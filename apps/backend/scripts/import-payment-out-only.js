// One-off: import Payment-Out transactions from a Vyapar backup's JSON dump, with the same
// FIFO allocation logic as import-payment-in-only.js — just against Purchase invoices and a
// negative (payable) Party.openingBalance instead of Sale/receivable. Confirmed against the
// client's own live Payment-Out screen (every party in that list — MUJEEB BOOKER, EASY PAISA
// SHOP, salesmen, SHAN COMPANY — is Vyapar type 4; this is NOT split with Expense the way it
// first looked from party names alone).
// Requires parties, items, and Purchase already imported.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
// Optional, for a multi-company tenant — see import-purchase-only.js for why.
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/import-payment-out-only.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

const CHUNK_SIZE = 500;
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const names = readJson('names.json');
  const transactions = readJson('transactions_payment_out.json');
  const partyOldIdToName = new Map(names.filter((n) => (n.full_name || '').trim()).map((n) => [n.name_id, n.full_name.trim()]));

  let companyId = COMPANY_ID;
  if (!companyId) {
    const company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: 'asc' } });
    companyId = company ? company.id : null;
  }

  const parties = await prisma.party.findMany({ where: { tenantId: TENANT_ID, companyId }, select: { id: true, name: true } });
  const partyIdByName = new Map(parties.map((p) => [p.name.trim().toLowerCase(), p.id]));

  const existingNumbers = new Set(
    (await prisma.transaction.findMany({ where: { tenantId: TENANT_ID, companyId, number: { startsWith: 'VY-' } }, select: { number: true } })).map((t) => t.number)
  );

  const cashflowEntries = [];
  let skipped = 0, alreadyImported = 0;
  for (const t of transactions) {
    const partyName = partyOldIdToName.get(t.txn_name_id);
    const partyId = partyName ? partyIdByName.get(partyName.toLowerCase()) : undefined;
    const date = t.txn_date ? new Date(t.txn_date) : null;
    const number = `VY-${t.txn_id}`;
    if (!partyId || !date || Number.isNaN(date.getTime())) { skipped++; continue; }
    if (existingNumbers.has(number)) { alreadyImported++; continue; }
    cashflowEntries.push({ partyId, date, amount: t.txn_cash_amount || 0, number });
  }

  // FIFO debts: oldest outstanding Purchase invoices per party, then a negative (payable)
  // opening balance. Parties with no Purchase invoices (most of them here — Mujeeb Booker,
  // salesmen, EasyPaisa) simply have no debts to apply against, so their payment lands with
  // balance == total, matching the "Unused" status the real app already shows for them.
  const partyIds = [...new Set(cashflowEntries.map((e) => e.partyId))];
  const partiesInfo = await prisma.party.findMany({ where: { id: { in: partyIds } }, select: { id: true, openingBalance: true, createdAt: true } });
  const partyInfoById = new Map(partiesInfo.map((p) => [p.id, p]));
  const outstandingInvoices = await prisma.transaction.findMany({
    where: { tenantId: TENANT_ID, partyId: { in: partyIds }, type: 'purchase', balance: { gt: 0 } },
    orderBy: { date: 'asc' },
    select: { id: true, partyId: true, balance: true, date: true },
  });
  const debtsByParty = new Map();
  for (const partyId of partyIds) {
    const invoices = outstandingInvoices.filter((i) => i.partyId === partyId).map((i) => ({ kind: 'invoice', invoiceId: i.id, balance: i.balance, date: i.date }));
    const info = partyInfoById.get(partyId);
    if (info && info.openingBalance < 0) invoices.push({ kind: 'opening', balance: -info.openingBalance, date: info.createdAt });
    invoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    debtsByParty.set(partyId, invoices);
  }

  cashflowEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const paymentRows = [];
  const allocationRows = [];
  const invoiceDecrements = new Map();
  const openingIncrements = new Map();

  for (const e of cashflowEntries) {
    if (!(e.amount > 0)) { skipped++; continue; }
    let remaining = e.amount;
    const paymentTxnId = randomUUID();
    const debts = debtsByParty.get(e.partyId) || [];
    for (const debt of debts) {
      if (remaining <= 0) break;
      const applied = Math.min(remaining, debt.balance);
      if (applied <= 0) continue;
      debt.balance -= applied;
      if (debt.kind === 'invoice') {
        allocationRows.push({ tenantId: TENANT_ID, paymentTxnId, invoiceTxnId: debt.invoiceId, amount: applied });
        invoiceDecrements.set(debt.invoiceId, (invoiceDecrements.get(debt.invoiceId) || 0) + applied);
      } else {
        openingIncrements.set(e.partyId, (openingIncrements.get(e.partyId) || 0) + applied);
      }
      remaining -= applied;
    }
    paymentRows.push({
      id: paymentTxnId, tenantId: TENANT_ID, partyId: e.partyId, type: 'payment_out', number: e.number, date: e.date,
      total: e.amount, balance: remaining, notes: JSON.stringify({ paymentType: 'Cash', receiptNo: e.number }), companyId,
    });
  }

  for (let i = 0; i < paymentRows.length; i += CHUNK_SIZE) await prisma.transaction.createMany({ data: paymentRows.slice(i, i + CHUNK_SIZE) });
  for (let i = 0; i < allocationRows.length; i += CHUNK_SIZE) await prisma.paymentAllocation.createMany({ data: allocationRows.slice(i, i + CHUNK_SIZE) });

  const invoiceIdList = [...invoiceDecrements.keys()];
  const CONC = 25;
  for (let i = 0; i < invoiceIdList.length; i += CONC) {
    await Promise.all(invoiceIdList.slice(i, i + CONC).map((id) => prisma.transaction.update({ where: { id }, data: { balance: { decrement: invoiceDecrements.get(id) } } })));
  }
  const openingPartyIdList = [...openingIncrements.keys()];
  for (let i = 0; i < openingPartyIdList.length; i += CONC) {
    await Promise.all(openingPartyIdList.slice(i, i + CONC).map((id) => prisma.party.update({ where: { id }, data: { openingBalance: { increment: openingIncrements.get(id) } } })));
  }

  console.log(`Payment-Out: ${paymentRows.length} created, ${alreadyImported} already imported, ${skipped} skipped`);
  console.log(`Allocations: ${allocationRows.length}, invoices touched: ${invoiceIdList.length}, parties w/ payable opening balance applied: ${openingPartyIdList.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

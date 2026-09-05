// One-off: import only Payment-In transactions from a Vyapar backup's JSON dump, with the
// same FIFO allocation logic as import-vyapar-backup.js (oldest outstanding Sale invoice
// first, then any positive/receivable Party.openingBalance) — computed entirely in memory
// first, then applied as a handful of bulk writes (one $transaction per payment exhausted the
// Railway proxy's connection pool once payment counts got into the thousands).
// Requires parties, items, and Sale already imported.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
// Optional, for a multi-company tenant — see import-purchase-only.js for why. Also confines
// FIFO allocation to this company's own Sale invoices (via the company-scoped party list
// feeding partyIds below), not some other company's invoices for a same-named party.
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/import-payment-in-only.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

const CHUNK_SIZE = 500;
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const names = readJson('names.json');
  const transactions = readJson('transactions_payment_in.json');
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

  // ---- Build cashflow entries, skipping already-imported and unmatched rows.
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

  // ---- FIFO debts: oldest outstanding Sale invoices per party, then a positive (receivable)
  // opening balance, oldest possible debt = party.createdAt.
  const partyIds = [...new Set(cashflowEntries.map((e) => e.partyId))];
  const partiesInfo = await prisma.party.findMany({ where: { id: { in: partyIds } }, select: { id: true, openingBalance: true, createdAt: true } });
  const partyInfoById = new Map(partiesInfo.map((p) => [p.id, p]));
  const outstandingInvoices = await prisma.transaction.findMany({
    where: { tenantId: TENANT_ID, partyId: { in: partyIds }, type: 'sale', balance: { gt: 0 } },
    orderBy: { date: 'asc' },
    select: { id: true, partyId: true, balance: true, date: true },
  });
  const debtsByParty = new Map();
  for (const partyId of partyIds) {
    const invoices = outstandingInvoices.filter((i) => i.partyId === partyId).map((i) => ({ kind: 'invoice', invoiceId: i.id, balance: i.balance, date: i.date }));
    const info = partyInfoById.get(partyId);
    if (info && info.openingBalance > 0) invoices.push({ kind: 'opening', balance: info.openingBalance, date: info.createdAt });
    invoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    debtsByParty.set(partyId, invoices);
  }

  // ---- Walk payments in original date order, allocating FIFO.
  cashflowEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const paymentRows = [];
  const allocationRows = [];
  const invoiceDecrements = new Map();
  const openingDecrements = new Map();

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
        openingDecrements.set(e.partyId, (openingDecrements.get(e.partyId) || 0) + applied);
      }
      remaining -= applied;
    }
    paymentRows.push({
      id: paymentTxnId, tenantId: TENANT_ID, partyId: e.partyId, type: 'payment_in', number: e.number, date: e.date,
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
  const openingPartyIdList = [...openingDecrements.keys()];
  for (let i = 0; i < openingPartyIdList.length; i += CONC) {
    await Promise.all(openingPartyIdList.slice(i, i + CONC).map((id) => prisma.party.update({ where: { id }, data: { openingBalance: { decrement: openingDecrements.get(id) } } })));
  }

  console.log(`Payment-In: ${paymentRows.length} created, ${alreadyImported} already imported, ${skipped} skipped`);
  console.log(`Allocations: ${allocationRows.length}, invoices touched: ${invoiceIdList.length}, parties w/ opening balance applied: ${openingPartyIdList.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// One-off correction for the Safal Traders (Shan Foods) import: 325 Vyapar type-4 transactions
// tied to party "SHAN COMPANY" (their actual supplier, ₨149.8M total) were imported as generic
// 'expense' — they're really Payment-Out against the 'purchase' invoices from that same
// supplier. This mirrors BulkImportService.processCashFlow's Payment-In -> Sale FIFO logic,
// just on the purchase side (Payment-Out -> oldest outstanding Purchase, then any negative/
// payable Party.openingBalance).
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
const PARTY_NAME = process.argv[4] || 'SHAN COMPANY';
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/fix-safal-purchase-payments.js <tenantId> <jsonDumpDir> [partyName]');
  process.exit(1);
}

const CHUNK_SIZE = 500;

async function main() {
  const payments = JSON.parse(fs.readFileSync(path.join(JSON_DIR, 'shan_company_payments.json'), 'utf8'));

  const party = await prisma.party.findFirst({ where: { tenantId: TENANT_ID, name: PARTY_NAME } });
  if (!party) throw new Error(`Party "${PARTY_NAME}" not found`);
  const company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID } });

  // ---- 1. Delete the wrongly-typed expense rows for this party.
  const numbers = payments.map((p) => `VY-${p.txn_id}`);
  const del = await prisma.transaction.deleteMany({ where: { tenantId: TENANT_ID, partyId: party.id, type: 'expense', number: { in: numbers } } });
  console.log(`Deleted ${del.count} wrongly-typed expense txns for ${PARTY_NAME}`);

  // ---- 2. FIFO debts: oldest outstanding Purchase invoices for this party, then a negative
  // (payable) opening balance, oldest possible debt = party.createdAt (same convention as
  // the Payment-In side, just for the payable direction).
  const outstanding = await prisma.transaction.findMany({
    where: { tenantId: TENANT_ID, partyId: party.id, type: 'purchase', balance: { gt: 0 } },
    orderBy: { date: 'asc' },
    select: { id: true, balance: true, date: true },
  });
  const debts = outstanding.map((inv) => ({ kind: 'invoice', invoiceId: inv.id, balance: inv.balance, date: inv.date }));
  if (party.openingBalance < 0) debts.push({ kind: 'opening', balance: -party.openingBalance, date: party.createdAt });
  debts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // ---- 3. Walk payments in original date order, allocating FIFO.
  payments.sort((a, b) => new Date(a.txn_date).getTime() - new Date(b.txn_date).getTime());
  const paymentRows = [];
  const allocationRows = [];
  const invoiceDecrements = new Map();
  let openingIncrement = 0;

  for (const p of payments) {
    const amount = p.txn_cash_amount || 0;
    if (!(amount > 0)) continue;
    let remaining = amount;
    const paymentTxnId = randomUUID();
    for (const debt of debts) {
      if (remaining <= 0) break;
      const applied = Math.min(remaining, debt.balance);
      if (applied <= 0) continue;
      debt.balance -= applied;
      if (debt.kind === 'invoice') {
        allocationRows.push({ tenantId: TENANT_ID, paymentTxnId, invoiceTxnId: debt.invoiceId, amount: applied });
        invoiceDecrements.set(debt.invoiceId, (invoiceDecrements.get(debt.invoiceId) || 0) + applied);
      } else {
        openingIncrement += applied;
      }
      remaining -= applied;
    }
    paymentRows.push({
      id: paymentTxnId,
      tenantId: TENANT_ID,
      partyId: party.id,
      type: 'payment_out',
      number: `VY-${p.txn_id}`,
      date: new Date(p.txn_date),
      total: amount,
      balance: remaining,
      notes: JSON.stringify({ paymentType: 'Cash', receiptNo: `VY-${p.txn_id}` }),
      companyId: company.id,
    });
  }

  for (let i = 0; i < paymentRows.length; i += CHUNK_SIZE) await prisma.transaction.createMany({ data: paymentRows.slice(i, i + CHUNK_SIZE) });
  for (let i = 0; i < allocationRows.length; i += CHUNK_SIZE) await prisma.paymentAllocation.createMany({ data: allocationRows.slice(i, i + CHUNK_SIZE) });

  const invoiceIdList = [...invoiceDecrements.keys()];
  const CONC = 25;
  for (let i = 0; i < invoiceIdList.length; i += CONC) {
    await Promise.all(invoiceIdList.slice(i, i + CONC).map((id) => prisma.transaction.update({ where: { id }, data: { balance: { decrement: invoiceDecrements.get(id) } } })));
  }
  if (openingIncrement > 0) {
    await prisma.party.update({ where: { id: party.id }, data: { openingBalance: { increment: openingIncrement } } });
  }

  console.log(`Payment-Out (corrected): ${paymentRows.length}, allocations: ${allocationRows.length}, invoices touched: ${invoiceIdList.length}, payable opening balance reduced by: ${openingIncrement}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

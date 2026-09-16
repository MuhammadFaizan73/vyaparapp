// One-off: reclassify already-imported 'expense' transactions to 'payment_out' when their
// party also has 'purchase' transactions in the same company — see the namesWithPurchases
// comment in import-vyapar-backup.js for the full reasoning (found via Safal Traders: this
// business records supplier payments through Vyapar's Expense screen, not Payment-Out, so
// the app's Payable calculation — which only nets Payment-Out against Purchase — never saw
// them and showed suppliers as still owing the full purchase amount).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const [, , TENANT_ID, COMPANY_ID] = process.argv;
if (!TENANT_ID || !COMPANY_ID) {
  console.error('Usage: node scripts/reclassify-supplier-expenses.js <tenantId> <companyId>');
  process.exit(1);
}

async function main() {
  const purchasePartyIds = new Set(
    (await prisma.transaction.findMany({
      where: { tenantId: TENANT_ID, companyId: COMPANY_ID, type: 'purchase' },
      select: { partyId: true },
      distinct: ['partyId'],
    })).map((t) => t.partyId),
  );

  const expenseTxns = await prisma.transaction.findMany({
    where: { tenantId: TENANT_ID, companyId: COMPANY_ID, type: 'expense', partyId: { in: [...purchasePartyIds] } },
    select: { id: true, partyId: true, total: true },
  });

  if (!expenseTxns.length) {
    console.log('No expense transactions found against a party that also has purchases — nothing to do.');
    return;
  }

  const byParty = new Map();
  for (const t of expenseTxns) {
    const arr = byParty.get(t.partyId) || [];
    arr.push(t);
    byParty.set(t.partyId, arr);
  }

  // balance = total on every existing payment_out row (this app never auto-allocates
  // Payment-Out — see import-vyapar-backup.js) — match that convention exactly rather than
  // introduce a differently-shaped payment_out row.
  let totalReclassified = 0, totalAmount = 0;
  for (const [, txns] of byParty) {
    for (const t of txns) {
      await prisma.transaction.update({ where: { id: t.id }, data: { type: 'payment_out', balance: t.total } });
    }
    totalReclassified += txns.length;
    totalAmount += txns.reduce((s, t) => s + t.total, 0);
  }

  console.log(`Reclassified ${totalReclassified} expense transactions (Rs ${totalAmount.toFixed(2)}) across ${byParty.size} supplier(s) to payment_out.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

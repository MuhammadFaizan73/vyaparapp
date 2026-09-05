// One-off: seed a small local test tenant with enough data to open Expenses/Cash In Hand
// meaningfully, for reproducing the Settings-navigation freeze bug locally (not on production).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
if (!TENANT_ID) {
  console.error('Usage: node scripts/seed-repro-tenant.js <tenantId>');
  process.exit(1);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
  if (!tenant) throw new Error('No such tenant');

  let company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID } });
  if (!company) {
    company = await prisma.company.create({
      data: { tenantId: TENANT_ID, name: 'Repro Test Co' },
    });
  }

  let store = await prisma.store.findFirst({ where: { tenantId: TENANT_ID, companyId: company.id } });
  if (!store) {
    store = await prisma.store.create({
      data: { tenantId: TENANT_ID, companyId: company.id, name: 'Main Store', isMain: true, storeType: 'Store' },
    });
  }

  const placeholder = await prisma.party.findFirst({ where: { tenantId: TENANT_ID, name: 'Business Expenses' } })
    ?? await prisma.party.create({ data: { tenantId: TENANT_ID, name: 'Business Expenses' } });

  const systemParty = await prisma.party.findFirst({ where: { tenantId: TENANT_ID, isSystem: true } })
    ?? await prisma.party.create({ data: { tenantId: TENANT_ID, name: 'System', isSystem: true } });

  // Match Safal Traders' real production scale (966 expense, 40 cash_in) to test whether
  // the Settings-navigation freeze is volume-dependent rather than a pure lifecycle bug.
  const categories = ['shortage', 'loader expense', 'Petrol', 'stationary', 'lunch', 'Electricity Bill', 'Rent', 'salary'];
  const TARGET_EXPENSE = 966;
  const TARGET_CASHIN = 40;
  const existingExpense = await prisma.transaction.count({ where: { tenantId: TENANT_ID, type: 'expense' } });
  const existingCashIn = await prisma.transaction.count({ where: { tenantId: TENANT_ID, type: 'cash_in' } });
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  const expenseRows = [];
  for (let i = existingExpense; i < TARGET_EXPENSE; i++) {
    const d = new Date(startDate.getTime() + i * 8 * 60 * 60 * 1000);
    expenseRows.push({
      tenantId: TENANT_ID,
      partyId: placeholder.id,
      type: 'expense',
      number: `RP-EXP-${i + 1}`,
      date: d,
      total: 500 + (i % 20) * 250,
      balance: 0,
      notes: JSON.stringify({ category: categories[i % categories.length], paymentType: 'Cash', items: [] }),
      companyId: company.id,
    });
  }
  const CHUNK = 500;
  for (let i = 0; i < expenseRows.length; i += CHUNK) {
    await prisma.transaction.createMany({ data: expenseRows.slice(i, i + CHUNK) });
  }

  const cashInRows = [];
  for (let i = existingCashIn; i < TARGET_CASHIN; i++) {
    const d = new Date(startDate.getTime() + i * 9 * 24 * 60 * 60 * 1000);
    cashInRows.push({
      tenantId: TENANT_ID,
      partyId: systemParty.id,
      type: 'cash_in',
      number: `RP-CASHIN-${i + 1}`,
      date: d,
      total: 5000 + (i % 8) * 2500,
      balance: 0,
      notes: JSON.stringify({ description: 'Other income seed', paymentType: 'Cash' }),
      companyId: company.id,
    });
  }
  if (cashInRows.length) await prisma.transaction.createMany({ data: cashInRows });

  console.log('Seeded company', company.id, 'store', store.id, 'new expenses', expenseRows.length, 'new cash_in', cashInRows.length);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

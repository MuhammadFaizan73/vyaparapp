// One-off: import Vyapar's kb_cash_adjustments "opening" row, which our original import
// never touched. Mirrors CashBankService.adjustCash exactly (same shape/party/notes) so it
// behaves identically to a manual "Reduce Cash" adjustment made through the app itself.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const MODE = process.argv[3]; // "add" | "reduce"
const AMOUNT = Number(process.argv[4]);
const DATE = process.argv[5]; // YYYY-MM-DD
const DESCRIPTION = process.argv[6] || 'Opening cash balance (from Vyapar backup)';

if (!TENANT_ID || !MODE || !AMOUNT || !DATE) {
  console.error('Usage: node scripts/import-opening-cash-adjustment.js <tenantId> <add|reduce> <amount> <YYYY-MM-DD> [description]');
  process.exit(1);
}
if (MODE !== 'add' && MODE !== 'reduce') {
  console.error('mode must be "add" or "reduce"');
  process.exit(1);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
  if (!tenant) throw new Error('No such tenant');

  const company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: 'asc' } });

  let systemParty = await prisma.party.findFirst({ where: { tenantId: TENANT_ID, isSystem: true } });
  if (!systemParty) systemParty = await prisma.party.create({ data: { tenantId: TENANT_ID, name: 'System', isSystem: true } });

  const type = MODE === 'add' ? 'cash_in' : 'cash_out';
  const number = `VY-OPENING-CASH-${TENANT_ID.slice(0, 8)}`;
  const existing = await prisma.transaction.findFirst({ where: { tenantId: TENANT_ID, number } });
  if (existing) {
    console.log('Already imported:', JSON.stringify(existing));
    return;
  }

  const created = await prisma.transaction.create({
    data: {
      tenantId: TENANT_ID,
      partyId: systemParty.id,
      type,
      number,
      total: AMOUNT,
      balance: 0,
      date: new Date(`${DATE}T00:00:00`),
      notes: JSON.stringify({ description: DESCRIPTION, paymentType: 'Cash' }),
      companyId: company ? company.id : null,
    },
  });
  console.log('Created:', JSON.stringify(created));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// One-off: import Vyapar type-29 ("Claims"/"salary"/"extra incentives" — confirmed by the
// client as an "Other Income" category, not Expense or Payment-Out) as `cash_in` transactions,
// using the exact same shape as CashBankService.adjustCash — the app has no dedicated "Other
// Income" type, but cash_in already IS a generic income-with-description record that shows
// correctly in Cash In Hand's ledger and balance.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/import-other-income-only.js <tenantId> <jsonDumpDir>');
  process.exit(1);
}

const CHUNK_SIZE = 500;
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const names = readJson('names.json');
  const transactions = readJson('transactions_other_income.json');
  const partyOldIdToName = new Map(names.filter((n) => (n.full_name || '').trim()).map((n) => [n.name_id, n.full_name.trim()]));

  const company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: 'asc' } });
  const companyId = company ? company.id : null;

  // Same convention as CashBankService.getSystemParty: one shared "System" party per tenant.
  let systemParty = await prisma.party.findFirst({ where: { tenantId: TENANT_ID, isSystem: true } });
  if (!systemParty) systemParty = await prisma.party.create({ data: { tenantId: TENANT_ID, name: 'System', isSystem: true } });

  const existingNumbers = new Set(
    (await prisma.transaction.findMany({ where: { tenantId: TENANT_ID, number: { startsWith: 'VY-' } }, select: { number: true } })).map((t) => t.number)
  );

  let buf = [];
  let created = 0, skipped = 0, alreadyImported = 0;
  const flush = async () => {
    if (!buf.length) return;
    await prisma.transaction.createMany({ data: buf });
    created += buf.length;
    buf = [];
  };

  for (const t of transactions) {
    const date = t.txn_date ? new Date(t.txn_date) : null;
    const number = `VY-${t.txn_id}`;
    if (!date || Number.isNaN(date.getTime()) || !(t.txn_cash_amount > 0)) { skipped++; continue; }
    if (existingNumbers.has(number)) { alreadyImported++; continue; }
    const description = partyOldIdToName.get(t.txn_name_id) || 'Other Income';
    buf.push({
      tenantId: TENANT_ID,
      partyId: systemParty.id,
      type: 'cash_in',
      number,
      date,
      total: t.txn_cash_amount,
      balance: 0,
      notes: JSON.stringify({ description, paymentType: 'Cash' }),
      companyId,
    });
    if (buf.length >= CHUNK_SIZE) await flush();
  }
  await flush();

  console.log(`Other Income (cash_in): ${created} created, ${alreadyImported} already imported, ${skipped} skipped`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

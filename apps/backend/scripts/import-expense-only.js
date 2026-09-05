// One-off: import Vyapar type-7 (confirmed Expense — Petrol/SHORTAGE/stationary/loader/lunch,
// matching the client's live Expense report exactly) as Expense transactions. These carry no
// party at all, so route through a placeholder "Business Expenses" party (same convention
// bulk-import.service.ts uses), and their category comes from the line item's item name
// (a fake "item" encoding the category), not txn_description which is blank.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
// Optional, for a multi-company tenant — see import-purchase-only.js for why.
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/import-expense-only.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

const CHUNK_SIZE = 500;
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const items = readJson('items.json');
  const transactions = readJson('transactions_expense.json');
  const lineitems = readJson('lineitems.json');
  const itemNameById = new Map(items.map((it) => [it.item_id, (it.item_name || '').trim()]));

  const lineitemsByTxn = new Map();
  for (const li of lineitems) {
    const name = itemNameById.get(li.item_id);
    if (!name) continue;
    const arr = lineitemsByTxn.get(li.lineitem_txn_id) || [];
    arr.push(name);
    lineitemsByTxn.set(li.lineitem_txn_id, arr);
  }

  let companyId = COMPANY_ID;
  if (!companyId) {
    const company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: 'asc' } });
    companyId = company ? company.id : null;
  }

  let placeholder = await prisma.party.findFirst({ where: { tenantId: TENANT_ID, companyId, name: 'Business Expenses' } });
  if (!placeholder) placeholder = await prisma.party.create({ data: { tenantId: TENANT_ID, companyId, name: 'Business Expenses' } });

  const existingNumbers = new Set(
    (await prisma.transaction.findMany({ where: { tenantId: TENANT_ID, companyId, number: { startsWith: 'VY-' } }, select: { number: true } })).map((t) => t.number)
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
    if (!date || Number.isNaN(date.getTime())) { skipped++; continue; }
    if (existingNumbers.has(number)) { alreadyImported++; continue; }
    const category = t.txn_description || (lineitemsByTxn.get(t.txn_id) || [])[0] || 'Expense';
    buf.push({
      tenantId: TENANT_ID,
      partyId: placeholder.id,
      type: 'expense',
      number,
      date,
      total: t.txn_cash_amount || 0,
      balance: 0,
      notes: JSON.stringify({ category, paymentType: 'Cash', items: [] }),
      companyId,
    });
    if (buf.length >= CHUNK_SIZE) await flush();
  }
  await flush();

  console.log(`Expense: ${created} created, ${alreadyImported} already imported, ${skipped} skipped`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

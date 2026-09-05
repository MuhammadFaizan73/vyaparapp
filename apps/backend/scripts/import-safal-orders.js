// One-off: import Vyapar type-21 records for Safal Traders. Unlike every other type code seen
// so far, this one splits into two real document types via txn_sub_type, confirmed against the
// client's own Vyapar Credit Note report (ref 182, "UBAID GENEREL STORE", 01-Sep-2026,
// Rs 2,475 — an exact match on txn_id 38927, sub_type 0):
//   sub_type 0 (73 rows, ref range 3-182)  -> credit_note (Sale Return)
//   sub_type 1 (107 rows, ref range 1-180) -> sale_order
// Requires parties and items already imported.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
// Optional, for a multi-company tenant — see import-purchase-only.js for why.
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/import-safal-orders.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

const CHUNK_SIZE = 500;
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const names = readJson('names.json');
  const items = readJson('items.json');
  const units = readJson('units.json');
  const transactions = readJson('transactions_type21.json'); // dumped separately, includes txn_sub_type
  const lineitems = readJson('lineitems.json');

  const unitById = new Map(units.map((u) => [u.unit_id, u.unit_short_name || u.unit_name]));
  const itemById = new Map(items.map((it) => [it.item_id, { name: (it.item_name || '').trim(), unit: unitById.get(it.base_unit_id) || null }]));
  const partyOldIdToName = new Map(names.filter((n) => (n.full_name || '').trim()).map((n) => [n.name_id, n.full_name.trim()]));

  let companyId = COMPANY_ID;
  if (!companyId) {
    const company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: 'asc' } });
    companyId = company ? company.id : null;
  }

  const parties = await prisma.party.findMany({ where: { tenantId: TENANT_ID, companyId }, select: { id: true, name: true } });
  const partyIdByName = new Map(parties.map((p) => [p.name.trim().toLowerCase(), p.id]));

  const lineitemsByTxn = new Map();
  for (const li of lineitems) {
    const item = itemById.get(li.item_id);
    if (!item) continue;
    const arr = lineitemsByTxn.get(li.lineitem_txn_id) || [];
    arr.push({ name: item.name, qty: li.quantity, unit: unitById.get(li.lineitem_unit_id) || item.unit, rate: li.priceperunit });
    lineitemsByTxn.set(li.lineitem_txn_id, arr);
  }

  const existingNumbers = new Set(
    (await prisma.transaction.findMany({ where: { tenantId: TENANT_ID, companyId, number: { startsWith: 'VY-' } }, select: { number: true } })).map((t) => t.number)
  );

  let buf = [];
  const counts = { credit_note: 0, sale_order: 0, skipped: 0, alreadyImported: 0 };
  const flush = async () => {
    if (!buf.length) return;
    await prisma.transaction.createMany({ data: buf });
    buf = [];
  };

  for (const t of transactions) {
    const partyName = partyOldIdToName.get(t.txn_name_id);
    const partyId = partyName ? partyIdByName.get(partyName.toLowerCase()) : undefined;
    const date = t.txn_date ? new Date(t.txn_date) : null;
    if (!partyId || !date || Number.isNaN(date.getTime())) { counts.skipped++; continue; }
    const number = `VY-${t.txn_id}`;
    if (existingNumbers.has(number)) { counts.alreadyImported++; continue; }

    // Confirmed by the client: ALL type-21 rows are Credit Notes regardless of txn_sub_type
    // (an earlier sub_type-based credit_note/sale_order split was wrong and later corrected).
    const type = 'credit_note';
    const lineItems = lineitemsByTxn.get(t.txn_id) || [];
    buf.push({
      tenantId: TENANT_ID,
      partyId,
      type,
      number,
      date,
      total: (t.txn_cash_amount || 0) + (t.txn_balance_amount || 0),
      balance: t.txn_balance_amount || 0,
      notes: JSON.stringify(lineItems),
      companyId,
    });
    counts[type]++;
    if (buf.length >= CHUNK_SIZE) await flush();
  }
  await flush();

  console.log(`Credit Note: ${counts.credit_note}, Sale Order: ${counts.sale_order}, already imported: ${counts.alreadyImported}, skipped: ${counts.skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// One-off: import only Purchase transactions (Vyapar type 2 for Safal Traders — see
// type-map.json) from a backup's JSON dump. Requires parties and items already imported
// (import-parties-only.js / import-items-only.js). No Payment-Out/FIFO here — that's a
// separate step once payments are imported.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
// Optional, for a multi-company tenant: scopes the party lookup (so a name shared with
// another company's party isn't cross-linked) AND the already-imported check to this
// company alone — two *different* backups (one per company) both number their own
// transactions VY-1, VY-2, ... from scratch, so a tenant-wide check would wrongly treat
// company B's VY-1 as "already imported" once company A's VY-1 exists.
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/import-purchase-only.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

const CHUNK_SIZE = 500;
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const names = readJson('names.json');
  const items = readJson('items.json');
  const units = readJson('units.json');
  const transactions = readJson('transactions.json');
  const lineitems = readJson('lineitems.json');
  const typeMap = readJson('type-map.json');
  const purchaseTypeCodes = Object.entries(typeMap).filter(([, m]) => m.bucket === 'purchase' && m.label === 'purchase').map(([code]) => Number(code));
  console.log('Vyapar type codes treated as Purchase:', purchaseTypeCodes);

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
  let created = 0, skipped = 0, alreadyImported = 0;
  const flush = async () => {
    if (!buf.length) return;
    await prisma.transaction.createMany({ data: buf });
    created += buf.length;
    buf = [];
  };

  for (const t of transactions) {
    if (!purchaseTypeCodes.includes(t.txn_type)) continue;
    const partyName = partyOldIdToName.get(t.txn_name_id);
    const partyId = partyName ? partyIdByName.get(partyName.toLowerCase()) : undefined;
    const date = t.txn_date ? new Date(t.txn_date) : null;
    if (!partyId || !date || Number.isNaN(date.getTime())) { skipped++; continue; }
    const number = `VY-${t.txn_id}`;
    if (existingNumbers.has(number)) { alreadyImported++; continue; }

    const lineItems = lineitemsByTxn.get(t.txn_id) || [];
    buf.push({
      tenantId: TENANT_ID,
      partyId,
      type: 'purchase',
      number,
      date,
      total: (t.txn_cash_amount || 0) + (t.txn_balance_amount || 0),
      balance: t.txn_balance_amount || 0,
      notes: JSON.stringify(lineItems),
      companyId,
    });
    if (buf.length >= CHUNK_SIZE) await flush();
  }
  await flush();

  console.log(`Purchase: ${created} created, ${alreadyImported} already imported, ${skipped} skipped (no party/date match)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

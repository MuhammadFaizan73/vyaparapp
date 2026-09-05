// One-off: reports.service.ts's computeStockMap() treats Item.openingStock as a day-1
// baseline and forward-simulates every Purchase/Sale/Credit-Note/Debit-Note line item on
// top of it to arrive at "current stock" (the normal, live-entered-data case: a tenant sets
// openingStock once, then every transaction naturally adjusts it going forward). Our import
// instead set openingStock to Vyapar's CURRENT stock quantity (item_stock_quantity) — so this
// same forward simulation double-applies every already-imported movement on top of a number
// that already reflects them, driving Stock Value badly negative.
// Fix: back-solve openingStock so forward-simulating the transactions we already imported
// lands exactly back on the real current quantity, same pattern as fix-party-balances-from-kbnames.js.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
// Optional, for a multi-company tenant — mirrors reports.service.ts's own computeStockMap(),
// which scopes its transaction scan by companyId when one is given; without this, an item
// name shared across two companies' catalogs would net-movement using the wrong company's
// transactions too.
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/fix-item-opening-stock.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }
function parseItems(notes) {
  if (!notes) return [];
  try {
    const p = JSON.parse(notes);
    if (Array.isArray(p)) return p;
    return Array.isArray(p?.items) ? p.items : [];
  } catch { return []; }
}

async function main() {
  const currentStock = readJson('items_current_stock.json');
  const currentQtyByName = new Map(currentStock.map((i) => [(i.item_name || '').trim().toLowerCase(), i.item_stock_quantity || 0]));

  const companyFilter = COMPANY_ID ? { companyId: COMPANY_ID } : {};
  const items = await prisma.item.findMany({ where: { tenantId: TENANT_ID, ...companyFilter }, select: { id: true, name: true, openingStock: true } });

  const txns = await prisma.transaction.findMany({
    where: { tenantId: TENANT_ID, ...companyFilter, type: { in: ['purchase', 'sale', 'credit_note', 'debit_note'] } },
    select: { type: true, notes: true },
  });

  // NOT unit-converted: confirmed (by hand, against kb_lineitems) that Vyapar's own export
  // already expresses every line item's quantity in the item's tracked/base unit, regardless
  // of which unit label ended up on it — e.g. a "1 Jar" sale line item on a Carton-tracked
  // item (1 Carton = 24 Jar) is stored as quantity 0.041667 (=1/24), not 1. Re-dividing by
  // conversionRate here would double-convert it.
  const netMovementByName = new Map();
  for (const t of txns) {
    for (const li of parseItems(t.notes)) {
      const key = (li.name || '').trim().toLowerCase();
      if (!key) continue;
      const qty = li.qty ?? 0;
      const delta = (t.type === 'purchase' || t.type === 'credit_note') ? qty : -qty;
      netMovementByName.set(key, (netMovementByName.get(key) || 0) + delta);
    }
  }

  let updated = 0, unchanged = 0, noMatch = 0;
  const updates = [];
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    const targetCurrentQty = currentQtyByName.get(key);
    if (targetCurrentQty === undefined) { noMatch++; continue; }
    const netMovement = netMovementByName.get(key) || 0;
    const requiredOpening = targetCurrentQty - netMovement;
    if (Math.abs(requiredOpening - item.openingStock) < 0.001) { unchanged++; continue; }
    updates.push({ id: item.id, openingStock: requiredOpening });
    updated++;
  }

  console.log(`Items: ${items.length} total, ${updated} to update, ${unchanged} already correct, ${noMatch} no backup match (skipped)`);

  const CONCURRENCY = 25;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    await Promise.all(updates.slice(i, i + CONCURRENCY).map((u) =>
      prisma.item.update({ where: { id: u.id }, data: { openingStock: u.openingStock } })
    ));
  }
  console.log(`Updated ${updates.length} items' openingStock.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

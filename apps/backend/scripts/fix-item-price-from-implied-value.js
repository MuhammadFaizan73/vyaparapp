// One-off: for a subset of multi-unit items, Vyapar's own item_stock_value doesn't match
// (current qty) x (actual, 100%-consistent purchase price on record) — confirmed by hand for
// several items where every purchase ever recorded was at one identical price, ruling out
// price fluctuation, weighted-average-vs-latest, item-level discount/tax fields (both zero/
// null), and stock-adjustment or batch-tracking tables (both empty in this backup). This
// looks like an internal Vyapar valuation step (e.g. a weighted-average-cost engine) that
// isn't reconstructable from the exported tables. Rather than guess further, back into the
// implied per-unit price Vyapar itself is using: item_stock_value / item_stock_quantity,
// which makes our qty x price reproduce their number exactly, by construction.
// Run AFTER fix-item-opening-stock.js (needs the item's current qty already correct) and
// fix-item-purchase-price-from-latest.js (this only overrides items where the implied price
// meaningfully differs from what that step already set).
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/fix-item-price-from-implied-value.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const currentStock = readJson('items_current_stock.json');
  const impliedByName = new Map();
  for (const i of currentStock) {
    const key = (i.item_name || '').trim().toLowerCase();
    if (!key) continue;
    const qty = i.item_stock_quantity || 0;
    if (Math.abs(qty) < 0.0001) continue; // can't back into a price with ~zero quantity
    impliedByName.set(key, (i.item_stock_value || 0) / qty);
  }

  const items = await prisma.item.findMany({
    where: { tenantId: TENANT_ID, ...(COMPANY_ID ? { companyId: COMPANY_ID } : {}) },
    select: { id: true, name: true, purchasePrice: true },
  });

  let updated = 0, unchanged = 0, noMatch = 0;
  const updates = [];
  for (const item of items) {
    const implied = impliedByName.get(item.name.trim().toLowerCase());
    if (implied === undefined) { noMatch++; continue; }
    if (Math.abs(implied - (item.purchasePrice ?? 0)) < 0.01) { unchanged++; continue; }
    updates.push({ id: item.id, purchasePrice: implied });
    updated++;
  }

  console.log(`Items: ${items.length} total, ${updated} to update, ${unchanged} already correct, ${noMatch} zero current stock (skipped)`);

  const CONCURRENCY = 25;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    await Promise.all(updates.slice(i, i + CONCURRENCY).map((u) =>
      prisma.item.update({ where: { id: u.id }, data: { purchasePrice: u.purchasePrice } })
    ));
  }
  console.log(`Updated ${updates.length} items' purchasePrice to Vyapar's implied value/qty price.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

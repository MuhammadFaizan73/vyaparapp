// One-off: bootstrap-item-stock.js seeds ItemStock.quantity from Item.openingStock — correct
// for a genuinely new company with no history (StoresService.ensureBootstrapped's own
// convention), but WRONG after a bulk historical import: fix-item-opening-stock.js has already
// back-solved Item.openingStock to a DAY-1 baseline (so reports.service.ts's computeStockMap()
// can forward-simulate every imported transaction on top of it and land on the real current
// qty). The Items list screen doesn't use that dynamic simulation though — items.service.ts
// reads current stock straight from ItemStock (stock.service.ts's getStocksForItems()), a static
// running counter that real transaction create/update code paths adjust incrementally. A bulk
// import's createMany() transactions never touch it, so it's left sitting at whatever
// bootstrap-item-stock.js seeded — the day-1 baseline, not today's real quantity. This sets
// ItemStock.quantity (Main Store) to Vyapar's own current quantity directly, closing that gap.
// Run once, AFTER bootstrap-item-stock.js, for every company a full historical backup was
// imported into.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR || !COMPANY_ID) {
  console.error('Usage: node scripts/fix-item-stock-to-current.js <tenantId> <jsonDumpDir> <companyId>');
  process.exit(1);
}

function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const currentStock = readJson('items_current_stock.json');
  const currentQtyByName = new Map(currentStock.map((i) => [(i.item_name || '').trim().toLowerCase(), i.item_stock_quantity || 0]));

  const store = await prisma.store.findFirst({ where: { tenantId: TENANT_ID, companyId: COMPANY_ID, isMain: true } });
  if (!store) throw new Error('No Main Store for this company — run bootstrap-item-stock.js first');

  const items = await prisma.item.findMany({ where: { tenantId: TENANT_ID, companyId: COMPANY_ID }, select: { id: true, name: true } });
  const stocks = await prisma.itemStock.findMany({ where: { tenantId: TENANT_ID, storeId: store.id }, select: { id: true, itemId: true, quantity: true } });
  const stockByItemId = new Map(stocks.map((s) => [s.itemId, s]));

  let updated = 0, unchanged = 0, noMatch = 0;
  const updates = [];
  for (const item of items) {
    const target = currentQtyByName.get(item.name.trim().toLowerCase());
    if (target === undefined) { noMatch++; continue; }
    const stock = stockByItemId.get(item.id);
    if (!stock) { noMatch++; continue; }
    if (Math.abs(stock.quantity - target) < 0.001) { unchanged++; continue; }
    updates.push({ id: stock.id, quantity: target });
    updated++;
  }

  console.log(`ItemStock rows: ${items.length} items, ${updated} to update, ${unchanged} already correct, ${noMatch} no backup match (skipped)`);

  const CONCURRENCY = 25;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    await Promise.all(updates.slice(i, i + CONCURRENCY).map((u) =>
      prisma.itemStock.update({ where: { id: u.id }, data: { quantity: u.quantity } })
    ));
  }
  console.log(`Updated ${updates.length} ItemStock rows to Vyapar's current quantity.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

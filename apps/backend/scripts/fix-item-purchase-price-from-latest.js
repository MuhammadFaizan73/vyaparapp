// One-off: Item.purchasePrice was imported from kb_items.item_purchase_unit_price (a manually
// maintained "master" field) but Vyapar's own stock valuation (item_stock_value) clearly uses
// each item's most recent ACTUAL purchase line-item price instead — confirmed by comparing
// specific items where the two differ (e.g. "SHOOP CHATPATA 31.5GM": master price 27.45 vs its
// last 5 purchase line items all at 26.3403284672). Set purchasePrice to the latest purchase's
// priceperunit for every item that has at least one Purchase line item, closing that gap.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
// Optional, for a multi-company tenant: without this, an item name shared with a different
// company's own catalog would get its purchasePrice overwritten from THIS dump's price data.
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/fix-item-purchase-price-from-latest.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const items = readJson('items.json');
  const transactions = readJson('transactions.json');
  const lineitems = readJson('lineitems.json');

  const itemNameById = new Map(items.map((it) => [it.item_id, (it.item_name || '').trim()]));
  const purchaseTxnDateById = new Map(
    transactions.filter((t) => t.txn_type === 2).map((t) => [t.txn_id, t.txn_date])
  );

  // Latest (by txn_date) priceperunit per item name, from Purchase line items only.
  const latestByName = new Map(); // name -> { date, price }
  for (const li of lineitems) {
    const date = purchaseTxnDateById.get(li.lineitem_txn_id);
    if (!date) continue; // not a purchase line item
    const name = itemNameById.get(li.item_id);
    if (!name) continue;
    const existing = latestByName.get(name);
    if (!existing || new Date(date) > new Date(existing.date)) {
      latestByName.set(name, { date, price: li.priceperunit });
    }
  }

  const dbItems = await prisma.item.findMany({ where: { tenantId: TENANT_ID, ...(COMPANY_ID ? { companyId: COMPANY_ID } : {}) }, select: { id: true, name: true, purchasePrice: true } });

  let updated = 0, unchanged = 0, noPurchase = 0;
  const updates = [];
  for (const item of dbItems) {
    const latest = latestByName.get(item.name);
    if (!latest) { noPurchase++; continue; }
    if (Math.abs((latest.price ?? 0) - (item.purchasePrice ?? 0)) < 0.001) { unchanged++; continue; }
    updates.push({ id: item.id, purchasePrice: latest.price });
    updated++;
  }

  console.log(`Items: ${dbItems.length} total, ${updated} to update, ${unchanged} already correct, ${noPurchase} never purchased (skipped)`);

  const CONCURRENCY = 25;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    await Promise.all(updates.slice(i, i + CONCURRENCY).map((u) =>
      prisma.item.update({ where: { id: u.id }, data: { purchasePrice: u.purchasePrice } })
    ));
  }
  console.log(`Updated ${updates.length} items' purchasePrice.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// One-off: import only Items (catalog) from a Vyapar backup's JSON dump — no parties, no
// transactions. Same field mapping as import-vyapar-backup.js's Items step. Attaches to the
// tenant's existing Company if one exists.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
// Optional: scopes both which company new items are tagged with AND the dedupe check to
// that company alone — see import-parties-only.js for why (Company-Based Filtering).
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/import-items-only.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

const CHUNK_SIZE = 500;
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const items = readJson('items.json');
  const units = readJson('units.json');
  const unitById = new Map(units.map((u) => [u.unit_id, u.unit_short_name || u.unit_name]));

  let companyId = COMPANY_ID;
  if (!companyId) {
    const company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: 'asc' } });
    companyId = company ? company.id : null;
  }

  const existingItems = await prisma.item.findMany({ where: { tenantId: TENANT_ID, companyId }, select: { name: true } });
  const existingNames = new Set(existingItems.map((i) => i.name.trim().toLowerCase()));

  const seen = new Set();
  const newItems = [];
  for (const it of items) {
    const name = (it.item_name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (existingNames.has(key) || seen.has(key)) continue;
    seen.add(key);
    newItems.push({
      tenantId: TENANT_ID,
      companyId,
      name,
      sku: it.item_code || null,
      unit: unitById.get(it.base_unit_id) || null,
      secondaryUnit: unitById.get(it.secondary_unit_id) || null,
      salePrice: it.item_sale_unit_price ?? null,
      purchasePrice: it.item_purchase_unit_price ?? null,
      mrp: it.item_mrp ?? null,
      openingStock: it.item_stock_quantity ?? 0,
      minStock: it.item_min_stock_quantity ?? 0,
      itemLocation: it.item_location || null,
    });
  }
  for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
    await prisma.item.createMany({ data: newItems.slice(i, i + CHUNK_SIZE) });
  }
  console.log(`Items: ${newItems.length} created, ${items.length - newItems.length} skipped (blank name or already existed)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

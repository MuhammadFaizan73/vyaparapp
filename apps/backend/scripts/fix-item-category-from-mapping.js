// One-off: neither import-vyapar-backup.js nor import-items-only.js ever read Vyapar's
// category data (kb_items.category_id is always the default/uncategorized value — the real
// per-item category lives in the separate kb_item_categories_mapping many-to-many table,
// discovered only after a client reported categories missing post-import). Some items map to
// more than one Vyapar category; since our own Item.category is a single string (matching
// the existing category dropdown/filter UI), this takes the first mapped category per item
// (lowest category_id) rather than attempting to represent all of them.
// Needs dump/item_categories.json: `SELECT i.item_name, c.item_category_name FROM kb_items i
// JOIN (SELECT item_id, MIN(category_id) AS category_id FROM kb_item_categories_mapping
// GROUP BY item_id) m ON m.item_id = i.item_id JOIN kb_item_categories c ON c.item_category_id
// = m.category_id WHERE i.item_name IS NOT NULL AND i.item_name <> '';`
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/fix-item-category-from-mapping.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const rows = readJson('item_categories.json');
  const categoryByName = new Map(rows.map((r) => [(r.item_name || '').trim().toLowerCase(), r.item_category_name]));

  const items = await prisma.item.findMany({
    where: { tenantId: TENANT_ID, ...(COMPANY_ID ? { companyId: COMPANY_ID } : {}) },
    select: { id: true, name: true, category: true },
  });

  let updated = 0, unchanged = 0, noMatch = 0;
  const updates = [];
  for (const item of items) {
    const category = categoryByName.get(item.name.trim().toLowerCase());
    if (!category) { noMatch++; continue; }
    if (item.category === category) { unchanged++; continue; }
    updates.push({ id: item.id, category });
    updated++;
  }

  console.log(`Items: ${items.length} total, ${updated} to update, ${unchanged} already correct, ${noMatch} no category in backup (left as-is)`);

  const CONCURRENCY = 25;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    await Promise.all(updates.slice(i, i + CONCURRENCY).map((u) =>
      prisma.item.update({ where: { id: u.id }, data: { category: u.category } })
    ));
  }
  console.log(`Updated ${updates.length} items' category.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

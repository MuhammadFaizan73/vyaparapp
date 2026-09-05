// One-off: our import never captured kb_item_units_mapping.conversion_rate — only the
// secondaryUnit *name*, never the numeric rate — so reports.service.ts's buildUnitConverter
// (which needs Item.conversionRate to do anything beyond passing quantity straight through)
// silently treated every Purchase/Sale line item as 1-for-1 regardless of which unit it was
// actually recorded in. For a catalog sold "by the box, bought by the piece" (or vice versa),
// this is a real, not niche, error: confirmed 69 of Spencer's 72 items use multi-unit
// tracking. Sets Item.conversionRate to match Vyapar's own mapping exactly — same field
// semantics ("1 unit = conversionRate secondaryUnit"), no transformation needed.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/fix-item-conversion-rate.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const rows = readJson('items_conversion_rate.json');
  const rateByName = new Map();
  for (const r of rows) {
    const key = (r.item_name || '').trim().toLowerCase();
    if (!key) continue;
    rateByName.set(key, r.conversion_rate);
  }

  const items = await prisma.item.findMany({
    where: { tenantId: TENANT_ID, ...(COMPANY_ID ? { companyId: COMPANY_ID } : {}) },
    select: { id: true, name: true, conversionRate: true },
  });

  let updated = 0, unchanged = 0, noMatch = 0;
  const updates = [];
  for (const item of items) {
    const rate = rateByName.get(item.name.trim().toLowerCase());
    if (rate === undefined) { noMatch++; continue; }
    const rateStr = String(rate);
    if (item.conversionRate === rateStr) { unchanged++; continue; }
    updates.push({ id: item.id, conversionRate: rateStr });
    updated++;
  }

  console.log(`Items: ${items.length} total, ${updated} to update, ${unchanged} already correct, ${noMatch} no multi-unit mapping (skipped)`);

  const CONCURRENCY = 25;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    await Promise.all(updates.slice(i, i + CONCURRENCY).map((u) =>
      prisma.item.update({ where: { id: u.id }, data: { conversionRate: u.conversionRate } })
    ));
  }
  console.log(`Updated ${updates.length} items' conversionRate.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

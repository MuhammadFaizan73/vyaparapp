// One-off: backfill Item.conversionRate for items whose secondaryUnit was imported but
// conversionRate wasn't (import-vyapar-backup.js didn't read items_conversion_rate.json
// until this was found missing for Spencer's Carton->Box items).
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

const [, , TENANT_ID, COMPANY_ID, JSON_DIR] = process.argv;
if (!TENANT_ID || !COMPANY_ID || !JSON_DIR) {
  console.error('Usage: node scripts/backfill-conversion-rate.js <tenantId> <companyId> <jsonDumpDir>');
  process.exit(1);
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(path.join(JSON_DIR, 'items_conversion_rate.json'), 'utf8'));
  const rateByName = new Map(rows.map((r) => [(r.item_name || '').trim().toLowerCase(), String(r.conversion_rate)]));

  const items = await prisma.item.findMany({ where: { tenantId: TENANT_ID, companyId: COMPANY_ID }, select: { id: true, name: true, conversionRate: true } });

  let updated = 0, missing = 0;
  for (const item of items) {
    const rate = rateByName.get(item.name.trim().toLowerCase());
    if (!rate) continue;
    if (item.conversionRate === rate) continue;
    await prisma.item.update({ where: { id: item.id }, data: { conversionRate: rate } });
    updated++;
  }
  console.log(`Updated ${updated} items with a conversionRate. ${rateByName.size - updated} name(s) in the dump had no matching item.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

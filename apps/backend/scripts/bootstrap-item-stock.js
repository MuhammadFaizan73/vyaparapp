// One-off: imported items only ever got Item.openingStock filled in (a static historical seed
// value, by design never live-decremented — see the Store model's schema comment). The app's
// "current stock" always reads from ItemStock instead (stock.service.ts's getStocksForItems), so
// every bulk-imported item showed 0 stock until a real Store + ItemStock rows exist. This
// replicates StoresService.ensureBootstrapped's exact convention (Main Store, isMain: true,
// storeType: "Store", ItemStock seeded from each item's openingStock) instead of going through
// the live NestJS app.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
if (!TENANT_ID) {
  console.error('Usage: node scripts/bootstrap-item-stock.js <tenantId>');
  process.exit(1);
}

async function main() {
  const companies = await prisma.company.findMany({ where: { tenantId: TENANT_ID }, select: { id: true, name: true } });

  for (const company of companies) {
    let store = await prisma.store.findFirst({ where: { tenantId: TENANT_ID, companyId: company.id, isMain: true } });
    if (!store) {
      store = await prisma.store.create({
        data: { tenantId: TENANT_ID, companyId: company.id, name: 'Main Store', storeType: 'Store', isMain: true },
      });
      console.log(`Created Main Store for "${company.name}"`);
    }
    // Cover both cases: a brand-new store (no ItemStock rows yet) and a store that already
    // existed (e.g. auto-bootstrapped by the live app before this script ever ran) but whose
    // ItemStock rows never caught up with items a bulk import added afterward.
    const items = await prisma.item.findMany({ where: { tenantId: TENANT_ID, companyId: company.id }, select: { id: true, openingStock: true } });
    const existing = await prisma.itemStock.findMany({ where: { tenantId: TENANT_ID, storeId: store.id }, select: { itemId: true } });
    const covered = new Set(existing.map((e) => e.itemId));
    const missing = items.filter((i) => !covered.has(i.id));
    if (missing.length > 0) {
      await prisma.itemStock.createMany({
        data: missing.map((i) => ({ tenantId: TENANT_ID, itemId: i.id, storeId: store.id, quantity: i.openingStock ?? 0 })),
      });
    }
    console.log(`"${company.name}": ${missing.length} new item stock rows created, ${covered.size} already had one`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

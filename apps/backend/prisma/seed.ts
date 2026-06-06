import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const DEMO_KEYS = [
  { key: "VYPR-DESK-2026-A1B2", platform: "desktop" },
  { key: "VYPR-DESK-2026-C3D4", platform: "desktop" },
  { key: "VYPR-DESK-2026-E5F6", platform: "desktop" },
  { key: "VYPR-MOBI-2026-G7H8", platform: "mobile" },
  { key: "VYPR-MOBI-2026-J9K0", platform: "mobile" },
  { key: "VYPR-MOBI-2026-L1M2", platform: "mobile" },
];

const DEMO_ITEMS = [
  { name: "Infinix NOte 50", sku: "a100", unit: "Pcs", salePrice: 40000, purchasePrice: 35000, openingStock: 12 },
  { name: "Item 1",           sku: "a101", unit: "Pcs", salePrice: 20,    purchasePrice: 15,    openingStock: 50 },
  { name: "Item 2",           sku: "a102", unit: "Kg",  salePrice: 30,    purchasePrice: 22,    openingStock: 30 },
  { name: "Item 3",           sku: "a103", unit: "Pcs", salePrice: 35,    purchasePrice: 28,    openingStock: 100 },
  { name: "Item 4",           sku: "a104", unit: "Box", salePrice: 20,    purchasePrice: 14,    openingStock: 25 },
  { name: "Item 5",           sku: "a105", unit: "L",   salePrice: 55,    purchasePrice: 40,    openingStock: 60 },
  { name: "Samsung Galaxy A35", sku: "a106", unit: "Pcs", salePrice: 52000, purchasePrice: 46000, openingStock: 8 },
  { name: "USB-C Cable",      sku: "a107", unit: "Pcs", salePrice: 350,   purchasePrice: 200,   openingStock: 200 },
];

async function main() {
  const oneYear = new Date();
  oneYear.setFullYear(oneYear.getFullYear() + 1);

  // Seed default superadmin
  const adminEmail = "admin@vyapar.pk";
  const existing = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash("Admin@1234", 10);
    await prisma.adminUser.create({
      data: { name: "Super Admin", email: adminEmail, passwordHash, role: "superadmin" },
    });
    console.log(`\nSuper Admin created: ${adminEmail} / Admin@1234`);
    console.log("  IMPORTANT: Change this password after first login!\n");
  }

  // Upsert license keys
  for (const { key, platform } of DEMO_KEYS) {
    await prisma.license.upsert({
      where: { key },
      update: {},
      create: { key, plan: "pro", platform, expiresAt: oneYear },
    });
  }

  // Seed demo items for every registered tenant that has none
  const tenants = await prisma.tenant.findMany({ select: { id: true, phone: true } });
  for (const tenant of tenants) {
    const existing = await prisma.item.count({ where: { tenantId: tenant.id } });
    if (existing > 0) continue;

    for (const item of DEMO_ITEMS) {
      await prisma.item.create({
        data: {
          tenantId: tenant.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          salePrice: item.salePrice,
          purchasePrice: item.purchasePrice,
          openingStock: item.openingStock,
          mrp: item.salePrice,
        },
      });
    }
    console.log(`  Seeded ${DEMO_ITEMS.length} items for tenant ${tenant.phone}`);
  }

  console.log("\nReady-to-use demo keys:");
  console.log("  Desktop:", DEMO_KEYS.filter(k => k.platform === "desktop").map(k => k.key).join(", "));
  console.log("  Mobile: ", DEMO_KEYS.filter(k => k.platform === "mobile").map(k => k.key).join(", "));
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_KEYS = [
  { key: "DESK-VYPR-2026-0001", platform: "desktop" },
  { key: "DESK-VYPR-2026-0002", platform: "desktop" },
  { key: "DESK-VYPR-2026-0003", platform: "desktop" },
  { key: "MOBI-VYPR-2026-0001", platform: "mobile" },
  { key: "MOBI-VYPR-2026-0002", platform: "mobile" },
  { key: "MOBI-VYPR-2026-0003", platform: "mobile" },
];

async function main() {
  const oneYear = new Date();
  oneYear.setFullYear(oneYear.getFullYear() + 1);

  for (const { key, platform } of DEMO_KEYS) {
    await prisma.license.upsert({
      where: { key },
      update: {},
      create: { key, plan: "pro", platform, expiresAt: oneYear },
    });
  }

  console.log("\nReady-to-use demo keys:");
  console.log("  Desktop:", DEMO_KEYS.filter(k => k.platform === "desktop").map(k => k.key).join(", "));
  console.log("  Mobile: ", DEMO_KEYS.filter(k => k.platform === "mobile").map(k => k.key).join(", "));
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

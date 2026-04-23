import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function makeKey(): string {
  const chunks = Array.from({ length: 4 }, () =>
    randomBytes(2).toString("hex").toUpperCase(),
  );
  return chunks.join("-");
}

async function main() {
  const oneYear = new Date();
  oneYear.setFullYear(oneYear.getFullYear() + 1);

  const demoKeys = ["DEMO-VYPR-2026-0001", "DEMO-VYPR-2026-0002", "DEMO-VYPR-2026-0003"];

  for (const key of demoKeys) {
    await prisma.license.upsert({
      where: { key },
      update: {},
      create: { key, plan: "pro", expiresAt: oneYear },
    });
  }

  for (let i = 0; i < 5; i++) {
    const key = makeKey();
    await prisma.license.create({
      data: { key, plan: "pro", expiresAt: oneYear },
    });
    console.log("Generated license:", key);
  }

  console.log("\nReady-to-use demo keys:");
  demoKeys.forEach((k) => console.log("  ", k));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// One-off: create (or reset the password of) the superadmin AdminUser, for when
// production has none yet or nobody knows the current password. Mirrors
// prisma/seed.ts's own superadmin-seeding logic exactly, just runnable standalone
// against whichever DATABASE_URL is in the environment (e.g. via `railway run`).
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
if (!EMAIL || !PASSWORD) {
  console.error('Usage: node scripts/reset-superadmin.js <email> <password>');
  process.exit(1);
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const existing = await prisma.adminUser.findUnique({ where: { email: EMAIL } });
  if (existing) {
    await prisma.adminUser.update({ where: { email: EMAIL }, data: { passwordHash, role: 'superadmin', isActive: true } });
    console.log(`Password reset for existing admin: ${EMAIL}`);
  } else {
    await prisma.adminUser.create({
      data: { name: 'Super Admin', email: EMAIL, passwordHash, role: 'superadmin' },
    });
    console.log(`Superadmin created: ${EMAIL}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

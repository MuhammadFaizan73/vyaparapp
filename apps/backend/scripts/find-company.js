// One-off lookup: find a Company by a case-insensitive name fragment, printing its id,
// tenantId, and tenant's phone — used to locate IDs before running a scoped script
// (wipe-company-data.js, import-vyapar-backup.js) that needs them as arguments.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const QUERY = process.argv[2];
if (!QUERY) {
  console.error('Usage: node scripts/find-company.js <name-fragment>');
  process.exit(1);
}

async function main() {
  const companies = await prisma.company.findMany({
    where: { name: { contains: QUERY, mode: 'insensitive' } },
    include: { tenant: { select: { phone: true, id: true } } },
  });
  if (!companies.length) {
    console.log('No company found matching:', QUERY);
    return;
  }
  for (const c of companies) {
    console.log(`Company "${c.name}" id=${c.id} tenantId=${c.tenantId} tenantPhone=${c.tenant.phone}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

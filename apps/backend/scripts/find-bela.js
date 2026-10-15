// One-off lookup: find a Distributor by name fragment and list every Company under it
// (via its Branches) — used to locate the right companyId before a scoped import/wipe.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dists = await prisma.distributor.findMany({ where: { name: { contains: 'bela', mode: 'insensitive' } } });
  if (!dists.length) { console.log('No distributor matching "bela"'); return; }
  for (const d of dists) {
    console.log(`Distributor "${d.name}" id=${d.id} tenantId=${d.tenantId}`);
    const branches = await prisma.branch.findMany({ where: { distributorId: d.id } });
    for (const b of branches) {
      console.log(`  Branch "${b.name}" id=${b.id}`);
      const companies = await prisma.company.findMany({ where: { branchId: b.id } });
      for (const c of companies) console.log(`    Company "${c.name}" id=${c.id}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

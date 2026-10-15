// One-off: create a pass-through Branch "Main" under the existing "Bela" Distributor
// (which has zero branches/companies so far), then create the new Company
// "G.M.G TRADERS BELA" under that branch — the target for this backup's import.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DISTRIBUTOR_NAME = 'Bela';
const COMPANY_NAME = 'G.M.G TRADERS BELA';

async function main() {
  const distributor = await prisma.distributor.findFirst({ where: { name: DISTRIBUTOR_NAME } });
  if (!distributor) { console.error(`Distributor "${DISTRIBUTOR_NAME}" not found`); process.exit(1); }
  console.log(`Distributor "${distributor.name}" (${distributor.id}), tenant ${distributor.tenantId}`);

  const existingBranches = await prisma.branch.findMany({ where: { distributorId: distributor.id } });
  let branch = existingBranches[0];
  if (!branch) {
    branch = await prisma.branch.create({ data: { tenantId: distributor.tenantId, distributorId: distributor.id, name: 'Main' } });
    console.log(`Created Branch "${branch.name}" (${branch.id})`);
  } else {
    console.log(`Using existing Branch "${branch.name}" (${branch.id})`);
  }

  const existingCompany = await prisma.company.findFirst({ where: { tenantId: distributor.tenantId, name: COMPANY_NAME } });
  if (existingCompany) {
    console.log(`Company "${COMPANY_NAME}" already exists (${existingCompany.id}) — not creating a duplicate.`);
    console.log(`tenantId=${distributor.tenantId} companyId=${existingCompany.id}`);
    return;
  }

  const company = await prisma.company.create({
    data: { tenantId: distributor.tenantId, branchId: branch.id, name: COMPANY_NAME, phone: '03342424222' },
  });
  console.log(`Created Company "${company.name}" (${company.id})`);
  console.log(`tenantId=${distributor.tenantId} companyId=${company.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

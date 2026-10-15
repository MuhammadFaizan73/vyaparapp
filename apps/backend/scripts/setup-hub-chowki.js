// One-off: create Distributor "Hub Chowki" + a pass-through Branch "Main", then move the
// tenant's 3 existing companies (Shan Foods, Spencer, Danpak — currently sitting directly
// under the Tenant with no Distributor/Branch) under it. Purely a Company.branchId update —
// Parties/Items/Transactions/Stores are keyed by companyId, which never changes, so no
// business data moves or is touched.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = 'f61fec54-2fdd-45bd-8b43-22d98170e19d';
const COMPANY_NAMES = ['Safal Traders (Shan Foods)', 'Spencer', 'Danpak'];

async function main() {
  const companies = await prisma.company.findMany({ where: { tenantId: TENANT_ID, name: { in: COMPANY_NAMES } } });
  console.log('Found companies:', companies.map((c) => `${c.name} (branchId=${c.branchId ?? 'null'})`).join(', '));
  if (companies.length !== COMPANY_NAMES.length) {
    console.error('Expected 3 companies, found', companies.length, '- aborting, nothing changed.');
    process.exit(1);
  }

  const distributor = await prisma.distributor.create({
    data: { tenantId: TENANT_ID, name: 'Hub Chowki' },
  });
  console.log('Created Distributor:', distributor.name, distributor.id);

  const branch = await prisma.branch.create({
    data: { tenantId: TENANT_ID, distributorId: distributor.id, name: 'Main' },
  });
  console.log('Created Branch:', branch.name, branch.id);

  for (const c of companies) {
    await prisma.company.update({ where: { id: c.id }, data: { branchId: branch.id } });
    console.log(`  ${c.name} -> branchId set to ${branch.id}`);
  }
  console.log('Done. No parties/items/transactions/stores were touched.');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

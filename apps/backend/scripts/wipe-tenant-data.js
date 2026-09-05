// One-off: wipe all business data for a tenant, keep the Tenant row (account/license/login intact).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PHONE = process.argv[2];
if (!PHONE) {
  console.error('Usage: node scripts/wipe-tenant-data.js <phone>');
  process.exit(1);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { phone: PHONE } });
  if (!tenant) {
    console.error(`No tenant found with phone ${PHONE}`);
    process.exit(1);
  }
  const tenantId = tenant.id;
  console.log(`Wiping business data for tenant ${tenantId} (${PHONE})`);

  const counts = {};
  counts.transactionHistory = (await prisma.transactionHistory.deleteMany({ where: { tenantId } })).count;
  counts.paymentAllocation = (await prisma.paymentAllocation.deleteMany({ where: { tenantId } })).count;
  counts.transaction = (await prisma.transaction.deleteMany({ where: { tenantId } })).count;
  counts.stockTransferLine = (await prisma.stockTransferLine.deleteMany({ where: { transfer: { tenantId } } })).count;
  counts.stockTransfer = (await prisma.stockTransfer.deleteMany({ where: { tenantId } })).count;
  counts.itemStock = (await prisma.itemStock.deleteMany({ where: { tenantId } })).count;
  counts.locationPing = (await prisma.locationPing.deleteMany({ where: { tenantId } })).count;
  counts.shopVisit = (await prisma.shopVisit.deleteMany({ where: { tenantId } })).count;
  counts.partyAssignment = (await prisma.partyAssignment.deleteMany({ where: { tenantId } })).count;
  counts.item = (await prisma.item.deleteMany({ where: { tenantId } })).count;
  counts.party = (await prisma.party.deleteMany({ where: { tenantId } })).count;
  counts.partyGroup = (await prisma.partyGroup.deleteMany({ where: { tenantId } })).count;
  counts.teamMember = (await prisma.teamMember.deleteMany({ where: { tenantId } })).count;
  counts.taxRate = (await prisma.taxRate.deleteMany({ where: { tenantId } })).count;
  counts.store = (await prisma.store.deleteMany({ where: { tenantId } })).count;
  counts.company = (await prisma.company.deleteMany({ where: { tenantId } })).count;
  counts.branch = (await prisma.branch.deleteMany({ where: { tenantId } })).count;
  counts.distributor = (await prisma.distributor.deleteMany({ where: { tenantId } })).count;
  counts.bankAccount = (await prisma.bankAccount.deleteMany({ where: { tenantId } })).count;
  counts.loanAccount = (await prisma.loanAccount.deleteMany({ where: { tenantId } })).count;

  console.log('Deleted rows:', counts);
  console.log('Tenant account, license, and device sessions left intact.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

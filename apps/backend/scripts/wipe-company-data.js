// One-off: wipe business data for ONE company under a multi-company tenant, leaving every
// other company (and the Tenant/Company/Store rows themselves) untouched. Unlike
// wipe-tenant-data.js (which wipes the whole tenant), this is for re-importing a fresh
// backup for a single company without disturbing its siblings' already-imported data.
// TeamMember/TaxRate/Branch/Distributor/BankAccount/LoanAccount are tenant-wide concepts in
// this schema, not company-scoped — deliberately left untouched here.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const COMPANY_ID = process.argv[3];
if (!TENANT_ID || !COMPANY_ID) {
  console.error('Usage: node scripts/wipe-company-data.js <tenantId> <companyId>');
  process.exit(1);
}

async function main() {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company || company.tenantId !== TENANT_ID) {
    console.error(`Company ${COMPANY_ID} not found under tenant ${TENANT_ID}`);
    process.exit(1);
  }
  console.log(`Wiping data for company "${company.name}" (${COMPANY_ID}), tenant ${TENANT_ID}`);

  const counts = {};

  // A big tenant's transaction id list can blow past Postgres's ~32k bind-variable limit
  // in one IN (...) — chunk every id-list delete instead of passing them all at once.
  const CHUNK = 5000;
  const txnIds = (await prisma.transaction.findMany({ where: { tenantId: TENANT_ID, companyId: COMPANY_ID }, select: { id: true } })).map((t) => t.id);

  counts.transactionHistory = 0;
  for (let i = 0; i < txnIds.length; i += CHUNK) {
    counts.transactionHistory += (await prisma.transactionHistory.deleteMany({
      where: { tenantId: TENANT_ID, transactionId: { in: txnIds.slice(i, i + CHUNK) } },
    })).count;
  }

  counts.paymentAllocation = 0;
  for (let i = 0; i < txnIds.length; i += CHUNK) {
    const slice = txnIds.slice(i, i + CHUNK);
    counts.paymentAllocation += (await prisma.paymentAllocation.deleteMany({
      where: { tenantId: TENANT_ID, OR: [{ paymentTxnId: { in: slice } }, { invoiceTxnId: { in: slice } }] },
    })).count;
  }

  counts.transaction = (await prisma.transaction.deleteMany({ where: { tenantId: TENANT_ID, companyId: COMPANY_ID } })).count;

  counts.stockTransferLine = (await prisma.stockTransferLine.deleteMany({ where: { transfer: { tenantId: TENANT_ID, companyId: COMPANY_ID } } })).count;
  counts.stockTransfer = (await prisma.stockTransfer.deleteMany({ where: { tenantId: TENANT_ID, companyId: COMPANY_ID } })).count;
  counts.itemStock = (await prisma.itemStock.deleteMany({ where: { tenantId: TENANT_ID, store: { companyId: COMPANY_ID } } })).count;
  counts.item = (await prisma.item.deleteMany({ where: { tenantId: TENANT_ID, companyId: COMPANY_ID } })).count;
  // Party/PartyAssignment/ShopVisit cascade per the schema's own onDelete rules.
  counts.party = (await prisma.party.deleteMany({ where: { tenantId: TENANT_ID, companyId: COMPANY_ID } })).count;
  counts.store = (await prisma.store.deleteMany({ where: { tenantId: TENANT_ID, companyId: COMPANY_ID } })).count;

  console.log('Deleted rows:', counts);
  console.log(`Company "${company.name}" row itself, and every other company's data, left intact.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

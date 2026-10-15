const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const companyId = process.argv[2];
  const tenantId = process.argv[3];
  console.log('items:', await prisma.item.count({ where: { tenantId, companyId } }));
  console.log('parties:', await prisma.party.count({ where: { tenantId, companyId } }));
  console.log('transactions:', await prisma.transaction.count({ where: { tenantId, companyId } }));
}
main().catch(e=>console.error('FAIL',e.message)).finally(()=>prisma.$disconnect());

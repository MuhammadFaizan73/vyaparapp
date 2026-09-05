// One-off correction: import-vyapar-backup.js originally mapped Vyapar txn_type 21 ->
// purchase_order and 28 -> sale_order. Party-name evidence (type 28's parties are almost all
// prefixed "Sp" = Supplier, confirmed on VY-98244 / "sp h mozamil Medical center...") showed
// this was backwards. Swaps the two based on the original txn_id lists dumped to JSON.
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const DIR = process.argv[3];
if (!TENANT_ID || !DIR) {
  console.error('Usage: node scripts/fix-order-types.js <tenantId> <jsonDumpDir>');
  process.exit(1);
}

async function main() {
  const toSaleOrder = JSON.parse(fs.readFileSync(`${DIR}/toSaleOrder.json`)).map((r) => `VY-${r.txn_id}`);
  const toPurchaseOrder = JSON.parse(fs.readFileSync(`${DIR}/toPurchaseOrder.json`)).map((r) => `VY-${r.txn_id}`);

  const r1 = await prisma.transaction.updateMany({
    where: { tenantId: TENANT_ID, number: { in: toSaleOrder }, type: 'purchase_order' },
    data: { type: 'sale_order' },
  });
  const r2 = await prisma.transaction.updateMany({
    where: { tenantId: TENANT_ID, number: { in: toPurchaseOrder }, type: 'sale_order' },
    data: { type: 'purchase_order' },
  });
  console.log('purchase_order -> sale_order (was Vyapar type 21):', r1.count, 'of', toSaleOrder.length);
  console.log('sale_order -> purchase_order (was Vyapar type 28):', r2.count, 'of', toPurchaseOrder.length);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

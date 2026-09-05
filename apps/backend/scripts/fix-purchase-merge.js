// One-off correction #2 on the same pair: fix-note-types.js moved Vyapar type 2 from
// credit_note to debit_note, assuming it was a Purchase Return. Client evidence (VY-98200 and
// VY-98251, both type 2, both confirmed by the client as plain Purchases, not returns) plus
// near-identical month-by-month volume between type 2 (1403 rows) and type 24/purchase (1525
// rows) throughout 2026 show type 2 is just a second bucket of ordinary Purchases, not a return
// type at all. The lone type 23 record's party name literally contains "return" ("Sp k adnan
// return..."), so it goes back to debit_note (Purchase Return) — reverting that half of the
// previous swap.
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const DIR = process.argv[3];
if (!TENANT_ID || !DIR) {
  console.error('Usage: node scripts/fix-purchase-merge.js <tenantId> <jsonDumpDir>');
  process.exit(1);
}

async function main() {
  const type2Ids = JSON.parse(fs.readFileSync(`${DIR}/toDebitNote.json`)).map((r) => `VY-${r.txn_id}`); // was type 2
  const type23Ids = JSON.parse(fs.readFileSync(`${DIR}/toCreditNote.json`)).map((r) => `VY-${r.txn_id}`); // was type 23

  const r1 = await prisma.transaction.updateMany({
    where: { tenantId: TENANT_ID, number: { in: type2Ids }, type: 'debit_note' },
    data: { type: 'purchase' },
  });
  const r2 = await prisma.transaction.updateMany({
    where: { tenantId: TENANT_ID, number: { in: type23Ids }, type: 'credit_note' },
    data: { type: 'debit_note' },
  });
  console.log('debit_note -> purchase (Vyapar type 2, was mistaken for a return):', r1.count, 'of', type2Ids.length);
  console.log('credit_note -> debit_note (Vyapar type 23, real Purchase Return):', r2.count, 'of', type23Ids.length);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

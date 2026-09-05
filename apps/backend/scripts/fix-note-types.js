// One-off correction: import-vyapar-backup.js mapped Vyapar txn_type 2 -> credit_note (sale
// return) and 23 -> debit_note (purchase return). Direct evidence (client compared VY-98251,
// party "Sp sakher lal new", against the real Vyapar app, which shows it as a Purchase-side
// record, not a sale return) plus the party overlap between type 2 and type 28/purchase_order's
// top trading partners show this was backwards, same mistake as the 21/28 swap. Swaps the two
// based on the original txn_id lists dumped to JSON.
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const DIR = process.argv[3];
if (!TENANT_ID || !DIR) {
  console.error('Usage: node scripts/fix-note-types.js <tenantId> <jsonDumpDir>');
  process.exit(1);
}

async function main() {
  const toDebitNote = JSON.parse(fs.readFileSync(`${DIR}/toDebitNote.json`)).map((r) => `VY-${r.txn_id}`);
  const toCreditNote = JSON.parse(fs.readFileSync(`${DIR}/toCreditNote.json`)).map((r) => `VY-${r.txn_id}`);

  const r1 = await prisma.transaction.updateMany({
    where: { tenantId: TENANT_ID, number: { in: toDebitNote }, type: 'credit_note' },
    data: { type: 'debit_note' },
  });
  const r2 = await prisma.transaction.updateMany({
    where: { tenantId: TENANT_ID, number: { in: toCreditNote }, type: 'debit_note' },
    data: { type: 'credit_note' },
  });
  console.log('credit_note -> debit_note (was Vyapar type 2):', r1.count, 'of', toDebitNote.length);
  console.log('debit_note -> credit_note (was Vyapar type 23):', r2.count, 'of', toCreditNote.length);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

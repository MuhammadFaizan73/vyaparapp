// One-off: import Bank Accounts from a Vyapar backup's JSON dump. Vyapar's own
// kb_bank_accounts table is unused/empty in every backup seen so far — real bank/wallet
// accounts (JazzCash, EasyPaisa, UBL, Faysal, Meezan, etc., plus staff-labeled cash drawers)
// live in kb_paymentTypes instead (paymentType_type = 'BANK'; 'CASH'/'CHEQUE' are the app's
// own built-ins, not real accounts, so they're excluded at dump time — see the SELECT in
// this repo's session notes: `... WHERE paymentType_type='BANK'`).
// Needs dump/bank_accounts.json: [{ name, opening_balance, opening_date }, ...].
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/import-bank-accounts.js <tenantId> <jsonDumpDir>');
  process.exit(1);
}

function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const banks = readJson('bank_accounts.json');

  const existing = await prisma.bankAccount.findMany({ where: { tenantId: TENANT_ID }, select: { name: true } });
  const existingNames = new Set(existing.map((b) => b.name.trim().toLowerCase()));

  let created = 0, skipped = 0;
  for (const b of banks) {
    const name = (b.name || '').trim();
    if (!name || existingNames.has(name.toLowerCase())) { skipped++; continue; }
    await prisma.bankAccount.create({
      data: {
        tenantId: TENANT_ID,
        name,
        openingBalance: b.opening_balance ?? 0,
        openingBalanceDate: b.opening_date ? new Date(b.opening_date) : new Date(),
      },
    });
    created++;
  }
  console.log(`Bank accounts: ${created} created, ${skipped} skipped (blank name or already existed)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

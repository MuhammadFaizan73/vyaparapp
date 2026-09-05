// One-off: Vyapar's own kb_names.amount is the authoritative, live-computed running
// balance per party (confirmed: summing it matches the real app's Total Receivable/Payable
// on the dashboard exactly, to the cent). Our own parties.service.ts derives balance from
// summing transactions instead, which diverges for parties whose money movements don't fit
// its assumptions (e.g. a party with heavy Payment-In but no Sale invoice to apply it against
// — that Payment-In has no effect on payable in our formula, but Vyapar's own ledger already
// accounts for it). Rather than rewrite that shared formula (used live by every tenant),
// back-solve each party's `openingBalance` so today's existing formula reproduces Vyapar's
// exact number: openingBalance = kb_names.amount - (receivable_from_txns - payable_from_txns
// computed with opening excluded).
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
// Optional, for a multi-company tenant: without this, a party name shared between two
// companies' own backups (a generic name, or the same real person dealing with both) would
// get matched and back-solved using the WRONG company's transaction totals.
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/fix-party-balances-from-kbnames.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const kbNames = readJson('kb_names_amounts.json');
  const amountByName = new Map();
  for (const n of kbNames) {
    const key = (n.full_name || '').trim().toLowerCase();
    if (!key) continue;
    amountByName.set(key, (amountByName.get(key) || 0) + (n.amount || 0));
  }

  const companyFilter = COMPANY_ID ? { companyId: COMPANY_ID } : {};
  const parties = await prisma.party.findMany({ where: { tenantId: TENANT_ID, ...companyFilter }, select: { id: true, name: true, openingBalance: true } });
  const aggregates = await prisma.transaction.groupBy({
    by: ['partyId', 'type'],
    where: { tenantId: TENANT_ID, ...companyFilter },
    _sum: { total: true, balance: true },
  });
  const byParty = new Map();
  for (const a of aggregates) {
    const arr = byParty.get(a.partyId) || [];
    arr.push({ type: a.type, total: a._sum.total ?? 0, balance: a._sum.balance ?? 0 });
    byParty.set(a.partyId, arr);
  }

  let updated = 0, unchanged = 0, noMatch = 0;
  const updates = [];
  for (const p of parties) {
    const target = amountByName.get(p.name.trim().toLowerCase());
    if (target === undefined) { noMatch++; continue; }

    let receivable = 0, purchaseTotal = 0, paymentOutTotal = 0;
    for (const t of byParty.get(p.id) || []) {
      if (t.type === 'sale') receivable += t.balance;
      else if (t.type === 'credit_note') receivable -= t.total; // matches the fixed parties.service.ts formula
      else if (t.type === 'purchase') purchaseTotal += t.total;
      else if (t.type === 'debit_note') purchaseTotal -= t.total;
      else if (t.type === 'payment_out') paymentOutTotal += t.total;
    }
    const payable = Math.max(0, purchaseTotal - paymentOutTotal);
    const B = receivable - payable;
    const requiredOpening = target - B;

    if (Math.abs(requiredOpening - p.openingBalance) < 0.01) { unchanged++; continue; }
    updates.push({ id: p.id, openingBalance: requiredOpening });
    updated++;
  }

  console.log(`Parties: ${parties.length} total, ${updated} to update, ${unchanged} already correct, ${noMatch} no kb_names match (skipped)`);

  const CONCURRENCY = 25;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    await Promise.all(updates.slice(i, i + CONCURRENCY).map((u) =>
      prisma.party.update({ where: { id: u.id }, data: { openingBalance: u.openingBalance } })
    ));
  }
  console.log(`Updated ${updates.length} parties' openingBalance.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

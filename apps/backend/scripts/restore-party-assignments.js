// One-off: restore PartyAssignment rows from a snapshot taken before a company wipe+reimport
// (see snapshot-party-assignments.js) — matches by party NAME (case-insensitive, trimmed)
// against the freshly-imported parties, since a reimport gives every party a brand new id.
// Unmatched snapshot rows (a customer renamed/removed in Vyapar between backups) are logged
// by name, not silently dropped.
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const COMPANY_ID = process.argv[3];
const SNAPSHOT_PATH = process.argv[4];
if (!TENANT_ID || !COMPANY_ID || !SNAPSHOT_PATH) {
  console.error('Usage: node scripts/restore-party-assignments.js <tenantId> <companyId> <snapshotPath>');
  process.exit(1);
}

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const parties = await prisma.party.findMany({ where: { tenantId: TENANT_ID, companyId: COMPANY_ID }, select: { id: true, name: true } });
  const partyIdByName = new Map(parties.map((p) => [p.name.trim().toLowerCase(), p.id]));

  let matched = 0;
  const unmatched = [];
  const rows = [];
  for (const a of snapshot) {
    const partyId = partyIdByName.get(a.partyName.trim().toLowerCase());
    if (!partyId) { unmatched.push(a.partyName); continue; }
    matched++;
    rows.push({ tenantId: TENANT_ID, memberId: a.memberId, partyId, visitDays: a.visitDays });
  }

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await prisma.partyAssignment.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
  }

  console.log(`Restored ${matched}/${snapshot.length} party assignments.`);
  if (unmatched.length) {
    console.log(`${unmatched.length} unmatched (party name not found in reimported data):`);
    const uniqueUnmatched = [...new Set(unmatched)];
    for (const name of uniqueUnmatched) console.log(`  - ${name}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

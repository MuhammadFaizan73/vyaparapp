// Pair for snapshot-party-assignments.js — run AFTER the wipe+reimport, once the new Party
// rows exist. Matches each snapshotted assignment back to a party by name (same lowercased-
// name convention import-vyapar-backup.js uses for its own dedup), so the same salesman ends
// up assigned to the same real-world shop even though its Party id changed.
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const [, , TENANT_ID, COMPANY_ID, IN_FILE] = process.argv;
if (!TENANT_ID || !COMPANY_ID || !IN_FILE) {
  console.error('Usage: node scripts/restore-party-assignments.js <tenantId> <companyId> <inFile>');
  process.exit(1);
}

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
  const parties = await prisma.party.findMany({ where: { tenantId: TENANT_ID, companyId: COMPANY_ID }, select: { id: true, name: true } });
  const partyIdByName = new Map(parties.map((p) => [p.name.trim().toLowerCase(), p.id]));

  let restored = 0;
  const missingNames = [];
  for (const a of snapshot) {
    const partyId = partyIdByName.get((a.partyName || '').trim().toLowerCase());
    if (!partyId) { missingNames.push(a.partyName); continue; }
    await prisma.partyAssignment.upsert({
      where: { partyId_memberId: { partyId, memberId: a.memberId } },
      update: { visitDays: a.visitDays },
      create: { tenantId: TENANT_ID, partyId, memberId: a.memberId, visitDays: a.visitDays },
    });
    restored++;
  }

  console.log(`Restored ${restored}/${snapshot.length} assignments for company ${COMPANY_ID}.`);
  if (missingNames.length) {
    console.log(`${missingNames.length} could not be matched (party name not found in the new import — likely renamed or dropped from the new backup):`);
    console.log([...new Set(missingNames)].join(', '));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// One-off: snapshot a company's salesman-to-party assignments by NAME (not id) before a
// wipe+reimport — the reimport creates fresh Party rows with new ids, so the old
// PartyAssignment rows (which reference the old ids) are gone regardless of whether this
// script touches them. Pair with restore-party-assignments.js after the reimport to
// re-create the same assignments against the newly imported parties.
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const [, , TENANT_ID, COMPANY_ID, OUT_FILE] = process.argv;
if (!TENANT_ID || !COMPANY_ID || !OUT_FILE) {
  console.error('Usage: node scripts/snapshot-party-assignments.js <tenantId> <companyId> <outFile>');
  process.exit(1);
}

async function main() {
  const assignments = await prisma.partyAssignment.findMany({
    where: { tenantId: TENANT_ID, party: { companyId: COMPANY_ID } },
    include: { party: { select: { name: true, phone: true } }, member: { select: { name: true } } },
  });
  const snapshot = assignments.map((a) => ({
    memberId: a.memberId,
    memberName: a.member.name,
    visitDays: a.visitDays,
    partyName: a.party.name,
    partyPhone: a.party.phone,
  }));
  fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshotted ${snapshot.length} party assignments for company ${COMPANY_ID} -> ${OUT_FILE}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

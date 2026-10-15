// One-off: snapshot every PartyAssignment for a company (memberId + party NAME, not party
// id, since a wipe+reimport gives every party a brand new id) so assignments can be
// restored by name-match after the reimport. Writes JSON to the given output path.
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const COMPANY_ID = process.argv[3];
const OUT_PATH = process.argv[4];
if (!TENANT_ID || !COMPANY_ID || !OUT_PATH) {
  console.error('Usage: node scripts/snapshot-party-assignments.js <tenantId> <companyId> <outPath>');
  process.exit(1);
}

async function main() {
  const assignments = await prisma.partyAssignment.findMany({
    where: { tenantId: TENANT_ID, party: { companyId: COMPANY_ID } },
    include: { party: { select: { name: true } }, member: { select: { name: true, role: true } } },
  });
  const rows = assignments.map((a) => ({
    memberId: a.memberId,
    memberName: a.member.name,
    memberRole: a.member.role,
    partyName: a.party.name,
    visitDays: a.visitDays,
  }));
  fs.writeFileSync(OUT_PATH, JSON.stringify(rows, null, 2));
  console.log(`Snapshotted ${rows.length} party assignments to ${OUT_PATH}`);
  const byMember = {};
  for (const r of rows) byMember[r.memberName] = (byMember[r.memberName] || 0) + 1;
  console.log('By member:', byMember);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

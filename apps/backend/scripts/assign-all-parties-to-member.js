// One-off: assign every party across ALL of a tenant's companies to one specific
// unrestricted (companyIds=null) salesman/biller_salesman TeamMember. The existing
// assign-parties-to-company-salesmen.js script deliberately skips unrestricted members
// (companyIds=null) since it can't tell which single company they're meant to work —
// this script is for the case where the answer is "all of them", confirmed explicitly
// per-member rather than inferred.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MEMBER_ID = process.argv[2];
if (!MEMBER_ID) {
  console.error('Usage: node scripts/assign-all-parties-to-member.js <memberId>');
  process.exit(1);
}

const ALL_DAYS = 'Mon,Tue,Wed,Thu,Fri,Sat,Sun';

async function main() {
  const member = await prisma.teamMember.findUnique({ where: { id: MEMBER_ID } });
  if (!member) { console.error('No TeamMember with that id.'); process.exit(1); }
  if (!['salesman', 'biller_salesman'].includes(member.role)) {
    console.error(`Refusing: role is "${member.role}", not salesman/biller_salesman.`);
    process.exit(1);
  }

  const parties = await prisma.party.findMany({ where: { tenantId: member.tenantId }, select: { id: true } });
  console.log(`Assigning ${parties.length} parties (all companies) to ${member.name} (${MEMBER_ID})`);

  const existing = await prisma.partyAssignment.findMany({ where: { memberId: MEMBER_ID }, select: { partyId: true } });
  const existingIds = new Set(existing.map((a) => a.partyId));
  const toCreate = parties.filter((p) => !existingIds.has(p.id)).map((p) => ({
    tenantId: member.tenantId, partyId: p.id, memberId: MEMBER_ID, visitDays: ALL_DAYS,
  }));

  if (toCreate.length) {
    const result = await prisma.partyAssignment.createMany({ data: toCreate });
    console.log(`Created ${result.count} new assignments, ${parties.length - toCreate.length} already existed.`);
  } else {
    console.log('All assignments already existed.');
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

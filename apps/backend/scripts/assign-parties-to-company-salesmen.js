// One-off (run after every bulk import): a salesman/biller_salesman role's mobile
// `useParties()` hook filters the party list down to ONLY parties with a PartyAssignment
// row for them (src/useParties.ts, apps/mobile) — a bulk import never creates those, so a
// salesman scoped to a freshly-imported company sees ZERO parties when adding an invoice,
// even though the parties themselves imported correctly. Confirmed on Safal Traders,
// Spencer ("Rakesh", role=salesman, companyIds=["<Spencer's id>"]).
//
// Assigns every party in the given company to every TeamMember whose role is salesman/
// biller_salesman AND whose companyIds explicitly includes this company — a member with
// companyIds=null (unrestricted) is intentionally NOT auto-assigned here, since we can't
// tell which company they're actually meant to work, and over-assigning would expose a
// possibly-unrelated salesman to this company's full party list.
//
// visitDays defaults to every day (no real visit-day data exists in a Vyapar backup) so
// nothing is invisible due to the mobile app's "today's parties" geo-fence filter.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const COMPANY_ID = process.argv[3];
if (!TENANT_ID || !COMPANY_ID) {
  console.error('Usage: node scripts/assign-parties-to-company-salesmen.js <tenantId> <companyId>');
  process.exit(1);
}

const ALL_DAYS = 'Mon,Tue,Wed,Thu,Fri,Sat,Sun';

async function main() {
  const members = await prisma.teamMember.findMany({
    where: { tenantId: TENANT_ID, role: { in: ['salesman', 'biller_salesman'] } },
    select: { id: true, name: true, companyIds: true },
  });
  const scopedMembers = members.filter((m) => {
    if (!m.companyIds) return false;
    try { return JSON.parse(m.companyIds).includes(COMPANY_ID); } catch { return false; }
  });
  if (!scopedMembers.length) {
    console.log('No salesman/biller_salesman scoped to this company — nothing to assign.');
    await prisma.$disconnect();
    return;
  }

  const parties = await prisma.party.findMany({ where: { companyId: COMPANY_ID }, select: { id: true } });
  console.log(`Assigning ${parties.length} parties to ${scopedMembers.length} salesman/salesmen: ${scopedMembers.map((m) => m.name).join(', ')}`);

  let created = 0, alreadyExisted = 0;
  for (const member of scopedMembers) {
    const existing = await prisma.partyAssignment.findMany({ where: { memberId: member.id }, select: { partyId: true } });
    const existingIds = new Set(existing.map((a) => a.partyId));
    const toCreate = parties.filter((p) => !existingIds.has(p.id)).map((p) => ({
      tenantId: TENANT_ID, partyId: p.id, memberId: member.id, visitDays: ALL_DAYS,
    }));
    alreadyExisted += parties.length - toCreate.length;
    if (toCreate.length) {
      const result = await prisma.partyAssignment.createMany({ data: toCreate });
      created += result.count;
    }
  }
  console.log(`Created ${created} new assignments, ${alreadyExisted} already existed.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

// One-off: import only Parties (customers/suppliers) from a Vyapar backup's JSON dump — no
// items, no transactions, no company touched. Same field mapping and opening-balance
// convention (positive = receivable, negative = payable) as import-vyapar-backup.js's Parties
// step.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
// Optional: for a multi-company tenant, scopes both which company new parties are tagged
// with AND the dedupe check to that company alone (a name that already exists under a
// *different* company in this tenant must still get its own row here — Company-Based
// Filtering means each company's parties are its own set, not shared/deduped tenant-wide).
// Omit for a single-company tenant, where the old tenant-wide behavior is equivalent.
const COMPANY_ID = process.argv[4];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/import-parties-only.js <tenantId> <jsonDumpDir> [companyId]');
  process.exit(1);
}

const CHUNK_SIZE = 500;
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const names = readJson('names.json');
  const openingReceivable = readJson('opening_receivable.json');
  const openingPayable = readJson('opening_payable.json');
  const receivableByOldId = new Map(openingReceivable.map((r) => [r.name_id, r.bal]));
  const payableByOldId = new Map(openingPayable.map((r) => [r.name_id, r.bal]));

  // Without this, parties import with companyId=null — invisible from the "select this
  // company" dashboard filter unless they happen to have a transaction tagged to that
  // company (parties.service.ts only falls back to include untagged parties tenant-wide).
  let companyId = COMPANY_ID;
  if (!companyId) {
    const company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: 'asc' } });
    companyId = company ? company.id : null;
  }

  const existingParties = await prisma.party.findMany({ where: { tenantId: TENANT_ID, companyId }, select: { name: true } });
  const existingNames = new Set(existingParties.map((p) => p.name.trim().toLowerCase()));

  const seen = new Set();
  const newParties = [];
  for (const n of names) {
    const name = (n.full_name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (existingNames.has(key) || seen.has(key)) continue;
    seen.add(key);
    const openingBalance = (receivableByOldId.get(n.name_id) || 0) - (payableByOldId.get(n.name_id) || 0);
    newParties.push({
      tenantId: TENANT_ID,
      name,
      phone: n.phone_number || null,
      email: n.email || null,
      billingAddress: n.address || null,
      shippingAddress: n.name_shipping_address || null,
      state: n.name_state || null,
      gstin: n.name_gstin_number || null,
      pincode: n.pincode || null,
      shippingPincode: n.name_shipping_pincode || null,
      creditLimit: n.credit_limit ?? null,
      openingBalance,
      companyId,
    });
  }
  for (let i = 0; i < newParties.length; i += CHUNK_SIZE) {
    await prisma.party.createMany({ data: newParties.slice(i, i + CHUNK_SIZE) });
  }
  console.log(`Parties: ${newParties.length} created, ${names.length - newParties.length} skipped (blank name or already existed)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

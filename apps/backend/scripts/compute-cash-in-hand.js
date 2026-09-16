// One-off: replicate cash-bank.service.ts's getCashInHand exactly, to verify the imported
// data reproduces a sane figure without needing to run the whole NestJS app.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const [, , TENANT_ID, COMPANY_ID] = process.argv;
if (!TENANT_ID || !COMPANY_ID) {
  console.error('Usage: node scripts/compute-cash-in-hand.js <tenantId> <companyId>');
  process.exit(1);
}

const CASH_IN_TYPES = new Set(["payment_in", "sale", "credit_note", "cash_in", "pos_sale"]);
const CASH_OUT_TYPES = new Set(["payment_out", "purchase", "expense", "debit_note", "cash_out"]);

function parseNoteObj(notes) {
  if (!notes) return {};
  try {
    const p = JSON.parse(notes);
    if (p && !Array.isArray(p) && typeof p === "object") return p;
    return {};
  } catch { return {}; }
}
function isCashTxn(type, notes) {
  if (type === "cash_in" || type === "cash_out") return true;
  const obj = parseNoteObj(notes);
  const pt = obj.paymentType ?? "Cash";
  return pt === "Cash";
}
function txnDirection(type) { return CASH_IN_TYPES.has(type) ? "in" : "out"; }
function cashAmount(t, allocatedByInvoice) {
  if (t.type === "sale" || t.type === "purchase") {
    const paid = t.total - t.balance;
    const allocated = allocatedByInvoice.get(t.id) ?? 0;
    return Math.max(0, paid - allocated);
  }
  if (t.type === "credit_note" || t.type === "debit_note") return 0;
  return t.total;
}

async function main() {
  const txns = await prisma.transaction.findMany({
    where: { tenantId: TENANT_ID, companyId: COMPANY_ID },
    select: { id: true, type: true, total: true, balance: true, notes: true },
  });
  const allocations = await prisma.paymentAllocation.groupBy({
    by: ["invoiceTxnId"],
    where: { tenantId: TENANT_ID },
    _sum: { amount: true },
  });
  const allocatedByInvoice = new Map(allocations.map((a) => [a.invoiceTxnId, a._sum.amount ?? 0]));

  const cashTxns = txns.filter((t) =>
    (CASH_IN_TYPES.has(t.type) || CASH_OUT_TYPES.has(t.type)) &&
    isCashTxn(t.type, t.notes) &&
    cashAmount(t, allocatedByInvoice) !== 0
  );

  let balance = 0;
  const byType = {};
  for (const t of cashTxns) {
    const amt = cashAmount(t, allocatedByInvoice);
    const dir = txnDirection(t.type);
    byType[t.type] = byType[t.type] || { in: 0, out: 0, count: 0 };
    byType[t.type].count++;
    if (dir === "in") { balance += amt; byType[t.type].in += amt; }
    else { balance -= amt; byType[t.type].out += amt; }
  }

  console.log(`Company ${COMPANY_ID}: Cash In Hand = ${balance.toFixed(2)}`);
  console.log('By type:', JSON.stringify(byType, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

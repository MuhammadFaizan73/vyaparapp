// One-off correction: import-vyapar-backup.js mapped Vyapar txn_type 4 -> payment_in and
// 3 -> expense. Direct evidence (client's own memory of a specific Payment-In, VY-98246,
// showing up as an Expense) plus party-name proof (type 4's top parties literally have
// "expense"/"expence" written into the name — "Haseeb expence over all company", etc. — while
// type 3's parties are normal trade contacts) show this was backwards, the same mistake as the
// 21/28 and 2/23 swaps.
//
// This one is more invasive than a plain type relabel: the wrong "payment_in" batch (really
// type 4 / expense) already ran FIFO allocation against Sale invoices and Party.openingBalance.
// So this script:
//   1. Deletes the wrongly-labeled payment_in transactions (type 4) and their allocations.
//   2. Deletes the wrongly-labeled expense transactions (type 3).
//   3. Resets every Sale transaction's balance and every Party's openingBalance back to their
//      original imported values (from the source JSON dumps) — undoing the FIFO side effects
//      cleanly instead of trying to arithmetically reverse them in place.
//   4. Re-creates both buckets with the corrected types, re-running FIFO allocation for the
//      now-real Payment-In batch (type 3) — same in-memory algorithm as the main import script.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/fix-payment-expense-swap.js <tenantId> <jsonDumpDir>');
  process.exit(1);
}

const prisma = new PrismaClient();
const CHUNK_SIZE = 500;
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8')); }

async function main() {
  const transactions = readJson('transactions.json');
  const names = readJson('names.json');
  const openingReceivable = readJson('opening_receivable.json');
  const openingPayable = readJson('opening_payable.json');
  const receivableByOldId = new Map(openingReceivable.map((r) => [r.name_id, r.bal]));
  const payableByOldId = new Map(openingPayable.map((r) => [r.name_id, r.bal]));

  const company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: 'asc' } });
  const companyId = company.id;

  // ---- 1/2. Delete the two wrongly-typed batches (and the wrong batch's allocations).
  const wrongPaymentIns = await prisma.transaction.findMany({ where: { tenantId: TENANT_ID, type: 'payment_in', number: { startsWith: 'VY-' } }, select: { id: true } });
  const wrongIds = wrongPaymentIns.map((t) => t.id);
  const delAlloc = await prisma.paymentAllocation.deleteMany({ where: { tenantId: TENANT_ID, paymentTxnId: { in: wrongIds } } });
  const delPayIn = await prisma.transaction.deleteMany({ where: { id: { in: wrongIds } } });
  const delExpense = await prisma.transaction.deleteMany({ where: { tenantId: TENANT_ID, type: 'expense', number: { startsWith: 'VY-' } } });
  console.log(`Deleted ${delPayIn.count} wrongly-typed payment_in txns, ${delAlloc.count} allocations, ${delExpense.count} wrongly-typed expense txns`);

  // ---- 3. Reset Sale balances and Party opening balances back to their original imported values.
  const totalByNumber = new Map(transactions.filter((t) => t.txn_type === 1).map((t) => [`VY-${t.txn_id}`, t.txn_balance_amount || 0]));
  const sales = await prisma.transaction.findMany({ where: { tenantId: TENANT_ID, type: 'sale', number: { startsWith: 'VY-' } }, select: { id: true, number: true, balance: true } });
  let resetSales = 0;
  for (const s of sales) {
    const original = totalByNumber.get(s.number);
    if (original !== undefined && original !== s.balance) {
      await prisma.transaction.update({ where: { id: s.id }, data: { balance: original } });
      resetSales++;
    }
  }
  console.log(`Reset ${resetSales} sale balances back to original`);

  const partyOldIdToName = new Map();
  for (const n of names) {
    const name = (n.full_name || '').trim();
    if (name) partyOldIdToName.set(n.name_id, name);
  }
  const openingBalanceByName = new Map();
  for (const [oldId, name] of partyOldIdToName) {
    const ob = (receivableByOldId.get(oldId) || 0) - (payableByOldId.get(oldId) || 0);
    if (ob !== 0) openingBalanceByName.set(name.toLowerCase(), ob);
  }
  const allParties = await prisma.party.findMany({ where: { tenantId: TENANT_ID }, select: { id: true, name: true, openingBalance: true, createdAt: true } });
  let resetParties = 0;
  for (const p of allParties) {
    const original = openingBalanceByName.get(p.name.trim().toLowerCase()) ?? 0;
    if (original !== p.openingBalance) {
      await prisma.party.update({ where: { id: p.id }, data: { openingBalance: original } });
      resetParties++;
    }
  }
  console.log(`Reset ${resetParties} party opening balances back to original`);

  // ---- 4. Re-create the two buckets with corrected types: 3 -> payment_in (with FIFO), 4 -> expense.
  const partyIdByName = new Map(allParties.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const expenseBuf = [];
  const cashflowEntries = [];
  for (const t of transactions) {
    const partyName = partyOldIdToName.get(t.txn_name_id);
    const partyId = partyName ? partyIdByName.get(partyName.toLowerCase()) : undefined;
    const date = t.txn_date ? new Date(t.txn_date) : null;
    if (!partyId || !date || Number.isNaN(date.getTime())) continue;
    const number = `VY-${t.txn_id}`;
    if (t.txn_type === 4) {
      expenseBuf.push({
        tenantId: TENANT_ID, partyId, type: 'expense', number, date,
        total: t.txn_cash_amount || 0, balance: 0,
        notes: JSON.stringify({ category: t.txn_description || 'Expense', paymentType: 'Cash', items: [] }),
        companyId,
      });
    } else if (t.txn_type === 3) {
      cashflowEntries.push({ partyId, type: 'payment_in', date, amount: t.txn_cash_amount || 0, number });
    }
  }
  for (let i = 0; i < expenseBuf.length; i += CHUNK_SIZE) await prisma.transaction.createMany({ data: expenseBuf.slice(i, i + CHUNK_SIZE) });
  console.log(`Expense (corrected, was type 4): ${expenseBuf.length}`);

  const partyIds = [...new Set(cashflowEntries.map((e) => e.partyId))];
  const partiesInfo = await prisma.party.findMany({ where: { id: { in: partyIds } }, select: { id: true, openingBalance: true, createdAt: true } });
  const partyInfoById = new Map(partiesInfo.map((p) => [p.id, p]));
  const outstandingInvoices = await prisma.transaction.findMany({
    where: { tenantId: TENANT_ID, partyId: { in: partyIds }, type: 'sale', balance: { gt: 0 } },
    orderBy: { date: 'asc' },
    select: { id: true, partyId: true, balance: true, date: true },
  });
  const debtsByParty = new Map();
  for (const partyId of partyIds) {
    const invoices = outstandingInvoices.filter((i) => i.partyId === partyId).map((i) => ({ kind: 'invoice', invoiceId: i.id, balance: i.balance, date: i.date }));
    const info = partyInfoById.get(partyId);
    if (info && info.openingBalance > 0) invoices.push({ kind: 'opening', balance: info.openingBalance, date: info.createdAt });
    invoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    debtsByParty.set(partyId, invoices);
  }

  const paymentRows = [];
  const allocationRows = [];
  const invoiceDecrements = new Map();
  const openingDecrements = new Map();
  for (const e of cashflowEntries) {
    if (!(e.amount > 0)) continue;
    let remaining = e.amount;
    const paymentTxnId = randomUUID();
    const debts = debtsByParty.get(e.partyId) || [];
    for (const debt of debts) {
      if (remaining <= 0) break;
      const applied = Math.min(remaining, debt.balance);
      if (applied <= 0) continue;
      debt.balance -= applied;
      if (debt.kind === 'invoice') {
        allocationRows.push({ tenantId: TENANT_ID, paymentTxnId, invoiceTxnId: debt.invoiceId, amount: applied });
        invoiceDecrements.set(debt.invoiceId, (invoiceDecrements.get(debt.invoiceId) || 0) + applied);
      } else {
        openingDecrements.set(e.partyId, (openingDecrements.get(e.partyId) || 0) + applied);
      }
      remaining -= applied;
    }
    paymentRows.push({
      id: paymentTxnId, tenantId: TENANT_ID, partyId: e.partyId, type: 'payment_in', number: e.number, date: e.date,
      total: e.amount, balance: remaining, notes: JSON.stringify({ paymentType: 'Cash', receiptNo: e.number }), companyId,
    });
  }
  for (let i = 0; i < paymentRows.length; i += CHUNK_SIZE) await prisma.transaction.createMany({ data: paymentRows.slice(i, i + CHUNK_SIZE) });
  for (let i = 0; i < allocationRows.length; i += CHUNK_SIZE) await prisma.paymentAllocation.createMany({ data: allocationRows.slice(i, i + CHUNK_SIZE) });

  const invoiceIdList = [...invoiceDecrements.keys()];
  const CONC = 25;
  for (let i = 0; i < invoiceIdList.length; i += CONC) {
    await Promise.all(invoiceIdList.slice(i, i + CONC).map((id) => prisma.transaction.update({ where: { id }, data: { balance: { decrement: invoiceDecrements.get(id) } } })));
  }
  const openingPartyIdList = [...openingDecrements.keys()];
  for (let i = 0; i < openingPartyIdList.length; i += CONC) {
    await Promise.all(openingPartyIdList.slice(i, i + CONC).map((id) => prisma.party.update({ where: { id }, data: { openingBalance: { decrement: openingDecrements.get(id) } } })));
  }
  console.log(`Payment-In (corrected, was type 3): ${paymentRows.length}, allocations: ${allocationRows.length}, invoices touched: ${invoiceIdList.length}, parties w/ opening balance applied: ${openingPartyIdList.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

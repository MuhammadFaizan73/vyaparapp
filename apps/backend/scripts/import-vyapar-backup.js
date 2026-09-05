// One-off: import a real Vyapar app (.vyb) backup's business data into one of our tenants.
// Reuses the exact conventions the app's own bulk-import feature (bulk-import.service.ts)
// already established: dedupe items/parties by lowercased name, line items stored as a bare
// JSON array in Transaction.notes, and FIFO auto-allocation of Payment-In against the oldest
// outstanding Sale invoices (+ any positive Party.openingBalance, per that service's own
// convention: positive openingBalance = receivable, negative = payable).
//
// Vyapar's txn_type codes are not publicly documented. This mapping was reverse-engineered
// from the data itself (see session notes): types 5/6 have literal "Receivable/Payable opening
// balance" descriptions; types 50/51 are proven (via a 215-row match against this backup's own
// party_to_party_transfer table) to be personal fund transfers, not real business transactions,
// and are excluded entirely. The remaining sale/purchase/order split (1 vs 2, 21 vs 24 vs 28) is
// inferred from line-item presence, cash-vs-balance shape, and transaction volume — flagged here
// so it's easy to bulk-correct via `UPDATE "Transaction" SET type = ...` if the client says a
// bucket looks wrong once they see it in the app.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const TENANT_ID = process.argv[2];
const JSON_DIR = process.argv[3];
if (!TENANT_ID || !JSON_DIR) {
  console.error('Usage: node scripts/import-vyapar-backup.js <tenantId> <jsonDumpDir>');
  process.exit(1);
}

const prisma = new PrismaClient();
const CHUNK_SIZE = 500;

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8'));
}

// txn_type -> how to bucket it. "sale"/"purchase" buckets go through the free-text
// transactionType map used by the real bulk-import screens; "order"/"cashflow"/"expense"
// are handled directly here since the existing API doesn't cover sale/purchase orders.
//
// IMPORTANT: these numeric codes are NOT a fixed global enum shared across every Vyapar backup
// — confirmed by comparing two different businesses' files. Codes 1 (sale), 3 (payment_in),
// 4 (expense), 5/6 (opening balance, which have literal description text) held steady across
// both; everything else (2, 21, 23, 24, 28, 29...) must be re-verified per backup from line-item
// presence, cash-vs-balance shape, volume, and — most reliably — the actual party names involved
// (a supplier's real name, "...SALESMAN", "Claims"/"salary" expense buckets, etc.). Put a
// per-backup override at `${JSON_DIR}/type-map.json` (same shape as DEFAULT_TYPE_MAP below) —
// see scripts/type-map.muhammadi-medicose.json for a worked, evidence-annotated example.
const DEFAULT_TYPE_MAP = {
  1: { bucket: 'sale', label: 'sale' },
  23: { bucket: 'purchase', label: 'purchase return' }, // -> debit_note
  24: { bucket: 'purchase', label: 'purchase' },
  2: { bucket: 'purchase', label: 'purchase' },
  21: { bucket: 'order', type: 'sale_order' },
  28: { bucket: 'order', type: 'purchase_order' },
  3: { bucket: 'cashflow', type: 'payment_in' },
  4: { bucket: 'expense' },
  7: { bucket: 'cashflow', type: 'payment_out' },
};
const typeMapOverridePath = path.join(JSON_DIR, 'type-map.json');
const TYPE_MAP = fs.existsSync(typeMapOverridePath) ? JSON.parse(fs.readFileSync(typeMapOverridePath, 'utf8')) : DEFAULT_TYPE_MAP;

async function main() {
  const names = readJson('names.json');
  const items = readJson('items.json');
  const units = readJson('units.json');
  const transactions = readJson('transactions.json');
  const lineitems = readJson('lineitems.json');
  const openingReceivable = readJson('opening_receivable.json');
  const openingPayable = readJson('opening_payable.json');

  const unitById = new Map(units.map((u) => [u.unit_id, u.unit_short_name || u.unit_name]));
  const receivableByOldId = new Map(openingReceivable.map((r) => [r.name_id, r.bal]));
  const payableByOldId = new Map(openingPayable.map((r) => [r.name_id, r.bal]));

  // ---- 0. Company: reuse the tenant's existing company, just fill in the real business name
  // — read from the backup's own kb_firms dump, never hardcoded (this script runs against
  // multiple different businesses' backups).
  const firms = readJson('firms.json');
  const firm = firms[0];
  const company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: 'asc' } });
  if (!company) throw new Error('Tenant has no Company to attach imported data to');
  if (firm && company.name === 'My Business') {
    await prisma.company.update({ where: { id: company.id }, data: { name: firm.firm_name, phone: firm.firm_phone || null, email: firm.firm_email || null } });
    console.log(`Renamed placeholder company -> ${firm.firm_name} (${company.id})`);
  }
  const companyId = company.id;

  // ---- 0b. Opening cash balance (kb_cash_adjustments) — optional, skip if not dumped.
  // Discovered late (Safal Traders): this table holds a starting cash-in-hand figure set
  // when the business first started using Vyapar, entirely separate from any kb_transactions
  // row, so the earlier import passes never touched it. Only one "opening"-described row has
  // been seen in practice, confirmed by the client to be a REDUCTION against Cash In Hand —
  // any other cash_adj_type/description here hasn't been verified, so it's flagged instead of
  // silently guessed at.
  const cashAdjPath = path.join(JSON_DIR, 'cash_adjustments.json');
  if (fs.existsSync(cashAdjPath)) {
    const cashAdjustments = JSON.parse(fs.readFileSync(cashAdjPath, 'utf8'));
    if (cashAdjustments.length) {
      let systemParty = await prisma.party.findFirst({ where: { tenantId: TENANT_ID, isSystem: true } });
      if (!systemParty) systemParty = await prisma.party.create({ data: { tenantId: TENANT_ID, name: 'System', isSystem: true } });
      for (const adj of cashAdjustments) {
        const desc = (adj.cash_adj_description || '').trim();
        const isOpening = desc.toLowerCase().includes('opening');
        if (!isOpening) {
          console.warn(`SKIPPED cash adjustment id=${adj.cash_adj_id} type=${adj.cash_adj_type} desc="${desc}" amount=${adj.cash_adj_amount} — not a recognized "opening" adjustment, needs manual review before importing`);
          continue;
        }
        const number = `VY-OPENING-CASH-${adj.cash_adj_id}`;
        const existing = await prisma.transaction.findFirst({ where: { tenantId: TENANT_ID, number } });
        if (existing) { console.log(`Opening cash adjustment ${number} already imported`); continue; }
        await prisma.transaction.create({
          data: {
            tenantId: TENANT_ID,
            partyId: systemParty.id,
            type: 'cash_out', // confirmed direction for an "opening" adjustment — see comment above
            number,
            total: adj.cash_adj_amount,
            balance: 0,
            date: new Date(adj.cash_adj_date),
            notes: JSON.stringify({ description: desc || 'Opening cash balance', paymentType: 'Cash' }),
            companyId,
          },
        });
        console.log(`Opening cash adjustment imported: ${number} = ${adj.cash_adj_amount}`);
      }
    }
  }

  // ---- 1. Items (dedupe by lowercased name against what's already there, same as bulk-import).
  const existingItems = await prisma.item.findMany({ where: { tenantId: TENANT_ID }, select: { name: true } });
  const existingItemNames = new Set(existingItems.map((i) => i.name.trim().toLowerCase()));
  const itemById = new Map(); // old item_id -> { name, unit }
  const seenItemNames = new Set();
  const newItems = [];
  for (const it of items) {
    const name = (it.item_name || '').trim();
    if (!name) continue;
    const unit = unitById.get(it.base_unit_id) || null;
    itemById.set(it.item_id, { name, unit });
    const key = name.toLowerCase();
    if (existingItemNames.has(key) || seenItemNames.has(key)) continue;
    seenItemNames.add(key);
    newItems.push({
      tenantId: TENANT_ID,
      companyId,
      name,
      sku: it.item_code || null,
      unit,
      secondaryUnit: unitById.get(it.secondary_unit_id) || null,
      salePrice: it.item_sale_unit_price ?? null,
      purchasePrice: it.item_purchase_unit_price ?? null,
      mrp: it.item_mrp ?? null,
      openingStock: it.item_stock_quantity ?? 0,
      minStock: it.item_min_stock_quantity ?? 0,
      itemLocation: it.item_location || null,
    });
  }
  for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
    await prisma.item.createMany({ data: newItems.slice(i, i + CHUNK_SIZE) });
  }
  console.log(`Items: ${newItems.length} created, ${items.length - newItems.length} skipped (blank name or already existed)`);

  // ---- 2. Parties (dedupe by lowercased name; carry opening balance: +receivable / -payable).
  const existingParties = await prisma.party.findMany({ where: { tenantId: TENANT_ID }, select: { id: true, name: true } });
  const partyIdByName = new Map(existingParties.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const partyOldIdToName = new Map(); // old name_id -> canonical trimmed name, for txn linking
  const seenPartyNames = new Set();
  const newParties = [];
  for (const n of names) {
    const name = (n.full_name || '').trim();
    if (!name) continue;
    partyOldIdToName.set(n.name_id, name);
    const key = name.toLowerCase();
    if (partyIdByName.has(key) || seenPartyNames.has(key)) continue;
    seenPartyNames.add(key);
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
  const refreshed = await prisma.party.findMany({ where: { tenantId: TENANT_ID }, select: { id: true, name: true } });
  for (const p of refreshed) partyIdByName.set(p.name.trim().toLowerCase(), p.id);
  console.log(`Parties: ${newParties.length} created, ${names.length - newParties.length} skipped (blank name or already existed)`);

  // ---- 3. Build lineitems-by-txn (name/qty/unit/rate), matching the notes JSON shape every
  // other transaction-creation path in this app already uses.
  const lineitemsByTxn = new Map();
  for (const li of lineitems) {
    const item = itemById.get(li.item_id);
    if (!item) continue;
    const arr = lineitemsByTxn.get(li.lineitem_txn_id) || [];
    arr.push({ name: item.name, qty: li.quantity, unit: unitById.get(li.lineitem_unit_id) || item.unit, rate: li.priceperunit });
    lineitemsByTxn.set(li.lineitem_txn_id, arr);
  }

  // ---- 3b. Numbers already imported (this tenant's original number is `VY-<old txn_id>`,
  // globally unique regardless of type) — makes a re-run after a crash resume cleanly instead
  // of duplicating everything already committed.
  const existingNumbers = new Set(
    (await prisma.transaction.findMany({ where: { tenantId: TENANT_ID, number: { startsWith: 'VY-' } }, select: { number: true } })).map((t) => t.number)
  );

  // ---- 4. Sale-side / purchase-side / order transactions — straight batched inserts.
  let saleBuf = [], purchaseBuf = [], orderBuf = [], expenseBuf = [];
  let counts = { sale: 0, purchase: 0, order: 0, expense: 0, skipped: 0, alreadyImported: 0, payment_in: 0, payment_out: 0 };

  const flush = async (buf, label) => {
    if (!buf.length) return;
    await prisma.transaction.createMany({ data: buf });
    counts[label] += buf.length;
  };

  const cashflowEntries = [];

  // Placeholder party for expense-bucket transactions with no real party at all — only
  // created if this backup actually has any (checked below before the loop needs it).
  const needsExpensePlaceholder = transactions.some((t) => {
    const m = TYPE_MAP[t.txn_type];
    return m && m.bucket === 'expense' && !partyOldIdToName.get(t.txn_name_id);
  });
  let expensePlaceholderPartyId;
  if (needsExpensePlaceholder) {
    const existing = await prisma.party.findFirst({ where: { tenantId: TENANT_ID, name: 'Business Expenses' } });
    expensePlaceholderPartyId = existing ? existing.id : (await prisma.party.create({ data: { tenantId: TENANT_ID, name: 'Business Expenses' } })).id;
  }

  for (const t of transactions) {
    const mapping = TYPE_MAP[t.txn_type];
    const partyName = partyOldIdToName.get(t.txn_name_id);
    // Some backups (e.g. petrol/shortage/stationery petty-cash entries) carry no party at all —
    // only 'expense' has a sane fallback (a placeholder "Business Expenses" party, same
    // convention bulk-import.service.ts uses when its own Expense import has no "Paid To").
    // Everything else genuinely needs its real party and gets skipped without one.
    const partyId = partyName ? partyIdByName.get(partyName.toLowerCase()) : (mapping && mapping.bucket === 'expense' ? expensePlaceholderPartyId : undefined);
    const date = t.txn_date ? new Date(t.txn_date) : null;
    if (!mapping || !partyId || !date || Number.isNaN(date.getTime())) {
      counts.skipped++;
      continue;
    }
    const number = `VY-${t.txn_id}`;
    if (existingNumbers.has(number)) {
      counts.alreadyImported++;
      continue;
    }

    if (mapping.bucket === 'sale' || mapping.bucket === 'purchase') {
      const lineItems = lineitemsByTxn.get(t.txn_id) || [];
      const total = (t.txn_cash_amount || 0) + (t.txn_balance_amount || 0);
      const row = {
        tenantId: TENANT_ID,
        partyId,
        type: mapping.label === 'sale' ? 'sale' : mapping.label === 'sale return' ? 'credit_note' : mapping.label === 'purchase' ? 'purchase' : 'debit_note',
        number,
        date,
        total,
        balance: t.txn_balance_amount || 0,
        notes: JSON.stringify(lineItems),
        companyId,
      };
      if (mapping.bucket === 'sale') { saleBuf.push(row); if (saleBuf.length >= CHUNK_SIZE) await flush(saleBuf, 'sale').then(() => (saleBuf = [])); }
      else { purchaseBuf.push(row); if (purchaseBuf.length >= CHUNK_SIZE) await flush(purchaseBuf, 'purchase').then(() => (purchaseBuf = [])); }
    } else if (mapping.bucket === 'order') {
      const lineItems = lineitemsByTxn.get(t.txn_id) || [];
      const total = (t.txn_cash_amount || 0) + (t.txn_balance_amount || 0);
      orderBuf.push({
        tenantId: TENANT_ID,
        partyId,
        type: mapping.type,
        number,
        date,
        total,
        balance: t.txn_balance_amount || 0,
        notes: JSON.stringify(lineItems),
        companyId,
      });
      if (orderBuf.length >= CHUNK_SIZE) await flush(orderBuf, 'order').then(() => (orderBuf = []));
    } else if (mapping.bucket === 'expense') {
      // Petty-cash entries with no real party often carry their category as a fake "item"
      // line (e.g. "PERTOL MUJEEB", "shortage", "Stationery") instead of txn_description.
      const lineItems = lineitemsByTxn.get(t.txn_id) || [];
      const category = t.txn_description || lineItems[0]?.name || 'Expense';
      expenseBuf.push({
        tenantId: TENANT_ID,
        partyId,
        type: 'expense',
        number,
        date,
        total: t.txn_cash_amount || 0,
        balance: 0,
        notes: JSON.stringify({ category, paymentType: 'Cash', items: [] }),
        companyId,
      });
      if (expenseBuf.length >= CHUNK_SIZE) await flush(expenseBuf, 'expense').then(() => (expenseBuf = []));
    } else if (mapping.bucket === 'cashflow') {
      cashflowEntries.push({ partyId, type: mapping.type, date, amount: t.txn_cash_amount || 0, number });
    }
  }
  await flush(saleBuf, 'sale');
  await flush(purchaseBuf, 'purchase');
  await flush(orderBuf, 'order');
  await flush(expenseBuf, 'expense');
  console.log(`Sale-side: ${counts.sale}, Purchase-side: ${counts.purchase}, Orders: ${counts.order}, Expenses: ${counts.expense}, skipped: ${counts.skipped}`);

  // ---- 5. Payment-in / payment-out — same FIFO allocation logic as BulkImportService.
  // processCashFlow (Payment-In only; Payment-Out has never had auto-allocation in this app),
  // but computed entirely in memory first and applied as a handful of bulk writes — one
  // $transaction() per payment (4100 of them) was exhausting the connection pool over the
  // Railway proxy's network latency (P2028 "unable to start a transaction in the given time").
  const partyIds = [...new Set(cashflowEntries.filter((e) => e.type === 'payment_in').map((e) => e.partyId))];
  const partiesInfo = await prisma.party.findMany({ where: { id: { in: partyIds } }, select: { id: true, openingBalance: true, createdAt: true } });
  const partyInfoById = new Map(partiesInfo.map((p) => [p.id, p]));
  const outstandingInvoices = await prisma.transaction.findMany({
    where: { tenantId: TENANT_ID, partyId: { in: partyIds }, type: 'sale', balance: { gt: 0 } },
    orderBy: { date: 'asc' },
    select: { id: true, partyId: true, balance: true, date: true },
  });
  const debtsByParty = new Map(); // partyId -> [{kind, invoiceId?, balance(mutable), date}], sorted
  for (const partyId of partyIds) {
    const invoices = outstandingInvoices.filter((i) => i.partyId === partyId).map((i) => ({ kind: 'invoice', invoiceId: i.id, balance: i.balance, date: i.date }));
    const info = partyInfoById.get(partyId);
    if (info && info.openingBalance > 0) invoices.push({ kind: 'opening', balance: info.openingBalance, date: info.createdAt });
    invoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    debtsByParty.set(partyId, invoices);
  }

  const paymentRows = [];
  const allocationRows = [];
  const invoiceDecrements = new Map(); // invoiceId -> total to subtract
  const openingDecrements = new Map(); // partyId -> total to subtract

  for (const e of cashflowEntries) {
    if (!(e.amount > 0)) { counts.skipped++; continue; }
    let remaining = e.amount;
    const paymentTxnId = randomUUID();
    if (e.type === 'payment_in') {
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
    }
    paymentRows.push({
      id: paymentTxnId,
      tenantId: TENANT_ID,
      partyId: e.partyId,
      type: e.type,
      number: e.number,
      date: e.date,
      total: e.amount,
      balance: remaining,
      notes: JSON.stringify({ paymentType: 'Cash', receiptNo: e.number }),
      companyId,
    });
    counts[e.type]++;
  }

  for (let i = 0; i < paymentRows.length; i += CHUNK_SIZE) await prisma.transaction.createMany({ data: paymentRows.slice(i, i + CHUNK_SIZE) });
  for (let i = 0; i < allocationRows.length; i += CHUNK_SIZE) await prisma.paymentAllocation.createMany({ data: allocationRows.slice(i, i + CHUNK_SIZE) });

  const invoiceIdList = [...invoiceDecrements.keys()];
  const UPDATE_CONCURRENCY = 25;
  for (let i = 0; i < invoiceIdList.length; i += UPDATE_CONCURRENCY) {
    await Promise.all(invoiceIdList.slice(i, i + UPDATE_CONCURRENCY).map((id) =>
      prisma.transaction.update({ where: { id }, data: { balance: { decrement: invoiceDecrements.get(id) } } })
    ));
  }
  const openingPartyIdList = [...openingDecrements.keys()];
  for (let i = 0; i < openingPartyIdList.length; i += UPDATE_CONCURRENCY) {
    await Promise.all(openingPartyIdList.slice(i, i + UPDATE_CONCURRENCY).map((id) =>
      prisma.party.update({ where: { id }, data: { openingBalance: { decrement: openingDecrements.get(id) } } })
    ));
  }

  console.log(`Payment-In: ${counts.payment_in}, Payment-Out: ${counts.payment_out}, allocations: ${allocationRows.length}, invoices touched: ${invoiceIdList.length}, parties w/ opening balance applied: ${openingPartyIdList.length}`);
  console.log(`Already imported (skipped as duplicates): ${counts.alreadyImported}`);
  console.log(`Total skipped (no party/date match): ${counts.skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

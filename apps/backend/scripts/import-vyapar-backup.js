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
//
// CORRECTED (previously had these backwards): type 4 is a party-based payment (txn_name_id
// set, txn_category_id NULL) — functionally Payment-Out, not a generic expense. Type 7 is a
// real category-based Expense (txn_category_id set, txn_name_id NULL — Bike Repairing,
// Petrol, Rent, Tea, ...). Confirmed against the client's own Vyapar Expense-by-Category
// screen for Safal Traders (Shan Foods): "Bike Repairing" showing 3 transactions totaling
// Rs 6,680 matched exactly to 3 txn_type=7 rows keyed by txn_category_id. See
// categoryNameById's comment below for the full column-based reasoning — this is driven by
// which Vyapar schema column is populated, not by business-specific naming, so it should hold
// across backups, but re-verify the txn_name_id/txn_category_id split per backup regardless.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const TENANT_ID = process.argv[2];
const COMPANY_ID = process.argv[3];
const JSON_DIR = process.argv[4];
if (!TENANT_ID || !COMPANY_ID || !JSON_DIR) {
  console.error('Usage: node scripts/import-vyapar-backup.js <tenantId> <companyId> <jsonDumpDir>');
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
  4: { bucket: 'cashflow', type: 'payment_out' },
  7: { bucket: 'expense_by_category' },
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

  // Optional — dump/item_categories.json (see fix-item-category-from-mapping.js for the
  // exact query). kb_items.category_id is always the default/uncategorized value; the real
  // per-item category lives in the separate kb_item_categories_mapping many-to-many table,
  // pre-resolved to one name per item (first/lowest category_id) at dump time.
  const categoriesPath = path.join(JSON_DIR, 'item_categories.json');
  const categoryByItemName = new Map();
  if (fs.existsSync(categoriesPath)) {
    for (const r of JSON.parse(fs.readFileSync(categoriesPath, 'utf8'))) {
      categoryByItemName.set((r.item_name || '').trim().toLowerCase(), r.item_category_name);
    }
  }

  // Optional — dump/items_conversion_rate.json. An item can have a secondaryUnit name
  // (e.g. "Box") with NO conversionRate set — the app's own unit dropdown needs both to
  // offer that unit at all, so without this an item imported with a secondary unit but no
  // rate silently never shows it (found via Spencer: all 72 of its Carton->Box items).
  const conversionRatePath = path.join(JSON_DIR, 'items_conversion_rate.json');
  const conversionRateByItemName = new Map();
  if (fs.existsSync(conversionRatePath)) {
    for (const r of JSON.parse(fs.readFileSync(conversionRatePath, 'utf8'))) {
      conversionRateByItemName.set((r.item_name || '').trim().toLowerCase(), r.conversion_rate);
    }
  }

  // ---- 0. Company: the caller picks which existing Company this backup attaches to
  // (required for multi-company tenants — importing two businesses' backups into the same
  // tenant with no explicit target previously always fell back to "the oldest company",
  // silently mixing a second business's data into the first's). Fill in the real business
  // name from the backup's own kb_firms dump, never hardcoded.
  const firms = readJson('firms.json');
  const firm = firms[0];
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company || company.tenantId !== TENANT_ID) throw new Error(`Company ${COMPANY_ID} not found under tenant ${TENANT_ID}`);
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
        const existing = await prisma.transaction.findFirst({ where: { tenantId: TENANT_ID, companyId, number } });
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
  // Scoped to this company, not the whole tenant — otherwise a second company's backup
  // sharing an item name with the first (e.g. a generic SKU) would silently reuse the first
  // company's row instead of creating its own.
  const existingItems = await prisma.item.findMany({ where: { tenantId: TENANT_ID, companyId }, select: { name: true } });
  const existingItemNames = new Set(existingItems.map((i) => i.name.trim().toLowerCase()));
  const itemById = new Map(); // old item_id -> { name, unit }
  const seenItemNames = new Set();
  const newItems = [];
  for (const it of items) {
    const name = (it.item_name || '').trim();
    if (!name) continue;
    const unit = unitById.get(it.base_unit_id) || null;
    itemById.set(it.item_id, {
      name, unit,
      baseUnitId: it.base_unit_id,
      secondaryUnitId: it.secondary_unit_id,
      conversionRate: conversionRateByItemName.get(key),
    });
    const key = name.toLowerCase();
    if (existingItemNames.has(key) || seenItemNames.has(key)) continue;
    seenItemNames.add(key);
    newItems.push({
      tenantId: TENANT_ID,
      companyId,
      name,
      sku: it.item_code || null,
      category: categoryByItemName.get(key) || null,
      unit,
      secondaryUnit: unitById.get(it.secondary_unit_id) || null,
      conversionRate: conversionRateByItemName.has(key) ? String(conversionRateByItemName.get(key)) : null,
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
  // Scoped to this company — same cross-company collision risk as items above, but worse:
  // it would silently attach a second company's transactions to the FIRST company's party.
  const existingParties = await prisma.party.findMany({ where: { tenantId: TENANT_ID, companyId }, select: { id: true, name: true } });
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
  const refreshed = await prisma.party.findMany({ where: { tenantId: TENANT_ID, companyId }, select: { id: true, name: true } });
  for (const p of refreshed) partyIdByName.set(p.name.trim().toLowerCase(), p.id);
  console.log(`Parties: ${newParties.length} created, ${names.length - newParties.length} skipped (blank name or already existed)`);

  // ---- 3. Build lineitems-by-txn (name/qty/unit/rate), matching the notes JSON shape every
  // other transaction-creation path in this app already uses.
  //
  // unit is ALWAYS the item's own base unit here, never li.lineitem_unit_id's label —
  // confirmed (by hand, against kb_lineitems) that Vyapar's own export already expresses
  // every line item's quantity in the item's tracked/base unit, regardless of which unit
  // label the line was actually entered in (e.g. a "1 Jar" sale on a Carton-tracked item,
  // 1 Carton = 24 Jar, is stored as quantity 0.041667 = 1/24, not 1) — see
  // fix-item-opening-stock.js's header comment for the original discovery. Storing the
  // line's OWN unit label (e.g. "jar") here, with an already-base-unit qty, made
  // reports.service.ts's computeStockMap() apply buildUnitConverter's secondary-unit
  // division A SECOND TIME on every such line (0.041667 / 24 instead of leaving it alone)
  // — confirmed against Spencer's real Vyapar Stock Value report: our Stock Value showed
  // Rs 40,09,504 against Vyapar's real Rs 4,02,570, a ~10x inflation concentrated exactly
  // on every item with a secondaryUnit/conversionRate set.
  const lineitemsByTxn = new Map();
  for (const li of lineitems) {
    const item = itemById.get(li.item_id);
    if (!item) continue;
    const arr = lineitemsByTxn.get(li.lineitem_txn_id) || [];
    arr.push({ name: item.name, qty: li.quantity, unit: item.unit, rate: li.priceperunit });
    lineitemsByTxn.set(li.lineitem_txn_id, arr);
  }

  // ---- 3b. Numbers already imported (`VY-<old txn_id>`, unique within the SOURCE backup —
  // but txn_id is Vyapar's own per-business auto-increment, so two different companies'
  // backups under this tenant can easily both have a "VY-1". Scoped to this company so
  // company B's txn_id=1 isn't mistaken for already-imported just because company A's was.
  // Makes a re-run after a crash resume cleanly instead of duplicating everything committed.
  const existingNumbers = new Set(
    (await prisma.transaction.findMany({ where: { tenantId: TENANT_ID, companyId, number: { startsWith: 'VY-' } }, select: { number: true } })).map((t) => t.number)
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

  // Vyapar stores two structurally different things under what looked like one "expense"
  // concept, distinguished by which column is set on the row (confirmed against the raw
  // .vyb for Safal Traders, Shan Foods, by cross-checking the client's own Vyapar
  // Expense-by-Category screen — e.g. "Bike Repairing" showing 3 transactions totaling
  // Rs 6,680 matched exactly to 3 txn_type=7 rows with txn_category_id set):
  //   - txn_category_id set, txn_name_id NULL (100% of this backup's type-7 rows): a real
  //     category-based Expense (Bike Repairing, Petrol, Rent, Tea, ...) — genuinely a
  //     business expense, no party involved at all.
  //   - txn_name_id set, txn_category_id NULL (100% of this backup's type-4 rows,
  //     including e.g. "BINESH", a supplier with a real Payable opening balance and no
  //     type-2 Purchase row under this exact name): a payment to/from a real party,
  //     functionally identical to Payment-Out.
  // The earlier assumption (4=expense, 7=payment_out, from this file's original header
  // comment) had these backwards — TYPE_MAP below is corrected accordingly. Category
  // lookups use this map; `mapping.bucket === 'expense_by_category'` reads it below.
  const categoryNameById = new Map(names.map((n) => [n.name_id, (n.full_name || '').trim()]));

  // Placeholder party for expense_by_category rows — they have no real party at all
  // (txn_name_id is NULL by definition), only created if this backup actually has any.
  const needsExpensePlaceholder = transactions.some((t) => (TYPE_MAP[t.txn_type] || {}).bucket === 'expense_by_category');
  let expensePlaceholderPartyId;
  if (needsExpensePlaceholder) {
    const existing = await prisma.party.findFirst({ where: { tenantId: TENANT_ID, name: 'Business Expenses' } });
    expensePlaceholderPartyId = existing ? existing.id : (await prisma.party.create({ data: { tenantId: TENANT_ID, name: 'Business Expenses' } })).id;
  }

  // REVERTED — a cashflow (payment-in/payment-out) entry with no party at all was initially
  // assumed to be a personal cash withdrawal and given a "Cash Withdrawal" placeholder party,
  // same as the expense placeholder above. Checked against the raw .vyb directly for Safal
  // Traders (Shan Foods): all 983 of these payment-out rows have txn_payment_type_id = NULL
  // (not Cash, not Cheque — Vyapar's own kb_paymentTypes only defines those two), no
  // description, and amounts as small as Rs 3-90 — not real withdrawals, but Vyapar's own
  // auto-generated round-off adjustment rows. Importing them as real cash-out transactions
  // is what put Cash In Hand ~9.5M off after this business's usual correct import. Left
  // unimported, matching the prior (correct) behavior — same as everything else with no
  // real party and no sane fallback.

  for (const t of transactions) {
    const mapping = TYPE_MAP[t.txn_type];
    const partyName = partyOldIdToName.get(t.txn_name_id);
    // expense_by_category rows have no party at all (txn_name_id is NULL by definition —
    // see the categoryNameById comment above) — always the placeholder. Everything else
    // genuinely needs its real party and gets skipped without one.
    const partyId = partyName
      ? partyIdByName.get(partyName.toLowerCase())
      : mapping && mapping.bucket === 'expense_by_category' ? expensePlaceholderPartyId
      : undefined;
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
    } else if (mapping.bucket === 'expense_by_category') {
      // Real category-based Expense (Bike Repairing, Petrol, Rent, Tea, ...) — see the
      // categoryNameById comment above. txn_name_id is NULL for these; the category name
      // lives on txn_category_id instead.
      const category = categoryNameById.get(t.txn_category_id) || t.txn_description || 'Expense';
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

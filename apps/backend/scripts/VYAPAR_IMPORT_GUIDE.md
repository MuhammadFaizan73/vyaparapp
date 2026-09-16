# Vyapar (.vyb) Backup Import — Standard Procedure

Follow this exact sequence for every Vyapar backup import (new company or re-import).
Do not skip verification steps — every rule below was learned from a real mistake on a
real client's data.

## Reference case: Safal Traders (Shan Foods), 2026-09-14 backup

Client-verified correct after applying every rule below. Use this to sanity-check the
pipeline is behaving the same way on a future re-import (figures will differ, but the
*shape* — Payment-Out and Expense on the same order of magnitude, Expense broken into
many small named categories, Payable/Receivable both in the single-digit-lakh range —
should look similar for this business):

| Figure | Amount (Rs) |
|---|---|
| Total Receivable | 4,946,626.68 |
| Total Payable | 4,430,422.42 |
| Stock Value | 1,840,583.30 |
| Sale | 158,811,457.54 |
| Purchase | 157,410,997.76 |
| Payment-In | 233,990,111.40 |
| Payment-Out | 219,861,516.00 |
| Other Income (Claims + salary + extra incentives) | 12,122,768.00 |
| Total Expense (by category) | 9,582,391.00 |
| Cash In Hand | 788,121.40 |

Expense breakdown (top entries) matched the client's own Vyapar Expense-by-Category
screen exactly, including the smallest ones (Bike Repairing Rs 6,680, Tea Rs 14,200):
interst exp 6,062,895 · Salary 2,985,677 · Rent 135,000 · solar expense 115,000 ·
loader 65,424 · Petrol 35,570 · carpenter 30,500 · Incentive noodles 25,000 ·
SHORTAGE 18,575 · eidi 18,000 · lunch 16,530 · Tax Expense 15,000 · Tea 14,200 ·
stationary 13,151 · Bike repairing 6,680 · vyapar 6,000 · Mobile load 4,761 ·
water 3,808 · camera expense 3,500 · test 3,000 · zakir mobile 2,000 ·
mouse cut 1,420 · sweeper expense 400 · electric expense 300.

All three re-run-the-fix-script checks (party balances, item opening stock, item current
stock) showed **0 to update** after the pipeline ran once — the strongest available proof
of an exact match, since it means Vyapar's own numbers and our live app's own formula
agree with no adjustment needed.

## Reference case: Safal Traders (Spencer), 2026-09-15 backup

Same tenant, no `name_type=3` custom categories at all (so no Other Income case here —
that's specific to whichever custom categories a business happens to have created).
Client-confirmed correct before import (matched their own Vyapar figures) — note Cash In
Hand came out **negative** here (-Rs 894,985) and that was still correct; a negative
result isn't automatically a bug, only a mismatch against Vyapar's own number is.

| Figure | Amount (Rs) |
|---|---|
| Total Receivable | 1,529,729.00 |
| Total Payable | 518,920.18 |
| Stock Value | 402,570.98 |
| Sale | 5,441,488.00 |
| Purchase | 5,316,294.18 |
| Payment-In | 8,585,781.00 |
| Payment-Out | 9,483,070.00 |
| Total Expense (by category) | 996.00 (Petrol 600, Tea 200, shortage 196) |
| Cash In Hand | -894,985.00 |

Also re-confirmed **0 to update** on all three fix-script re-runs after the pipeline ran
once.

## Fixed bug: line-item unit must always be the item's BASE unit, never the line's own unit

Found on Spencer (which has real `secondaryUnit`/`conversionRate` set on many items —
Shan Foods doesn't, so this bug had zero effect there): the frontend showed Stock Value
as **Rs 40,09,504** against Vyapar's real **Rs 4,02,570** — a ~10x inflation. Root cause:
`lineitemsByTxn` was storing each line item's *own* recorded unit (`li.lineitem_unit_id`,
e.g. "jar" or "Box" — Vyapar's secondary/tertiary unit) even though `li.quantity` is
*already* expressed in the item's base unit (confirmed earlier, quantity 0.041667 for "1
Jar" when 1 Carton = 24 Jar). `reports.service.ts`'s `computeStockMap()` then applies
`buildUnitConverter` — which divides by `conversionRate` again whenever the line's unit
matches the item's `secondaryUnit` — double-converting every such line and wildly
inflating (or, for a handful of items, zeroing out) the resulting stock quantity/value.

**Fix**: always store the item's own base unit (`item.unit`) on the line item, never the
line's own unit label — `qty` is already scaled to that base unit regardless of which
unit Vyapar originally recorded the sale in. Already corrected in
`import-vyapar-backup.js`'s lineitem-building step (§3) for future imports. If re-running
this against already-imported data, also directly correct every `sale`/`purchase`/
`credit_note`/`debit_note` Transaction's `notes` line items (`li.unit` → the item's
current `unit`) — a one-off DB fix, not something a re-import alone retroactively
corrects.

**Verify this specifically whenever a business has items with `secondaryUnit`/
`conversionRate` set** (check `items_conversion_rate.json` isn't empty) — replicate
`reports.service.ts`'s exact `buildUnitConverter` logic against the DB (not a simplified
no-conversion script) and diff against `items_current_stock.json`'s `item_stock_value`.
A simplified verification script that skips unit conversion (matching
`fix-item-opening-stock.js`'s own deliberate no-conversion approach for back-solving
`openingStock`) will *appear* to match — it doesn't exercise the same code path the real
frontend does.

## Known, accepted formula gap: Stock Value (not Stock Quantity)

Stock *quantity* matches Vyapar exactly (0 diff, confirmed above). Stock *value* will
still show a small residual gap (Rs 3,800 on Shan Foods, Rs 7,884 on Spencer, after the
unit-conversion fix above) — this is not a bug. Our app values current stock at the
item's current/latest `purchasePrice` (which matches Vyapar's own item-master field
exactly); Vyapar's own Stock Value report uses the *weighted-average cost* of that item's
actual purchase history instead. Whenever an item's price changed over time, the two
numbers diverge slightly — some items over, some under, netting to a small residual.
Don't chase this to zero; it would require tracking weighted-average cost per item, a
real feature change, not an import fix. (Spencer's residual is mostly two duplicate
item-name variants — e.g. "TREND WAFER CHOC(6X12)RS.100/=" vs the real, currently-priced
"...RS.120/=" — where Vyapar's own item master shows `purchasePrice=0` for the stale
variant but its Stock Value report still carries a real weighted-average-cost value for
it; same root cause, not worth chasing further.)

## 1. Dump the backup to JSON

```
node scripts/dump-vyb-to-json.js "<path-to-backup>.vyb" <scratch-dir>/dump-<company>
```

Produces `names.json`, `items.json`, `units.json`, `transactions.json`, `lineitems.json`,
`opening_receivable.json`, `opening_payable.json`, `firms.json`, `cash_adjustments.json`,
`item_categories.json`, `items_current_stock.json`, `items_conversion_rate.json`,
`kb_names_amounts.json`.

## 2. Re-verify the txn_type map for THIS backup — never reuse blindly

Vyapar's `txn_type` codes are not a fixed global enum. Codes that are stable across
backups seen so far: **1** (sale), **2/23/24** (purchase family), **3** (payment_in),
**21** (credit note — see below), **4** and **7** (see below), **5/6** (opening balance,
handled separately, never mapped), **29** (a business's own custom category — see below).

### The critical distinction: `txn_name_id` vs `txn_category_id`

Every `kb_transactions` row is either party-based or category-based, **never both**:

- `txn_name_id` set, `txn_category_id` NULL → a real party (customer/supplier/staff).
  Type 4 rows are this shape — they are **Payment-Out to a real party**, not a generic
  expense, even though this file's original assumption (before this correction) treated
  type 4 as "expense". A supplier can show up here with a real Payable opening balance
  and zero Purchase invoices under the exact same name (e.g. "BINESH" at Safal Traders,
  Shan Foods: Rs 50.2M paid, Rs 3.96M opening payable, 0 purchase rows) — that's still a
  real payment, just routed through Vyapar's Expense screen by the business.

- `txn_category_id` set, `txn_name_id` NULL → a real category-based Expense (Bike
  Repairing, Petrol, Rent, Tea, loader, SHORTAGE, ...). Type 7 rows are this shape. Look
  up the category name via `txn_category_id` against `names.json` (Vyapar stores its
  Expense Category master list in the same `kb_names` table, tagged `name_type=2` for
  the built-in ones or `name_type=3` for custom ones a tenant added — but the actual
  transaction always links via `txn_category_id`, not `txn_name_id`, for this bucket).

**Verify this split before trusting it**, per backup:

```sql
SELECT CASE WHEN txn_name_id IS NOT NULL THEN 'has_name_id'
            WHEN txn_category_id IS NOT NULL THEN 'has_category_id'
            ELSE 'neither' END AS kind, count(*), sum(txn_cash_amount)
FROM kb_transactions WHERE txn_type IN (4, 7) GROUP BY txn_type, kind;
```

Confirmed 100% consistent (Shan Foods and Spencer, Sept 2026): every type-4 row has
`txn_name_id` set; every type-7 row has `txn_category_id` set. This is driven by which
Vyapar *feature* was used to create the row (Expense screen picking a party vs picking a
category), so it should hold structurally across backups — but check the query above
every time regardless.

### Type 29 — a business's own custom Expense Category can actually be Other Income

A `name_type=3` row in `kb_names` is a custom Expense Category the tenant created
themselves (distinct from Vyapar's built-in `name_type=2` list, which in practice is
never used as a real `txn_name_id`). For Safal Traders (Shan Foods), the 3 custom
categories that exist — **Claims**, **salary**, **extra incentives** — are confirmed by
the client to actually be **Other Income received** (e.g. claims/incentive payouts a
distributor gets FROM the manufacturer), not expenses paid out — despite living in
Vyapar's Expense feature. Route these as `payment_in`, not `expense`. **Re-verify this
with the client for every new backup** — a different business's custom categories may
genuinely be expenses.

### Type 21 — always Credit Note, not split by sub_type

Confirmed by the client (cross-checked against their own Vyapar Credit Note report, ref
182 "UBAID GENEREL STORE", 01-Sep-2026, Rs 2,475 — exact match on txn_id 38927): **every**
type-21 row is a Credit Note (Sale Return), regardless of `txn_sub_type`. An earlier
sub_type-based credit_note/sale_order split was wrong and was corrected. Exclude 21 from
the main `TYPE_MAP` (leave it unmapped so the main import skips it) and import it
separately:

```
node scripts/import-safal-orders.js <tenantId> <jsonDumpDir> <companyId>
```

### Writing the override

If anything above needs correcting for a specific backup, drop
`${jsonDumpDir}/type-map.json` (same shape as `DEFAULT_TYPE_MAP` in
`import-vyapar-backup.js`) — it fully replaces the default map, not merges with it. Save
a copy as `scripts/type-map.<company-slug>.json` for the audit trail (see
`type-map.safal-shan-foods.json`, `type-map.safal-spencer.json`,
`type-map.muhammadi-medicose.json` for worked examples). The corrected baseline:

```json
{
  "1": { "bucket": "sale", "label": "sale" },
  "23": { "bucket": "purchase", "label": "purchase return" },
  "24": { "bucket": "purchase", "label": "purchase" },
  "2": { "bucket": "purchase", "label": "purchase" },
  "28": { "bucket": "order", "type": "purchase_order" },
  "3": { "bucket": "cashflow", "type": "payment_in" },
  "4": { "bucket": "cashflow", "type": "payment_out" },
  "7": { "bucket": "expense_by_category" },
  "29": { "bucket": "cashflow", "type": "payment_in" }
}
```
(21 stays unmapped/excluded — handled by `import-safal-orders.js`.)

## 3. Run the full pipeline, in this exact order

```
node scripts/import-vyapar-backup.js       <tenantId> <companyId> <jsonDumpDir>
node scripts/import-safal-orders.js        <tenantId> <jsonDumpDir> <companyId>
node scripts/fix-item-opening-stock.js     <tenantId> <jsonDumpDir> <companyId>
node scripts/fix-party-balances-from-kbnames.js <tenantId> <jsonDumpDir> <companyId>
node scripts/bootstrap-item-stock.js       <tenantId>
node scripts/fix-item-stock-to-current.js  <tenantId> <jsonDumpDir> <companyId>
node scripts/assign-parties-to-company-salesmen.js <tenantId> <companyId>
```

`bootstrap-item-stock.js` is tenant-wide (loops every company under the tenant) — run it
once after all companies' steps 1–5 above are done, not per-company.

**`assign-parties-to-company-salesmen.js` is not optional** — skipping it silently breaks
invoice creation for every salesman on this company. The mobile app's `useParties()` hook
(`apps/mobile/src/useParties.ts`) filters a salesman/biller_salesman role's party list down
to ONLY parties with a `PartyAssignment` row for them — a bulk import never creates those,
so a salesman scoped to a freshly-imported company sees a completely empty party list when
adding an invoice, even though every party imported correctly (confirmed on Safal Traders,
Spencer: "Rakesh", role=salesman, `companyIds=["<Spencer's id>"]`, 0 parties visible before
this step, 1,329 after). Assigns every party in the company to every TeamMember whose role
is salesman/biller_salesman AND whose `companyIds` explicitly includes this company (a
member with `companyIds=null`, i.e. unrestricted, is deliberately skipped — there's no way
to tell which company they actually work, and auto-assigning would leak this company's full
party list to a possibly-unrelated salesman). `visitDays` defaults to every day of the
week, since a Vyapar backup has no real visit-schedule data to import.

## 4. Verify before telling the client it's done — three independent checks, not one

Re-running a "fix" script is itself a verification: 0 rows left to update means the data
already matches. Do this for both party balances and item stock:

```
node scripts/fix-party-balances-from-kbnames.js <tenantId> <jsonDumpDir> <companyId>
node scripts/fix-item-opening-stock.js         <tenantId> <jsonDumpDir> <companyId>
node scripts/fix-item-stock-to-current.js      <tenantId> <jsonDumpDir> <companyId>
```
Expect `0 to update` on every one, every time, after the pipeline above already ran once.

Additionally, replicate the **actual live app formulas** (not just the fix scripts) —
`parties.service.ts`'s Payable/Receivable calculation and `reports.service.ts`'s
`computeStockMap()` — directly against the database, and diff the totals against
`kb_names_amounts.json` (Vyapar's own per-party running balance) and
`items_current_stock.json` (Vyapar's own current stock quantity/value). Both must match
to the cent/unit — this is the check that actually matters, since it exercises the same
code path a real user's screen does, not just the one-off import script's own logic.

## 5. Never touch this script's shared, live-used formulas to patch an import quirk

`CashBankService`, `PartiesService.list()`, and `reports.service.ts`'s
`computeStockMap()` are used live by every tenant. If an import produces a wrong number
against one of these, the fix is almost always in **how the import categorizes/tags the
data** (as in every rule above), never in changing the shared formula itself — a
shared-formula change to fix one business's import will silently break every other
tenant's live, correctly-entered data.

## Known gotchas (still valid, unrelated to the type-4/7 correction above)

- **Opening cash balance** (`kb_cash_adjustments`, `cash_adj_description` containing
  "opening"): a real, separate cash movement, imported as its own `cash_out` transaction
  against a "System" party. Any *other* `cash_adj_type`/description in this table is
  unverified — flagged with a console warning, not silently guessed at.
- **Item stock**: `Item.openingStock` is a back-solved day-1 baseline so
  `reports.service.ts`'s forward-simulation lands on Vyapar's real current quantity —
  never set it to Vyapar's current quantity directly (`fix-item-opening-stock.js` fixes
  this if it happens). `ItemStock.quantity` (read by the Items list screen) is a
  *separate*, static counter seeded from `openingStock` by `bootstrap-item-stock.js`, and
  needs its own correction (`fix-item-stock-to-current.js`) after a bulk historical
  import, since bulk `createMany()` transactions never touch it.
- **Party balances**: `parties.service.ts`'s Payable/Receivable formula nets Purchase
  against Payment-Out only (not Expense), and sums Sale's own `balance` field for
  Receivable — `fix-party-balances-from-kbnames.js` back-solves `Party.openingBalance`
  so this existing, unmodified formula reproduces Vyapar's own `kb_names.amount` exactly,
  rather than rewriting the formula (used live by every tenant).
- **Round-off Payment-Out rows with no party**: some backups have `txn_type=7`-shaped (in
  the old, pre-correction sense) rows with no party, no description, and amounts as small
  as Rs 3–90 — these are Vyapar's own auto-generated round-off adjustments, not real cash
  movements. Left unimported (same as everything else with no real party and no sane
  fallback).

// One-off: extract a Vyapar .vyb backup (a zip archive containing one SQLite database) into
// the per-table JSON_DIR shape every import-*.js / fix-*.js script in this directory expects.
// Fills a real gap: no such extraction step existed anywhere in this repo before (the original
// Safal Traders import's dump step was done ad-hoc outside of git — see session notes referenced
// in import-vyapar-backup.js/import-bank-accounts.js). This makes the next backup import
// reproducible from a checked-in script instead of undocumented one-off shell history.
//
// Usage: node scripts/dump-vyb-to-json.js <path-to.vyb> <outputJsonDir>
//
// Produces (only the tables/queries the rest of this directory's scripts actually read):
//   names.json, items.json, units.json, transactions.json, lineitems.json,
//   opening_receivable.json, opening_payable.json, firms.json, cash_adjustments.json,
//   item_categories.json, bank_accounts.json, items_current_stock.json,
//   items_conversion_rate.json, kb_names_amounts.json
// Does NOT produce type-map.json or the transactions_<bucket>.json splits — those depend on a
// per-backup txn_type verification (codes are not a fixed global enum, re-verify every time,
// see import-vyapar-backup.js's own header comment) that has to happen after looking at this
// dump's own data, not blindly re-guessed by this script. Use split-transactions-by-type.js
// once you've confirmed the type-map for this specific backup.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const VYB_PATH = process.argv[2];
const OUT_DIR = process.argv[3];
if (!VYB_PATH || !OUT_DIR) {
  console.error('Usage: node scripts/dump-vyb-to-json.js <path-to.vyb> <outputJsonDir>');
  process.exit(1);
}

function sqliteJson(dbPath, sql) {
  const out = execFileSync('sqlite3', ['-json', dbPath, sql], { maxBuffer: 1024 * 1024 * 1024 });
  const text = out.toString('utf8').trim();
  return text ? JSON.parse(text) : [];
}

function writeJson(name, data) {
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data));
  console.log(`${name}: ${Array.isArray(data) ? data.length : 1} row(s)`);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // .vyb is a zip archive with exactly one .vyp SQLite file inside — unzip to a scratch dir.
  const unzipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vyb-'));
  execFileSync('unzip', ['-o', VYB_PATH, '-d', unzipDir]);
  const vyp = fs.readdirSync(unzipDir).find((f) => f.endsWith('.vyp'));
  if (!vyp) throw new Error(`No .vyp file found inside ${VYB_PATH}`);
  const dbPath = path.join(unzipDir, vyp);
  console.log(`Extracted ${vyp}`);

  writeJson('names.json', sqliteJson(dbPath, `
    SELECT name_id, full_name, phone_number, email, address, name_shipping_address,
           name_state, name_gstin_number, pincode, name_shipping_pincode, credit_limit
    FROM kb_names;
  `));

  writeJson('kb_names_amounts.json', sqliteJson(dbPath, `
    SELECT full_name, amount FROM kb_names;
  `));

  writeJson('items.json', sqliteJson(dbPath, `
    SELECT item_id, item_name, item_code, base_unit_id, secondary_unit_id,
           item_sale_unit_price, item_purchase_unit_price, item_mrp,
           item_stock_quantity, item_min_stock_quantity, item_location
    FROM kb_items;
  `));

  writeJson('items_current_stock.json', sqliteJson(dbPath, `
    SELECT item_name, item_stock_quantity, item_stock_value FROM kb_items;
  `));

  writeJson('items_conversion_rate.json', sqliteJson(dbPath, `
    SELECT i.item_name, m.conversion_rate
    FROM kb_items i
    JOIN kb_item_units_mapping m ON m.unit_mapping_id = i.unit_mapping_id
    WHERE i.unit_mapping_id IS NOT NULL;
  `));

  writeJson('units.json', sqliteJson(dbPath, `
    SELECT unit_id, unit_name, unit_short_name FROM kb_item_units;
  `));

  writeJson('transactions.json', sqliteJson(dbPath, `
    SELECT txn_id, txn_type, txn_sub_type, txn_name_id, txn_date, txn_cash_amount,
           txn_balance_amount, txn_description
    FROM kb_transactions;
  `));

  writeJson('lineitems.json', sqliteJson(dbPath, `
    SELECT lineitem_txn_id, item_id, quantity, priceperunit, lineitem_unit_id
    FROM kb_lineitems;
  `));

  // txn_type 5/6 (Receivable/Payable opening balance) confirmed stable across every backup
  // seen so far (unlike the sale/purchase/order codes) — see import-vyapar-backup.js header.
  writeJson('opening_receivable.json', sqliteJson(dbPath, `
    SELECT txn_name_id AS name_id, txn_balance_amount AS bal FROM kb_transactions WHERE txn_type = 5;
  `));
  writeJson('opening_payable.json', sqliteJson(dbPath, `
    SELECT txn_name_id AS name_id, txn_balance_amount AS bal FROM kb_transactions WHERE txn_type = 6;
  `));

  writeJson('firms.json', sqliteJson(dbPath, `
    SELECT firm_name, firm_phone, firm_email FROM kb_firms;
  `));

  writeJson('cash_adjustments.json', sqliteJson(dbPath, `
    SELECT cash_adj_id, cash_adj_type, cash_adj_amount, cash_adj_date, cash_adj_description
    FROM kb_cash_adjustments;
  `));

  writeJson('item_categories.json', sqliteJson(dbPath, `
    SELECT i.item_name, c.item_category_name
    FROM kb_items i
    JOIN (SELECT item_id, MIN(category_id) AS category_id FROM kb_item_categories_mapping GROUP BY item_id) m
      ON m.item_id = i.item_id
    JOIN kb_item_categories c ON c.item_category_id = m.category_id
    WHERE i.item_name IS NOT NULL AND i.item_name <> '';
  `));

  writeJson('bank_accounts.json', sqliteJson(dbPath, `
    SELECT paymentType_name AS name, paymentType_opening_balance AS opening_balance,
           paymentType_opening_date AS opening_date
    FROM kb_paymentTypes WHERE paymentType_type = 'BANK';
  `));

  fs.rmSync(unzipDir, { recursive: true, force: true });
  console.log(`Done. JSON dump written to ${OUT_DIR}`);
}

main();

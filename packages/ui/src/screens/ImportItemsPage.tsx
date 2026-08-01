import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";

type TargetKey =
  | "name" | "sku" | "companyTag" | "category"
  | "mrp" | "salePrice" | "purchasePrice"
  | "discountType" | "discount"
  | "openingStock" | "minStock" | "itemLocation"
  | "taxRate" | "inclusiveOfTax"
  | "tertiaryUnit" | "unit" | "secondaryUnit" | "conversionRate" | "tertiaryConversionRate";

type FieldDef = { key: TargetKey; label: string; required?: boolean; kind: "text" | "number" };

// Order matches the source system's own Item import template exactly, so a file exported
// from there maps column-for-column with no reshuffling. Exported so every other "download
// items template" entry point (e.g. ItemsScreen's dropdown) uses the exact same column set
// instead of drifting out of sync with its own hardcoded list.
export const TARGET_FIELDS: FieldDef[] = [
  { key: "name",                   label: "Item Name*",              required: true, kind: "text" },
  { key: "sku",                    label: "Item Code",               kind: "text" },
  { key: "companyTag",             label: "Company Name",            kind: "text" },
  { key: "category",               label: "Category",                kind: "text" },
  { key: "mrp",                    label: "MRP",                     kind: "number" },
  { key: "salePrice",              label: "Sale Price",              kind: "number" },
  { key: "purchasePrice",          label: "Purchase Price",          kind: "number" },
  { key: "discountType",           label: "Discount Type",           kind: "text" },
  { key: "discount",               label: "Sale Discount",           kind: "number" },
  { key: "openingStock",           label: "Opening Stock Quantity",  kind: "number" },
  { key: "minStock",               label: "Minimum Stock Quantity",  kind: "number" },
  { key: "itemLocation",           label: "Item Location",           kind: "text" },
  { key: "taxRate",                label: "Tax Rate",                kind: "number" },
  { key: "inclusiveOfTax",         label: "Inclusive Of Tax",        kind: "text" },
  // Unit hierarchy, biggest to smallest: Top Pack Unit (Carton) -> Unit (Box, the item's
  // normal stocking unit) -> Pieces (a finer subdivision of Unit).
  { key: "tertiaryUnit",           label: "Top Pack Unit",           kind: "text" },
  { key: "unit",                   label: "Unit",                    kind: "text" },
  { key: "secondaryUnit",          label: "Pieces",                  kind: "text" },
  { key: "conversionRate",         label: "Conversion Rate (Unit = n Pieces)",       kind: "text" },
  { key: "tertiaryConversionRate", label: "Top Pack Conversion Rate (Top Unit = n Unit)", kind: "text" },
];

// Smart column-to-field auto-mapping (docs/FEATURES.md #6): match on normalized header text.
const FIELD_SYNONYMS: Record<TargetKey, string[]> = {
  name:            ["itemname", "name", "productname", "item", "description", "productitemname"],
  sku:             ["itemcode", "code", "sku", "itemsku", "productcode", "barcode"],
  companyTag:      ["companyname", "company", "companytag", "firm", "firmname"],
  category:        ["category", "itemcategory", "productcategory"],
  unit:            ["unit", "baseunit", "primaryunit", "uom"],
  secondaryUnit:   ["secondaryunit", "secunit", "pieces", "pcs"],
  conversionRate:  ["conversionrate", "conversion", "convrate"],
  tertiaryUnit:    ["tertiaryunit", "toppackunit", "topunit", "cartonunit"],
  tertiaryConversionRate: ["tertiaryconversionrate", "toppackconversionrate", "topconversion", "cartonconversion"],
  mrp:             ["mrp", "defaultmrp", "maxretailprice"],
  salePrice:       ["saleprice", "sellingprice", "price", "retailprice"],
  purchasePrice:   ["purchaseprice", "costprice", "buyprice", "purchaserate"],
  discount:        ["saliscount", "discount", "salediscount", "discountpercent", "discountamount"],
  discountType:    ["discounttype"],
  openingStock:    ["openingstockquantity", "openingstock", "stock", "qty", "quantity", "openingqty"],
  minStock:        ["minimumstockquantity", "minstock", "minimumstock", "minqty", "reorderlevel"],
  itemLocation:    ["itemlocation", "location", "storelocation"],
  taxRate:         ["taxrate", "tax", "gstrate"],
  inclusiveOfTax:  ["inclusiveoftax", "inclusiveoftax", "taxinclusive"],
};

const NO_MAP = "__none__";

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function autoMapHeaders(headers: string[]): Record<TargetKey, string> {
  const used = new Set<string>();
  const mapping = {} as Record<TargetKey, string>;
  for (const field of TARGET_FIELDS) {
    const synonyms = FIELD_SYNONYMS[field.key];
    let match = headers.find((h) => !used.has(h) && synonyms.includes(normalizeHeader(h)));
    if (!match) {
      match = headers.find((h) => !used.has(h) && synonyms.some((s) => s.length >= 3 && normalizeHeader(h).includes(s)));
    }
    mapping[field.key] = match ?? NO_MAP;
    if (match) used.add(match);
  }
  return mapping;
}

type ParsedRow = {
  name: string; sku: string; companyTag: string; category: string;
  unit: string; secondaryUnit: string; conversionRate: string;
  tertiaryUnit: string; tertiaryConversionRate: string;
  mrp?: number; salePrice?: number; purchasePrice?: number;
  discountType: string; discount?: number;
  openingStock?: number; minStock?: number; itemLocation: string;
  taxRate?: number; inclusiveOfTax: string;
  errors: string[];
};

function downloadSample() {
  const headers = TARGET_FIELDS.map((f) => f.label);
  const sample = [
    // name, sku, companyTag, category, mrp, salePrice, purchasePrice, discountType, discount,
    // openingStock, minStock, itemLocation, taxRate, inclusiveOfTax,
    // tertiaryUnit, unit, secondaryUnit(Pieces), conversionRate(Unit=nPieces), tertiaryConversionRate(TopUnit=nUnit)
    ["Sample Item A", "ITM-A1B2C3", "", "General", "120", "150", "100", "Discount %", "0", "50", "5", "Store 1", "17", "Inclusive", "", "PIECES", "", "", ""],
    ["Sample Item B", "ITM-D4E5F6", "", "General", "", "800", "650", "Discount %", "5", "20", "2", "Store 1", "17", "Inclusive", "CARTON", "BOX", "PIECES", "20", "12"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Items");
  XLSX.writeFile(wb, "godigi_items_sample.xlsx");
}

type Props = { onGoToItems?: () => void };

export function ImportItemsPage({ onGoToItems }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<"upload" | "mapping" | "preview" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<TargetKey, string>>({} as Record<TargetKey, string>);

  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [reviewTab, setReviewTab] = useState<"valid" | "errors">("valid");

  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyTag, setCompanyTag] = useState("");
  // `companies` entries (other than the synthetic "__main__" row) now carry real Company
  // UUIDs — resolve the selected name back to its id so imported items get a real companyId,
  // not just the legacy free-text companyTag.
  const selectedCompanyId = companies.find((c) => c.name === companyTag && c.id !== "__main__")?.id;

  useMemo(() => {
    api.getTenant().then((t) => {
      const mainName = t.companyName || t.phone || "My Company";
      const extras: Array<{ id: string; name: string }> = Array.isArray(t.extraCompanies) ? t.extraCompanies : [];
      const all = [{ id: "__main__", name: mainName }, ...extras];
      setCompanies(all);
      setCompanyTag(mainName);
    }).catch(() => {});
  }, []);

  function parseFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]!];
        if (!ws) { setParseError("This file has no readable sheet."); return; }
        const headerRow = (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })[0] ?? []) as unknown[];
        const cleanHeaders = headerRow.map((h) => String(h ?? "").trim()).filter(Boolean);
        if (!cleanHeaders.length) { setParseError("Couldn't find a header row in this file."); return; }
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        setHeaders(cleanHeaders);
        setRawRows(raw);
        setMapping(autoMapHeaders(cleanHeaders));
        setStage("mapping");
      } catch {
        setParseError("Couldn't read this file. Make sure it's a valid .xls or .xlsx file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function buildPreview() {
    const rows: ParsedRow[] = rawRows.map((r) => {
      const get = (key: TargetKey): unknown => {
        const h = mapping[key];
        return h && h !== NO_MAP ? r[h] : undefined;
      };
      const num = (v: unknown): number | undefined => {
        const s = String(v ?? "").trim();
        if (!s) return undefined;
        const n = Number(s);
        return Number.isFinite(n) ? n : undefined;
      };
      const name = String(get("name") ?? "").trim();
      const errors: string[] = [];
      if (!name) errors.push("Item Name is required");
      return {
        name,
        sku: String(get("sku") ?? "").trim(),
        companyTag: String(get("companyTag") ?? "").trim(),
        category: String(get("category") ?? "").trim(),
        unit: String(get("unit") ?? "").trim(),
        secondaryUnit: String(get("secondaryUnit") ?? "").trim(),
        conversionRate: String(get("conversionRate") ?? "").trim(),
        tertiaryUnit: String(get("tertiaryUnit") ?? "").trim(),
        tertiaryConversionRate: String(get("tertiaryConversionRate") ?? "").trim(),
        mrp: num(get("mrp")),
        salePrice: num(get("salePrice")),
        purchasePrice: num(get("purchasePrice")),
        discountType: String(get("discountType") ?? "").trim(),
        discount: num(get("discount")),
        openingStock: num(get("openingStock")),
        minStock: num(get("minStock")),
        itemLocation: String(get("itemLocation") ?? "").trim(),
        taxRate: num(get("taxRate")),
        inclusiveOfTax: String(get("inclusiveOfTax") ?? "").trim(),
        errors,
      };
    });
    setPreviewRows(rows);
    setReviewTab(rows.some((r) => r.errors.length) ? "errors" : "valid");
    setStage("preview");
  }

  const validRows = previewRows.filter((r) => r.errors.length === 0);
  const errorRows = previewRows.filter((r) => r.errors.length > 0);
  const displayRows = reviewTab === "valid" ? validRows : errorRows;

  async function handleImport() {
    if (!validRows.length) return;
    setImporting(true);
    setImportedCount(0);
    setFailedCount(0);
    let ok = 0, fail = 0;
    for (const r of validRows) {
      try {
        await api.createItem({
          name: r.name,
          sku: r.sku || undefined,
          category: r.category || undefined,
          unit: r.unit || undefined,
          secondaryUnit: r.secondaryUnit || undefined,
          conversionRate: r.conversionRate || undefined,
          tertiaryUnit: r.tertiaryUnit || undefined,
          tertiaryConversionRate: r.tertiaryConversionRate || undefined,
          mrp: r.mrp,
          salePrice: r.salePrice,
          purchasePrice: r.purchasePrice,
          discountType: r.discountType || undefined,
          discount: r.discount,
          openingStock: r.openingStock,
          minStock: r.minStock,
          itemLocation: r.itemLocation || undefined,
          taxRate: r.taxRate,
          inclusiveOfTax: r.inclusiveOfTax || undefined,
          companyTag: r.companyTag || companyTag || undefined,
          companyId: (r.companyTag
            ? companies.find((c) => c.name.toLowerCase() === r.companyTag.trim().toLowerCase() && c.id !== "__main__")?.id
            : selectedCompanyId) || undefined,
        });
        ok++;
      } catch {
        fail++;
      }
      setImportedCount(ok);
      setFailedCount(fail);
    }
    setImporting(false);
    setStage("done");
  }

  function resetAll() {
    setStage("upload");
    setFileName("");
    setParseError(null);
    setHeaders([]);
    setRawRows([]);
    setMapping({} as Record<TargetKey, string>);
    setPreviewRows([]);
    setImportedCount(0);
    setFailedCount(0);
  }

  return (
    <div className="impg-layout">
      <div className="impg-header">
        <h1 className="impg-header__title">Import Items From Excel File</h1>
        {companies.length > 1 && stage !== "done" && (
          <div className="impg-header__company">
            <label>Import into</label>
            <select value={companyTag} onChange={(e) => setCompanyTag(e.target.value)}>
              {companies.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {stage === "upload" && (
        <div className="impg-card">
          <div className="impg-steps">
            <div className="impg-step">
              <span className="impg-step__num">STEP 1</span>
              <p className="impg-step__text">Create an Excel file with the following format, or download a ready-made sample.</p>
              <button type="button" className="impg-outline-btn" onClick={downloadSample}>Download Sample</button>
              <div className="impg-fields-hint">
                {TARGET_FIELDS.map((f) => <span key={f.key} className="impg-fields-hint__chip">{f.label}</span>)}
              </div>
            </div>
            <div className="impg-step">
              <span className="impg-step__num">STEP 2</span>
              <p className="impg-step__text">Upload your filled .xls or .xlsx file below.</p>
            </div>
            <div className="impg-step">
              <span className="impg-step__num">STEP 3</span>
              <p className="impg-step__text">Map your columns to Godigi's fields, verify the items, and complete the import.</p>
            </div>
          </div>

          <div
            className={`impg-dropzone${dragOver ? " impg-dropzone--over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
            />
            <UploadCloudIcon />
            <p className="impg-dropzone__text">Drag &amp; Drop your file here, or <span className="impg-dropzone__link">Upload File</span></p>
            <p className="impg-dropzone__sub">.xls / .xlsx (excel sheet)</p>
          </div>
          {parseError && <div className="impg-error-banner">{parseError}</div>}
        </div>
      )}

      {stage === "mapping" && (
        <div className="impg-card">
          <div className="impg-card__title-row">
            <h2 className="impg-card__title">Map your fields to Godigi's fields</h2>
            <span className="impg-file-badge">{fileName}</span>
          </div>
          <table className="impg-map-table">
            <thead>
              <tr>
                <th>Fields available in Godigi</th>
                <th>Select your column</th>
              </tr>
            </thead>
            <tbody>
              {TARGET_FIELDS.map((f) => (
                <tr key={f.key}>
                  <td className={f.required ? "impg-map-table__required" : ""}>{f.label}</td>
                  <td>
                    <select
                      value={mapping[f.key] ?? NO_MAP}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    >
                      <option value={NO_MAP}>— Don't import —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="impg-card__footer">
            <button type="button" className="impg-outline-btn" onClick={() => setStage("upload")}>Back</button>
            <button
              type="button"
              className="impg-primary-btn"
              disabled={!mapping.name || mapping.name === NO_MAP}
              onClick={buildPreview}
            >
              Proceed
            </button>
          </div>
        </div>
      )}

      {stage === "preview" && (
        <div className="impg-card">
          <div className="impg-review-tabs">
            <button
              type="button"
              className={`impg-review-tab${reviewTab === "valid" ? " impg-review-tab--active" : ""}`}
              onClick={() => setReviewTab("valid")}
            >
              ✓ Valid Items: {validRows.length}
            </button>
            <button
              type="button"
              className={`impg-review-tab impg-review-tab--error${reviewTab === "errors" ? " impg-review-tab--active" : ""}`}
              onClick={() => setReviewTab("errors")}
            >
              ⚠ Items with Errors: {errorRows.length}
            </button>
          </div>
          <div className="impg-table-wrap">
            <table className="impg-preview-table">
              <thead>
                <tr>
                  {TARGET_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => (
                  <tr key={i} className={row.errors.length ? "impg-preview-table__row--error" : ""}>
                    <td className={row.errors.length ? "impg-preview-table__cell--invalid" : ""}>{row.name}</td>
                    <td>{row.sku}</td>
                    <td>{row.companyTag}</td>
                    <td>{row.category}</td>
                    <td>{row.mrp ?? ""}</td>
                    <td>{row.salePrice ?? ""}</td>
                    <td>{row.purchasePrice ?? ""}</td>
                    <td>{row.discountType}</td>
                    <td>{row.discount ?? ""}</td>
                    <td>{row.openingStock ?? ""}</td>
                    <td>{row.minStock ?? ""}</td>
                    <td>{row.itemLocation}</td>
                    <td>{row.taxRate ?? ""}</td>
                    <td>{row.inclusiveOfTax}</td>
                    <td>{row.tertiaryUnit}</td>
                    <td>{row.unit}</td>
                    <td>{row.secondaryUnit}</td>
                    <td>{row.conversionRate}</td>
                    <td>{row.tertiaryConversionRate}</td>
                  </tr>
                ))}
                {displayRows.length === 0 && (
                  <tr><td colSpan={TARGET_FIELDS.length} className="impg-preview-table__empty">No {reviewTab === "valid" ? "valid" : "error"} rows</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="impg-card__footer">
            <button type="button" className="impg-outline-btn" onClick={() => setStage("mapping")} disabled={importing}>Back</button>
            <button
              type="button"
              className="impg-primary-btn"
              disabled={!validRows.length || importing}
              onClick={() => void handleImport()}
            >
              {importing ? `Importing ${importedCount}/${validRows.length}…` : `Import ${validRows.length} Valid Item${validRows.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="impg-card impg-done">
          <CheckCircleIcon />
          <p className="impg-done__title">{importedCount} item{importedCount !== 1 ? "s" : ""} imported successfully</p>
          {failedCount > 0 && <p className="impg-done__sub">{failedCount} item{failedCount !== 1 ? "s" : ""} failed to import.</p>}
          <div className="impg-card__footer" style={{ justifyContent: "center" }}>
            <button type="button" className="impg-outline-btn" onClick={resetAll}>Import More</button>
            <button type="button" className="impg-primary-btn" onClick={() => onGoToItems?.()}>Go to Items</button>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadCloudIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" width="44" height="44">
      <path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4.5 4.5 0 0 1 .5 8.97" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12v6M9 15l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="#16a34a" width="48" height="48">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14.414-4.707-4.707 1.414-1.414L11 13.586l5.293-5.293 1.414 1.414L11 16.414z" />
    </svg>
  );
}

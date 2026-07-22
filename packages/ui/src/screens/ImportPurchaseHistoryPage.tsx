import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";

const PURCHASE_REPORT_SHEET = "Purchase Report";
const ITEM_DETAILS_SHEET = "Item Details";

const REQUIRED_PURCHASE_REPORT_HEADERS = ["Date", "Invoice No", "Party Name", "Total Amount"];
const REQUIRED_ITEM_DETAILS_HEADERS = ["Invoice No./Txn No.", "Item Name", "Quantity", "UnitPrice"];

type RawRow = Record<string, unknown>;

type LineItem = { name: string; qty: number; unit?: string; rate: number };
type AggregatedItem = { name: string; unit?: string; sku?: string; purchasePrice?: number; lastTimestamp: number };
type AggregatedParty = { name: string; phone?: string };
type AggregatedInvoice = {
  number: string; date: string; partyName: string; transactionType: string;
  total: number; balance: number;
  lineItems: LineItem[];
};

type Summary = {
  totalInvoiceRows: number;
  totalItemRows: number;
  items: AggregatedItem[];
  parties: AggregatedParty[];
  invoices: AggregatedInvoice[];
  skippedInvoices: number;
  skippedItemRows: number;
  minDate: string | null;
  maxDate: string | null;
};

// Matches the same mixed date-serial / "DD/MM/YYYY" text convention used across the other
// legacy-export importers.
function parseSheetDate(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "string" && v.trim()) {
    const s = v.trim();
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      const [, dd, mm, yyyy] = dmy;
      const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

// Unlike the Sale/Cash Flow exports, this report has a title/timestamp row (and sometimes a
// blank row) above the real header row — scan the first few rows for the one that actually
// contains every required column, instead of assuming row 0 is the header.
function findHeaderRowIndex(ws: XLSX.WorkSheet, requiredHeaders: string[], maxScanRows = 8): number {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  for (let i = 0; i < Math.min(maxScanRows, aoa.length); i++) {
    const row = (aoa[i] ?? []).map((c) => String(c ?? "").trim());
    if (requiredHeaders.every((h) => row.includes(h))) return i;
  }
  return -1;
}

function readSheetRows(ws: XLSX.WorkSheet, requiredHeaders: string[]): { rows: RawRow[]; headerRowIndex: number } {
  const headerRowIndex = findHeaderRowIndex(ws, requiredHeaders);
  if (headerRowIndex === -1) return { rows: [], headerRowIndex: -1 };
  const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { range: headerRowIndex, defval: "" });
  return { rows, headerRowIndex };
}

// "Purchase Report" is the invoice-level tab (one row per purchase bill: totals, balance,
// supplier). "Item Details" is the line-item tab, joined back via "Invoice No./Txn No." <->
// "Invoice No". Totals/balance always come from Purchase Report, never summed from line items.
function buildSummary(purchaseRows: RawRow[], itemRows: RawRow[]): Summary {
  const itemRowsByInvoice = new Map<string, RawRow[]>();
  for (const r of itemRows) {
    const invoiceNo = String(r["Invoice No./Txn No."] ?? "").trim();
    if (!invoiceNo) continue;
    const list = itemRowsByInvoice.get(invoiceNo);
    if (list) list.push(r); else itemRowsByInvoice.set(invoiceNo, [r]);
  }

  const itemsByKey = new Map<string, AggregatedItem>();
  const partiesByKey = new Map<string, AggregatedParty>();
  const invoices: AggregatedInvoice[] = [];
  const seenInvoiceNumbers = new Set<string>();
  let skippedInvoices = 0;
  let skippedItemRows = 0;
  let minMs = Infinity;
  let maxMs = -Infinity;

  for (const r of purchaseRows) {
    const invoiceNo = String(r["Invoice No"] ?? "").trim();
    const partyName = String(r["Party Name"] ?? "").trim();
    const dateIso = parseSheetDate(r["Date"]);
    const total = Number(r["Total Amount"]) || 0;
    const balanceRaw = r["Balance Due"];
    const balance = balanceRaw !== undefined && String(balanceRaw).trim() !== "" ? Number(balanceRaw) || 0 : total;
    const phone = String(r["Party Phone No."] ?? "").trim() || undefined;

    if (!invoiceNo || !partyName || !dateIso || seenInvoiceNumbers.has(invoiceNo)) { skippedInvoices++; continue; }
    seenInvoiceNumbers.add(invoiceNo);

    const timestamp = new Date(dateIso).getTime();
    minMs = Math.min(minMs, timestamp);
    maxMs = Math.max(maxMs, timestamp);

    const partyKey = partyName.toLowerCase();
    const existingParty = partiesByKey.get(partyKey);
    if (!existingParty) partiesByKey.set(partyKey, { name: partyName, phone });
    else if (!existingParty.phone && phone) existingParty.phone = phone;

    const rawLineItems = itemRowsByInvoice.get(invoiceNo) ?? [];
    const lineItems: LineItem[] = [];
    let transactionType = "Purchase";
    for (const lr of rawLineItems) {
      const itemName = String(lr["Item Name"] ?? "").trim();
      if (!itemName) { skippedItemRows++; continue; }
      const qty = Number(lr["Quantity"]) || 0;
      const unit = String(lr["Unit"] ?? "").trim() || undefined;
      const sku = String(lr["Item Code"] ?? "").trim() || undefined;
      const rate = Number(lr["UnitPrice"]) || 0;
      const lrType = String(lr["Transaction Type"] ?? "").trim();
      if (lrType) transactionType = lrType;

      lineItems.push({ name: itemName, qty, unit, rate });

      const itemKey = itemName.toLowerCase();
      const existingItem = itemsByKey.get(itemKey);
      if (!existingItem || timestamp >= existingItem.lastTimestamp) {
        itemsByKey.set(itemKey, { name: itemName, unit, sku, purchasePrice: rate || undefined, lastTimestamp: timestamp });
      }
    }

    invoices.push({
      number: invoiceNo, date: dateIso, partyName, transactionType,
      total, balance, lineItems,
    });
  }

  return {
    totalInvoiceRows: purchaseRows.length,
    totalItemRows: itemRows.length,
    items: [...itemsByKey.values()],
    parties: [...partiesByKey.values()],
    invoices,
    skippedInvoices,
    skippedItemRows,
    minDate: Number.isFinite(minMs) ? new Date(minMs).toISOString() : null,
    maxDate: Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : null,
  };
}

type Stage = "upload" | "preview" | "importing" | "done";

type JobProgress = {
  status: "processing" | "done" | "error";
  total: number; processed: number;
  itemsCreated: number; partiesCreated: number; invoicesImported: number; invoicesSkipped: number;
  error?: string;
};

type Props = { onGoToPurchases?: () => void };

export function ImportPurchaseHistoryPage({ onGoToPurchases }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);

  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyTag, setCompanyTag] = useState("");

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

        const findSheet = (name: string) => wb.SheetNames.find((n) => n.trim().toLowerCase() === name.toLowerCase());
        const purchaseSheetName = findSheet(PURCHASE_REPORT_SHEET);
        const itemSheetName = findSheet(ITEM_DETAILS_SHEET);
        if (!purchaseSheetName || !itemSheetName) {
          const missingTabs = [!purchaseSheetName && `"${PURCHASE_REPORT_SHEET}"`, !itemSheetName && `"${ITEM_DETAILS_SHEET}"`].filter(Boolean);
          setParseError(`This file is missing the ${missingTabs.join(" and ")} tab. Found: ${wb.SheetNames.join(", ")}`);
          return;
        }

        const { rows: purchaseRows, headerRowIndex: purchaseHeaderIdx } = readSheetRows(wb.Sheets[purchaseSheetName]!, REQUIRED_PURCHASE_REPORT_HEADERS);
        const { rows: itemRows, headerRowIndex: itemHeaderIdx } = readSheetRows(wb.Sheets[itemSheetName]!, REQUIRED_ITEM_DETAILS_HEADERS);
        if (purchaseHeaderIdx === -1 || itemHeaderIdx === -1) {
          const parts: string[] = [];
          if (purchaseHeaderIdx === -1) parts.push(`Couldn't find the expected header row in "${PURCHASE_REPORT_SHEET}" (needs: ${REQUIRED_PURCHASE_REPORT_HEADERS.join(", ")})`);
          if (itemHeaderIdx === -1) parts.push(`Couldn't find the expected header row in "${ITEM_DETAILS_SHEET}" (needs: ${REQUIRED_ITEM_DETAILS_HEADERS.join(", ")})`);
          setParseError(parts.join(" — "));
          return;
        }

        setSummary(buildSummary(purchaseRows, itemRows));
        setStage("preview");
      } catch {
        setParseError(`Couldn't read this file. Make sure it's a valid .xls or .xlsx file with "${PURCHASE_REPORT_SHEET}" and "${ITEM_DETAILS_SHEET}" tabs.`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function startImport() {
    if (!summary) return;
    setStage("importing");
    setProgress({ status: "processing", total: summary.invoices.length, processed: 0, itemsCreated: 0, partiesCreated: 0, invoicesImported: 0, invoicesSkipped: 0 });
    try {
      const { jobId } = await api.startPurchaseHistoryImport({
        companyTag: companyTag || undefined,
        items: summary.items.map((i) => ({ name: i.name, unit: i.unit, sku: i.sku, purchasePrice: i.purchasePrice })),
        parties: summary.parties.map((p) => ({ name: p.name, phone: p.phone })),
        invoices: summary.invoices.map((inv) => ({
          number: inv.number, date: inv.date, partyName: inv.partyName,
          transactionType: inv.transactionType, total: inv.total, balance: inv.balance,
          lineItems: inv.lineItems,
        })),
      });
      const poll = async () => {
        const status = await api.getPurchaseHistoryImportStatus(jobId);
        setProgress(status);
        if (status.status === "processing") setTimeout(poll, 1500);
        else setStage("done");
      };
      void poll();
    } catch {
      setProgress((p) => p ? { ...p, status: "error", error: "Failed to start import. Check your connection and try again." } : p);
      setStage("done");
    }
  }

  function resetAll() {
    setStage("upload");
    setFileName("");
    setParseError(null);
    setSummary(null);
    setProgress(null);
  }

  const progressPct = progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div className="impg-layout">
      <div className="impg-header">
        <h1 className="impg-header__title">Import Purchase History From Excel File</h1>
        {companies.length > 1 && stage === "preview" && (
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
              <p className="impg-step__text">
                Export your old purchase register as an Excel file with two tabs: a "{PURCHASE_REPORT_SHEET}" tab (one row per bill) and an "{ITEM_DETAILS_SHEET}" tab (one row per item purchased, linked back by invoice number).
              </p>
              <p className="impg-step__text" style={{ fontWeight: 600, marginBottom: 4 }}>{PURCHASE_REPORT_SHEET} needs:</p>
              <div className="impg-fields-hint">
                {REQUIRED_PURCHASE_REPORT_HEADERS.map((h) => <span key={h} className="impg-fields-hint__chip">{h}</span>)}
              </div>
              <p className="impg-step__text" style={{ fontWeight: 600, margin: "10px 0 4px" }}>{ITEM_DETAILS_SHEET} needs:</p>
              <div className="impg-fields-hint">
                {REQUIRED_ITEM_DETAILS_HEADERS.map((h) => <span key={h} className="impg-fields-hint__chip">{h}</span>)}
              </div>
            </div>
            <div className="impg-step">
              <span className="impg-step__num">STEP 2</span>
              <p className="impg-step__text">Upload the file below — no column mapping needed, this importer reads both tabs directly (even with a report title row above the headers).</p>
            </div>
            <div className="impg-step">
              <span className="impg-step__num">STEP 3</span>
              <p className="impg-step__text">Review the summary — including how many items landed in each bill — then import. Items, Suppliers, and Purchase bills are created automatically.</p>
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

      {stage === "preview" && summary && (
        <div className="impg-card">
          <div className="impg-card__title-row">
            <h2 className="impg-card__title">Ready to import</h2>
            <span className="impg-file-badge">{fileName}</span>
          </div>
          <div className="impg-fields-hint" style={{ marginBottom: 20 }}>
            <span className="impg-fields-hint__chip">{summary.totalInvoiceRows.toLocaleString()} bill rows read</span>
            <span className="impg-fields-hint__chip">{summary.totalItemRows.toLocaleString()} item-detail rows read</span>
            <span className="impg-fields-hint__chip">{summary.items.length.toLocaleString()} unique items</span>
            <span className="impg-fields-hint__chip">{summary.parties.length.toLocaleString()} unique suppliers</span>
            <span className="impg-fields-hint__chip">{summary.invoices.length.toLocaleString()} bills</span>
            {summary.minDate && summary.maxDate && (
              <span className="impg-fields-hint__chip">
                {new Date(summary.minDate).toLocaleDateString()} – {new Date(summary.maxDate).toLocaleDateString()}
              </span>
            )}
          </div>
          {(summary.skippedInvoices > 0 || summary.skippedItemRows > 0) && (
            <div className="impg-error-banner" style={{ marginBottom: 16 }}>
              {summary.skippedInvoices > 0 && `${summary.skippedInvoices.toLocaleString()} bill row(s) skipped — missing invoice no., party, date, or a duplicate invoice no.`}
              {summary.skippedInvoices > 0 && summary.skippedItemRows > 0 && " "}
              {summary.skippedItemRows > 0 && `${summary.skippedItemRows.toLocaleString()} item-detail row(s) skipped — missing item name.`}
            </div>
          )}
          <div className="impg-table-wrap" style={{ marginBottom: 20, maxHeight: 320, overflowY: "auto" }}>
            <table className="impg-preview-table">
              <thead>
                <tr>
                  <th>Invoice No</th><th>Supplier</th><th>Date</th><th>Total</th><th>Balance</th><th>Items</th>
                </tr>
              </thead>
              <tbody>
                {summary.invoices.slice(0, 200).map((inv) => (
                  <tr key={inv.number}>
                    <td>{inv.number}</td>
                    <td>{inv.partyName}</td>
                    <td>{new Date(inv.date).toLocaleDateString()}</td>
                    <td>{inv.total.toLocaleString()}</td>
                    <td>{inv.balance.toLocaleString()}</td>
                    <td>{inv.lineItems.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summary.invoices.length > 200 && (
              <div style={{ padding: 10, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                + {(summary.invoices.length - 200).toLocaleString()} more bills not shown
              </div>
            )}
          </div>
          <p className="impg-step__text">
            Each bill is imported with its recorded total and balance due from the {PURCHASE_REPORT_SHEET} tab.
            Re-running this same file later will skip bills already imported — it's safe to retry.
          </p>
          <div className="impg-card__footer">
            <button type="button" className="impg-outline-btn" onClick={resetAll}>Back</button>
            <button type="button" className="impg-primary-btn" onClick={() => void startImport()}>
              Import {summary.invoices.length.toLocaleString()} Bills
            </button>
          </div>
        </div>
      )}

      {stage === "importing" && progress && (
        <div className="impg-card impg-done">
          <p className="impg-done__title">Importing… {progress.processed.toLocaleString()} / {progress.total.toLocaleString()}</p>
          <div className="impg-progress-track">
            <div className="impg-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="impg-step__text" style={{ marginTop: 16 }}>
            {progress.invoicesImported.toLocaleString()} imported · {progress.invoicesSkipped.toLocaleString()} skipped
          </p>
        </div>
      )}

      {stage === "done" && progress && (
        <div className="impg-card impg-done">
          {progress.status === "error" ? (
            <>
              <p className="impg-done__title">Import failed</p>
              <p className="impg-done__sub">{progress.error ?? "Something went wrong."}</p>
            </>
          ) : (
            <>
              <CheckCircleIcon />
              <p className="impg-done__title">{progress.invoicesImported.toLocaleString()} bills imported</p>
              <p className="impg-step__text">
                {progress.itemsCreated.toLocaleString()} items created · {progress.partiesCreated.toLocaleString()} suppliers created
                {progress.invoicesSkipped > 0 && ` · ${progress.invoicesSkipped.toLocaleString()} bills skipped (already imported)`}
              </p>
            </>
          )}
          <div className="impg-card__footer" style={{ justifyContent: "center", marginTop: 16 }}>
            <button type="button" className="impg-outline-btn" onClick={resetAll}>Import Another File</button>
            <button type="button" className="impg-primary-btn" onClick={() => onGoToPurchases?.()}>Go to Purchase Bills</button>
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

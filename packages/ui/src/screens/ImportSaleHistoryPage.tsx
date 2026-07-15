import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";

const EXPECTED_HEADERS = [
  "Date", "Invoice No./Txn No.", "Party Name", "Item Name", "Item Code",
  "Category", "Challan/Order No.", "Quantity", "Unit", "UnitPrice",
  "Transaction Type", "Amount",
];

type RawRow = Record<string, unknown>;

type AggregatedItem = { name: string; unit?: string; sku?: string; salePrice?: number; lastTimestamp: number };
type AggregatedParty = { name: string };
type AggregatedInvoice = {
  number: string; date: string; partyName: string; transactionType: string;
  total: number; lineItems: Array<{ name: string; qty: number; unit?: string; rate: number }>;
};

type Summary = {
  totalRows: number;
  items: AggregatedItem[];
  parties: AggregatedParty[];
  invoices: AggregatedInvoice[];
  skippedRows: number;
  minDate: string | null;
  maxDate: string | null;
};

// The sheet mixes real Excel date-serial numbers with plain "DD/MM/YYYY" text cells
// (observed in ~60% of rows in the source export) — both must parse to the same date.
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

function buildSummary(rows: RawRow[]): Summary {
  const itemsByKey = new Map<string, AggregatedItem>();
  const partiesByKey = new Map<string, AggregatedParty>();
  const invoicesByNumber = new Map<string, AggregatedInvoice>();
  let skippedRows = 0;
  let minMs = Infinity;
  let maxMs = -Infinity;

  for (const r of rows) {
    const itemName = String(r["Item Name"] ?? "").trim();
    const partyName = String(r["Party Name"] ?? "").trim();
    const invoiceNo = String(r["Invoice No./Txn No."] ?? "").trim();
    const dateIso = parseSheetDate(r["Date"]);
    const qty = Number(r["Quantity"]) || 0;
    const unitPrice = Number(r["UnitPrice"]) || 0;
    const amount = Number(r["Amount"]) || 0;
    const unit = String(r["Unit"] ?? "").trim() || undefined;
    const sku = String(r["Item Code"] ?? "").trim() || undefined;
    const txnType = String(r["Transaction Type"] ?? "").trim() || "Sale";

    if (!itemName || !partyName || !invoiceNo || !dateIso) { skippedRows++; continue; }

    const timestamp = new Date(dateIso).getTime();
    minMs = Math.min(minMs, timestamp);
    maxMs = Math.max(maxMs, timestamp);

    const itemKey = itemName.toLowerCase();
    const existingItem = itemsByKey.get(itemKey);
    if (!existingItem || timestamp >= existingItem.lastTimestamp) {
      itemsByKey.set(itemKey, { name: itemName, unit, sku, salePrice: unitPrice || undefined, lastTimestamp: timestamp });
    }

    const partyKey = partyName.toLowerCase();
    if (!partiesByKey.has(partyKey)) partiesByKey.set(partyKey, { name: partyName });

    let invoice = invoicesByNumber.get(invoiceNo);
    if (!invoice) {
      invoice = { number: invoiceNo, date: dateIso, partyName, transactionType: txnType, total: 0, lineItems: [] };
      invoicesByNumber.set(invoiceNo, invoice);
    }
    invoice.total += amount;
    invoice.lineItems.push({ name: itemName, qty, unit, rate: unitPrice });
  }

  return {
    totalRows: rows.length,
    items: [...itemsByKey.values()],
    parties: [...partiesByKey.values()],
    invoices: [...invoicesByNumber.values()],
    skippedRows,
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

type Props = { onGoToParties?: () => void };

export function ImportSaleHistoryPage({ onGoToParties }: Props) {
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
        const ws = wb.Sheets[wb.SheetNames[0]!];
        if (!ws) { setParseError("This file has no readable sheet."); return; }
        const headerRow = (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })[0] ?? []) as unknown[];
        const cleanHeaders = headerRow.map((h) => String(h ?? "").trim()).filter(Boolean);
        const missing = EXPECTED_HEADERS.filter((h) => !cleanHeaders.includes(h));
        if (missing.length) {
          setParseError(`This doesn't look like a Vyapar sale-history export. Missing columns: ${missing.join(", ")}`);
          return;
        }
        const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "" });
        setSummary(buildSummary(rows));
        setStage("preview");
      } catch {
        setParseError("Couldn't read this file. Make sure it's a valid .xls or .xlsx file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function startImport() {
    if (!summary) return;
    setStage("importing");
    setProgress({ status: "processing", total: summary.invoices.length, processed: 0, itemsCreated: 0, partiesCreated: 0, invoicesImported: 0, invoicesSkipped: 0 });
    try {
      const { jobId } = await api.startSaleHistoryImport({
        companyTag: companyTag || undefined,
        items: summary.items.map((i) => ({ name: i.name, unit: i.unit, sku: i.sku, salePrice: i.salePrice })),
        parties: summary.parties.map((p) => ({ name: p.name })),
        invoices: summary.invoices.map((inv) => ({
          number: inv.number, date: inv.date, partyName: inv.partyName,
          transactionType: inv.transactionType, total: inv.total, lineItems: inv.lineItems,
        })),
      });
      const poll = async () => {
        const status = await api.getSaleHistoryImportStatus(jobId);
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
        <h1 className="impg-header__title">Import Sale History From Excel File</h1>
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
                Export your old sale register as an Excel file with these columns (in any order):
              </p>
              <div className="impg-fields-hint">
                {EXPECTED_HEADERS.map((h) => <span key={h} className="impg-fields-hint__chip">{h}</span>)}
              </div>
            </div>
            <div className="impg-step">
              <span className="impg-step__num">STEP 2</span>
              <p className="impg-step__text">Upload the file below — no column mapping needed, this importer reads the fixed export format directly.</p>
            </div>
            <div className="impg-step">
              <span className="impg-step__num">STEP 3</span>
              <p className="impg-step__text">Review the summary, then import. Items, Parties, and Sale invoices are created automatically.</p>
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
            <span className="impg-fields-hint__chip">{summary.totalRows.toLocaleString()} rows read</span>
            <span className="impg-fields-hint__chip">{summary.items.length.toLocaleString()} unique items</span>
            <span className="impg-fields-hint__chip">{summary.parties.length.toLocaleString()} unique parties</span>
            <span className="impg-fields-hint__chip">{summary.invoices.length.toLocaleString()} invoices</span>
            {summary.minDate && summary.maxDate && (
              <span className="impg-fields-hint__chip">
                {new Date(summary.minDate).toLocaleDateString()} – {new Date(summary.maxDate).toLocaleDateString()}
              </span>
            )}
          </div>
          {summary.skippedRows > 0 && (
            <div className="impg-error-banner" style={{ marginBottom: 16 }}>
              {summary.skippedRows.toLocaleString()} row(s) were skipped — missing item, party, invoice number, or date.
            </div>
          )}
          <p className="impg-step__text">
            Each invoice will be recorded as an outstanding Sale (full amount added to that party's balance).
            Re-running this same file later will skip invoices already imported — it's safe to retry.
          </p>
          <div className="impg-card__footer">
            <button type="button" className="impg-outline-btn" onClick={resetAll}>Back</button>
            <button type="button" className="impg-primary-btn" onClick={() => void startImport()}>
              Import {summary.invoices.length.toLocaleString()} Invoices
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
              <p className="impg-done__title">{progress.invoicesImported.toLocaleString()} invoices imported</p>
              <p className="impg-step__text">
                {progress.itemsCreated.toLocaleString()} items created · {progress.partiesCreated.toLocaleString()} parties created
                {progress.invoicesSkipped > 0 && ` · ${progress.invoicesSkipped.toLocaleString()} invoices skipped (already imported)`}
              </p>
            </>
          )}
          <div className="impg-card__footer" style={{ justifyContent: "center", marginTop: 16 }}>
            <button type="button" className="impg-outline-btn" onClick={resetAll}>Import Another File</button>
            <button type="button" className="impg-primary-btn" onClick={() => onGoToParties?.()}>Go to Parties</button>
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

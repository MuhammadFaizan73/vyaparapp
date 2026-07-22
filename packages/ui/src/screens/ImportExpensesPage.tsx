import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";

const REQUIRED_HEADERS = ["Date", "Category Name", "Payment Type", "Total Amount"];
const DEFAULT_PARTY_NAME = "Business Expenses";

type RawRow = Record<string, unknown>;

type ExpenseEntry = {
  category: string; paymentType: string; date: string;
  amount: number; balance: number; number: string; description?: string;
};
type CategoryBreakdown = { category: string; count: number; total: number };

type Summary = {
  totalRows: number;
  skippedRows: number;
  entries: ExpenseEntry[];
  perCategory: CategoryBreakdown[];
  totalAmount: number;
  minDate: string | null;
  maxDate: string | null;
};

// Matches the same mixed date-serial / "DD/MM/YYYY" text convention used across the other
// legacy-export importers (Sale History, Cash Flow, Import Items).
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
  const perCategoryByKey = new Map<string, CategoryBreakdown>();
  const entries: ExpenseEntry[] = [];
  let skippedRows = 0;
  let minMs = Infinity;
  let maxMs = -Infinity;
  let totalAmount = 0;
  let autoIndex = 0;

  for (const r of rows) {
    autoIndex++;
    const category = String(r["Category Name"] ?? "").trim();
    const dateIso = parseSheetDate(r["Date"]);
    const amount = Number(r["Total Amount"]) || 0;
    const paymentType = String(r["Payment Type"] ?? "").trim() || "Cash";
    const refNo = String(r["Invoice No"] ?? "").trim();
    const description = String(r["Description"] ?? "").trim() || undefined;
    const balanceRaw = r["Balance Due"];
    const balance = balanceRaw !== undefined && String(balanceRaw).trim() !== "" ? Number(balanceRaw) || 0 : amount;

    if (!category || !dateIso || !(amount > 0)) { skippedRows++; continue; }

    const timestamp = new Date(dateIso).getTime();
    minMs = Math.min(minMs, timestamp);
    maxMs = Math.max(maxMs, timestamp);

    // Source file has no invoice numbers for expenses — synthesize a stable per-row number
    // so re-running the same file later is a no-op instead of double-importing.
    const number = refNo || `AUTO-${autoIndex}`;
    entries.push({ category, paymentType, date: dateIso, amount, balance, number, description });
    totalAmount += amount;

    const key = category.toLowerCase();
    const agg = perCategoryByKey.get(key) ?? { category, count: 0, total: 0 };
    agg.count++;
    agg.total += amount;
    perCategoryByKey.set(key, agg);
  }

  return {
    totalRows: rows.length,
    skippedRows,
    entries,
    perCategory: [...perCategoryByKey.values()].sort((a, b) => b.total - a.total),
    totalAmount,
    minDate: Number.isFinite(minMs) ? new Date(minMs).toISOString() : null,
    maxDate: Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : null,
  };
}

type Stage = "upload" | "preview" | "importing" | "done";

type JobProgress = {
  status: "processing" | "done" | "error";
  total: number; processed: number;
  itemsCreated: number; partiesCreated: number;
  invoicesImported: number; invoicesSkipped: number;
  entriesImported: number; entriesSkipped: number;
  error?: string;
};

type Props = { onGoToExpenses?: () => void };

export function ImportExpensesPage({ onGoToExpenses }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);

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
        const missing = REQUIRED_HEADERS.filter((h) => !cleanHeaders.includes(h));
        if (missing.length) {
          setParseError(`This doesn't look like an expense export. Missing columns: ${missing.join(", ")}`);
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
    setProgress({
      status: "processing", total: summary.entries.length, processed: 0,
      itemsCreated: 0, partiesCreated: 0, invoicesImported: 0, invoicesSkipped: 0,
      entriesImported: 0, entriesSkipped: 0,
    });
    try {
      const { jobId } = await api.startExpenseImport({
        partyName: DEFAULT_PARTY_NAME,
        entries: summary.entries.map((e) => ({
          category: e.category, paymentType: e.paymentType, date: e.date,
          amount: e.amount, balance: e.balance, number: e.number, description: e.description,
        })),
      });
      const poll = async () => {
        const status = await api.getExpenseImportStatus(jobId);
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
        <h1 className="impg-header__title">Import Expenses From Excel File</h1>
      </div>

      {stage === "upload" && (
        <div className="impg-card">
          <div className="impg-steps">
            <div className="impg-step">
              <span className="impg-step__num">STEP 1</span>
              <p className="impg-step__text">
                Export your expense report as an Excel file with these columns (in any order):
              </p>
              <div className="impg-fields-hint">
                {REQUIRED_HEADERS.map((h) => <span key={h} className="impg-fields-hint__chip">{h}</span>)}
              </div>
            </div>
            <div className="impg-step">
              <span className="impg-step__num">STEP 2</span>
              <p className="impg-step__text">
                Upload the file below. Expenses in this data have no vendor/party of their own, so every
                imported expense is recorded against a single "{DEFAULT_PARTY_NAME}" party — rename it later if you'd prefer.
              </p>
            </div>
            <div className="impg-step">
              <span className="impg-step__num">STEP 3</span>
              <p className="impg-step__text">Review the totals per category, then import.</p>
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
            <span className="impg-fields-hint__chip">{summary.entries.length.toLocaleString()} expenses</span>
            <span className="impg-fields-hint__chip">{summary.perCategory.length.toLocaleString()} categories</span>
            <span className="impg-fields-hint__chip">Total: Rs {summary.totalAmount.toLocaleString()}</span>
            {summary.minDate && summary.maxDate && (
              <span className="impg-fields-hint__chip">
                {new Date(summary.minDate).toLocaleDateString()} – {new Date(summary.maxDate).toLocaleDateString()}
              </span>
            )}
          </div>
          {summary.skippedRows > 0 && (
            <div className="impg-error-banner" style={{ marginBottom: 16 }}>
              {summary.skippedRows.toLocaleString()} row(s) skipped — missing category, date, or a zero/blank amount.
            </div>
          )}
          <p className="impg-step__text" style={{ fontWeight: 600, marginBottom: 8 }}>Totals by category</p>
          <div className="impg-table-wrap" style={{ marginBottom: 20, maxHeight: 320, overflowY: "auto" }}>
            <table className="impg-preview-table">
              <thead>
                <tr>
                  <th>Category</th><th>Count</th><th>Total (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {summary.perCategory.map((c) => (
                  <tr key={c.category}>
                    <td>{c.category}</td>
                    <td>{c.count}</td>
                    <td>{c.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="impg-step__text">
            Each row becomes an Expense record against "{DEFAULT_PARTY_NAME}".
            Re-running this same file later will skip expenses already imported — it's safe to retry.
          </p>
          <div className="impg-card__footer">
            <button type="button" className="impg-outline-btn" onClick={resetAll}>Back</button>
            <button type="button" className="impg-primary-btn" onClick={() => void startImport()}>
              Import {summary.entries.length.toLocaleString()} Expenses
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
            {progress.entriesImported.toLocaleString()} imported · {progress.entriesSkipped.toLocaleString()} skipped
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
              <p className="impg-done__title">{progress.entriesImported.toLocaleString()} expenses imported</p>
              <p className="impg-step__text">
                {progress.entriesSkipped > 0 && `${progress.entriesSkipped.toLocaleString()} expenses skipped (already imported)`}
              </p>
            </>
          )}
          <div className="impg-card__footer" style={{ justifyContent: "center", marginTop: 16 }}>
            <button type="button" className="impg-outline-btn" onClick={resetAll}>Import Another File</button>
            <button type="button" className="impg-primary-btn" onClick={() => onGoToExpenses?.()}>Go to Expenses</button>
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

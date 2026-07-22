import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";

const REQUIRED_HEADERS = ["Date", "Name", "Type", "Cash In Amount", "Cash Out Amount"];

type RawRow = Record<string, unknown>;

type CashFlowEntry = {
  partyName: string; type: "payment_in" | "payment_out"; date: string;
  amount: number; number: string; description?: string;
};
type AggregatedParty = { name: string };
type PartyBreakdown = {
  partyName: string; cashInCount: number; cashInTotal: number; cashOutCount: number; cashOutTotal: number;
};

type Summary = {
  totalRows: number;
  ignoredNonPartyRows: number;
  skippedRows: number;
  parties: AggregatedParty[];
  entries: CashFlowEntry[];
  perParty: PartyBreakdown[];
  cashInTotal: number;
  cashOutTotal: number;
  minDate: string | null;
  maxDate: string | null;
};

// Matches the same mixed date-serial / "DD/MM/YYYY" text convention used across the other
// legacy-export importers (Sale History, Import Items).
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

// Only "Payment-In"/"Payment-Out" rows are tied to a real party — Expense, cash-counter
// Sale, Other Income, and cash-adjustment rows are skipped entirely (not counted as errors,
// just out of scope for a per-party ledger; they belong in a Cash In Hand book instead).
function buildSummary(rows: RawRow[]): Summary {
  const partiesByKey = new Map<string, AggregatedParty>();
  const perPartyByKey = new Map<string, PartyBreakdown>();
  const entries: CashFlowEntry[] = [];
  let ignoredNonPartyRows = 0;
  let skippedRows = 0;
  let minMs = Infinity;
  let maxMs = -Infinity;
  let cashInTotal = 0;
  let cashOutTotal = 0;
  let autoIndex = 0;

  for (const r of rows) {
    autoIndex++;
    const typeRaw = String(r["Type"] ?? "").trim().toLowerCase();
    if (typeRaw !== "payment-in" && typeRaw !== "payment-out") { ignoredNonPartyRows++; continue; }

    const partyName = String(r["Name"] ?? "").trim();
    const dateIso = parseSheetDate(r["Date"]);
    const cashIn = Number(r["Cash In Amount"]) || 0;
    const cashOut = Number(r["Cash Out Amount"]) || 0;
    const type: "payment_in" | "payment_out" = typeRaw === "payment-in" ? "payment_in" : "payment_out";
    const amount = type === "payment_in" ? cashIn : cashOut;
    const refNo = String(r["Reference No"] ?? "").trim();
    const description = String(r["Description"] ?? "").trim() || undefined;

    if (!partyName || !dateIso || !(amount > 0)) { skippedRows++; continue; }

    const timestamp = new Date(dateIso).getTime();
    minMs = Math.min(minMs, timestamp);
    maxMs = Math.max(maxMs, timestamp);

    const partyKey = partyName.toLowerCase();
    if (!partiesByKey.has(partyKey)) partiesByKey.set(partyKey, { name: partyName });

    // Payment-In rows always carry a unique Reference No in this export; Payment-Out rows
    // never do — synthesize a stable per-row number so re-running the same file is a no-op.
    const number = refNo || `AUTO-${autoIndex}`;
    entries.push({ partyName, type, date: dateIso, amount, number, description });

    const agg = perPartyByKey.get(partyKey) ?? { partyName, cashInCount: 0, cashInTotal: 0, cashOutCount: 0, cashOutTotal: 0 };
    if (type === "payment_in") { agg.cashInCount++; agg.cashInTotal += amount; cashInTotal += amount; }
    else { agg.cashOutCount++; agg.cashOutTotal += amount; cashOutTotal += amount; }
    perPartyByKey.set(partyKey, agg);
  }

  return {
    totalRows: rows.length,
    ignoredNonPartyRows,
    skippedRows,
    parties: [...partiesByKey.values()],
    entries,
    perParty: [...perPartyByKey.values()].sort((a, b) => (b.cashInTotal + b.cashOutTotal) - (a.cashInTotal + a.cashOutTotal)),
    cashInTotal,
    cashOutTotal,
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

type Props = { onGoToParties?: () => void };

export function ImportCashFlowPage({ onGoToParties }: Props) {
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
          setParseError(`This doesn't look like a cash flow export. Missing columns: ${missing.join(", ")}`);
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
      const { jobId } = await api.startCashFlowImport({
        parties: summary.parties.map((p) => ({ name: p.name })),
        entries: summary.entries.map((e) => ({
          partyName: e.partyName, type: e.type, date: e.date,
          amount: e.amount, number: e.number, description: e.description,
        })),
      });
      const poll = async () => {
        const status = await api.getCashFlowImportStatus(jobId);
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
        <h1 className="impg-header__title">Import Cash Flow From Excel File</h1>
      </div>

      {stage === "upload" && (
        <div className="impg-card">
          <div className="impg-steps">
            <div className="impg-step">
              <span className="impg-step__num">STEP 1</span>
              <p className="impg-step__text">
                Export your cash flow / cash book as an Excel file with these columns (in any order):
              </p>
              <div className="impg-fields-hint">
                {REQUIRED_HEADERS.map((h) => <span key={h} className="impg-fields-hint__chip">{h}</span>)}
              </div>
            </div>
            <div className="impg-step">
              <span className="impg-step__num">STEP 2</span>
              <p className="impg-step__text">
                Upload the file below. Only Payment-In and Payment-Out rows are imported — each one against the named party.
                Expense, cash-counter Sale, Other Income, and cash-adjustment rows are skipped since they aren't tied to a party.
              </p>
            </div>
            <div className="impg-step">
              <span className="impg-step__num">STEP 3</span>
              <p className="impg-step__text">Review how much cash moved in and out per party, then import.</p>
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
            <span className="impg-fields-hint__chip">{summary.ignoredNonPartyRows.toLocaleString()} non-party rows ignored</span>
            <span className="impg-fields-hint__chip">{summary.parties.length.toLocaleString()} unique parties</span>
            <span className="impg-fields-hint__chip">{summary.entries.length.toLocaleString()} entries</span>
            <span className="impg-fields-hint__chip">Cash In: Rs {summary.cashInTotal.toLocaleString()}</span>
            <span className="impg-fields-hint__chip">Cash Out: Rs {summary.cashOutTotal.toLocaleString()}</span>
            {summary.minDate && summary.maxDate && (
              <span className="impg-fields-hint__chip">
                {new Date(summary.minDate).toLocaleDateString()} – {new Date(summary.maxDate).toLocaleDateString()}
              </span>
            )}
          </div>
          {summary.skippedRows > 0 && (
            <div className="impg-error-banner" style={{ marginBottom: 16 }}>
              {summary.skippedRows.toLocaleString()} Payment-In/Out row(s) skipped — missing party name, date, or a zero/blank amount.
            </div>
          )}
          <p className="impg-step__text" style={{ fontWeight: 600, marginBottom: 8 }}>Cash in/out per party</p>
          <div className="impg-table-wrap" style={{ marginBottom: 20, maxHeight: 320, overflowY: "auto" }}>
            <table className="impg-preview-table">
              <thead>
                <tr>
                  <th>Party</th><th>Cash In (count)</th><th>Cash In (Rs)</th><th>Cash Out (count)</th><th>Cash Out (Rs)</th><th>Net</th>
                </tr>
              </thead>
              <tbody>
                {summary.perParty.slice(0, 200).map((p) => (
                  <tr key={p.partyName}>
                    <td>{p.partyName}</td>
                    <td>{p.cashInCount}</td>
                    <td>{p.cashInTotal.toLocaleString()}</td>
                    <td>{p.cashOutCount}</td>
                    <td>{p.cashOutTotal.toLocaleString()}</td>
                    <td>{(p.cashInTotal - p.cashOutTotal).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summary.perParty.length > 200 && (
              <div style={{ padding: 10, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                + {(summary.perParty.length - 200).toLocaleString()} more parties not shown
              </div>
            )}
          </div>
          <p className="impg-step__text">
            Each row becomes a Payment-In or Payment-Out record against that party.
            Re-running this same file later will skip entries already imported — it's safe to retry.
          </p>
          <div className="impg-card__footer">
            <button type="button" className="impg-outline-btn" onClick={resetAll}>Back</button>
            <button type="button" className="impg-primary-btn" onClick={() => void startImport()}>
              Import {summary.entries.length.toLocaleString()} Entries
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
              <p className="impg-done__title">{progress.entriesImported.toLocaleString()} entries imported</p>
              <p className="impg-step__text">
                {progress.partiesCreated.toLocaleString()} parties created
                {progress.entriesSkipped > 0 && ` · ${progress.entriesSkipped.toLocaleString()} entries skipped (already imported)`}
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

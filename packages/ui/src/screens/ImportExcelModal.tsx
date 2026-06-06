import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";

type Props = { onClose: () => void; onImported?: () => void };

type RowData = {
  name: string;
  phone: string;
  email: string;
  address: string;
  openingBalance: string;
  openingDate: string;
};

type ParsedRow = RowData & { errors: string[] };

type Stage = "upload" | "review";

function parseDate(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return String(raw);
    const dd = String(d.d).padStart(2, "0");
    const mm = String(d.m).padStart(2, "0");
    return `${dd}/${mm}/${d.y}`;
  }
  return String(raw).trim();
}

function validateRow(r: RowData): string[] {
  const errs: string[] = [];
  if (!r.name.trim()) errs.push("Name is required");
  if (r.openingBalance && isNaN(parseFloat(r.openingBalance)))
    errs.push("Opening Balance must be a number");
  if (r.openingDate && !/^\d{2}\/\d{2}\/\d{4}$/.test(r.openingDate))
    errs.push("Opening Date must be dd/MM/yyyy");
  return errs;
}

export function ImportExcelModal({ onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<Stage>("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [activeTab, setActiveTab] = useState<"valid" | "errors">("errors");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      const parsed: ParsedRow[] = raw.map((r) => {
        const row: RowData = {
          name: String(r["Name*"] ?? r["Name"] ?? "").trim(),
          phone: String(r["Contact No."] ?? r["Contact No"] ?? r["Phone"] ?? "").trim(),
          email: String(r["Email ID"] ?? r["Email"] ?? "").trim(),
          address: String(r["Address"] ?? "").trim(),
          openingBalance: String(r["Opening Balance"] ?? "").trim(),
          openingDate: parseDate(r["Opening Date (dd/MM/yyyy)"] ?? r["Opening Date"] ?? ""),
        };
        return { ...row, errors: validateRow(row) };
      });

      setRows(parsed);
      const hasErrors = parsed.some((r) => r.errors.length > 0);
      setActiveTab(hasErrors ? "errors" : "valid");
      setStage("review");
    };
    reader.readAsArrayBuffer(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) parseFile(f);
  }

  function handleBrowse(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  }

  async function handleImport() {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (!valid.length) return;
    setImporting(true);
    setImportError(null);
    let failed = 0;
    for (const r of valid) {
      try {
        await api.createParty({
          name: r.name,
          phone: r.phone || undefined,
          email: r.email || undefined,
          billingAddress: r.address || undefined,
          openingBalance: r.openingBalance ? parseFloat(r.openingBalance) : undefined,
        });
      } catch {
        failed++;
      }
    }
    setImporting(false);
    onImported?.();
    if (failed > 0) {
      setImportError(`${failed} ${failed === 1 ? "party" : "parties"} could not be imported (may already exist or name is duplicate).`);
    } else {
      onClose();
    }
  }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);
  const displayRows = activeTab === "valid" ? validRows : errorRows;

  const SupportBar = () => (
    <div className="import-support-bar">
      <span className="import-support-bar__text">
        | WhatsApp Chat Support
        <svg viewBox="0 0 24 24" fill="#25d366" width="14" height="14" style={{ margin: "0 4px" }}>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.135.562 4.14 1.542 5.874L0 24l6.302-1.51A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.96 0-3.792-.534-5.362-1.463l-.386-.228-3.98.953.98-3.884-.252-.4A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
        (+971) 501 759 794 |
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14" style={{ margin: "0 4px" }}>
          <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 3h7v7M21 3 9 15" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <a href="#" className="import-support-bar__link">Get Instant Online Support</a>
      </span>
    </div>
  );

  // ── Upload stage ──
  if (stage === "upload") {
    return (
      <div className="import-backdrop">
        <SupportBar />
        <div className="import-main">
          <div className="import-topbar">
            <span className="import-topbar__title">Import Excel</span>
            <button type="button" className="import-close-btn" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="import-body">
            {/* Left: download */}
            <div className="import-left">
              <p className="import-left__hint">
                Download .xls/.xlsx (excel sheet)<br />template file to enter Data
              </p>
              <div className="import-xls-icon">
                <div className="import-xls-icon__shadow" />
                <div className="import-xls-icon__card">
                  <span className="import-xls-icon__label">xls</span>
                </div>
              </div>
              <button
                type="button"
                className="import-download-btn"
                onClick={() => {
                  const wb = XLSX.utils.book_new();
                  const ws = XLSX.utils.aoa_to_sheet([
                    ["Name*", "Contact No.", "Email ID", "Address", "Opening Balance", "Opening Date (dd/MM/yyyy)"],
                  ]);
                  XLSX.utils.book_append_sheet(wb, ws, "Parties");
                  XLSX.writeFile(wb, "parties_template.xlsx");
                }}
              >
                Download
              </button>
            </div>

            <div className="import-divider" />

            {/* Right: upload */}
            <div className="import-right">
              <p className="import-right__hint">Upload your .xls/ .xlsx (excel sheet)</p>
              <div
                className={`import-dropzone${dragOver ? " import-dropzone--over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xls,.xlsx"
                  style={{ display: "none" }}
                  onChange={handleBrowse}
                />
                <UploadIllustration />
                <p className="import-dropzone__text">
                  Drag and drop or{" "}
                  <span className="import-dropzone__link">Click here to Browse</span>
                </p>
                <p className="import-dropzone__sub">formatted excel file to continue</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Review stage ──
  return (
    <div className="import-backdrop">
      <SupportBar />
      <div className="import-main">
        <div className="import-topbar">
          <span className="import-topbar__title">Import Parties</span>
          <button type="button" className="import-close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="import-review-tabs">
          <button
            type="button"
            className={`import-review-tab${activeTab === "valid" ? " import-review-tab--active" : ""}`}
            onClick={() => setActiveTab("valid")}
          >
            <svg viewBox="0 0 24 24" fill="#16a34a" width="16" height="16">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14.414-4.707-4.707 1.414-1.414L11 13.586l5.293-5.293 1.414 1.414L11 16.414z" />
            </svg>
            Valid Parties : {validRows.length}
          </button>
          <button
            type="button"
            className={`import-review-tab${activeTab === "errors" ? " import-review-tab--active import-review-tab--error" : ""}`}
            onClick={() => setActiveTab("errors")}
          >
            <svg viewBox="0 0 24 24" fill="#f97316" width="16" height="16">
              <path d="M12 2L1 21h22L12 2zm0 3.516L21.016 19H2.984L12 5.516zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
            </svg>
            Parties with Errors : {errorRows.length}
          </button>
        </div>

        <div className="import-review-body">
          <div className="import-review-section-title">
            {activeTab === "valid" ? "Valid Parties" : "Parties with Errors"}
          </div>

          {importError && <div className="form-error" style={{ margin: "0 20px 12px" }}>{importError}</div>}

          {/* Table */}
          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }} />
                  <th>Name*</th>
                  <th>Contact No.</th>
                  <th>Email ID</th>
                  <th>Address</th>
                  <th>Opening Balance</th>
                  <th>Opening Date (dd/MM/yyyy)</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => (
                  <tr key={i} className={row.errors.length ? "import-table__row--error" : ""}>
                    <td className="import-table__icon-cell">
                      {row.errors.length > 0 ? (
                        <span title={row.errors.join("; ")}>
                          <svg viewBox="0 0 24 24" fill="#ef4444" width="16" height="16">
                            <path d="M12 2L1 21h22L12 2zm0 3.516L21.016 19H2.984L12 5.516zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
                          </svg>
                        </span>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="#16a34a" width="16" height="16">
                          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14.414-4.707-4.707 1.414-1.414L11 13.586l5.293-5.293 1.414 1.414L11 16.414z" />
                        </svg>
                      )}
                    </td>
                    <td className={row.errors.some(e => e.includes("Name")) ? "import-table__cell--invalid" : ""}>{row.name}</td>
                    <td>{row.phone}</td>
                    <td>{row.email}</td>
                    <td>{row.address}</td>
                    <td className={row.errors.some(e => e.includes("Balance")) ? "import-table__cell--invalid" : ""}>{row.openingBalance}</td>
                    <td className={row.errors.some(e => e.includes("Date")) ? "import-table__cell--invalid" : ""}>{row.openingDate}</td>
                  </tr>
                ))}
                {displayRows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>
                      No {activeTab === "valid" ? "valid" : "error"} rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="import-review-footer">
          <button
            type="button"
            className={`import-import-btn${validRows.length > 0 ? " import-import-btn--active" : ""}`}
            disabled={validRows.length === 0 || importing}
            onClick={() => void handleImport()}
          >
            {importing ? "Importing…" : `Import ${validRows.length} Valid ${validRows.length === 1 ? "Party" : "Parties"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadIllustration() {
  return (
    <div style={{ position: "relative", width: 120, height: 130, marginBottom: 12 }}>
      <div style={{
        position: "absolute", bottom: 0, right: 0,
        width: 90, height: 110, background: "#c7d2e8",
        borderRadius: 8, transform: "rotate(4deg)",
      }} />
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: 90, height: 110, background: "#3b82f6",
        borderRadius: 8,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" width="36" height="36">
          <path d="M12 4v12M6 10l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ width: 36, height: 3, background: "rgba(255,255,255,0.7)", borderRadius: 2 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

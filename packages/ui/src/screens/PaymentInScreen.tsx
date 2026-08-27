import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";
import type { Transaction, Party, TeamMember } from "@vyapar/api-client";
import { useCompany } from "../lib/CompanyContext";

/* ── helpers ── */
function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" });
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmtChip(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = iso(now);
  switch (preset) {
    case "Today": return { from: todayStr, to: todayStr };
    case "This Week": {
      const day = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      return { from: iso(mon), to: todayStr };
    }
    case "This Month": return { from: `${y}-${pad(m + 1)}-01`, to: iso(new Date(y, m + 1, 0)) };
    case "Last Month": return { from: `${y}-${pad(m)}-01`, to: iso(new Date(y, m, 0)) };
    case "This Quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return { from: `${y}-${pad(qStart + 1)}-01`, to: todayStr };
    }
    case "This Year": return { from: `${y}-01-01`, to: todayStr };
    default: return { from: `${y}-${pad(m + 1)}-01`, to: iso(new Date(y, m + 1, 0)) };
  }
}

export type PiRow = Transaction & { partyName: string; runningBalance: number };

// Rows arrive most-recent-first; running balance accumulates chronologically (oldest
// first), starting from whatever came before the oldest row currently on screen.
function withRunningBalance<T extends { date: string; total: number }>(
  rowsDesc: T[],
  openingBalance: number,
): (T & { runningBalance: number })[] {
  let acc = openingBalance;
  const ascWithBalance = [...rowsDesc].reverse().map((r) => {
    acc += r.total;
    return { ...r, runningBalance: acc };
  });
  return ascWithBalance.reverse();
}

const AVATAR_PALETTES = [
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#dbeafe", fg: "#1d4ed8" },
];
const avatarCache: Record<string, (typeof AVATAR_PALETTES)[0]> = {};
let _pIdx = 0;
function partyColor(name: string) {
  if (!avatarCache[name]) avatarCache[name] = AVATAR_PALETTES[_pIdx++ % AVATAR_PALETTES.length];
  return avatarCache[name];
}

function getPaymentType(notes: string | null): string {
  if (!notes) return "Cash";
  try {
    const parsed = JSON.parse(notes);
    return parsed.paymentType ?? "Cash";
  } catch {
    return "Cash";
  }
}

function ddmmyyyyPI(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function exportPaymentsToExcel(rows: PiRow[], from: string, to: string) {
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((r, idx) => ({
      "Date": ddmmyyyyPI(r.date),
      "Reference No": r.number ?? `#${idx + 1}`,
      "Party Name": r.partyName,
      "Total Amount": r.total,
      "Payment Type": getPaymentType(r.notes),
      "Received": r.total - r.balance,
      "Running Balance": r.runningBalance,
      "Status": r.balance === 0 ? "Used" : "Unused",
    })),
  );
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Payment-In");
  XLSX.writeFile(book, `PaymentIn_${from}_to_${to}.xlsx`);
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
type Props = { isLocked?: boolean; onLockedAction?: () => void };

// Recent-first cap on the list fetch — a normal user cares about recent payments, not
// scrolling through years of history. Header totals below come from a separate cheap
// aggregate call instead, so they stay accurate even though the visible list is capped.
export const RECENT_ROWS_LIMIT = 300;

export function PaymentInScreen({ isLocked = false, onLockedAction }: Props) {
  const [rows, setRows] = useState<PiRow[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [summary, setSummary] = useState({ count: 0, total: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<PiRow | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<PiRow | null>(null);
  const [viewHistoryRow, setViewHistoryRow] = useState<PiRow | null>(null);
  const { companyFilter, selectedCompanyId, companies } = useCompany();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  /* ── date filter — was a static, non-functional display before this fix ── */
  const initRange = getPresetRange("This Month");
  const [filterPreset, setFilterPreset] = useState("This Month");
  const [filterFrom, setFilterFrom] = useState(initRange.from);
  const [filterTo, setFilterTo] = useState(initRange.to);
  const [showDatePanel, setShowDatePanel] = useState(false);
  const [datePanelPos, setDatePanelPos] = useState({ top: 0, left: 0 });
  const datePanelRef = useRef<HTMLDivElement>(null);

  /* ── firm (company) and user (booker) filters — also static/non-functional before this fix ── */
  const [firmFilterId, setFirmFilterId] = useState("");
  const [userFilterId, setUserFilterId] = useState("");
  const [showFirmPanel, setShowFirmPanel] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [firmPanelPos, setFirmPanelPos] = useState({ top: 0, left: 0 });
  const [userPanelPos, setUserPanelPos] = useState({ top: 0, left: 0 });
  const firmPanelRef = useRef<HTMLDivElement>(null);
  const userPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listTeamMembers().then(setTeamMembers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showDatePanel) return;
    function handler(e: MouseEvent) {
      if (datePanelRef.current && !datePanelRef.current.contains(e.target as Node)) setShowDatePanel(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDatePanel]);

  useEffect(() => {
    if (!showFirmPanel && !showUserPanel) return;
    function handler(e: MouseEvent) {
      if (showFirmPanel && firmPanelRef.current && !firmPanelRef.current.contains(e.target as Node)) setShowFirmPanel(false);
      if (showUserPanel && userPanelRef.current && !userPanelRef.current.contains(e.target as Node)) setShowUserPanel(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showFirmPanel, showUserPanel]);

  async function loadData() {
    try {
      const companyId = firmFilterId || companyFilter || undefined;
      const bookerId = userFilterId || undefined;
      const [txns, ps, sum] = await Promise.all([
        // Explicit take alongside the date range — a bare take (no from/to) was the bug:
        // it silently showed the most recent RECENT_ROWS_LIMIT payments regardless of
        // whatever the filter chips claimed to be showing.
        api.getTransactionsByType("payment_in", { from: filterFrom, to: filterTo, take: 10000, companyId, bookerId }),
        api.getParties(),
        api.getTransactionsSummary("payment_in", { from: filterFrom, to: filterTo, companyId, bookerId }),
      ]);
      const map = Object.fromEntries(ps.map((p: Party) => [p.id, p]));
      const oldest = txns[txns.length - 1];
      const opening = oldest ? (await api.getOpeningBalance("payment_in", oldest.date)).total : 0;
      const withParty = txns.map((t) => ({ ...t, partyName: map[t.partyId]?.name ?? "Unknown", runningBalance: 0 }));
      setRows(withRunningBalance(withParty, opening));
      setParties(ps);
      setSummary(sum);
    } catch { /* offline */ }
  }

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilter, filterFrom, filterTo, firmFilterId, userFilterId]);

  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuId]);

  const totalAmount = summary.total;
  const receivedAmount = summary.total - summary.balance;

  function handleAdd() {
    if (isLocked) { onLockedAction?.(); return; }
    setEditRow(null);
    setShowForm(true);
  }

  async function handleDuplicate(row: PiRow) {
    try {
      const { count } = await api.getTransactionsSummary("payment_in");
      await api.createTransaction({
        partyId: row.partyId,
        type: "payment_in",
        number: String(count + 1),
        date: new Date().toISOString(),
        total: row.total,
        balance: row.total,
        notes: row.notes ?? undefined,
        companyId: selectedCompanyId ?? undefined,
      });
      setLoading(true);
      await loadData();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pi-main">
      {/* ── Page header ── */}
      <div className="pi-page-header">
        <div className="pi-page-header__left">
          <span className="pi-page-header__title">Payment-In</span>
          <button type="button" className="pi-page-header__dropdown-btn" aria-label="Switch view">▾</button>
        </div>
        <div className="pi-page-header__right">
          <button type="button" className="pi-page-header__add-btn" onClick={handleAdd}>
            + Add Payment-In
          </button>
          <button type="button" className="pi-page-header__icon-btn" aria-label="Settings">⚙</button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="pi-filterbar">
        <span className="pi-filterbar__label">Filter by :</span>
        <button type="button" className="pi-filterbar__chip" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setDatePanelPos({ top: r.bottom + 6, left: r.left });
          setShowDatePanel((v) => !v);
        }}>{filterPreset} ▾</button>
        <button type="button" className="pi-filterbar__date" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setDatePanelPos({ top: r.bottom + 6, left: r.left });
          setShowDatePanel((v) => !v);
        }}>📅 {fmtChip(filterFrom)} To {fmtChip(filterTo)}</button>
        <button type="button" className="pi-filterbar__chip" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setFirmPanelPos({ top: r.bottom + 6, left: r.left });
          setShowFirmPanel((v) => !v);
        }}>{firmFilterId ? (companies.find((c) => c.id === firmFilterId)?.name ?? "All Firms") : "All Firms"} ▾</button>
        <button type="button" className="pi-filterbar__chip" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setUserPanelPos({ top: r.bottom + 6, left: r.left });
          setShowUserPanel((v) => !v);
        }}>{userFilterId ? (teamMembers.find((m) => m.id === userFilterId)?.name ?? "All Users") : "All Users"} ▾</button>
        <div className="pi-filterbar__spacer" />
        <button type="button" className="dc-icon-btn" onClick={() => exportPaymentsToExcel(rows, filterFrom, filterTo)}>
          📊 Excel Report
        </button>
      </div>

      {/* ── Firm (company) filter panel ── */}
      {showFirmPanel && (
        <div ref={firmPanelRef} style={{ position: "fixed", top: firmPanelPos.top, left: firmPanelPos.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.13)", zIndex: 700, width: 220, padding: "6px 0", maxHeight: 320, overflowY: "auto" }}>
          <button type="button" onClick={() => { setFirmFilterId(""); setShowFirmPanel(false); }}
            style={{ display: "block", width: "100%", padding: "8px 14px", background: !firmFilterId ? "#eff6ff" : "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: !firmFilterId ? "#2563eb" : "#374151", fontWeight: !firmFilterId ? 600 : 400 }}>
            All Firms
          </button>
          {companies.map((c) => (
            <button key={c.id} type="button" onClick={() => { setFirmFilterId(c.id); setShowFirmPanel(false); }}
              style={{ display: "block", width: "100%", padding: "8px 14px", background: firmFilterId === c.id ? "#eff6ff" : "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: firmFilterId === c.id ? "#2563eb" : "#374151", fontWeight: firmFilterId === c.id ? 600 : 400 }}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* ── User (booker) filter panel ── */}
      {showUserPanel && (
        <div ref={userPanelRef} style={{ position: "fixed", top: userPanelPos.top, left: userPanelPos.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.13)", zIndex: 700, width: 220, padding: "6px 0", maxHeight: 320, overflowY: "auto" }}>
          <button type="button" onClick={() => { setUserFilterId(""); setShowUserPanel(false); }}
            style={{ display: "block", width: "100%", padding: "8px 14px", background: !userFilterId ? "#eff6ff" : "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: !userFilterId ? "#2563eb" : "#374151", fontWeight: !userFilterId ? 600 : 400 }}>
            All Users
          </button>
          {teamMembers.length === 0 ? (
            <div style={{ padding: "8px 14px", fontSize: 12, color: "#9ca3af" }}>No team members yet.</div>
          ) : teamMembers.map((m) => (
            <button key={m.id} type="button" onClick={() => { setUserFilterId(m.id); setShowUserPanel(false); }}
              style={{ display: "block", width: "100%", padding: "8px 14px", background: userFilterId === m.id ? "#eff6ff" : "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: userFilterId === m.id ? "#2563eb" : "#374151", fontWeight: userFilterId === m.id ? 600 : 400 }}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Date filter panel (fixed) ── */}
      {showDatePanel && (
        <div ref={datePanelRef} style={{ position: "fixed", top: datePanelPos.top, left: datePanelPos.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.13)", zIndex: 700, width: 340, padding: "12px 0 16px" }}>
          <div style={{ padding: "0 14px 10px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase" }}>Quick Select</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 0" }}>
            {["Today", "This Week", "This Month", "Last Month", "This Quarter", "This Year"].map((p) => (
              <button key={p} type="button"
                onClick={() => {
                  const r = getPresetRange(p);
                  setFilterPreset(p); setFilterFrom(r.from); setFilterTo(r.to);
                  setShowDatePanel(false);
                }}
                style={{ padding: "8px 14px", background: filterPreset === p ? "#eff6ff" : "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: filterPreset === p ? "#2563eb" : "#374151", fontWeight: filterPreset === p ? 600 : 400 }}
                onMouseEnter={(e) => { if (filterPreset !== p) e.currentTarget.style.background = "#f9fafb"; }}
                onMouseLeave={(e) => { if (filterPreset !== p) e.currentTarget.style.background = "none"; }}
              >{p}</button>
            ))}
          </div>
          <div style={{ height: 1, background: "#f3f4f6", margin: "10px 0" }} />
          <div style={{ padding: "0 14px 4px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase" }}>Custom Range</div>
          <div style={{ display: "flex", gap: 8, padding: "8px 14px 0", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>From</div>
              <input type="date" value={filterFrom}
                onChange={(e) => { setFilterFrom(e.target.value); setFilterPreset("Custom"); }}
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 8px", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <span style={{ fontSize: 13, color: "#9ca3af", marginTop: 14 }}>–</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>To</div>
              <input type="date" value={filterTo}
                onChange={(e) => { setFilterTo(e.target.value); setFilterPreset("Custom"); }}
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 8px", fontSize: 13, boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ padding: "10px 14px 0", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowDatePanel(false)}
              style={{ padding: "6px 16px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Apply</button>
          </div>
        </div>
      )}

      {/* ── Summary card ── */}
      <div className="pi-summary">
        <div className="pi-summary__block">
          <span className="pi-summary__label">Total Amount</span>
          <span className="pi-summary__value">Rs {fmt(totalAmount)}</span>
          <div className="pi-summary__sub-row">
            <span>Received: <strong>Rs {fmt(receivedAmount)}</strong></span>
          </div>
        </div>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="pi-loading">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="pi-empty">
          <div className="pi-empty__illustration">
            <div className="pi-empty__circle"><span>💳</span></div>
          </div>
          <p className="pi-empty__title">No Payment-In records</p>
          <p className="pi-empty__sub">Record a received payment to get started.</p>
          <button type="button" className="pi-empty__btn" onClick={handleAdd}>
            + Add Payment-In
          </button>
        </div>
      ) : (
        <div className="pi-list">
          {/* Table header */}
          <div className="pi-table-head">
            <span style={{ flex: 1.2 }}>DATE</span>
            <span style={{ flex: 1 }}>REF.NO.</span>
            <span style={{ flex: 2 }}>PARTY NAME</span>
            <span style={{ textAlign: "right", flex: 1.2 }}>TOTAL AMOUNT</span>
            <span style={{ textAlign: "right", flex: 1.2 }}>RECEIVED</span>
            <span style={{ textAlign: "right", flex: 1.4 }}>RUNNING BALANCE</span>
            <span style={{ flex: 1.2 }}>PAYMENT TYPE</span>
            <span style={{ textAlign: "center", flex: 1 }}>STATUS</span>
            <span style={{ flex: 0.6 }} />
          </div>

          {rows.map((row) => {
            const pal = partyColor(row.partyName);
            const isUnused = row.balance === row.total;
            const paymentType = getPaymentType(row.notes);
            return (
              <div
                key={row.id}
                className="pi-row pi-row--clickable"
                onClick={() => { setEditRow(row); setShowForm(true); }}
              >
                <span className="pi-row__cell" style={{ flex: 1.2 }}>{formatDate(row.date)}</span>
                <span className="pi-row__cell" style={{ flex: 1 }}>#{row.number ?? "–"}</span>
                <div className="pi-row__party" style={{ flex: 2 }}>
                  <div className="pi-row__avatar" style={{ background: pal.bg, color: pal.fg }}>
                    {row.partyName[0]?.toUpperCase()}
                  </div>
                  <span className="pi-row__name">{row.partyName}</span>
                </div>
                <span className="pi-row__cell" style={{ textAlign: "right", flex: 1.2 }}>Rs {fmt(row.total)}</span>
                <span className="pi-row__cell" style={{ textAlign: "right", flex: 1.2, color: "#16a34a" }}>
                  Rs {fmt(row.total - row.balance)}
                </span>
                <span className="pi-row__cell" style={{ textAlign: "right", flex: 1.4 }}>
                  Rs {fmt(row.runningBalance)}
                </span>
                <span className="pi-row__cell" style={{ flex: 1.2 }}>{paymentType}</span>
                <span className="pi-row__cell" style={{ textAlign: "center", flex: 1 }}>
                  <span className={isUnused ? "pi-status--unused" : "pi-status--used"}>
                    {isUnused ? "Unused" : "Used"}
                  </span>
                </span>
                <div className="pi-row__actions" style={{ flex: 0.6 }} onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="pi-row__icon-btn" title="Print" onClick={() => window.print()}>🖨</button>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="pi-row__icon-btn"
                      title="More"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (menuId === row.id) { setMenuId(null); return; }
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const menuHeight = 6 * 38; // 6 menu items
                        const openUpward = window.innerHeight - r.bottom < menuHeight + 12;
                        setMenuPos({
                          top: openUpward ? r.top - menuHeight - 4 : r.bottom + 4,
                          left: r.right - 160,
                        });
                        setMenuId(row.id);
                      }}
                    >⋯</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Row action menu ── */}
      {menuId && (() => {
        const row = rows.find((r) => r.id === menuId);
        if (!row) return null;
        return (
          <div
            className="pi-row-menu"
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { label: "View/Edit",    action: () => { setEditRow(row); setShowForm(true); setMenuId(null); } },
              { label: "Open PDF",     action: () => { setMenuId(null); window.print(); } },
              { label: "Print",        action: () => { setMenuId(null); window.print(); } },
              { label: "Delete",       action: () => { setDeleteConfirmRow(row); setMenuId(null); } },
              { label: "Duplicate",    action: () => { setMenuId(null); void handleDuplicate(row); } },
              { label: "View History", action: () => { setViewHistoryRow(row); setMenuId(null); } },
            ].map(({ label, action }) => (
              <button key={label} type="button" className="pi-row-menu__item" onClick={action}>{label}</button>
            ))}
          </div>
        );
      })()}

      {/* ── New / Edit Form ── */}
      {showForm && (
        <PaymentInForm
          key={editRow?.id ?? "new"}
          parties={parties}
          existingCount={rows.length}
          initialRow={editRow ?? undefined}
          onClose={() => { setShowForm(false); setEditRow(null); }}
          onSaved={() => {
            setShowForm(false);
            setEditRow(null);
            setLoading(true);
            loadData().finally(() => setLoading(false));
          }}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirmRow && (
        <div className="nsf-dialog-overlay">
          <div className="nsf-dialog">
            <div className="nsf-dialog__header">
              <span className="nsf-dialog__title">Delete Payment-In</span>
              <button type="button" className="nsf-dialog__x" onClick={() => setDeleteConfirmRow(null)}>✕</button>
            </div>
            <p className="nsf-dialog__body">
              Delete receipt <strong>#{deleteConfirmRow.number ?? "–"}</strong> for <strong>{deleteConfirmRow.partyName}</strong> (Rs {deleteConfirmRow.total.toLocaleString()})?
              This cannot be undone.
            </p>
            <div className="nsf-dialog__footer">
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--cancel" onClick={() => setDeleteConfirmRow(null)}>Cancel</button>
              <button
                type="button"
                className="nsf-dialog__btn nsf-dialog__btn--ok"
                style={{ background: "#dc2626" }}
                onClick={async () => {
                  await api.deleteTransaction(deleteConfirmRow.id);
                  setDeleteConfirmRow(null);
                  setLoading(true);
                  loadData().finally(() => setLoading(false));
                }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── View History ── */}
      {viewHistoryRow && (
        <PiViewHistoryModal
          row={viewHistoryRow}
          onClose={() => setViewHistoryRow(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAYMENT-IN FORM (modal)
═══════════════════════════════════════════════════════════ */
export function PaymentInForm({
  parties,
  existingCount = 0,
  initialRow,
  prefilledPartyId,
  prefilledAmount,
  onClose,
  onSaved,
}: {
  parties: Party[];
  existingCount?: number;
  initialRow?: PiRow;
  prefilledPartyId?: string;
  prefilledAmount?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initialRow);
  const dropRef = useRef<HTMLDivElement>(null);

  const initNotes = initialRow ? (() => { try { return JSON.parse(initialRow.notes ?? "{}"); } catch { return {}; } })() : {};

  const initParty = initialRow
    ? { id: initialRow.partyId, name: initialRow.partyName }
    : prefilledPartyId
      ? (() => { const p = parties.find((x) => x.id === prefilledPartyId); return p ? { id: p.id, name: p.name } : null; })()
      : null;

  const [customer, setCustomer] = useState(initParty?.name ?? "");
  const [selectedPartyId, setSelectedPartyId] = useState(initParty?.id ?? "");
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const PRESET_PAYMENT_TYPES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card"];
  const [paymentType, setPaymentType] = useState<string>(initNotes.paymentType ?? "Cash");
  // "+ Add Payment type" was a dead button — clicking it did nothing, so a custom
  // method (Easy Paisa, JazzCash, ...) could never actually be recorded even though
  // paymentType has always just been a free-text string in `notes`.
  const [showCustomPayment, setShowCustomPayment] = useState(
    () => !!initNotes.paymentType && !PRESET_PAYMENT_TYPES.includes(initNotes.paymentType),
  );
  const [customPaymentInput, setCustomPaymentInput] = useState(showCustomPayment ? paymentType : "");
  const [receiptNo, setReceiptNo] = useState(initialRow?.number ?? String(existingCount + 1));

  /* Auto-compute receipt number when opened fresh */
  useEffect(() => {
    if (!initialRow) {
      api.getTransactionsSummary("payment_in")
        .then(({ count }) => setReceiptNo(String(count + 1)))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [date, setDate] = useState(initialRow ? initialRow.date.slice(0, 10) : today());
  const [amount, setAmount] = useState(
    initialRow ? String(initialRow.total) : prefilledAmount ? String(prefilledAmount) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { selectedCompanyId } = useCompany();

  /* Link Payment state */
  const [partyInvoices, setPartyInvoices] = useState<Transaction[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkedInvoiceIds, setLinkedInvoiceIds] = useState<Set<string>>(new Set());

  /* Share/Print/Save & New menu */
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareMenuPos, setShareMenuPos] = useState({ top: 0, left: 0 });
  const [shareNotice, setShareNotice] = useState("");

  const selectedParty = parties.find((p) => p.id === selectedPartyId);
  const filteredParties = customer
    ? parties.filter((p) => p.name.toLowerCase().includes(customer.toLowerCase()))
    : parties;

  /* Load party's outstanding sale invoices when party changes, and — when editing an
   * existing payment — restore which invoices it was previously linked to. An invoice
   * this payment already reduced (partially or to zero) is added back to its balance
   * here to the amount it would be after the backend reverses this payment's old
   * allocations on save, so the existing min(balance, remaining) split below computes
   * the right numbers whether or not the user actually changes anything. */
  useEffect(() => {
    if (!selectedPartyId) { setPartyInvoices([]); setLinkedInvoiceIds(new Set()); return; }
    api.getPartyTransactions(selectedPartyId)
      .then(async (txns) => {
        let invoices = txns.filter((t) => t.type === "sale" && t.balance > 0);
        if (isEdit && initialRow) {
          const existingAllocations = await api.getTransactionAllocations(initialRow.id).catch(() => []);
          if (existingAllocations.length) {
            const byId = new Map(invoices.map((t) => [t.id, t]));
            for (const alloc of existingAllocations) {
              const existing = byId.get(alloc.invoiceId);
              if (existing) {
                existing.balance += alloc.amount;
              } else {
                const fetched = await api.getTransaction(alloc.invoiceId).catch(() => null);
                if (fetched) {
                  invoices = [...invoices, { ...fetched, balance: fetched.balance + alloc.amount }];
                  byId.set(fetched.id, invoices[invoices.length - 1]);
                }
              }
            }
            setLinkedInvoiceIds(new Set(existingAllocations.map((a) => a.invoiceId)));
          }
        }
        setPartyInvoices(invoices);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartyId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowPartyDrop(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!showShareMenu) return;
    const close = () => setShowShareMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showShareMenu]);

  const receivedAmt = parseFloat(amount) || 0;
  const linkedTotal = partyInvoices
    .filter((t) => linkedInvoiceIds.has(t.id))
    .reduce((s, t) => s + Math.min(t.balance, receivedAmt), 0);
  const unusedAmt = Math.max(0, receivedAmt - linkedTotal);

  async function save(mode: "close" | "new" = "close") {
    setError("");
    if (!selectedPartyId) { setError("Select a party."); return; }
    if (receivedAmt <= 0) { setError("Enter a valid amount."); return; }
    if (!paymentType.trim()) { setError("Enter a payment type."); return; }
    setSaving(true);
    const notesJson = JSON.stringify({ paymentType, receiptNo });

    /* Which invoices this payment applies to, and how much — sent to the backend as
     * `allocations` so it can persist the link (PaymentAllocation) instead of just
     * mutating each invoice's balance with no record of which payment did it. */
    let remaining = linkedTotal;
    const allocations: { invoiceId: string; amount: number }[] = [];
    for (const invId of Array.from(linkedInvoiceIds)) {
      if (remaining <= 0) break;
      const inv = partyInvoices.find((t) => t.id === invId);
      if (!inv) continue;
      const deduct = Math.min(inv.balance, remaining);
      if (deduct <= 0) continue;
      allocations.push({ invoiceId: invId, amount: deduct });
      remaining -= deduct;
    }

    try {
      if (isEdit && initialRow) {
        await api.updateTransaction(initialRow.id, {
          partyId: selectedPartyId,
          date: new Date(date).toISOString(),
          total: receivedAmt,
          balance: unusedAmt,
          notes: notesJson,
          companyId: selectedCompanyId ?? null,
          allocations,
        });
      } else {
        await api.createTransaction({
          partyId: selectedPartyId,
          type: "payment_in",
          number: receiptNo,
          date: new Date(date).toISOString(),
          total: receivedAmt,
          balance: unusedAmt,
          notes: notesJson,
          companyId: selectedCompanyId ?? undefined,
          allocations,
        });
      }

      if (mode === "new") {
        setCustomer("");
        setSelectedPartyId("");
        setAmount("");
        setReceiptNo(String((parseInt(receiptNo, 10) || existingCount + 1) + 1));
        setPartyInvoices([]);
        setLinkedInvoiceIds(new Set());
      } else {
        onSaved();
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save. Check connection.");
    } finally {
      setSaving(false);
    }
  }

  function shareText() {
    return [
      `Payment Receipt #${receiptNo}`,
      `Party: ${selectedParty?.name ?? customer}`,
      `Amount: Rs ${receivedAmt.toFixed(2)}`,
      `Date: ${date}`,
      `Payment Type: ${paymentType}`,
    ].join("\n");
  }

  async function handleShare() {
    const text = shareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Payment Receipt", text });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareNotice("Copied to clipboard");
    } catch {
      setShareNotice("Could not share");
    }
    setTimeout(() => setShareNotice(""), 2000);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="pi-form-overlay" onClick={onClose}>
      <div className="pi-form-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="pi-form-header">
          <span className="pi-form-header__title">Payment-In</span>
          <div className="pi-form-header__icons">
            <button type="button" className="pi-form-header__icon-btn" title="Calculator">⌨</button>
            <button type="button" className="pi-form-header__icon-btn" title="Settings">⚙</button>
            <button type="button" className="pi-form-header__icon-btn pi-form-header__icon-btn--close" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="pi-form-body">

          {/* Left column */}
          <div className="pi-form-left" ref={dropRef}>
            <div className="pi-party-field">
              <label className="pi-field-label">Search by Name/Phone *</label>
              <div className="pi-party-input-wrap">
                <input
                  className="pi-party-input"
                  placeholder="Search by Name/Phone"
                  value={customer}
                  onChange={(e) => { setCustomer(e.target.value); setShowPartyDrop(true); }}
                  onFocus={() => setShowPartyDrop(true)}
                  autoComplete="off"
                />
                <span className="pi-party-arrow">▾</span>
              </div>
              {selectedParty && (
                <span className="pi-party-bal">BAL: {fmt(Math.abs(selectedParty.balance))}</span>
              )}
              {showPartyDrop && (
                <div className="pi-party-drop nsf-party-drop">
                  <div className="nsf-party-drop__header-row">
                    <span />
                    <span className="nsf-party-drop__bal-hdr">Party Balance</span>
                  </div>
                  {filteredParties.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="nsf-party-drop__row"
                      onClick={() => { setCustomer(p.name); setSelectedPartyId(p.id); setShowPartyDrop(false); }}
                    >
                      <div className="nsf-party-drop__info">
                        <span className="nsf-party-drop__name">{p.name}</span>
                        <span className="nsf-party-drop__phone">{p.phone}</span>
                      </div>
                      <div className="nsf-party-drop__right">
                        <span className="nsf-party-drop__bal-amt">{Math.abs(p.balance).toLocaleString()}</span>
                        <span className={`nsf-party-drop__badge${p.balance > 0 ? " nsf-party-drop__badge--red" : " nsf-party-drop__badge--green"}`}>
                          {p.balance > 0 ? "↑" : "✓"}
                        </span>
                      </div>
                    </button>
                  ))}
                  {filteredParties.length === 0 && <p className="nsf-item-drop__empty">No parties found</p>}
                </div>
              )}
            </div>

            <div className="pi-payment-field">
              <span className="pi-field-label">Payment Type</span>
              {showCustomPayment ? (
                <input
                  className="pi-payment-select"
                  value={customPaymentInput}
                  autoFocus
                  placeholder="e.g. Easy Paisa"
                  onChange={(e) => { setCustomPaymentInput(e.target.value); setPaymentType(e.target.value); }}
                />
              ) : (
                <select className="pi-payment-select" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                  {PRESET_PAYMENT_TYPES.map((pt) => <option key={pt}>{pt}</option>)}
                </select>
              )}
            </div>

            <button
              type="button"
              className="pi-add-payment-btn"
              onClick={() => {
                if (showCustomPayment) { setShowCustomPayment(false); setPaymentType("Cash"); }
                else { setShowCustomPayment(true); setCustomPaymentInput(""); setPaymentType(""); }
              }}
            >
              {showCustomPayment ? "← Use preset type" : "+ Add Payment type"}
            </button>

            <div className="pi-add-btns">
              <button type="button" className="pi-add-btn">
                <span className="pi-add-btn__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </span>
                ADD DESCRIPTION
              </button>
              <button type="button" className="pi-add-btn">
                <span className="pi-add-btn__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                </span>
                Add Image
              </button>
            </div>
          </div>

          {/* Right column */}
          <div className="pi-form-right">
            <div className="pi-meta-row">
              <span className="pi-meta-label">Receipt No</span>
              <input className="pi-meta-input" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} />
            </div>
            <div className="pi-meta-row">
              <span className="pi-meta-label">Date</span>
              <input type="date" className="pi-meta-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Received row ── */}
        <div className="pi-received-row">
          <span className="pi-received-label">Received</span>
          <div className="pi-received-input-wrap">
            <span className="pi-received-currency">Rs</span>
            <input
              type="number"
              className="pi-received-input"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
            />
          </div>
        </div>

        {error && <p className="pi-error">{error}</p>}

        {/* ── Action bar ── */}
        <div className="pi-form-actionbar">
          <div className="pi-form-actionbar__left">
            {selectedParty && partyInvoices.length > 0 && (
              <button type="button" className="pi-link-payment-btn" onClick={() => setShowLinkModal(true)}>
                🔗 LINK PAYMENT
                {linkedInvoiceIds.size > 0 && (
                  <span className="pi-link-payment-btn__badge">{linkedInvoiceIds.size}</span>
                )}
              </button>
            )}
          </div>
          <div className="pi-form-actionbar__right">
            {shareNotice && <span className="pi-share-notice">{shareNotice}</span>}
            <div className="pi-share-wrap">
              <button type="button" className="pi-share-btn" onClick={handleShare}>Share</button>
              <button
                type="button"
                className="pi-share-arrow"
                onClick={(e) => {
                  e.stopPropagation();
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setShareMenuPos({ top: r.top - 8, left: r.right - 160 });
                  setShowShareMenu((v) => !v);
                }}
              >
                ▼
              </button>
            </div>
            <button type="button" className="pi-save-btn" onClick={() => save()} disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Update" : "Save"}
            </button>
          </div>
        </div>

        {showShareMenu && (
          <div
            className="pi-row-menu"
            style={{ position: "fixed", top: shareMenuPos.top, left: shareMenuPos.left, transform: "translateY(-100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="pi-row-menu__item" onClick={() => { setShowShareMenu(false); void handleShare(); }}>Share</button>
            <button type="button" className="pi-row-menu__item" onClick={() => { setShowShareMenu(false); handlePrint(); }}>Print</button>
            <button type="button" className="pi-row-menu__item" onClick={() => { setShowShareMenu(false); void save("new"); }}>Save &amp; New</button>
          </div>
        )}
      </div>

      {/* ── Link Payment to Invoices Modal ── */}
      {showLinkModal && (
        <LinkPaymentToInvoicesModal
          partyName={selectedParty?.name ?? customer}
          receivedAmount={receivedAmt}
          invoices={partyInvoices}
          linkedIds={linkedInvoiceIds}
          onDone={(ids) => { setLinkedInvoiceIds(ids); setShowLinkModal(false); }}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   VIEW HISTORY MODAL (Payment-In)
═══════════════════════════════════════════════════════════ */
function PiViewHistoryModal({ row, onClose }: { row: PiRow; onClose: () => void }) {
  type HistoryEntry = { id: string; changes: string[]; ipAddress: string | null; createdAt: string };
  const [entries, setEntries] = React.useState<HistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.getTransactionHistory(row.id)
      .then((rows) => setEntries(rows))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [row.id]);

  function fmtTs(iso: string) {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  }

  return (
    <div className="nsf-dialog-overlay" style={{ zIndex: 700 }}>
      <div style={{
        background: "#fff", borderRadius: 10, width: 620, maxWidth: "95vw",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 16px", borderBottom: "1px solid #f0f0f0" }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: "#111827" }}>Edit History for Receipt #{row.number ?? row.id.slice(0, 6)}</span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
        </div>
        <div style={{ padding: "8px 0", maxHeight: 480, overflowY: "auto" }}>
          {loading ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>Loading…</p>
          ) : entries.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>No edit history yet.</p>
          ) : (
            entries.map((entry, idx) => (
              <div key={entry.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                padding: "14px 24px",
                borderBottom: idx < entries.length - 1 ? "1px solid #f3f4f6" : "none",
              }}>
                <div style={{ flex: 1, paddingRight: 24 }}>
                  {entry.changes.map((change, ci) => (
                    <div key={ci} style={{ display: "flex", gap: 8, fontSize: 13.5, color: "#1f2937", lineHeight: 1.6 }}>
                      <span>•</span><span>{change}</span>
                    </div>
                  ))}
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 6, whiteSpace: "nowrap" }}>{fmtTs(entry.createdAt)}</div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {entry.ipAddress && (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #d1d5db", background: "#f9fafb", color: "#374151" }}>{entry.ipAddress}</span>
                    )}
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #d1d5db", background: "#f9fafb", color: "#374151" }}>PRIMARY ADMIN</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LINK PAYMENT TO INVOICES MODAL
   (from the Payment-In form — picks outstanding sale invoices to allocate this payment to)
═══════════════════════════════════════════════════════════ */
function LinkPaymentToInvoicesModal({
  partyName,
  receivedAmount,
  invoices,
  linkedIds,
  onDone,
  onClose,
}: {
  partyName: string;
  receivedAmount: number;
  invoices: Transaction[];
  linkedIds: Set<string>;
  onDone: (ids: Set<string>) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(linkedIds));
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const filtered = invoices.filter((t) => {
    if (search && !(t.number ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "sale" && t.type !== "sale") return false;
    return true;
  });

  /* Compute how much of receivedAmount each selected invoice consumes, in order */
  function computeAllocations(sel: Set<string>) {
    let remaining = receivedAmount;
    const alloc: Record<string, number> = {};
    for (const inv of invoices) {
      if (!sel.has(inv.id)) continue;
      const take = Math.min(inv.balance, remaining);
      alloc[inv.id] = take;
      remaining -= take;
      if (remaining <= 0) break;
    }
    return alloc;
  }

  const allocations = computeAllocations(selected);
  const linkedTotal = Object.values(allocations).reduce((s, v) => s + v, 0);
  const unusedAmount = Math.max(0, receivedAmount - linkedTotal);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function autoLink() {
    const ids = new Set<string>();
    let left = receivedAmount;
    for (const inv of invoices) {
      if (left <= 0) break;
      ids.add(inv.id);
      left -= Math.min(inv.balance, left);
    }
    setSelected(ids);
  }

  return (
    <div className="lpm-overlay" onClick={onClose}>
      <div className="lpm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lpm-header">
          <span className="lpm-title">Link Payment to Txns</span>
          <button type="button" className="lpm-close" onClick={onClose}>✕</button>
        </div>

        <div className="lpm-meta">
          <div className="lpm-meta__col">
            <span className="lpm-meta__lbl">Party</span>
            <span className="lpm-meta__val">{partyName}</span>
          </div>
          <div className="lpm-meta__col">
            <span className="lpm-meta__lbl" style={{ color: "#3b82f6" }}>Received</span>
            <span className="lpm-meta__val">{fmt(receivedAmount)}</span>
          </div>
          <div className="lpm-meta__actions">
            <button type="button" className="lpm-auto-btn" onClick={autoLink}>AUTO LINK</button>
            <button type="button" className="lpm-reset-btn" onClick={() => setSelected(new Set())}>↺ RESET</button>
          </div>
        </div>

        <div className="lpm-filters">
          <select className="lpm-filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All transactions</option>
            <option value="sale">Sale Invoices only</option>
          </select>
          <input
            className="lpm-search"
            placeholder="Search ref/inv no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="lpm-table-wrap">
          <table className="lpm-table">
            <thead>
              <tr>
                <th />
                <th>Date</th>
                <th>Type</th>
                <th>Ref/Inv No.</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Linked Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const isChecked = selected.has(t.id);
                const linkAmt = allocations[t.id] ?? 0;
                return (
                  <tr
                    key={t.id}
                    className={isChecked ? "lpm-tr--selected" : ""}
                    onClick={() => toggle(t.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
                      />
                    </td>
                    <td>{new Date(t.date).toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                    <td>{t.type === "sale" ? "Sale Invoice" : t.type}</td>
                    <td>{t.number ?? "–"}</td>
                    <td>{fmt(t.total)}</td>
                    <td>{fmt(t.balance)}</td>
                    <td>{linkAmt > 0 ? fmt(linkAmt) : "–"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "20px", color: "#9ca3af" }}>
                    No outstanding invoices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lpm-footer">
          <span className="lpm-remaining">
            Unused Amount: <strong>{fmt(unusedAmount)}</strong>
          </span>
          <button type="button" className="lpm-cancel-btn" onClick={onClose}>CANCEL</button>
          <button type="button" className="lpm-done-btn" onClick={() => onDone(selected)}>DONE</button>
        </div>
      </div>
    </div>
  );
}

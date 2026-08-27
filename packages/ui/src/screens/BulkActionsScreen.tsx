import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";
import type { Transaction, Party } from "@vyapar/api-client";
import { useCompany } from "../lib/CompanyContext";

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
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

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Transactions" },
  { value: "sale", label: "Sale" },
  { value: "purchase", label: "Purchase" },
  { value: "payment_in", label: "Payment-In" },
  { value: "payment_out", label: "Payment-Out" },
  { value: "credit_note", label: "Credit Note" },
  { value: "debit_note", label: "Debit Note" },
  { value: "sale_order", label: "Sale Order" },
  { value: "estimate", label: "Estimate" },
  { value: "proforma_invoice", label: "Proforma Invoice" },
  { value: "delivery_challan", label: "Delivery Challan" },
  { value: "expense", label: "Expense" },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label]));

type Props = { isLocked?: boolean; onLockedAction?: () => void; onNavigate?: (screen: string) => void };

export function BulkActionsScreen({ isLocked = false, onLockedAction, onNavigate }: Props = {}) {
  const { companies, companyFilter } = useCompany();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const initRange = getPresetRange("This Month");
  const [filterPreset, setFilterPreset] = useState("This Month");
  const [filterFrom, setFilterFrom] = useState(initRange.from);
  const [filterTo, setFilterTo] = useState(initRange.to);
  const [showDatePanel, setShowDatePanel] = useState(false);
  const [datePanelPos, setDatePanelPos] = useState({ top: 0, left: 0 });
  const datePanelRef = useRef<HTMLDivElement>(null);

  const [firmFilterId, setFirmFilterId] = useState("");
  const [showFirmPanel, setShowFirmPanel] = useState(false);
  const [firmPanelPos, setFirmPanelPos] = useState({ top: 0, left: 0 });
  const firmPanelRef = useRef<HTMLDivElement>(null);

  const [typeFilter, setTypeFilter] = useState("");
  const [showTypePanel, setShowTypePanel] = useState(false);
  const [typePanelPos, setTypePanelPos] = useState({ top: 0, left: 0 });
  const typePanelRef = useRef<HTMLDivElement>(null);

  const [partyFilterId, setPartyFilterId] = useState("");
  const [showPartyPanel, setShowPartyPanel] = useState(false);
  const [partyPanelPos, setPartyPanelPos] = useState({ top: 0, left: 0 });
  const partyPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (showDatePanel && datePanelRef.current && !datePanelRef.current.contains(e.target as Node)) setShowDatePanel(false);
      if (showFirmPanel && firmPanelRef.current && !firmPanelRef.current.contains(e.target as Node)) setShowFirmPanel(false);
      if (showTypePanel && typePanelRef.current && !typePanelRef.current.contains(e.target as Node)) setShowTypePanel(false);
      if (showPartyPanel && partyPanelRef.current && !partyPanelRef.current.contains(e.target as Node)) setShowPartyPanel(false);
    }
    if (showDatePanel || showFirmPanel || showTypePanel || showPartyPanel) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [showDatePanel, showFirmPanel, showTypePanel, showPartyPanel]);

  async function load() {
    setLoading(true);
    try {
      const companyId = firmFilterId || companyFilter || undefined;
      const [txns, ps] = await Promise.all([
        api.getBulkTransactions({
          from: filterFrom, to: filterTo, companyId,
          partyId: partyFilterId || undefined,
          type: typeFilter || undefined,
          take: 10000,
        }),
        api.getParties(),
      ]);
      setRows(txns);
      setParties(ps);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    setSelected(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFrom, filterTo, companyFilter, firmFilterId, typeFilter, partyFilterId]);

  const partyNameById = new Map(parties.map((p) => [p.id, p.name]));

  const filtered = rows.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = (partyNameById.get(t.partyId) ?? "").toLowerCase();
    return name.includes(q) || (t.number ?? "").toLowerCase().includes(q);
  });

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((t) => t.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (isLocked) { onLockedAction?.(); return; }
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size.toLocaleString()} selected transaction(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      for (const id of selected) {
        await api.deleteTransaction(id).catch(() => {});
      }
      setSelected(new Set());
      await load();
    } finally {
      setDeleting(false);
    }
  }

  function handleExportExcel() {
    const rows = filtered.map((t) => ({
      "Date": fmtDate(t.date),
      "Ref. No": t.number ?? "–",
      "Name": partyNameById.get(t.partyId) ?? "Unknown",
      "Type": TYPE_LABEL[t.type] ?? t.type,
      "Total": t.total,
      "Received/Paid": t.total - t.balance,
      "Balance": t.balance,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bulk Actions");
    XLSX.writeFile(wb, `BulkActions_${filterFrom}_to_${filterTo}.xlsx`);
  }

  return (
    <div className="bulk-root">
      <div className="bulk-page-header">
        <span className="bulk-page-header__title">Bulk Actions</span>
        <div className="bulk-page-header__right">
          <input
            className="bulk-search"
            placeholder="Search party or ref no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="bulk-add-btn bulk-add-btn--sale" onClick={() => onNavigate?.("sale")}>+ Add Sale</button>
          <button type="button" className="bulk-add-btn bulk-add-btn--purchase" onClick={() => onNavigate?.("purchase")}>+ Add Purchase</button>
          <button type="button" className="dc-icon-btn" onClick={handleExportExcel} title="Download Excel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m7 10 5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="dc-icon-btn" onClick={() => window.print()} title="Print">🖨</button>
        </div>
      </div>

      <div className="purchase-datebar">
        <button type="button" className="purchase-datebar__period" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setDatePanelPos({ top: r.bottom + 6, left: r.left });
          setShowDatePanel((v) => !v);
        }}>{filterPreset} <span>▾</span></button>
        <div className="purchase-datebar__range">
          <span className="purchase-datebar__date-val">{fmtChip(filterFrom)}</span>
          <span className="purchase-datebar__to">To</span>
          <span className="purchase-datebar__date-val">{fmtChip(filterTo)}</span>
        </div>
        <button type="button" className="purchase-datebar__chip" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setFirmPanelPos({ top: r.bottom + 6, left: r.left });
          setShowFirmPanel((v) => !v);
        }}>{(firmFilterId ? companies.find((c) => c.id === firmFilterId)?.name : null) ?? "All Firms"} <span>▾</span></button>
        <button type="button" className="purchase-datebar__chip" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setTypePanelPos({ top: r.bottom + 6, left: r.left });
          setShowTypePanel((v) => !v);
        }}>{typeFilter ? TYPE_LABEL[typeFilter] : "All Transactions"} <span>▾</span></button>
        <button type="button" className="purchase-datebar__chip" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPartyPanelPos({ top: r.bottom + 6, left: r.left });
          setShowPartyPanel((v) => !v);
        }}>{(partyFilterId ? partyNameById.get(partyFilterId) : null) ?? "Select Party"} <span>▾</span></button>
      </div>

      {showDatePanel && (
        <div ref={datePanelRef} style={{ position: "fixed", top: datePanelPos.top, left: datePanelPos.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.13)", zIndex: 700, width: 340, padding: "12px 0 16px" }}>
          <div style={{ padding: "0 14px 10px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase" }}>Quick Select</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 0" }}>
            {["This Month", "Last Month", "This Quarter", "This Year"].map((p) => (
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

      {showTypePanel && (
        <div ref={typePanelRef} style={{ position: "fixed", top: typePanelPos.top, left: typePanelPos.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.13)", zIndex: 700, width: 220, padding: "6px 0", maxHeight: 320, overflowY: "auto" }}>
          {TYPE_OPTIONS.map((t) => (
            <button key={t.value} type="button" onClick={() => { setTypeFilter(t.value); setShowTypePanel(false); }}
              style={{ display: "block", width: "100%", padding: "8px 14px", background: typeFilter === t.value ? "#eff6ff" : "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: typeFilter === t.value ? "#2563eb" : "#374151", fontWeight: typeFilter === t.value ? 600 : 400 }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {showPartyPanel && (
        <div ref={partyPanelRef} style={{ position: "fixed", top: partyPanelPos.top, left: partyPanelPos.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.13)", zIndex: 700, width: 240, padding: "6px 0", maxHeight: 360, overflowY: "auto" }}>
          <button type="button" onClick={() => { setPartyFilterId(""); setShowPartyPanel(false); }}
            style={{ display: "block", width: "100%", padding: "8px 14px", background: !partyFilterId ? "#eff6ff" : "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: !partyFilterId ? "#2563eb" : "#374151", fontWeight: !partyFilterId ? 600 : 400 }}>
            All Parties
          </button>
          {parties.map((p) => (
            <button key={p.id} type="button" onClick={() => { setPartyFilterId(p.id); setShowPartyPanel(false); }}
              style={{ display: "block", width: "100%", padding: "8px 14px", background: partyFilterId === p.id ? "#eff6ff" : "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: partyFilterId === p.id ? "#2563eb" : "#374151", fontWeight: partyFilterId === p.id ? 600 : 400 }}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="bulk-table-wrap">
        {loading ? (
          <div className="pi-loading">Loading…</div>
        ) : (
          <table className="bulk-table">
            <thead>
              <tr>
                <th className="bulk-th bulk-th--check">
                  <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} />
                </th>
                <th className="bulk-th">Date</th>
                <th className="bulk-th">Ref. No</th>
                <th className="bulk-th">Name</th>
                <th className="bulk-th">Type</th>
                <th className="bulk-th bulk-th--num">Total</th>
                <th className="bulk-th bulk-th--num">Received/Paid</th>
                <th className="bulk-th bulk-th--num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="bulk-empty">No transactions to show</td></tr>
              ) : filtered.map((t) => (
                <tr key={t.id} className={selected.has(t.id) ? "bulk-tr bulk-tr--selected" : "bulk-tr"}>
                  <td className="bulk-td bulk-td--check">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} />
                  </td>
                  <td className="bulk-td">{fmtDate(t.date)}</td>
                  <td className="bulk-td">{t.number ?? "–"}</td>
                  <td className="bulk-td">{partyNameById.get(t.partyId) ?? "Unknown"}</td>
                  <td className="bulk-td">{TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className="bulk-td bulk-td--num">{fmt(t.total)}</td>
                  <td className="bulk-td bulk-td--num">{fmt(t.total - t.balance)}</td>
                  <td className="bulk-td bulk-td--num">{fmt(t.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected.size > 0 && (
        <div className="bulk-actionbar">
          <span className="bulk-actionbar__count">{selected.size.toLocaleString()} selected</span>
          <button type="button" className="bulk-actionbar__btn" onClick={() => window.print()}>🖨 Print</button>
          <button type="button" className="bulk-actionbar__btn bulk-actionbar__btn--danger" onClick={() => void handleBulkDelete()} disabled={deleting}>
            {deleting ? "Deleting…" : "🗑 Delete"}
          </button>
        </div>
      )}
    </div>
  );
}

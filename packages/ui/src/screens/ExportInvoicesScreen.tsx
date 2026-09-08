import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "../lib/api";
import { useCompany } from "../lib/CompanyContext";
import type { Party, TeamMember } from "@vyapar/api-client";
import { BulkInvoicePreviewModal } from "./BulkInvoicePreviewModal";
import type { SaleRow } from "./InvoicePreviewModal";

const PK_TZ = "Asia/Karachi";
function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtChip(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: PK_TZ });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: PK_TZ });
}
// Same preset math as SaleScreen's own getPresetRange — kept in sync manually (small pure
// function, duplicated rather than shared, matching this codebase's existing convention).
function getPresetRange(preset: string): { from: string; to: string } {
  const nowPK = new Date(new Date().toLocaleString("en-US", { timeZone: PK_TZ }));
  const y = nowPK.getFullYear(), m = nowPK.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = iso(nowPK);
  const now = nowPK;
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

export type ExportInvoicesFilters = {
  filterPreset: string;
  filterFrom: string;
  filterTo: string;
  salesmanFilterId: string;
  status: "all" | "unpaid" | "paid";
};

type Props = ExportInvoicesFilters & { onBack: () => void };

// Full page (not a popup) reached from the Sale list's "Export to PDF" — the client wanted the
// same Date/Salesman/status filters the Sale list has, adjustable here too, not just carried
// over as a read-only label. Owns its own copy of that filter state and re-fetches independently
// of the Sale list screen, same fetch shape as SaleScreen.loadSales().
export function ExportInvoicesScreen(props: Props) {
  const { onBack } = props;
  const { companyFilter } = useCompany();

  const [filterPreset, setFilterPreset] = useState(props.filterPreset);
  const [filterFrom, setFilterFrom] = useState(props.filterFrom);
  const [filterTo, setFilterTo] = useState(props.filterTo);
  const [salesmanFilterId, setSalesmanFilterId] = useState(props.salesmanFilterId);
  const [status, setStatus] = useState<"all" | "unpaid" | "paid">(props.status);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkPreview, setShowBulkPreview] = useState(false);

  const [showDatePanel, setShowDatePanel] = useState(false);
  const [datePanelPos, setDatePanelPos] = useState({ top: 0, left: 0 });
  const datePanelRef = useRef<HTMLDivElement>(null);
  const [showSalesmanPanel, setShowSalesmanPanel] = useState(false);
  const [salesmanPanelPos, setSalesmanPanelPos] = useState({ top: 0, left: 0 });
  const salesmanPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { api.listTeamMembers().then(setTeamMembers).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const opts = { from: filterFrom, to: filterTo, companyId: companyFilter ?? undefined, bookerId: salesmanFilterId || undefined };
        const [txns, ps] = await Promise.all([
          api.getTransactionsByType("sale", { ...opts, take: 10000 }),
          api.getParties(),
        ]);
        const map: Record<string, string> = {};
        ps.forEach((p) => { map[p.id] = p.name; });
        setSales(txns.map((t) => ({ ...t, partyName: map[t.partyId] ?? "Unknown" })));
        setParties(ps);
      } catch { /* offline */ } finally {
        setLoading(false);
      }
    })();
  }, [filterFrom, filterTo, companyFilter, salesmanFilterId]);

  useEffect(() => {
    if (!showDatePanel) return;
    function onDown(e: MouseEvent) {
      if (datePanelRef.current && !datePanelRef.current.contains(e.target as Node)) setShowDatePanel(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showDatePanel]);

  useEffect(() => {
    if (!showSalesmanPanel) return;
    function onDown(e: MouseEvent) {
      if (salesmanPanelRef.current && !salesmanPanelRef.current.contains(e.target as Node)) setShowSalesmanPanel(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showSalesmanPanel]);

  const filtered = useMemo(() => sales.filter((s) => {
    if (status === "unpaid") return s.balance > 0;
    if (status === "paid") return s.balance <= 0;
    return true;
  }), [sales, status]);

  // Re-select everything whenever the filtered set changes (new fetch, or status flipped) —
  // matches the old "Export to PDF" one-click behavior by default, still adjustable per-row.
  useEffect(() => {
    setSelected(new Set(filtered.map((s) => s.id)));
  }, [filtered]);

  const allSelected = selected.size === filtered.length && filtered.length > 0;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((s) => s.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="eip-screen">
      <div className="eip-appbar">
        <button type="button" className="eip-back" onClick={onBack}>← Back</button>
        <span className="eip-title">Export Invoices</span>
        <span className="eip-count-badge">{selected.size} of {filtered.length} selected</span>
      </div>

      <div className="sale-filterbar">
        <span className="sale-filterbar__label">Filter by :</span>

        <button type="button" className="sale-filterbar__chip" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setDatePanelPos({ top: r.bottom + 6, left: r.left });
          setShowDatePanel((v) => !v);
        }}>{filterPreset} ▾</button>

        <button type="button" className="sale-filterbar__date" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setDatePanelPos({ top: r.bottom + 6, left: r.left });
          setShowDatePanel((v) => !v);
        }}>📅 {fmtChip(filterFrom)} To {fmtChip(filterTo)}</button>

        <button type="button" className="sale-filterbar__chip" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setSalesmanPanelPos({ top: r.bottom + 6, left: r.left });
          setShowSalesmanPanel((v) => !v);
        }}>{salesmanFilterId ? (teamMembers.find((m) => m.id === salesmanFilterId)?.name ?? "All Salesmen") : "All Salesmen"} ▾</button>

        <div className="sale-filterbar__spacer" />

        <div className="sale-filterbar__pills">
          {(["all", "unpaid", "paid"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`sale-filterbar__pill${status === f ? " sale-filterbar__pill--active" : ""}`}
              onClick={() => setStatus(f)}
            >
              {f === "all" ? "All" : f === "unpaid" ? "Unpaid" : "Paid"}
            </button>
          ))}
        </div>
      </div>

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

      {showSalesmanPanel && (
        <div ref={salesmanPanelRef} style={{ position: "fixed", top: salesmanPanelPos.top, left: salesmanPanelPos.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.13)", zIndex: 700, width: 220, padding: "6px 0", maxHeight: 320, overflowY: "auto" }}>
          <button type="button" onClick={() => { setSalesmanFilterId(""); setShowSalesmanPanel(false); }}
            style={{ display: "block", width: "100%", padding: "8px 14px", background: !salesmanFilterId ? "#eff6ff" : "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: !salesmanFilterId ? "#2563eb" : "#374151", fontWeight: !salesmanFilterId ? 600 : 400 }}>
            All Salesmen
          </button>
          {teamMembers.length === 0 ? (
            <div style={{ padding: "8px 14px", fontSize: 12, color: "#9ca3af" }}>No team members yet.</div>
          ) : teamMembers.map((m) => (
            <button key={m.id} type="button" onClick={() => { setSalesmanFilterId(m.id); setShowSalesmanPanel(false); }}
              style={{ display: "block", width: "100%", padding: "8px 14px", background: salesmanFilterId === m.id ? "#eff6ff" : "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: salesmanFilterId === m.id ? "#2563eb" : "#374151", fontWeight: salesmanFilterId === m.id ? 600 : 400 }}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="eip-toolbar">
        <label className="eip-checkall">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Select All
        </label>
      </div>

      <div className="eip-list">
        {loading ? (
          <div className="eip-empty">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="eip-empty">No invoices match the current filters.</div>
        ) : (
          <table className="eip-table">
            <thead>
              <tr>
                <th className="eip-th-check" />
                <th>Party Name</th>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sale, i) => (
                <tr key={sale.id} onClick={() => toggleOne(sale.id)}>
                  <td className="eip-th-check">
                    <input type="checkbox" checked={selected.has(sale.id)} onChange={() => toggleOne(sale.id)} onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td>{sale.partyName}</td>
                  <td>#{i + 1}</td>
                  <td>{fmtDate(sale.date)}</td>
                  <td>Rs {fmt(sale.total)}</td>
                  <td>Rs {fmt(sale.balance)}</td>
                  <td>{sale.balance <= 0 ? "PAID" : "UNPAID"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="eip-footer">
        <button type="button" className="eip-btn" onClick={onBack}>Cancel</button>
        <button
          type="button"
          className="eip-btn eip-btn--primary"
          disabled={selected.size === 0}
          onClick={() => setShowBulkPreview(true)}
        >
          Continue with {selected.size} Invoice{selected.size === 1 ? "" : "s"}
        </button>
      </div>

      {showBulkPreview && (
        <BulkInvoicePreviewModal
          sales={filtered.filter((s) => selected.has(s.id))}
          parties={parties}
          onClose={() => setShowBulkPreview(false)}
        />
      )}
    </div>
  );
}

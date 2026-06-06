import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import type { Transaction, Party, Item } from "@vyapar/api-client";
import { InvoicePreviewModal } from "./InvoicePreviewModal";

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function today() { return new Date().toISOString().slice(0, 10); }
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtChip(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  switch (preset) {
    case "Today": return { from: today(), to: today() };
    case "This Week": {
      const day = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      return { from: iso(mon), to: today() };
    }
    case "This Month": return { from: `${y}-${pad(m + 1)}-01`, to: iso(new Date(y, m + 1, 0)) };
    case "Last Month": return { from: `${y}-${pad(m)}-01`, to: iso(new Date(y, m, 0)) };
    case "This Quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return { from: `${y}-${pad(qStart + 1)}-01`, to: today() };
    }
    case "This Year": return { from: `${y}-01-01`, to: today() };
    default: return { from: `${y}-${pad(m + 1)}-01`, to: iso(new Date(y, m + 1, 0)) };
  }
}

const UNITS = ["NONE", "Pcs", "Kg", "Gm", "L", "ML", "Box", "Pack", "Bag", "Mtr", "Ft"];

type LineItem = { id: string; name: string; mrp: number; qty: number; unit: string; rate: number; stock?: number };
function emptyRow(): LineItem {
  return { id: Date.now().toString() + Math.random(), name: "", mrp: 0, qty: 0, unit: "NONE", rate: 0 };
}

type TxnRow = Transaction & { partyName: string };

/* ─────────────────────────────────────────────
   Per-type configuration
───────────────────────────────────────────── */
type ConvertOption = { label: string; type: string };

type TxnConfig = {
  txnType: string;
  title: string;
  addLabel: string;
  numberLabel: string;
  showPhone?: boolean;
  showDueDate?: boolean;
  showInvoiceRef?: boolean;
  showPaymentType?: boolean;
  showConvertToSale?: boolean;
  convertOptions?: ConvertOption[];
  showLinkPayment?: boolean;
  summaryLabel?: string;
  emptyIcon?: string;
  emptyMsg?: string;
  emptySubMsg?: string;
  accentColor?: string;
};

const TXN_CONFIGS: Record<string, TxnConfig> = {
  "sale-estimate": {
    txnType: "estimate",
    title: "Estimate/Quotation",
    addLabel: "+ Add Estimate",
    numberLabel: "Ref No.",
    showConvertToSale: true,
    convertOptions: [
      { label: "Convert to Sale", type: "sale" },
      { label: "Convert to Sale Order", type: "sale_order" },
    ],
    summaryLabel: "Total Quotations",
    emptyIcon: "📋",
    emptyMsg: "No Transactions to show",
    emptySubMsg: "You haven't added any transactions yet.",
    accentColor: "#3b82f6",
  },
  "sale-proforma": {
    txnType: "proforma_invoice",
    title: "Proforma Invoice",
    addLabel: "+ Add Proforma",
    numberLabel: "Ref No.",
    showConvertToSale: true,
    convertOptions: [
      { label: "Convert to Sale", type: "sale" },
      { label: "Convert to Sale Order", type: "sale_order" },
    ],
    summaryLabel: "Total Quotations",
    emptyIcon: "📄",
    emptyMsg: "No Transactions to show",
    emptySubMsg: "You haven't added any transactions yet.",
    accentColor: "#3b82f6",
  },
  "sale-order": {
    txnType: "sale_order",
    title: "Sale Order",
    addLabel: "+ Add Sale Order",
    numberLabel: "Order No.",
    showPhone: true,
    showDueDate: true,
    showPaymentType: true,
    showConvertToSale: true,
    summaryLabel: "Total Sale Orders",
    emptyIcon: "🛒",
    emptyMsg: "No Sale Orders yet",
    emptySubMsg: "Create your first sale order.",
    accentColor: "#3b82f6",
  },
  "sale-delivery": {
    txnType: "delivery_challan",
    title: "Delivery Challan",
    addLabel: "Add Your First Delivery Challan",
    numberLabel: "Challan No.",
    showDueDate: true,
    showConvertToSale: true,
    convertOptions: [
      { label: "Convert to Sale", type: "sale" },
    ],
    summaryLabel: "Total Delivery Challans",
    emptyIcon: "🚚",
    emptyMsg: "Make & share delivery challan with your customers & convert it to sale whenever you want.",
    emptySubMsg: "",
    accentColor: "#d97706",
  },
  "sale-return": {
    txnType: "credit_note",
    title: "Sale Return/Credit Note",
    addLabel: "+ Add Credit Note",
    numberLabel: "Return No.",
    showPhone: true,
    showInvoiceRef: true,
    showPaymentType: true,
    showLinkPayment: true,
    summaryLabel: "Total Credit Notes",
    emptyIcon: "↩️",
    emptyMsg: "No data is available for Credit Note.",
    emptySubMsg: "Please try again after making relevant changes.",
    accentColor: "#3b82f6",
  },
};

/* ═══════════════════════════════════════════════════════════
   MAIN SCREEN
═══════════════════════════════════════════════════════════ */
type Props = { activeKey: string; isLocked?: boolean; onLockedAction?: () => void };

export function SaleTxnScreen({ activeKey, isLocked = false, onLockedAction }: Props) {
  const cfg = TXN_CONFIGS[activeKey] ?? TXN_CONFIGS["sale-estimate"];

  const [rows, setRows] = useState<TxnRow[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<TxnRow | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState<TxnRow | null>(null);
  const [saleOrderTab, setSaleOrderTab] = useState<"orders" | "online">("orders");
  const [convertRow, setConvertRow] = useState<TxnRow | null>(null);
  const [convertTargetType, setConvertTargetType] = useState<string>("sale");
  const [returnedQtys, setReturnedQtys] = useState<Record<string, number>>({});

  /* ── Filters ── */
  const initRange = getPresetRange("This Month");
  const [filterPreset, setFilterPreset] = useState("This Month");
  const [filterFrom, setFilterFrom] = useState(initRange.from);
  const [filterTo, setFilterTo] = useState(initRange.to);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showSearch, setShowSearch] = useState(false);
  const [showDatePanel, setShowDatePanel] = useState(false);
  const [datePanelPos, setDatePanelPos] = useState({ top: 0, left: 0 });
  const datePanelRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const [txns, ps, items] = await Promise.all([
        api.getTransactionsByType(cfg.txnType),
        api.getParties(),
        api.getItems(),
      ]);
      const map = Object.fromEntries(ps.map((p: Party) => [p.id, p]));
      setRows(txns.map((t) => ({ ...t, partyName: map[t.partyId]?.name ?? "Unknown" })));
      setParties(ps);
      setCatalog(items);
    } catch { /* offline */ }
  }

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.txnType]);

  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuId]);

  useEffect(() => {
    if (!showDatePanel) return;
    function handler(e: MouseEvent) {
      if (datePanelRef.current && !datePanelRef.current.contains(e.target as Node)) setShowDatePanel(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDatePanel]);

  const filteredRows = rows.filter((r) => {
    const d = r.date.slice(0, 10);
    if (d < filterFrom || d > filterTo) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      if (!r.partyName.toLowerCase().includes(q) && !(r.number ?? "").toLowerCase().includes(q)) return false;
    }
    if (filterStatus === "paid" && r.balance > 0) return false;
    if (filterStatus === "unpaid" && r.balance === 0) return false;
    return true;
  });

  function handleAdd() {
    if (isLocked) { onLockedAction?.(); return; }
    setEditRow(null);
    setShowForm(true);
  }

  async function handleDuplicate(row: TxnRow) {
    try {
      const all = await api.getTransactionsByType(cfg.txnType);
      const parsed = parseNotes(row.notes);
      await api.createTransaction({
        partyId: row.partyId,
        type: cfg.txnType as "estimate",
        number: String(all.length + 1),
        date: new Date().toISOString(),
        total: row.total,
        balance: row.total,
        notes: row.notes ?? undefined,
      });
      setLoading(true);
      await load();
    } finally {
      setLoading(false);
    }
  }

  function openConvert(row: TxnRow, targetType: string = "sale") {
    const parsed = parseNotes(row.notes);
    const items: any[] = parsed.items ?? [];
    const initial: Record<string, number> = {};
    items.forEach((item: any, idx: number) => { initial[String(idx)] = item.qty; });
    setReturnedQtys(initial);
    setConvertTargetType(targetType);
    setConvertRow(row);
  }

  async function doConvert() {
    if (!convertRow) return;
    const parsed = parseNotes(convertRow.notes);
    const items: any[] = parsed.items ?? [];
    const saleItems = items
      .map((item: any, idx: number) => ({ ...item, qty: returnedQtys[String(idx)] ?? 0 }))
      .filter((item: any) => item.qty > 0);
    if (saleItems.length === 0) { alert("Set quantity for at least one item."); return; }
    const total = saleItems.reduce((s: number, i: any) => s + i.qty * i.rate, 0);
    try {
      const allTxns = await api.getTransactionsByType(convertTargetType);
      const txnNumber = String(allTxns.length + 1);
      const notesJson = JSON.stringify({
        items: saleItems,
        phone: parsed.phone ?? "",
        dueDate: parsed.dueDate ?? new Date().toISOString().slice(0, 10),
        paymentType: parsed.paymentType ?? "Cash",
        fromSourceId: convertRow.id,
      });
      await api.createTransaction({
        partyId: convertRow.partyId,
        type: convertTargetType as "sale",
        number: txnNumber,
        date: new Date().toISOString(),
        total,
        balance: total,
        notes: notesJson,
      });
      const updatedNotes = JSON.stringify({ ...parsed, linkedSaleNumber: txnNumber });
      await api.updateTransaction(convertRow.id, { balance: 0, notes: updatedNotes });
      setConvertRow(null);
      const label = convertTargetType === "sale_order" ? "Sale Order" : "Sale Invoice";
      alert(`Converted to ${label} #${txnNumber} successfully.`);
      setLoading(true);
      await load();
      setLoading(false);
    } catch { alert("Could not convert. Please try again."); }
  }

  const totalAmt = filteredRows.reduce((s, r) => s + r.total, 0);
  const openAmt = filteredRows.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0);
  const convertedAmt = filteredRows.filter((r) => r.balance === 0).reduce((s, r) => s + r.total, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8f9fa" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 10px", background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{cfg.title}</span>
          <span style={{ fontSize: 16, color: "#6b7280" }}>▾</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {cfg.showConvertToSale && rows.length > 0 && (
            <button type="button" style={{ padding: "7px 16px", border: "1.5px solid #dc2626", borderRadius: 6, background: "#fff", color: "#dc2626", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Bulk Convert To Sale
            </button>
          )}
          <button type="button" onClick={handleAdd} style={{ padding: "8px 18px", background: cfg.accentColor ?? "#3b82f6", color: "#fff", border: "none", borderRadius: 7, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {cfg.showConvertToSale ? <><span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Sale Order</> : <>{cfg.addLabel}</>}
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "#fff", borderBottom: "1px solid #f0f0f0", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" }}>Filter by :</span>

        {/* Date preset chip */}
        <button type="button" style={chipStyle} onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setDatePanelPos({ top: r.bottom + 6, left: r.left });
          setShowDatePanel((v) => !v);
        }}>{filterPreset} ▾</button>

        {/* Date range chip */}
        <button type="button" style={chipStyle} onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setDatePanelPos({ top: r.bottom + 6, left: r.left });
          setShowDatePanel((v) => !v);
        }}>📅 {fmtChip(filterFrom)} To {fmtChip(filterTo)}</button>

        {activeKey === "sale-return" && (
          <select style={chipStyle} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Payment</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        )}

        <div style={{ flex: 1 }} />

        {/* Search input (toggleable) */}
        {showSearch && (
          <input
            autoFocus
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 10px", fontSize: 13, width: 220, outline: "none" }}
            placeholder="Search party or ref no…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setFilterSearch(""); setShowSearch(false); } }}
          />
        )}
        <button type="button"
          style={{ background: showSearch ? "#eff6ff" : "none", border: showSearch ? "1px solid #bfdbfe" : "none", borderRadius: 6, cursor: "pointer", color: showSearch ? "#2563eb" : "#6b7280", fontSize: 16, padding: "4px 8px" }}
          title="Search"
          onClick={() => { setShowSearch((v) => !v); if (showSearch) setFilterSearch(""); }}
        >🔍</button>

        <button type="button" style={{ background: "#16a34a", border: "none", borderRadius: 4, color: "#fff", padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>xls</button>
        <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16 }} onClick={() => window.print()}>🖨</button>
      </div>

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

      {/* ── Sale Order tabs ── */}
      {activeKey === "sale-order" && (
        <div style={{ display: "flex", background: "#fff", borderBottom: "2px solid #e5e7eb" }}>
          {(["orders", "online"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSaleOrderTab(tab)}
              style={{
                flex: 1, padding: "12px", border: "none", background: "none", cursor: "pointer",
                fontWeight: 600, fontSize: 13, letterSpacing: 0.5,
                color: saleOrderTab === tab ? "#3b82f6" : "#6b7280",
                borderBottom: saleOrderTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
                marginBottom: -2,
              }}
            >
              {tab === "orders" ? "SALE ORDERS" : "ONLINE ORDERS"}
            </button>
          ))}
        </div>
      )}

      {/* ── Summary card ── */}
      {filteredRows.length > 0 && (
        <div style={{ margin: "12px 20px 0", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 20px", display: "inline-flex", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{cfg.summaryLabel ?? "Total"}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Rs {fmt(totalAmt)}</div>
            {activeKey !== "sale-order" && (
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Converted: <strong>Rs {fmt(convertedAmt)}</strong>
                <span style={{ margin: "0 8px" }}>|</span>
                Open: <strong>Rs {fmt(openAmt)}</strong>
              </div>
            )}
          </div>
          {activeKey === "sale-order" && (
            <span style={{ padding: "3px 10px", borderRadius: 12, background: "#dcfce7", color: "#16a34a", fontSize: 12, fontWeight: 600 }}>
              {totalAmt > 0 ? "100% ↑" : "0%"}
            </span>
          )}
        </div>
      )}

      {/* ── List ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState cfg={cfg} onAdd={handleAdd} />
        ) : filteredRows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>No results found</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting the date range or search term.</div>
          </div>
        ) : activeKey === "sale-order" ? (
          <SaleOrderList
            rows={filteredRows}
            menuId={menuId}
            menuPos={menuPos}
            onMenu={(id, pos) => { setMenuId(id); setMenuPos(pos); }}
            onEdit={(r) => { setEditRow(r); setShowForm(true); }}
            onDelete={(r) => setDeleteConfirm(r)}
            onDuplicate={handleDuplicate}
            onConvert={(r) => openConvert(r, "sale")}
          />
        ) : activeKey === "sale-return" ? (
          <CreditNoteList
            rows={filteredRows}
            menuId={menuId}
            menuPos={menuPos}
            onMenu={(id, pos) => { setMenuId(id); setMenuPos(pos); }}
            onEdit={(r) => { setEditRow(r); setShowForm(true); }}
            onDelete={(r) => setDeleteConfirm(r)}
            onDuplicate={handleDuplicate}
          />
        ) : (
          <DefaultList
            cfg={cfg}
            rows={filteredRows}
            menuId={menuId}
            menuPos={menuPos}
            onMenu={(id, pos) => { setMenuId(id); setMenuPos(pos); }}
            onEdit={(r) => { setEditRow(r); setShowForm(true); }}
            onDelete={(r) => setDeleteConfirm(r)}
            onDuplicate={handleDuplicate}
            onConvert={openConvert}
          />
        )}

      </div>

      {/* Credit note bottom bar */}
      {activeKey === "sale-return" && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 20px", background: "#fff", borderTop: "1px solid #e5e7eb", fontSize: 13, color: "#374151" }}>
          <span>Total Amount: <strong style={{ color: "#3b82f6" }}>Rs {fmt(totalAmt)}</strong></span>
          <span>Balance: <strong>Rs {fmt(openAmt)}</strong></span>
        </div>
      )}

      {/* ── Row action menu ── */}
      {menuId && (() => {
        const row = rows.find((r) => r.id === menuId);
        if (!row) return null;
        const items: { label: string; action: () => void }[] = [
          { label: "View/Edit",    action: () => { setEditRow(row); setShowForm(true); setMenuId(null); } },
          { label: "Open PDF",     action: () => { setMenuId(null); window.print(); } },
          { label: "Print",        action: () => { setMenuId(null); window.print(); } },
          { label: "Delete",       action: () => { setDeleteConfirm(row); setMenuId(null); } },
          { label: "Duplicate",    action: () => { setMenuId(null); void handleDuplicate(row); } },
        ];
        if (cfg.showConvertToSale && row.balance > 0) {
          const opts = cfg.convertOptions ?? [{ label: "Convert to Sale", type: "sale" }];
          opts.forEach((opt) => {
            items.unshift({ label: opt.label, action: () => { setMenuId(null); openConvert(row, opt.type); } });
          });
        }
        return (
          <div
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 500, minWidth: 160, padding: "4px 0" }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map(({ label, action }) => (
              <button key={label} type="button" onClick={action} style={{ display: "block", width: "100%", padding: "9px 16px", background: "none", border: "none", textAlign: "left", fontSize: 13, color: "#374151", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >{label}</button>
            ))}
          </div>
        );
      })()}

      {/* ── Form ── */}
      {showForm && (
        <TxnForm
          key={editRow?.id ?? "new"}
          cfg={cfg}
          parties={parties}
          catalog={catalog}
          initialRow={editRow ?? undefined}
          existingCount={rows.length}
          onClose={() => { setShowForm(false); setEditRow(null); }}
          onSaved={async () => { setShowForm(false); setEditRow(null); setLoading(true); await load(); setLoading(false); }}
        />
      )}

      {/* ── Convert to Sale modal ── */}
      {convertRow && (() => {
        const parsed = parseNotes(convertRow.notes);
        const items: any[] = parsed.items ?? [];
        const convertTotal = items.reduce((s: number, item: any, idx: number) => {
          const qty = returnedQtys[String(idx)] ?? 0;
          return s + qty * item.rate;
        }, 0);
        const targetLabel = convertTargetType === "sale_order" ? "Sale Order" : "Sale Invoice";
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 800 }}>
            <div style={{ background: "#fff", borderRadius: 10, width: 640, maxWidth: "95vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Convert to {targetLabel}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{convertRow.partyName} · Ref #{convertRow.number ?? "–"}</div>
                </div>
                <button type="button" onClick={() => setConvertRow(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
              </div>
              <div style={{ padding: "14px 20px" }}>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>Set the quantity for each item to include in the sale invoice.</p>
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["#", "Item", "Unit", "Orig. Qty", "Sale Qty", "Rate", "Amount"].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, idx: number) => {
                      const saleQty = returnedQtys[String(idx)] ?? item.qty;
                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={tdStyle}>{idx + 1}</td>
                          <td style={tdStyle}>{item.name}</td>
                          <td style={tdStyle}>{item.unit ?? "NONE"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{item.qty}</td>
                          <td style={tdStyle}>
                            <input
                              type="number" min={0} max={item.qty}
                              value={saleQty}
                              onChange={(e) => {
                                const num = parseFloat(e.target.value) || 0;
                                setReturnedQtys((prev) => ({ ...prev, [String(idx)]: Math.min(num, item.qty) }));
                              }}
                              style={{ width: 70, border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: 13, textAlign: "right" }}
                            />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>Rs {fmt(item.rate)}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>Rs {fmt(saleQty * item.rate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  Sale Total: Rs {fmt(convertTotal)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "12px 20px", borderTop: "1px solid #e5e7eb" }}>
                <button type="button" onClick={() => setConvertRow(null)} style={{ padding: "8px 20px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                <button type="button" onClick={doConvert} style={{ padding: "8px 24px", background: "#d97706", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>CONVERT TO {targetLabel.toUpperCase()}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 800 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "28px 32px", width: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Delete {cfg.title}</div>
            <p style={{ fontSize: 14, color: "#374151", marginBottom: 24 }}>
              Delete record for <strong>{deleteConfirm.partyName}</strong> (Rs {deleteConfirm.total.toLocaleString()})? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setDeleteConfirm(null)} style={{ padding: "8px 20px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button type="button" style={{ padding: "8px 20px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
                onClick={async () => {
                  await api.deleteTransaction(deleteConfirm.id);
                  setDeleteConfirm(null);
                  setLoading(true);
                  await load();
                  setLoading(false);
                }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Empty state
───────────────────────────────────────────── */
function EmptyState({ cfg, onAdd }: { cfg: TxnConfig; onAdd: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>{cfg.emptyIcon}</div>
      <p style={{ fontSize: 14, color: "#374151", maxWidth: 360, marginBottom: 6 }}>{cfg.emptyMsg}</p>
      {cfg.emptySubMsg && <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>{cfg.emptySubMsg}</p>}
      <button type="button" onClick={onAdd} style={{ padding: "10px 24px", background: cfg.accentColor ?? "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
        {cfg.addLabel}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Default list (Estimate / Proforma / Delivery)
───────────────────────────────────────────── */
function DefaultList({ cfg, rows, menuId, menuPos, onMenu, onEdit, onDelete, onDuplicate, onConvert }: {
  cfg: TxnConfig; rows: TxnRow[];
  menuId: string | null; menuPos: { top: number; left: number };
  onMenu: (id: string, pos: { top: number; left: number }) => void;
  onEdit: (r: TxnRow) => void; onDelete: (r: TxnRow) => void; onDuplicate: (r: TxnRow) => void;
  onConvert?: (r: TxnRow, targetType: string) => void;
}) {
  const [convertDropId, setConvertDropId] = useState<string | null>(null);
  const [convertDropPos, setConvertDropPos] = useState({ top: 0, right: 0 });
  useEffect(() => {
    if (!convertDropId) return;
    const close = () => setConvertDropId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [convertDropId]);
  return (
    <div>
      <div style={{ marginBottom: 6 }}><strong style={{ fontSize: 14 }}>Transactions</strong></div>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {["Date", "Reference no", "Party Name", "Amount", "Balance", "Status", "Actions"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = row.balance === 0 ? "Converted" : row.balance === row.total ? "Open" : "Partial";
            const statusColor = status === "Converted" ? "#16a34a" : status === "Open" ? "#d97706" : "#3b82f6";
            return (
              <tr key={row.id} style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }} onClick={() => onEdit(row)}>
                <td style={tdStyle}>{formatDate(row.date)}</td>
                <td style={tdStyle}>{row.number ?? "–"}</td>
                <td style={tdStyle}>{row.partyName}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>Rs {fmt(row.total)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>Rs {fmt(row.balance)}</td>
                <td style={tdStyle}><span style={{ color: statusColor, fontWeight: 600, fontSize: 13 }}>{status}</span></td>
                <td style={{ ...tdStyle }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                    {cfg.showConvertToSale && status === "Converted" && (
                      <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, whiteSpace: "nowrap" }}>✓ Converted</span>
                    )}
                    {cfg.showConvertToSale && status !== "Converted" && (() => {
                      const opts = cfg.convertOptions ?? [{ label: "Convert to Sale", type: "sale" }];
                      if (opts.length === 1) {
                        return (
                          <button type="button"
                            onClick={() => onConvert?.(row, opts[0].type)}
                            style={{ padding: "5px 11px", border: "1.5px solid #d97706", borderRadius: 5, background: "#fff", fontSize: 11, cursor: "pointer", color: "#d97706", fontWeight: 700, whiteSpace: "nowrap" }}
                          >CONVERT TO SALE</button>
                        );
                      }
                      const optIcons: Record<string, string> = { sale: "🧾", sale_order: "📋" };
                      const optDesc: Record<string, string> = { sale: "Create a sale invoice", sale_order: "Create a sale order" };
                      return (
                        <div style={{ position: "relative" }}>
                          {/* Split button */}
                          <div style={{ display: "flex", borderRadius: 6, border: "1.5px solid #3b82f6" }}>
                            <button type="button"
                              onClick={() => onConvert?.(row, opts[0].type)}
                              style={{ padding: "5px 11px", background: "#eff6ff", border: "none", borderRight: "1px solid #bfdbfe", cursor: "pointer", fontSize: 11, color: "#2563eb", fontWeight: 700, whiteSpace: "nowrap", borderRadius: "4px 0 0 4px" }}
                            >{opts[0].label}</button>
                            <button type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setConvertDropPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                                setConvertDropId(convertDropId === row.id ? null : row.id);
                              }}
                              style={{ padding: "5px 8px", background: "#eff6ff", border: "none", cursor: "pointer", color: "#2563eb", fontSize: 11, fontWeight: 700, borderRadius: "0 4px 4px 0", display: "flex", alignItems: "center" }}
                            >▾</button>
                          </div>
                        </div>
                      );
                    })()}
                    <button type="button" style={iconBtnStyle} onClick={() => window.print()}>🖨</button>
                    <button type="button" style={iconBtnStyle} onClick={(e) => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      onMenu(row.id, { top: r.bottom + 4, left: r.right - 160 });
                    }}>⋯</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Fixed-position convert dropdown — rendered outside table to avoid clipping */}
      {convertDropId && cfg.convertOptions && cfg.convertOptions.length > 1 && (() => {
        const opts = cfg.convertOptions;
        const optIcons: Record<string, string> = { sale: "🧾", sale_order: "📋" };
        const optDesc: Record<string, string> = { sale: "Create a sale invoice", sale_order: "Create a sale order" };
        return (
          <div
            style={{ position: "fixed", top: convertDropPos.top, right: convertDropPos.right, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.14)", zIndex: 600, minWidth: 230, padding: "6px 0" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "6px 14px 8px", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase" }}>Convert to</div>
            {opts.map((opt, i) => (
              <React.Fragment key={opt.type}>
                {i > 0 && <div style={{ height: 1, background: "#f3f4f6", margin: "2px 0" }} />}
                <button type="button"
                  onClick={() => { setConvertDropId(null); rows.find((r) => r.id === convertDropId) && undefined; }}
                  onMouseDown={() => {
                    const row = rows.find((r) => r.id === convertDropId);
                    if (row) { setConvertDropId(null); onConvert?.(row, opt.type); }
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{optIcons[opt.type] ?? "📄"}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{optDesc[opt.type] ?? ""}</div>
                  </div>
                </button>
              </React.Fragment>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Sale Order list
───────────────────────────────────────────── */
function SaleOrderList({ rows, menuId, menuPos, onMenu, onEdit, onDelete, onDuplicate, onConvert }: {
  rows: TxnRow[];
  menuId: string | null; menuPos: { top: number; left: number };
  onMenu: (id: string, pos: { top: number; left: number }) => void;
  onEdit: (r: TxnRow) => void; onDelete: (r: TxnRow) => void;
  onDuplicate: (r: TxnRow) => void; onConvert: (r: TxnRow) => void;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #f0f0f0" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>TRANSACTIONS</span>
        <div style={{ flex: 1 }} />
        <input style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 10px", fontSize: 13, width: 200 }} placeholder="🔍" />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {["PARTY", "NO.", "DATE", "DUE DATE", "TOTAL AMOUNT", "BALANCE", "TYPE", "STATUS", "ACTION"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const parsed = parseNotes(row.notes);
            const dueDate = parsed.dueDate ? formatDate(parsed.dueDate) : formatDate(row.date);
            const isOverdue = parsed.dueDate ? new Date(parsed.dueDate) < new Date() : false;
            const status = row.balance === 0 ? "Completed" : isOverdue ? "Order Overdue" : "Pending";
            const statusColor = status === "Completed" ? "#16a34a" : status === "Order Overdue" ? "#d97706" : "#6b7280";
            return (
              <tr key={row.id} style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }} onClick={() => onEdit(row)}>
                <td style={tdStyle}>{row.partyName}</td>
                <td style={tdStyle}>{row.number ?? "–"}</td>
                <td style={tdStyle}>{formatDate(row.date)}</td>
                <td style={tdStyle}>{dueDate}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>Rs {fmt(row.total)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>Rs {fmt(row.balance)}</td>
                <td style={tdStyle}>Sale Order</td>
                <td style={tdStyle}><span style={{ color: statusColor, fontWeight: 600, fontSize: 13 }}>{status}</span></td>
                <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {status !== "Completed" ? (
                      <button type="button"
                        style={{ padding: "4px 10px", border: "1.5px solid #3b82f6", borderRadius: 4, background: "#fff", fontSize: 11, cursor: "pointer", color: "#3b82f6", fontWeight: 700, whiteSpace: "nowrap" }}
                        onClick={() => onConvert(row)}>CONVERT TO SALE</button>
                    ) : (
                      <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, whiteSpace: "nowrap" }}>✓ Converted</span>
                    )}
                    <button type="button" style={iconBtnStyle} onClick={(e) => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      onMenu(row.id, { top: r.bottom + 4, left: r.right - 160 });
                    }}>⋯</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Credit Note list
───────────────────────────────────────────── */
function CreditNoteList({ rows, menuId, menuPos, onMenu, onEdit, onDelete, onDuplicate }: {
  rows: TxnRow[];
  menuId: string | null; menuPos: { top: number; left: number };
  onMenu: (id: string, pos: { top: number; left: number }) => void;
  onEdit: (r: TxnRow) => void; onDelete: (r: TxnRow) => void; onDuplicate: (r: TxnRow) => void;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      <thead>
        <tr style={{ background: "#f9fafb" }}>
          {["#", "DATE", "REF NO.", "PARTY NAME", "CATEGORY NAME", "TYPE", "TOTAL", "RECEIVED/PAID", "BALANCE", "STATUS", "PRINT / SHA..."].map((h) => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          const parsed = parseNotes(row.notes);
          const received = row.total - row.balance;
          const status = row.balance === 0 ? "Paid" : row.balance === row.total ? "Unpaid" : "Partial";
          const statusColor = status === "Paid" ? "#16a34a" : status === "Unpaid" ? "#dc2626" : "#d97706";
          return (
            <tr key={row.id} style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }} onClick={() => onEdit(row)}>
              <td style={tdStyle}>{idx + 1}</td>
              <td style={tdStyle}>{formatDate(row.date)}</td>
              <td style={tdStyle}>{row.number ?? "–"}</td>
              <td style={tdStyle}>{row.partyName}</td>
              <td style={tdStyle}>General</td>
              <td style={tdStyle}>Credit Note</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>Rs {fmt(row.total)}</td>
              <td style={{ ...tdStyle, textAlign: "right", color: "#16a34a" }}>Rs {fmt(received)}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>Rs {fmt(row.balance)}</td>
              <td style={tdStyle}><span style={{ color: statusColor, fontWeight: 600, fontSize: 13 }}>{status}</span></td>
              <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" style={iconBtnStyle} onClick={() => window.print()}>🖨</button>
                  <button type="button" style={iconBtnStyle}>↗</button>
                  <button type="button" style={iconBtnStyle} onClick={(e) => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    onMenu(row.id, { top: r.bottom + 4, left: r.right - 160 });
                  }}>⋯</button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ═══════════════════════════════════════════════════════════
   TRANSACTION FORM (modal)
═══════════════════════════════════════════════════════════ */
function TxnForm({ cfg, parties, catalog, initialRow, existingCount, onClose, onSaved }: {
  cfg: TxnConfig;
  parties: Party[];
  catalog: Item[];
  initialRow?: TxnRow;
  existingCount: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initialRow);
  const parsed = initialRow ? parseNotes(initialRow.notes) : {};

  const dropRef = useRef<HTMLDivElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  const initParty = initialRow ? parties.find((p) => p.id === initialRow.partyId) : undefined;

  const [customer, setCustomer] = useState(initParty?.name ?? "");
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const [phone, setPhone] = useState(parsed.phone ?? initParty?.phone ?? "");
  const [date, setDate] = useState(initialRow ? initialRow.date.slice(0, 10) : today());
  const [dueDate, setDueDate] = useState(parsed.dueDate ?? today());
  const [invoiceNumber, setInvoiceNumber] = useState(parsed.invoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(parsed.invoiceDate ?? today());
  const [txnNumber, setTxnNumber] = useState(initialRow?.number ?? "");
  const [paymentType, setPaymentType] = useState(parsed.paymentType ?? "Cash");
  const [discountPct, setDiscountPct] = useState(parsed.discountPct ?? "");
  const [discountRs, setDiscountRs] = useState(parsed.discountRs ?? "");
  const [roundOff, setRoundOff] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedTxn, setSavedTxn] = useState<TxnRow | null>(null);
  const [activeItemRow, setActiveItemRow] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);

  /* Link Payment state (credit note only) */
  const [partyInvoices, setPartyInvoices] = useState<Transaction[]>([]);
  const [linkedInvoiceIds, setLinkedInvoiceIds] = useState<Set<string>>(new Set());
  const [showLinkModal, setShowLinkModal] = useState(false);

  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
      return parsed.items.map((i: any, idx: number) => ({
        id: String(idx), name: i.name ?? "", qty: Number(i.qty) || 0,
        unit: i.unit ?? "NONE", rate: Number(i.rate) || 0, mrp: Number(i.mrp) || 0,
      }));
    }
    return [emptyRow(), emptyRow()];
  });

  /* Auto-number */
  useEffect(() => {
    if (!initialRow) {
      api.getTransactionsByType(cfg.txnType)
        .then((txns) => setTxnNumber(String(txns.length + 1)))
        .catch(() => setTxnNumber(String(existingCount + 1)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Load outstanding sale invoices for selected party (link payment) */
  const selectedPartyId = parties.find((p) => p.name === customer)?.id;
  useEffect(() => {
    if (!cfg.showLinkPayment || !selectedPartyId) { setPartyInvoices([]); setLinkedInvoiceIds(new Set()); return; }
    api.getPartyTransactions(selectedPartyId)
      .then((txns) => setPartyInvoices(txns.filter((t) => t.type === "sale" && t.balance > 0)))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartyId]);

  /* Close party dropdown on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowPartyDrop(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedParty = parties.find((p) => p.id === selectedPartyId);
  const filteredParties = customer
    ? parties.filter((p) => p.name.toLowerCase().includes(customer.toLowerCase()))
    : parties;

  const validItems = lineItems.filter((i) => i.name.trim() && i.qty > 0);
  const subtotal = validItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const totalQty = validItems.reduce((s, i) => s + i.qty, 0);
  const discountAmt = discountPct
    ? (subtotal * parseFloat(discountPct)) / 100
    : parseFloat(discountRs) || 0;
  const afterDiscount = subtotal - discountAmt;
  const roundOffAmt = roundOff ? Math.round(afterDiscount) - afterDiscount : 0;
  const total = afterDiscount + roundOffAmt;
  const linkedAmount = partyInvoices
    .filter((t) => linkedInvoiceIds.has(t.id))
    .reduce((s, t) => s + Math.min(t.balance, total), 0);
  const balance = Math.max(0, total - linkedAmount);

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setLineItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function catalogFor(search: string) {
    if (!search.trim()) return catalog;
    const q = search.toLowerCase();
    return catalog.filter((c) => c.name.toLowerCase().includes(q) || (c.sku ?? "").toLowerCase().includes(q));
  }

  function openItemDrop(itemId: string, inputEl: HTMLElement) {
    const rowEl = inputEl.closest("tr");
    if (!rowEl || !tableWrapRef.current) return;
    const rowRect = rowEl.getBoundingClientRect();
    const wrapRect = tableWrapRef.current.getBoundingClientRect();
    setActiveItemRow(itemId);
    setDropPos({ top: rowRect.bottom, left: wrapRect.left, width: wrapRect.width });
  }
  function closeItemDrop(itemId: string) {
    setTimeout(() => {
      setActiveItemRow((cur) => { if (cur === itemId) { setDropPos(null); return null; } return cur; });
    }, 160);
  }

  function handleDiscountPct(val: string) {
    setDiscountPct(val);
    if (val && subtotal) setDiscountRs(((subtotal * parseFloat(val)) / 100).toFixed(2));
    else setDiscountRs("");
  }
  function handleDiscountRs(val: string) {
    setDiscountRs(val);
    if (val && subtotal) setDiscountPct(((parseFloat(val) / subtotal) * 100).toFixed(2));
    else setDiscountPct("");
  }

  async function save() {
    setError("");
    const party = selectedParty ?? parties.find((p) => p.name.toLowerCase() === customer.toLowerCase());
    if (!party) { setError("Select a valid party from the dropdown."); return; }
    if (validItems.length === 0) { setError("Add at least one item with a name and quantity > 0."); return; }
    setSaving(true);
    const notesJson = JSON.stringify({
      items: validItems.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, rate: i.rate, mrp: i.mrp })),
      phone, dueDate, invoiceNumber, invoiceDate, paymentType,
      discountPct, discountRs,
    });
    try {
      let savedTxnData: Transaction;
      if (isEdit && initialRow) {
        savedTxnData = await api.updateTransaction(initialRow.id, {
          partyId: party.id,
          date: new Date(date).toISOString(),
          total,
          balance,
          notes: notesJson,
        });
      } else {
        savedTxnData = await api.createTransaction({
          partyId: party.id,
          type: cfg.txnType as "estimate",
          number: txnNumber,
          date: new Date(date).toISOString(),
          total,
          balance,
          notes: notesJson,
        });
      }

      /* Deduct credit note amount from linked sale invoices */
      let remaining = linkedAmount;
      for (const invId of Array.from(linkedInvoiceIds)) {
        if (remaining <= 0) break;
        const inv = partyInvoices.find((t) => t.id === invId);
        if (!inv) continue;
        const deduct = Math.min(inv.balance, remaining);
        await api.updateTransaction(invId, { balance: Math.max(0, inv.balance - deduct) });
        remaining -= deduct;
      }

      setSavedTxn({ ...savedTxnData, partyName: party.name });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save. Check connection.");
    } finally {
      setSaving(false);
    }
  }

  const tabTitle = isEdit ? `${cfg.title} #${initialRow?.number ?? ""}` : cfg.title;

  if (savedTxn) {
    return (
      <InvoicePreviewModal
        sale={savedTxn}
        invoiceNumber={parseInt(savedTxn.number ?? "0") || existingCount + 1}
        party={parties.find((p) => p.id === savedTxn.partyId)}
        onClose={onSaved}
      />
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#f0f2f5", zIndex: 600, display: "flex", flexDirection: "column" }}>

      {/* ── Electron-style tab header ── */}
      <div style={{ display: "flex", alignItems: "center", background: "#e8eaed", borderBottom: "1px solid #d1d5db", padding: "0 12px", height: 36 }}>
        <div style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: "6px 6px 0 0", padding: "6px 14px 6px 10px", gap: 8, fontSize: 13, color: "#374151", border: "1px solid #d1d5db", borderBottom: "1px solid #fff", marginBottom: -1 }}>
          <span>✕</span>
          <span>{tabTitle}</span>
        </div>
        <div style={{ marginLeft: 6, display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: "#3b82f6", color: "#fff", fontSize: 16, cursor: "pointer" }}>+</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8, color: "#6b7280", fontSize: 16 }}>
          <span>⊞</span><span>⚙</span><span style={{ cursor: "pointer" }} onClick={onClose}>✕</span>
        </div>
      </div>

      {/* ── Form body ── */}
      <div style={{ flex: 1, overflowY: "auto", background: "#f8f9fa", padding: "0 0 80px" }}>
        <div style={{ background: "#fff", padding: "16px 24px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>{cfg.title}</h2>
        </div>

        <div style={{ display: "flex", gap: 20, padding: "16px 24px" }}>
          {/* Left column: party + extra fields */}
          <div style={{ flex: 1 }} ref={dropRef}>
            {/* Party field */}
            <div style={{ position: "relative" }}>
              <label style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, display: "block", marginBottom: 2 }}>Party *</label>
              <div style={{ display: "flex", alignItems: "center", border: "2px solid #3b82f6", borderRadius: 6, padding: "6px 10px", background: "#fff", gap: 6 }}>
                <input
                  style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: "#111827" }}
                  value={customer}
                  placeholder=""
                  onChange={(e) => { setCustomer(e.target.value); setShowPartyDrop(true); }}
                  onFocus={() => setShowPartyDrop(true)}
                  autoComplete="off"
                />
                <span style={{ color: "#6b7280" }}>▾</span>
              </div>
              {showPartyDrop && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 200, maxHeight: 240, overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", fontSize: 11, color: "#9ca3af", borderBottom: "1px solid #f0f0f0" }}>
                    <span>+ Add Party</span><span>Party Balance</span>
                  </div>
                  {filteredParties.slice(0, 10).map((p) => (
                    <button key={p.id} type="button" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "8px 10px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      onClick={() => { setCustomer(p.name); setPhone(p.phone ?? ""); setShowPartyDrop(false); }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                        {p.phone && <div style={{ fontSize: 11, color: "#9ca3af" }}>{p.phone}</div>}
                      </div>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>{Math.abs(p.balance ?? 0).toLocaleString()}</span>
                    </button>
                  ))}
                  {filteredParties.length === 0 && <p style={{ padding: 12, color: "#9ca3af", fontSize: 13 }}>No parties found</p>}
                </div>
              )}
            </div>

            {cfg.showPhone && (
              <input
                style={{ marginTop: 8, width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }}
                placeholder="Phone No."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            )}

            {cfg.showPaymentType && (
              <div style={{ marginTop: 12 }}>
                <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151" }}>
                  <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Payment Type</span>
                  <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} style={{ border: "none", outline: "none", fontSize: 13, background: "none", cursor: "pointer" }}>
                    <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option><option>Card</option>
                  </select>
                </div>
                <button type="button" style={{ marginTop: 8, display: "block", fontSize: 13, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ Add Payment type</button>
              </div>
            )}

            {/* Extra buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" style={addExtraBtn}><span>📄</span> ADD DESCRIPTION</button>
              <button type="button" style={addExtraBtn}><span>📷</span> Add Image</button>
              {cfg.showConvertToSale && (
                <button type="button" style={addExtraBtn}><span>📎</span> ADD DOCUMENT</button>
              )}
            </div>
          </div>

          {/* Right column: number + dates */}
          <div style={{ width: 280 }}>
            <div style={metaRowStyle}>
              <span style={metaLabelStyle}>{cfg.numberLabel}</span>
              <input style={metaInputStyle} value={txnNumber} onChange={(e) => setTxnNumber(e.target.value)} />
            </div>
            {cfg.showInvoiceRef && (
              <>
                <div style={metaRowStyle}>
                  <span style={metaLabelStyle}>Invoice Number</span>
                  <input style={metaInputStyle} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Invoice Number" />
                </div>
                <div style={metaRowStyle}>
                  <span style={metaLabelStyle}>Invoice Date</span>
                  <input type="date" style={metaInputStyle} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
              </>
            )}
            <div style={metaRowStyle}>
              <span style={metaLabelStyle}>{cfg.showInvoiceRef ? "Date" : "Invoice Date"}</span>
              <input type="date" style={metaInputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {cfg.showDueDate && (
              <div style={metaRowStyle}>
                <span style={metaLabelStyle}>Due Date</span>
                <input type="date" style={metaInputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* ── Items table ── */}
        <div style={{ padding: "0 24px" }} ref={tableWrapRef}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ ...thStyle, width: 36 }}>#</th>
                <th style={thStyle}>ITEM</th>
                <th style={{ ...thStyle, width: 100 }}>MRP</th>
                <th style={{ ...thStyle, width: 90 }}>QTY</th>
                <th style={{ ...thStyle, width: 110 }}>UNIT</th>
                <th style={{ ...thStyle, width: 130 }}>PRICE/UNIT</th>
                <th style={{ ...thStyle, width: 120, textAlign: "right" }}>AMOUNT</th>
                <th style={{ ...thStyle, width: 32 }}>+</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ ...tdStyle, color: "#9ca3af", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ ...tdStyle, position: "relative" }}>
                    <input
                      style={cellInputStyle}
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      onFocus={(e) => openItemDrop(item.id, e.currentTarget)}
                      onBlur={() => closeItemDrop(item.id)}
                    />
                    {activeItemRow === item.id && dropPos && (() => {
                      const matches = catalogFor(item.name);
                      if (!matches.length) return null;
                      return (
                        <div style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 700, maxHeight: 200, overflowY: "auto" }}>
                          {matches.slice(0, 8).map((c) => (
                            <button key={c.id} type="button" style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                              onMouseDown={() => {
                                updateItem(item.id, "name", c.name);
                                updateItem(item.id, "rate", c.salePrice ?? 0);
                                updateItem(item.id, "mrp", c.mrp ?? 0);
                                setActiveItemRow(null); setDropPos(null);
                              }}
                            >
                              <span>{c.name}</span>
                              <span style={{ color: "#6b7280" }}>Rs {c.salePrice?.toLocaleString() ?? 0}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={tdStyle}><input style={cellInputStyle} type="number" value={item.mrp || ""} placeholder="0" onChange={(e) => updateItem(item.id, "mrp", parseFloat(e.target.value) || 0)} /></td>
                  <td style={tdStyle}><input style={cellInputStyle} type="number" value={item.qty || ""} placeholder="0" onChange={(e) => updateItem(item.id, "qty", parseFloat(e.target.value) || 0)} /></td>
                  <td style={tdStyle}>
                    <select style={cellInputStyle} value={item.unit} onChange={(e) => updateItem(item.id, "unit", e.target.value)}>
                      {UNITS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}><input style={cellInputStyle} type="number" value={item.rate || ""} placeholder="0" onChange={(e) => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)} /></td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#374151" }}>{(item.qty * item.rate) || ""}</td>
                  <td style={tdStyle}>
                    <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 14 }}
                      onClick={() => setLineItems((p) => p.filter((i) => i.id !== item.id))}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ padding: "8px 10px" }}>
                  <button type="button" style={{ fontSize: 13, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    onClick={() => setLineItems((p) => [...p, emptyRow()])}>ADD ROW</button>
                </td>
                <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 600 }}>TOTAL</td>
                <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 600 }}>{totalQty || 0}</td>
                <td />
                <td />
                <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#374151" }}>{subtotal || 0}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Discount / Tax / Total ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 24px 0" }}>
          <div style={{ width: 340 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#374151" }}>Discount</span>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ width: 70, border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: 13 }} placeholder="(%)" value={discountPct} onChange={(e) => handleDiscountPct(e.target.value)} />
                <span style={{ fontSize: 13, color: "#6b7280", alignSelf: "center" }}>-</span>
                <input style={{ width: 80, border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: 13 }} placeholder="(Rs)" value={discountRs} onChange={(e) => handleDiscountRs(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#374151" }}>Tax</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select style={{ border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 8px", fontSize: 13 }}>
                  <option>NONE</option><option>GST 5%</option><option>GST 12%</option><option>GST 18%</option>
                </select>
                <span style={{ fontSize: 13, color: "#374151", minWidth: 30, textAlign: "right" }}>0</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}>
                <input type="checkbox" checked={roundOff} onChange={(e) => setRoundOff(e.target.checked)} />
                Round Off
              </label>
              <span style={{ fontSize: 13, color: "#374151" }}>{roundOffAmt.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
              <input style={{ width: 140, border: "1px solid #d1d5db", borderRadius: 4, padding: "6px 8px", fontSize: 14, fontWeight: 600, textAlign: "right" }} value={total || ""} readOnly />
            </div>
          </div>
        </div>

      </div>

      {/* ── Action bar ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #e5e7eb", zIndex: 601 }}>
        {error && (
          <div style={{ background: "#fef2f2", borderBottom: "1px solid #fecaca", padding: "8px 24px", color: "#dc2626", fontSize: 13, fontWeight: 500 }}>
            ⚠ {error}
          </div>
        )}
        <div style={{ padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          {cfg.showLinkPayment && selectedParty && partyInvoices.length > 0 && (
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", border: "2px solid #3b82f6", borderRadius: 6, background: "#eff6ff", color: "#2563eb", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              🔗 LINK PAYMENT
              {linkedInvoiceIds.size > 0 && (
                <span style={{ background: "#3b82f6", color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                  {linkedInvoiceIds.size}
                </span>
              )}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #d1d5db" }}>
            <button type="button" style={{ padding: "9px 20px", background: "#fff", border: "none", cursor: "pointer", fontSize: 14 }}>Share</button>
            <button type="button" style={{ padding: "9px 8px", background: "#fff", border: "none", borderLeft: "1px solid #d1d5db", cursor: "pointer", fontSize: 12 }}>▼</button>
          </div>
          <button type="button" onClick={save} disabled={saving} style={{ padding: "9px 32px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            {saving ? "Saving…" : isEdit ? "Update" : "Save"}
          </button>
        </div>
        </div>
      </div>

      {/* ── Link Payment Modal ── */}
      {showLinkModal && (
        <TxnLinkPaymentModal
          partyName={selectedParty?.name ?? customer}
          creditAmount={total}
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
   LINK PAYMENT MODAL (Credit Note → outstanding sale invoices)
═══════════════════════════════════════════════════════════ */
function TxnLinkPaymentModal({ partyName, creditAmount, invoices, linkedIds, onDone, onClose }: {
  partyName: string;
  creditAmount: number;
  invoices: Transaction[];
  linkedIds: Set<string>;
  onDone: (ids: Set<string>) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(linkedIds));

  function computeAllocations(sel: Set<string>) {
    let remaining = creditAmount;
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
  const unusedAmount = Math.max(0, creditAmount - linkedTotal);

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function autoLink() {
    const ids = new Set<string>();
    let left = creditAmount;
    for (const inv of invoices) {
      if (left <= 0) break;
      ids.add(inv.id);
      left -= Math.min(inv.balance, left);
    }
    setSelected(ids);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 900 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 10, width: 680, maxWidth: "95vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Link Credit Note to Invoices</span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "12px 20px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>
          <div><span style={{ color: "#6b7280" }}>Party: </span><strong>{partyName}</strong></div>
          <div><span style={{ color: "#3b82f6" }}>Credit Amount: </span><strong>Rs {fmt(creditAmount)}</strong></div>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={autoLink} style={{ padding: "5px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 5, color: "#2563eb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>AUTO LINK</button>
          <button type="button" onClick={() => setSelected(new Set())} style={{ padding: "5px 12px", background: "#f9fafb", border: "1px solid #d1d5db", borderRadius: 5, color: "#6b7280", fontSize: 12, cursor: "pointer" }}>↺ RESET</button>
        </div>

        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", position: "sticky", top: 0 }}>
                {["", "Date", "Inv No.", "Total", "Balance", "Applied Amount"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const isChecked = selected.has(inv.id);
                const applied = allocations[inv.id] ?? 0;
                return (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer", background: isChecked ? "#eff6ff" : "#fff" }} onClick={() => toggle(inv.id)}>
                    <td style={{ ...tdStyle, width: 36 }}><input type="checkbox" checked={isChecked} readOnly onClick={(e) => { e.stopPropagation(); toggle(inv.id); }} /></td>
                    <td style={tdStyle}>{new Date(inv.date).toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                    <td style={tdStyle}>#{inv.number ?? "–"}</td>
                    <td style={tdStyle}>Rs {fmt(inv.total)}</td>
                    <td style={tdStyle}>Rs {fmt(inv.balance)}</td>
                    <td style={{ ...tdStyle, color: applied > 0 ? "#16a34a" : "#9ca3af", fontWeight: applied > 0 ? 600 : 400 }}>{applied > 0 ? `Rs ${fmt(applied)}` : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 13, color: "#374151" }}>
            Unused Amount: <strong style={{ color: unusedAmount > 0 ? "#d97706" : "#16a34a" }}>Rs {fmt(unusedAmount)}</strong>
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 20px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13 }}>CANCEL</button>
            <button type="button" onClick={() => onDone(selected)} style={{ padding: "8px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>DONE</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Parse notes JSON helper
───────────────────────────────────────────── */
function parseNotes(notes: string | null | undefined): Record<string, any> {
  if (!notes) return {};
  try { return JSON.parse(notes); } catch { return {}; }
}

/* ─────────────────────────────────────────────
   Shared style constants
───────────────────────────────────────────── */
const chipStyle: React.CSSProperties = {
  padding: "5px 12px", border: "1px solid #d1d5db", borderRadius: 20,
  background: "#fff", fontSize: 13, cursor: "pointer", color: "#374151",
};
const thStyle: React.CSSProperties = {
  padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600,
  color: "#6b7280", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "10px 12px", fontSize: 13, color: "#374151",
};
const iconBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#6b7280", padding: "2px 4px",
};
const addExtraBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
  border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", fontSize: 12,
  color: "#6b7280", cursor: "pointer",
};
const metaRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  marginBottom: 10, gap: 12,
};
const metaLabelStyle: React.CSSProperties = {
  fontSize: 13, color: "#374151", whiteSpace: "nowrap", minWidth: 100,
};
const metaInputStyle: React.CSSProperties = {
  flex: 1, border: "1px solid #d1d5db", borderRadius: 4, padding: "6px 8px",
  fontSize: 13, textAlign: "right",
};
const cellInputStyle: React.CSSProperties = {
  width: "100%", border: "none", outline: "none", fontSize: 13,
  background: "transparent", padding: "2px 0",
};

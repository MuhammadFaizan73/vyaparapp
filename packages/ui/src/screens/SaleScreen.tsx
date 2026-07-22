import React, { useState, useEffect, useRef } from "react";

import { api } from "../lib/api";
import type { Transaction, Party, Item } from "@vyapar/api-client";
import { AddPartyModal } from "./AddPartyModal";
import { AddItemModal } from "./AddItemModal";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import { PaymentInForm, RECENT_ROWS_LIMIT } from "./PaymentInScreen";
import { DeliveryChallanModal } from "./DeliveryChallanModal";

/* ── helpers ── */
function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function numToWords(n: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function conv(x: number): string {
    if (x === 0) return "";
    if (x < 20)  return ones[x];
    if (x < 100) return tens[Math.floor(x/10)] + (x%10 ? " "+ones[x%10] : "");
    if (x < 1000) return ones[Math.floor(x/100)]+" Hundred"+(x%100 ? " "+conv(x%100) : "");
    if (x < 100000) return conv(Math.floor(x/1000))+" Thousand"+(x%1000 ? " "+conv(x%1000) : "");
    if (x < 10000000) return conv(Math.floor(x/100000))+" Lakh"+(x%100000 ? " "+conv(x%100000) : "");
    return conv(Math.floor(x/10000000))+" Crore"+(x%10000000 ? " "+conv(x%10000000) : "");
  }
  const int = Math.floor(Math.abs(n));
  const dec = Math.round((Math.abs(n)-int)*100);
  return (conv(int)||"Zero")+" Rupees"+(dec>0 ? " and "+conv(dec)+" Paise" : "")+" only";
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" });
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ── types ── */
type SaleRow = Transaction & { partyName: string };
type LineItem = { id: string; name: string; mrp: number; qty: number; unit: string; rate: number; stock?: number };
type SubTab = "invoices" | "estimate" | "proforma" | "payment_in" | "sale_order" | "delivery" | "return";

const ACTIVE_KEY_TO_SUBTAB: Record<string, SubTab> = {
  "sale-invoices":    "invoices",
  "sale-estimate":    "estimate",
  "sale-proforma":    "proforma",
  "sale-payment-in":  "payment_in",
  "sale-order":       "sale_order",
  "sale-delivery":    "delivery",
  "sale-return":      "return",
};

const SUB_TAB_LABEL: Record<SubTab, string> = {
  invoices:   "Sale Invoices",
  estimate:   "Estimate/ Quotation",
  proforma:   "Proforma Invoice",
  payment_in: "Payment-In",
  sale_order: "Sale Order",
  delivery:   "Delivery Challan",
  return:     "Sale Return/ Credit Note",
};

const AVATAR_PALETTES = [
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#fff1e6", fg: "#c2410c" },
  { bg: "#dbeafe", fg: "#1d4ed8" },
];
const avatarCache: Record<string, (typeof AVATAR_PALETTES)[0]> = {};
let _pIdx = 0;
function partyColor(name: string) {
  if (!avatarCache[name]) avatarCache[name] = AVATAR_PALETTES[_pIdx++ % AVATAR_PALETTES.length];
  return avatarCache[name];
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
type Props = { isLocked?: boolean; onLockedAction?: () => void; activeKey?: string };

export function SaleScreen({ isLocked = false, onLockedAction, activeKey = "sale-invoices" }: Props = {}) {
  const subTab: SubTab = ACTIVE_KEY_TO_SUBTAB[activeKey] ?? "invoices";
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [sales, setSales] = useState<SaleRow[]>([]);

  /* ── date / search filters ── */
  const initRange = getPresetRange("This Month");
  const [filterPreset, setFilterPreset] = useState("This Month");
  const [filterFrom, setFilterFrom] = useState(initRange.from);
  const [filterTo, setFilterTo] = useState(initRange.to);
  const [filterSearch, setFilterSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showDatePanel, setShowDatePanel] = useState(false);
  const [datePanelPos, setDatePanelPos] = useState({ top: 0, left: 0 });
  const datePanelRef = useRef<HTMLDivElement>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  /* form visibility */
  const [showForm, setShowForm] = useState(false);
  const [editSale, setEditSale] = useState<SaleRow | null>(null);
  /* receive payment */
  const [receivePaymentSale, setReceivePaymentSale] = useState<SaleRow | null>(null);
  /* delivery challan preview */
  const [challanSale, setChallanSale] = useState<SaleRow | null>(null);
  /* payment history */
  const [paymentHistorySale, setPaymentHistorySale] = useState<SaleRow | null>(null);
  /* delete confirm */
  const [deleteConfirmSale, setDeleteConfirmSale] = useState<SaleRow | null>(null);
  /* view edit history */
  const [viewHistorySale, setViewHistorySale] = useState<SaleRow | null>(null);
  /* invoice preview */
  const [previewSale, setPreviewSale] = useState<SaleRow | null>(null);
  const [previewIdx,  setPreviewIdx]  = useState(0);
  /* row action menu */
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  /* ── delivery challan tab state ── */
  const [challans, setChallans] = useState<SaleRow[]>([]);
  const [challanLoading, setChallanLoading] = useState(false);
  const [returnGoodsRow, setReturnGoodsRow] = useState<SaleRow | null>(null);
  const [returnedQtys, setReturnedQtys] = useState<Record<number, string>>({});
  const [convertingChallan, setConvertingChallan] = useState(false);
  const [challanSearch, setChallanSearch] = useState("");
  const [challanFilter, setChallanFilter] = useState<"All" | "Open" | "Closed">("All");

  /* ── load challans ── */
  async function loadChallans() {
    setChallanLoading(true);
    try {
      const [txns, ps] = await Promise.all([
        api.getTransactionsByType("delivery_challan", { take: RECENT_ROWS_LIMIT }),
        parties.length ? Promise.resolve(parties) : api.getParties(),
      ]);
      const map: Record<string, string> = {};
      (ps as Party[]).forEach((p) => { map[p.id] = p.name; });
      if (!parties.length) setParties(ps as Party[]);
      setChallans(
        (txns as SaleRow[])
          .map((t) => ({ ...t, partyName: map[t.partyId] ?? "Unknown" }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
    } catch { /* offline */ } finally { setChallanLoading(false); }
  }

  useEffect(() => {
    if (subTab === "delivery") loadChallans();
  }, [subTab]);

  function parseNotes(n: string | null | undefined) {
    try { return JSON.parse(n ?? "{}"); } catch { return {}; }
  }

  function openReturnGoods(row: SaleRow) {
    setReturnedQtys({});
    setReturnGoodsRow(row);
  }

  async function doConvertToSale() {
    if (!returnGoodsRow) return;
    setConvertingChallan(true);
    try {
      const notes = parseNotes(returnGoodsRow.notes);
      const challanItems: any[] = notes.items ?? [];
      const convertedItems = challanItems.map((item: any, i: number) => {
        const entered = returnedQtys[i];
        const qty = entered !== undefined && entered.trim() !== "" ? parseFloat(entered) || item.qty : item.qty;
        return { ...item, qty: Math.min(qty, item.qty) };
      });
      const total = convertedItems.reduce((s: number, i: any) => s + i.qty * i.rate, 0);

      const sale: any = await api.createTransaction({
        partyId: returnGoodsRow.partyId,
        type: "sale",
        date: new Date().toISOString(),
        total,
        balance: total,
        notes: JSON.stringify({ ...notes, items: convertedItems }),
      });

      await api.updateTransaction(returnGoodsRow.id, {
        balance: 0,
        notes: JSON.stringify({ ...notes, linkedSaleId: sale.id, linkedSaleNumber: sale.number }),
      });

      setReturnGoodsRow(null);
      await loadChallans();
    } catch { /* ignore */ } finally { setConvertingChallan(false); }
  }

  /* ── load data ──
     Sale's date filter (default "This Month") is real, unlike some other transaction
     screens where it's decorative — so it's passed straight to the API instead of fetching
     every sale ever and filtering client-side. Widening the range (e.g. to "This Year")
     triggers a fresh, still-bounded fetch rather than an unbounded one. */
  async function loadSales() {
    try {
      const [txns, ps, its] = await Promise.all([
        api.getTransactionsByType("sale", { from: filterFrom, to: filterTo }),
        api.getParties(),
        api.getItems(),
      ]);
      const map: Record<string, string> = {};
      ps.forEach((p: Party) => { map[p.id] = p.name; });
      setSales(txns.map((t) => ({ ...t, partyName: map[t.partyId] ?? "Unknown" })));
      setParties(ps);
      setItems(its);
    } catch { /* offline */ }

    try {
      const tenant = await api.getTenant();
      const mainName = tenant.companyName || tenant.phone || "My Company";
      const extras = Array.isArray(tenant.extraCompanies) ? tenant.extraCompanies : [];
      setCompanies([{ id: "__main__", name: mainName }, ...extras.map((e) => ({ id: e.id, name: e.name }))]);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    setLoading(true);
    loadSales().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFrom, filterTo]);

  /* close row menu on outside click */
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

  const filtered = sales.filter((s) => {
    const d = s.date.slice(0, 10);
    if (d < filterFrom || d > filterTo) return false;
    if (filter === "unpaid" && s.balance === 0) return false;
    if (filter === "paid" && s.balance > 0) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      if (!s.partyName.toLowerCase().includes(q) && !(s.number ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalSale     = filtered.reduce((s, i) => s + i.total, 0);
  const totalReceived = filtered.reduce((s, i) => s + (i.total - i.balance), 0);
  const totalBalance  = filtered.reduce((s, i) => s + i.balance, 0);

  function handleAddSale() {
    if (isLocked) { onLockedAction?.(); return; }
    setShowForm(true);
  }

  async function handleDuplicate(sale: SaleRow) {
    try {
      await api.createTransaction({
        partyId: sale.partyId, type: "sale",
        date: new Date().toISOString(),
        total: sale.total, balance: sale.total,
      });
      await loadSales();
    } catch { /* ignore */ }
  }

  return (
    <div className="sale-main">
      {subTab === "delivery" ? (
        <>
          {/* ── Delivery Challan list ── */}
          <div className="dc-page-header">
            <div className="dc-filter-bar">
              <span className="dc-filter-label">This Month ▾</span>
              <span className="dc-filter-sep">Between</span>
              <span className="dc-filter-date">01/05/2026 To 31/05/2026</span>
              <select className="dc-filter-select"><option>ALL FIRMS</option></select>
              <select className="dc-filter-select"><option>ALL USERS</option></select>
              <div style={{ flex: 1 }} />
              <button type="button" className="dc-icon-btn">📊 Excel Report</button>
              <button type="button" className="dc-icon-btn">🖨 Print</button>
            </div>
          </div>

          <div className="dc-content">
            <div className="dc-toolbar">
              <span className="dc-toolbar-title">TRANSACTIONS</span>
              <div style={{ flex: 1 }} />
              <button type="button" className="dc-bulk-btn" onClick={() => {
                const openRows = challans.filter((c) => c.balance > 0);
                if (openRows.length === 0) return;
                openReturnGoods(openRows[0]);
              }}>Bulk Convert To Sale</button>
              <button type="button" className="dc-add-btn" onClick={() => { setShowForm(true); }}>⊕ Add Delivery Challan</button>
            </div>

            <div className="dc-search-row">
              <input
                className="dc-search"
                placeholder="🔍  Search transactions"
                value={challanSearch}
                onChange={(e) => setChallanSearch(e.target.value)}
              />
              <div className="dc-status-tabs">
                {(["All","Open","Closed"] as const).map((f) => (
                  <button key={f} type="button"
                    className={`dc-status-tab${challanFilter===f?" dc-status-tab--active":""}`}
                    onClick={() => setChallanFilter(f)}>{f}</button>
                ))}
              </div>
            </div>

            {challanLoading ? (
              <div className="sale-loading">Loading…</div>
            ) : (
              <table className="dc-table">
                <thead>
                  <tr>
                    <th>DATE ↓</th>
                    <th>PARTY</th>
                    <th>CHALLAN NO.</th>
                    <th>DUE DATE</th>
                    <th style={{ textAlign:"right" }}>TOTAL AMOUNT</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {challans
                    .filter((c) => {
                      const matchFilter = challanFilter === "All" || (challanFilter === "Open" ? c.balance > 0 : c.balance === 0);
                      const matchSearch = !challanSearch || c.partyName.toLowerCase().includes(challanSearch.toLowerCase());
                      return matchFilter && matchSearch;
                    })
                    .map((row) => {
                      const notes = parseNotes(row.notes);
                      const isClosed = row.balance === 0;
                      const dueDate = notes.dueDate ? new Date(notes.dueDate).toLocaleDateString("en-PK",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
                      const dueSuffix = notes.dueDate && new Date(notes.dueDate).toDateString() === new Date().toDateString() ? " Due: Today" : "";
                      return (
                        <tr key={row.id} className={`dc-row${!isClosed?" dc-row--open":""}`}>
                          <td>{formatDate(row.date)}</td>
                          <td className="dc-row__party">{row.partyName}</td>
                          <td>{row.number ?? "—"}</td>
                          <td>{dueDate}{dueSuffix}</td>
                          <td style={{ textAlign:"right" }}>Rs {fmt(row.total)}</td>
                          <td>
                            {isClosed
                              ? <span className="dc-badge dc-badge--closed">Closed <span className="dc-badge__date">{formatDate(row.date)}</span></span>
                              : <span className="dc-badge dc-badge--open">Open</span>}
                          </td>
                          <td>
                            {isClosed
                              ? <button type="button" className="dc-link-btn" onClick={() => {}}>
                                  Converted To Invoice No.{notes.linkedSaleNumber ?? "—"}
                                </button>
                              : <button type="button" className="dc-convert-btn" onClick={() => openReturnGoods(row)}>
                                  CONVERT TO SALE
                                </button>}
                          </td>
                          <td><button type="button" className="dc-more-btn">⋯</button></td>
                        </tr>
                      );
                    })}
                  {challans.length === 0 && !challanLoading && (
                    <tr><td colSpan={8} style={{ textAlign:"center", padding:"40px", color:"#9ca3af" }}>No delivery challans yet</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Return Goods modal ── */}
          {returnGoodsRow && (() => {
            const notes = parseNotes(returnGoodsRow.notes);
            const challanItems: any[] = notes.items ?? [];
            return (
              <div className="dc-modal-overlay" onClick={() => setReturnGoodsRow(null)}>
                <div className="dc-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="dc-modal-header">
                    <span className="dc-modal-title">Return Goods</span>
                    <button type="button" className="dc-modal-close" onClick={() => setReturnGoodsRow(null)}>✕</button>
                  </div>
                  <div className="dc-modal-body">
                    <p className="dc-modal-subtitle">List of Items on Challan</p>
                    <table className="dc-return-table">
                      <thead>
                        <tr>
                          <th>Items</th>
                          <th>Shipped</th>
                          <th>Returned Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {challanItems.map((item: any, i: number) => (
                          <tr key={i}>
                            <td>{i+1}. {item.name}</td>
                            <td>{item.qty}</td>
                            <td>
                              <input
                                type="number"
                                className="dc-return-input"
                                value={returnedQtys[i] ?? ""}
                                min={0}
                                max={item.qty}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val > item.qty) return;
                                  setReturnedQtys((prev) => ({ ...prev, [i]: e.target.value }));
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                        {challanItems.map((item: any, i: number) => (
                          item.mrp ? <tr key={`mrp-${i}`} className="dc-return-mrp"><td colSpan={3}>MRP: {item.mrp}</td></tr> : null
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="dc-modal-footer">
                    <label className="dc-modal-check">
                      <input type="checkbox" /> Do not show this dialog in future.
                    </label>
                    <button type="button" className="dc-modal-done-btn" onClick={doConvertToSale} disabled={convertingChallan}>
                      {convertingChallan ? "Converting…" : "DONE"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      ) : subTab !== "invoices" ? (
        <div className="sale-coming-soon">
          <span className="sale-coming-soon__icon">📄</span>
          <p className="sale-coming-soon__title">{SUB_TAB_LABEL[subTab]}</p>
          <p className="sale-coming-soon__sub">Coming soon</p>
        </div>
      ) : (
          <>
            {/* ── Page header ── */}
            <div className="sale-page-header">
              <div className="sale-page-header__left">
                <span className="sale-page-header__title">Sale Invoices</span>
                <button type="button" className="sale-page-header__dropdown-btn" aria-label="Switch view">▾</button>
              </div>
              <div className="sale-page-header__right">
                <button type="button" className="sale-page-header__add-btn" onClick={handleAddSale}>
                  + Add Sale
                </button>
                <button type="button" className="sale-page-header__icon-btn" aria-label="Settings">⚙</button>
              </div>
            </div>

            {/* ── Filter bar ── */}
            <div className="sale-filterbar">
              <span className="sale-filterbar__label">Filter by :</span>

              {/* Preset chip */}
              <button type="button" className="sale-filterbar__chip" onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setDatePanelPos({ top: r.bottom + 6, left: r.left });
                setShowDatePanel((v) => !v);
              }}>{filterPreset} ▾</button>

              {/* Date range chip */}
              <button type="button" className="sale-filterbar__date" onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setDatePanelPos({ top: r.bottom + 6, left: r.left });
                setShowDatePanel((v) => !v);
              }}>📅 {fmtChip(filterFrom)} To {fmtChip(filterTo)}</button>

              <div className="sale-filterbar__spacer" />

              {/* Search toggle */}
              {showSearch && (
                <input
                  autoFocus
                  style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 10px", fontSize: 13, width: 220, outline: "none" }}
                  placeholder="Search party or invoice no…"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { setFilterSearch(""); setShowSearch(false); } }}
                />
              )}
              <button type="button"
                style={{ background: showSearch ? "#eff6ff" : "none", border: showSearch ? "1px solid #bfdbfe" : "none", borderRadius: 6, cursor: "pointer", color: showSearch ? "#2563eb" : "#6b7280", fontSize: 16, padding: "4px 8px" }}
                onClick={() => { setShowSearch((v) => !v); if (showSearch) setFilterSearch(""); }}
              >🔍</button>

              <div className="sale-filterbar__pills">
                {(["all", "unpaid", "paid"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`sale-filterbar__pill${filter === f ? " sale-filterbar__pill--active" : ""}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === "all" ? "All" : f === "unpaid" ? "Unpaid" : "Paid"}
                  </button>
                ))}
              </div>
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

            {/* ── Summary card ── */}
            <div className="sale-summary">
              <div className="sale-summary__block">
                <span className="sale-summary__label">Total Sales Amount</span>
                <span className="sale-summary__value">Rs {fmt(totalSale)}</span>
                <div className="sale-summary__sub-row">
                  <span>Received: <strong>Rs {fmt(totalReceived)}</strong></span>
                  <span className="sale-summary__divider">|</span>
                  <span>Balance: <strong>Rs {fmt(totalBalance)}</strong></span>
                </div>
              </div>
            </div>

            {/* ── List ── */}
            {loading ? (
              <div className="sale-loading">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="sale-empty">
                <div className="sale-empty__illustration">
                  <div className="sale-empty__circle">
                    <span>📋</span>
                  </div>
                </div>
                <p className="sale-empty__title">No Transactions to show</p>
                <p className="sale-empty__sub">You haven't added any transactions yet.</p>
                <button type="button" className="sale-empty__btn" onClick={handleAddSale}>
                  + Add Sale
                </button>
              </div>
            ) : (
              <div className="sale-list">
                {/* Table header */}
                <div className="sale-table-head">
                  <span style={{ flex: 2 }}>PARTY NAME</span>
                  <span>INVOICE NO</span>
                  <span>DATE</span>
                  <span style={{ textAlign: "right" }}>AMOUNT</span>
                  <span style={{ textAlign: "right" }}>BALANCE</span>
                  <span style={{ textAlign: "center" }}>STATUS</span>
                  <span />
                </div>
                {filtered.map((sale, idx) => {
                  const pal = partyColor(sale.partyName);
                  const isPaid = sale.balance === 0;
                  return (
                    <div
                      key={sale.id}
                      className="sale-row sale-row--clickable"
                      onClick={() => { setEditSale(sale); setShowForm(true); }}
                    >
                      <div className="sale-row__party" style={{ flex: 2 }}>
                        <div className="sale-row__avatar" style={{ background: pal.bg, color: pal.fg }}>
                          {sale.partyName[0].toUpperCase()}
                        </div>
                        <span className="sale-row__name">{sale.partyName}</span>
                      </div>
                      <span className="sale-row__cell">#{idx + 1}</span>
                      <span className="sale-row__cell">{formatDate(sale.date)}</span>
                      <span className="sale-row__cell" style={{ textAlign: "right" }}>Rs {fmt(sale.total)}</span>
                      <span className="sale-row__cell" style={{ textAlign: "right", color: sale.balance > 0 ? "#ef4444" : "#16a34a" }}>
                        Rs {fmt(sale.balance)}
                      </span>
                      <span className="sale-row__cell" style={{ textAlign: "center" }}>
                        <span className={`sale-status-badge${isPaid ? " sale-status-badge--paid" : " sale-status-badge--unpaid"}`}>
                          {isPaid ? "PAID" : "UNPAID"}
                        </span>
                      </span>
                      <div className="sale-row__actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="sale-row__icon-btn" title="Print" onClick={() => window.print()}>🖨</button>
                        <div style={{ position: "relative" }}>
                          <button
                            type="button"
                            className="sale-row__icon-btn"
                            title="More"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (menuId === sale.id) { setMenuId(null); return; }
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setMenuPos({ top: r.bottom + 4, left: r.right - 160 });
                              setMenuId(sale.id);
                            }}
                          >⋯</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      {/* ── Row action menu (fixed) ── */}
      {menuId && (() => {
        const sale = sales.find((s) => s.id === menuId);
        if (!sale) return null;
        return (
          <div className="sale-row-menu" style={{ position: "fixed", top: menuPos.top, left: menuPos.left }} onClick={(e) => e.stopPropagation()}>
            {[
              { label: "View/Edit",               action: () => { setEditSale(sale); setShowForm(true); setMenuId(null); } },
              { label: "Receive Payment",          action: () => { setReceivePaymentSale(sale); setMenuId(null); } },
              { label: "Convert To Return",        action: () => setMenuId(null) },
              { label: "Preview Delivery Challan", action: () => { setChallanSale(sale); setMenuId(null); } },
              { label: "Payment History",          action: () => { setPaymentHistorySale(sale); setMenuId(null); } },
              { label: "Cancel Invoice",           action: () => { void api.updateTransaction(sale.id, { balance: 0 }); setMenuId(null); void loadSales(); } },
              { label: "Delete",                   action: () => { setDeleteConfirmSale(sale); setMenuId(null); } },
              { label: "Duplicate",                action: () => { setMenuId(null); handleDuplicate(sale); } },
              { label: "Open PDF",                 action: () => { setMenuId(null); window.print(); } },
              { label: "Preview",                  action: () => { setPreviewSale(sale); setPreviewIdx(sales.indexOf(sale) + 1); setMenuId(null); } },
              { label: "Print",                    action: () => { setMenuId(null); window.print(); } },
              { label: "View History",             action: () => { setViewHistorySale(sale); setMenuId(null); } },
            ].map(({ label, action }) => (
              <button key={label} type="button" className="sale-row-menu__item" onClick={action}>{label}</button>
            ))}
          </div>
        );
      })()}

      {/* ── New / Edit Sale Form ── */}
      {showForm && (
        <NewSaleForm
          key={editSale?.id ?? "new"}
          parties={parties}
          catalog={items}
          companies={companies}
          initialSale={editSale ?? undefined}
          initialParty={editSale ? parties.find((p) => p.id === editSale.partyId) : undefined}
          onClose={() => { setShowForm(false); setEditSale(null); }}
          onSaved={(sale, party, invoiceNum) => {
            setShowForm(false);
            setEditSale(null);
            setPreviewSale(sale);
            setPreviewIdx(invoiceNum ?? 1);
            void loadSales();
          }}
        />
      )}

      {/* ── Invoice Preview (opens after save) ── */}
      {previewSale && (
        <InvoicePreviewModal
          sale={previewSale}
          invoiceNumber={previewIdx}
          party={parties.find((p) => p.id === previewSale.partyId)}
          onClose={() => { setPreviewSale(null); void loadSales(); }}
        />
      )}

      {/* ── Receive Payment (Payment-In form pre-filled with party + outstanding balance) ── */}
      {receivePaymentSale && (
        <PaymentInForm
          key={receivePaymentSale.id}
          parties={parties}
          prefilledPartyId={receivePaymentSale.partyId}
          prefilledAmount={receivePaymentSale.balance}
          onClose={() => setReceivePaymentSale(null)}
          onSaved={() => { setReceivePaymentSale(null); void loadSales(); }}
        />
      )}

      {/* ── Delivery Challan Preview ── */}
      {challanSale && (
        <DeliveryChallanModal
          sale={challanSale}
          invoiceNumber={sales.indexOf(challanSale) + 1}
          party={parties.find((p) => p.id === challanSale.partyId)}
          onClose={() => setChallanSale(null)}
        />
      )}

      {/* ── Payment History ── */}
      {paymentHistorySale && (
        <PaymentHistoryModal
          sale={paymentHistorySale}
          onClose={() => setPaymentHistorySale(null)}
        />
      )}

      {/* ── View History ── */}
      {viewHistorySale && (
        <ViewHistoryModal
          sale={viewHistorySale}
          onClose={() => setViewHistorySale(null)}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirmSale && (
        <div className="nsf-dialog-overlay">
          <div className="nsf-dialog">
            <div className="nsf-dialog__header">
              <span className="nsf-dialog__title">Delete Invoice</span>
              <button type="button" className="nsf-dialog__x" onClick={() => setDeleteConfirmSale(null)}>✕</button>
            </div>
            <p className="nsf-dialog__body">
              Delete invoice for <strong>{deleteConfirmSale.partyName}</strong> (Rs {deleteConfirmSale.total.toLocaleString()})?
              This cannot be undone.
            </p>
            <div className="nsf-dialog__footer">
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--cancel" onClick={() => setDeleteConfirmSale(null)}>Cancel</button>
              <button
                type="button"
                className="nsf-dialog__btn nsf-dialog__btn--ok"
                style={{ background: "#dc2626" }}
                onClick={async () => {
                  await api.deleteTransaction(deleteConfirmSale.id);
                  setDeleteConfirmSale(null);
                  void loadSales();
                }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAYMENT HISTORY MODAL
═══════════════════════════════════════════════════════════ */
function PaymentHistoryModal({ sale, onClose }: { sale: SaleRow; onClose: () => void }) {
  const [partyTxns, setPartyTxns] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.getPartyTransactions(sale.partyId)
      .then((txns) => setPartyTxns(txns.filter((t) => t.type === "payment_in")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sale.partyId]);

  const received = sale.total - sale.balance;

  return (
    <div className="nsf-dialog-overlay" style={{ zIndex: 700 }}>
      <div className="nsf-dialog" style={{ width: 540, maxWidth: "95vw" }}>
        <div className="nsf-dialog__header">
          <span className="nsf-dialog__title">Payment History — {sale.partyName}</span>
          <button type="button" className="nsf-dialog__x" onClick={onClose}>✕</button>
        </div>

        {/* Invoice summary */}
        <div style={{ padding: "12px 20px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", display: "flex", gap: 24, fontSize: 13 }}>
          <span>Invoice Total: <strong>Rs {sale.total.toLocaleString()}</strong></span>
          <span>Received: <strong style={{ color: "#16a34a" }}>Rs {received.toLocaleString()}</strong></span>
          <span>Balance: <strong style={{ color: sale.balance > 0 ? "#ef4444" : "#16a34a" }}>Rs {sale.balance.toLocaleString()}</strong></span>
        </div>

        {/* Payment-In list for this party */}
        <div style={{ padding: "12px 20px", maxHeight: 320, overflowY: "auto" }}>
          {loading ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: 20 }}>Loading…</p>
          ) : partyTxns.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: 20 }}>No payments recorded for this party.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  {["Date","Receipt No.","Amount","Available","Payment Type"].map((h) => (
                    <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partyTxns.map((t) => {
                  let pt = "Cash";
                  try { pt = (JSON.parse(t.notes ?? "{}") as { paymentType?: string }).paymentType ?? "Cash"; } catch { /* */ }
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "8px 10px" }}>{new Date(t.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                      <td style={{ padding: "8px 10px" }}>#{t.number ?? "—"}</td>
                      <td style={{ padding: "8px 10px" }}>Rs {t.total.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", color: t.balance > 0 ? "#16a34a" : "#9ca3af" }}>Rs {t.balance.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px" }}>{pt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="nsf-dialog__footer">
          <button type="button" className="nsf-dialog__btn nsf-dialog__btn--ok" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   VIEW HISTORY MODAL
═══════════════════════════════════════════════════════════ */
function ViewHistoryModal({ sale, onClose }: { sale: SaleRow; onClose: () => void }) {
  type HistoryEntry = { id: string; changes: string[]; ipAddress: string | null; createdAt: string };
  const [entries, setEntries] = React.useState<HistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.getTransactionHistory(sale.id)
      .then((rows) => setEntries(rows))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sale.id]);

  function fmtTs(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  }

  return (
    <div className="nsf-dialog-overlay" style={{ zIndex: 700 }}>
      <div style={{
        background: "#fff", borderRadius: 10, width: 660, maxWidth: "95vw",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 16px", borderBottom: "1px solid #f0f0f0" }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: "#111827" }}>Edit History for Sale #{sale.number ?? sale.id.slice(0, 6)}</span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280", lineHeight: 1 }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ padding: "8px 0", maxHeight: 500, overflowY: "auto" }}>
          {loading ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>Loading…</p>
          ) : entries.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>No edit history yet. Edit the invoice to record changes.</p>
          ) : (
            entries.map((entry, idx) => (
              <div key={entry.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                padding: "14px 24px",
                borderBottom: idx < entries.length - 1 ? "1px solid #f3f4f6" : "none",
              }}>
                {/* Left: change bullets */}
                <div style={{ flex: 1, paddingRight: 24 }}>
                  {entry.changes.map((change, ci) => (
                    <div key={ci} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: "#1f2937", lineHeight: 1.6 }}>
                      <span style={{ marginTop: 3, color: "#374151" }}>•</span>
                      <span>{change}</span>
                    </div>
                  ))}
                </div>

                {/* Right: timestamp + badges */}
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 6, whiteSpace: "nowrap" }}>{fmtTs(entry.createdAt)}</div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {entry.ipAddress && (
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 4,
                        border: "1px solid #d1d5db", background: "#f9fafb", color: "#374151",
                      }}>{entry.ipAddress}</span>
                    )}
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 4,
                      border: "1px solid #d1d5db", background: "#f9fafb", color: "#374151",
                    }}>PRIMARY ADMIN</span>
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
   NEW SALE FORM
═══════════════════════════════════════════════════════════ */
const UNITS = ["NONE", "Pcs", "Kg", "Gm", "L", "ML", "Box", "Pack", "Bag", "Mtr", "Ft"];

function emptyRow(): LineItem {
  return { id: Date.now().toString() + Math.random(), name: "", mrp: 0, qty: 0, unit: "NONE", rate: 0 };
}

function NewSaleForm({
  parties, catalog, companies, initialSale, initialParty, onClose, onSaved,
}: {
  parties: Party[];
  catalog: Item[];
  companies: Array<{ id: string; name: string }>;
  initialSale?: SaleRow;
  initialParty?: Party;
  onClose: () => void;
  onSaved: (sale: SaleRow, party?: Party, invoiceNum?: number) => void;
}) {
  const isEdit = Boolean(initialSale);
  /* Party field is locked when editing an invoice that has any payment applied */
  const partyLocked = isEdit && !!initialSale && initialSale.balance < initialSale.total;
  const [mode, setMode] = useState<"credit" | "cash">(initialParty ? "credit" : "cash");
  const [customer, setCustomer] = useState(initialParty?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(initialParty?.phone ?? "");
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const [showAddParty,  setShowAddParty]  = useState(false);
  const [showAddItem,   setShowAddItem]   = useState(false);
  const [showSettings,      setShowSettings]      = useState(false);
  const [showBillingConfirm, setShowBillingConfirm] = useState(false);

  // Settings options
  const [salePrefix,     setSalePrefix]     = useState(false);
  const [quickEntry,     setQuickEntry]     = useState(false);
  const [linkPayment,    setLinkPayment]    = useState(true);
  const [dueDates,       setDueDates]       = useState(false);
  const [billingType,    setBillingType]    = useState<"lite" | "full">("full");
  const [invoiceDate, setInvoiceDate] = useState(
    initialSale ? initialSale.date.slice(0, 10) : today()
  );
  const [invoiceNumber] = useState(1);
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (initialSale) {
      try {
        const stored: { name: string; qty: number; unit: string; rate: number; mrp: number }[] =
          JSON.parse(initialSale.notes ?? "");
        if (Array.isArray(stored) && stored.length > 0) {
          return stored.map((i, idx) => ({
            id: String(idx),
            name: i.name ?? "",
            qty: Number(i.qty) || 0,
            unit: i.unit ?? "NONE",
            rate: Number(i.rate) || 0,
            mrp: Number(i.mrp) || 0,
          }));
        }
      } catch { /* notes is not JSON — fall through */ }
      return [{ id: "init", name: "Invoice Total", mrp: 0, qty: 1, unit: "NONE", rate: Number(initialSale.total) || 0 }];
    }
    return [emptyRow(), emptyRow()];
  });
  const [discountPct, setDiscountPct] = useState("");
  const [discountRs, setDiscountRs] = useState("");
  const [roundOff, setRoundOff] = useState(true);
  const [paymentType, setPaymentType] = useState("Cash");
  const [showReceived, setShowReceived] = useState(false);
  const [received, setReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [stockWarningItems, setStockWarningItems] = useState<string[]>([]);
  const [activeItemRow, setActiveItemRow] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);

  /* ── Link Payment ── */
  const [partyTxns, setPartyTxns] = useState<Transaction[]>([]);
  const [showLinkPayment, setShowLinkPayment] = useState(false);
  const [linkedTxnIds, setLinkedTxnIds] = useState<Set<string>>(new Set());

  const [selectedCompanyFilters, setSelectedCompanyFilters] = useState<string[]>([]);

  const dropRef = useRef<HTMLDivElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowPartyDrop(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function catalogFor(search: string) {
    let filtered = catalog;
    if (selectedCompanyFilters.length > 0) {
      filtered = filtered.filter((c) => selectedCompanyFilters.some((name) => c.companyTag === name));
    }
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((c) => c.name.toLowerCase().includes(q) || (c.sku ?? "").toLowerCase().includes(q));
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
      setActiveItemRow((cur) => {
        if (cur === itemId) { setDropPos(null); return null; }
        return cur;
      });
    }, 160);
  }

  const selectedParty = parties.find((p) => p.name === customer);

  useEffect(() => {
    if (!selectedParty) { setPartyTxns([]); setLinkedTxnIds(new Set()); return; }
    api.getPartyTransactions(selectedParty.id)
      .then((txns) => setPartyTxns(txns.filter((t) => t.type === "payment_in" && t.balance > 0)))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParty?.id]);

  const filteredParties = parties
    .filter((p) => p.partyType === "customer" || p.partyType === "both" || p.isSystem)
    .filter((p) => !customer || p.name.toLowerCase().includes(customer.toLowerCase()));

  const validItems = lineItems.filter((i) => i.name.trim() && i.qty > 0);
  const subtotal = validItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const totalQty = validItems.reduce((s, i) => s + i.qty, 0);
  const discountAmt = discountPct
    ? (subtotal * parseFloat(discountPct)) / 100
    : parseFloat(discountRs) || 0;
  const afterDiscount = subtotal - discountAmt;
  const roundOffAmt = roundOff ? Math.round(afterDiscount) - afterDiscount : 0;
  const total = afterDiscount + roundOffAmt;
  const receivedAmt = showReceived ? parseFloat(received) || 0 : 0;
  const linkedAmount = partyTxns
    .filter((t) => linkedTxnIds.has(t.id))
    .reduce((s, t) => s + Math.min(t.balance, total), 0);
  const balance = Math.max(0, total - receivedAmt - linkedAmount);

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setLineItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function addRow() {
    setLineItems((prev) => [...prev, emptyRow()]);
  }

  function removeItem(id: string) {
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  }

  useEffect(() => {
    function handleTablePaste(e: ClipboardEvent) {
      if (!tableWrapRef.current) return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text.includes("\t") && !text.includes("\n")) return;
      e.preventDefault();

      function pn(s: string): number {
        return parseFloat(s.replace(/[^\d.\-]/g, "")) || 0;
      }
      function isNum(s: string): boolean {
        return /^[^\d]*[\d]/.test(s);
      }

      const rows = text.trim().split(/\r?\n/).map(r => r.split("\t").map(c => c.trim()));
      const parsed: LineItem[] = rows
        .filter(cols => cols[0])
        .map(cols => {
          const name = cols[0] ?? "";
          let qty = 1, mrp = 0, rate = 0, unit = "pcs";

          const rest = cols.slice(1);
          const nums = rest.filter(isNum).map(pn);
          const texts = rest.filter(c => !isNum(c) && c);

          if (texts.length > 0) unit = texts[0];

          if (nums.length === 1) {
            qty = nums[0] || 1;
          } else if (nums.length === 2) {
            qty  = nums[0] || 1;
            rate = nums[1];
          } else if (nums.length === 3) {
            mrp  = nums[0];
            qty  = nums[1] || 1;
            rate = nums[2] || mrp;
          } else if (nums.length >= 4) {
            mrp  = nums[0];
            qty  = nums[1] || 1;
            rate = nums[3] || nums[2] || mrp;
          }

          const match = catalog.find(c => c.name.toLowerCase() === name.toLowerCase());
          if (match) {
            if (match.mrp) mrp = match.mrp;
            if (!rate)     rate = match.salePrice ?? match.purchasePrice ?? 0;
            if (unit === "pcs" && match.unit) unit = match.unit;
          }

          return { ...emptyRow(), name, qty, mrp, rate, unit };
        });
      if (parsed.length) setLineItems([...parsed, emptyRow()]);
    }

    document.addEventListener("paste", handleTablePaste);
    return () => document.removeEventListener("paste", handleTablePaste);
  }, [catalog]);

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

  function save() {
    setError("");
    if (mode === "credit" && !selectedParty) { setError("Select a customer from the dropdown."); return; }
    if (validItems.length === 0) { setError("Add at least one item with quantity."); return; }
    const lowStock = validItems
      .filter((i) => i.stock !== undefined && i.qty > i.stock)
      .map((i) => i.name);
    if (lowStock.length > 0) {
      setStockWarningItems(lowStock);
      return;
    }
    void saveConfirmed();
  }

  async function saveConfirmed() {
    setStockWarningItems([]);
    setSaving(true);
    const notesJson = JSON.stringify(
      validItems.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, rate: i.rate, mrp: i.mrp }))
    );
    try {
      let txn;
      if (isEdit && initialSale) {
        txn = await api.updateTransaction(initialSale.id, {
          partyId: selectedParty?.id ?? initialSale.partyId,
          date: new Date(invoiceDate).toISOString(),
          total,
          balance,
          notes: notesJson,
        });
      } else {
        txn = await api.createTransaction({
          partyId: selectedParty?.id ?? parties[0]?.id,
          type: "sale",
          date: new Date(invoiceDate).toISOString(),
          total,
          balance,
          notes: notesJson,
        });
      }

      /* Deduct balance from each linked payment-in transaction */
      let remainingToDeduct = linkedAmount;
      for (const txnId of Array.from(linkedTxnIds)) {
        if (remainingToDeduct <= 0) break;
        const pmtTxn = partyTxns.find((t) => t.id === txnId);
        if (!pmtTxn) continue;
        const deduct = Math.min(pmtTxn.balance, remainingToDeduct);
        await api.updateTransaction(txnId, { balance: Math.max(0, pmtTxn.balance - deduct) });
        remainingToDeduct -= deduct;
      }

      const saleRow: SaleRow = { ...txn, partyName: selectedParty?.name ?? (customer || "Cash Sale") };
      onSaved(saleRow, selectedParty, invoiceNumber);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save. Check connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nsf-root">

    {billingType === "lite" ? (
      /* ═══════════════ LITE SALE LAYOUT ═══════════════ */
      <>
        {/* Lite header */}
        <div className="lsf-header">
          <span className="lsf-header__title">Sale</span>
          <div className="lsf-header__sep" />
          <span className="lsf-header__mode-label">Switch to Full Mode</span>
          <button
            type="button"
            className="lsf-toggle"
            onClick={() => setBillingType("full")}
            title="Switch to Full Sale"
          />
          <div className="lsf-header__spacer" />
          <button type="button" className="lsf-header__close" onClick={() => setShowCloseConfirm(true)}>✕</button>
        </div>

        {/* Two-column layout */}
        <div className="lsf-layout">

          {/* ── Left: form ── */}
          <div className="lsf-form">

            {/* Customer fields */}
            <div className="lsf-customer-row" ref={dropRef}>
              <div className="lsf-field" style={{ position: "relative" }}>
                <label className="lsf-field__lbl">Customer Name <span className="lsf-req">*</span></label>
                <input
                  className="lsf-input"
                  placeholder="Search by Name / Phone"
                  value={customer}
                  onChange={(e) => { setCustomer(e.target.value); setShowPartyDrop(true); }}
                  onFocus={() => setShowPartyDrop(true)}
                  autoComplete="off"
                />
                {showPartyDrop && (
                  <div className="nsf-party-drop" style={{ top: "100%", left: 0, right: 0, width: "auto" }}>
                    <button
                      type="button"
                      className="nsf-party-drop__add-btn"
                      onClick={() => { setShowPartyDrop(false); setShowAddParty(true); }}
                    >
                      <span className="nsf-party-drop__add-icon">+</span>
                      Add Party
                    </button>
                    <div className="nsf-party-drop__header-row">
                      <span />
                      <span className="nsf-party-drop__bal-hdr">Party Balance</span>
                    </div>
                    {filteredParties.slice(0, 10).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="nsf-party-drop__row"
                        onClick={() => { setCustomer(p.name); setCustomerPhone(p.phone || ""); setShowPartyDrop(false); }}
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
                    {filteredParties.length === 0 && (
                      <p className="nsf-item-drop__empty">No parties found</p>
                    )}
                  </div>
                )}
              </div>
              <div className="lsf-field">
                <label className="lsf-field__lbl">Customer Phone Number</label>
                <div className="lsf-phone-wrap">
                  <span className="lsf-phone-prefix">+92</span>
                  <input className="lsf-input lsf-input--phone" placeholder="3XXXXXXXXX" value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Company filter chips */}
            {companies.length > 1 && (
              <div className="nsf-company-chips">
                <button
                  type="button"
                  className={`nsf-company-chip${selectedCompanyFilters.length === 0 ? " nsf-company-chip--active" : ""}`}
                  onClick={() => setSelectedCompanyFilters([])}
                >
                  All
                </button>
                {companies.map((c) => {
                  const isActive = selectedCompanyFilters.includes(c.name);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`nsf-company-chip${isActive ? " nsf-company-chip--active" : ""}`}
                      onClick={() => setSelectedCompanyFilters((prev) =>
                        isActive ? prev.filter((n) => n !== c.name) : [...prev, c.name]
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Items table */}
            <div className="lsf-table-wrap" ref={tableWrapRef}>
              <div className="nsf-paste-hint">
                <span className="nsf-paste-hint__icon">⌨</span>
                Copy rows from Excel / Google Sheets and press <kbd>Ctrl+V</kbd> anywhere in the table to import items instantly.
              </div>
              <table className="lsf-table">
                <thead>
                  <tr>
                    <th className="lsf-th lsf-th--num">#</th>
                    <th className="lsf-th">ITEM</th>
                    <th className="lsf-th lsf-th--num">QTY</th>
                    <th className="lsf-th lsf-th--unit">UNIT</th>
                    <th className="lsf-th lsf-th--num">PRICE</th>
                    <th className="lsf-th lsf-th--num">TOTAL</th>
                    <th className="lsf-th lsf-th--add">
                      <button type="button" className="lsf-add-col-btn" onClick={addRow}>+</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => (
                    <tr key={item.id} className="lsf-tr">
                      <td className="lsf-td lsf-td--num">{idx + 1}</td>
                      <td className="lsf-td">
                        <input
                          className="lsf-cell-input"
                          placeholder="Search item…"
                          value={item.name}
                          onChange={(e) => { updateItem(item.id, "name", e.target.value); openItemDrop(item.id, e.currentTarget); }}
                          onFocus={(e) => openItemDrop(item.id, e.currentTarget)}
                          onBlur={() => closeItemDrop(item.id)}
                        />
                      </td>
                      <td className="lsf-td lsf-td--num">
                        <input className="lsf-cell-input lsf-cell-input--num" type="number" min="0" placeholder="0"
                          value={item.qty || ""} onChange={(e) => updateItem(item.id, "qty", parseFloat(e.target.value)||0)} />
                      </td>
                      <td className="lsf-td">
                        <select className="lsf-cell-select"
                          value={item.unit} onChange={(e) => updateItem(item.id, "unit", e.target.value)}>
                          {["NONE","PCS","KG","G","L","ML","MTR","CM","BOX","PKT","DOZ","SET"].map(u=><option key={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="lsf-td lsf-td--num">
                        <input className="lsf-cell-input lsf-cell-input--num" type="number" min="0" placeholder="0"
                          value={item.rate || ""} onChange={(e) => updateItem(item.id, "rate", parseFloat(e.target.value)||0)} />
                      </td>
                      <td className="lsf-td lsf-td--num lsf-td--total">{item.qty && item.rate ? item.qty * item.rate : ""}</td>
                      <td className="lsf-td lsf-td--del">
                        <button type="button" className="lsf-del-btn"
                          onClick={() => setLineItems(p => p.filter(r => r.id !== item.id))}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="lsf-table-footer">
                <button type="button" className="lsf-add-row-btn" onClick={addRow}>+ Add Row</button>
                <span className="lsf-subtotal-lbl">Sub Total</span>
                <span className="lsf-subtotal-val">{subtotal > 0 ? subtotal : ""}</span>
              </div>
            </div>

            {/* Item catalog dropdown (fixed, full table width) */}
            {activeItemRow && dropPos && (() => {
              const activeItem = lineItems.find((i) => i.id === activeItemRow);
              if (!activeItem) return null;
              return (
                <div
                  className="nsf-item-drop"
                  style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 400 }}
                >
                  <button
                    type="button"
                    className="nsf-item-drop__add-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setActiveItemRow(null); setDropPos(null); setShowAddItem(true); }}
                  >
                    <span className="nsf-item-drop__add-icon">+</span>
                    Add New Item
                  </button>
                  <div className="nsf-item-drop__hdr">
                    <span className="nsf-item-drop__hdr-name">ITEM NAME</span>
                    <span className="nsf-item-drop__hdr-col">SALE PRICE</span>
                    <span className="nsf-item-drop__hdr-col">PURCHASE PRICE</span>
                    <span className="nsf-item-drop__hdr-col nsf-item-drop__hdr-col--stock">STOCK</span>
                    <span className="nsf-item-drop__hdr-col">LOCATION</span>
                  </div>
                  {catalogFor(activeItem.name).slice(0, 12).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="nsf-item-drop__row"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        updateItem(activeItemRow, "name", c.name);
                        updateItem(activeItemRow, "mrp", c.salePrice ?? 0);
                        updateItem(activeItemRow, "rate", c.salePrice ?? 0);
                        updateItem(activeItemRow, "unit", c.unit || "NONE");
                        updateItem(activeItemRow, "qty", 1);
                        setActiveItemRow(null);
                        setDropPos(null);
                      }}
                    >
                      <span className="nsf-item-drop__item-name">
                        {c.name}
                        {c.sku && <span className="nsf-item-drop__sku"> ({c.sku})</span>}
                      </span>
                      <span className="nsf-item-drop__col">{fmt(c.salePrice ?? 0)}</span>
                      <span className="nsf-item-drop__col">{c.purchasePrice != null ? fmt(c.purchasePrice) : "–"}</span>
                      <span className={`nsf-item-drop__col nsf-item-drop__col--stock${(c.openingStock ?? 0) < 0 ? " nsf-item-drop__col--neg" : (c.openingStock ?? 0) > 0 ? " nsf-item-drop__col--pos" : ""}`}>
                        {c.openingStock ?? 0}
                      </span>
                      <span className="nsf-item-drop__col nsf-item-drop__col--loc">–</span>
                    </button>
                  ))}
                  {catalogFor(activeItem.name).length === 0 && (
                    <p className="nsf-item-drop__empty">No items found</p>
                  )}
                </div>
              );
            })()}

            {/* Discount / Tax / Received */}
            <div className="lsf-totals">
              <div className="lsf-totals-row">
                <span className="lsf-totals-lbl">Discount</span>
                <div className="lsf-totals-controls">
                  <input className="lsf-sm-input" type="number" min="0" placeholder="0"
                    value={discountPct} onChange={(e) => handleDiscountPct(e.target.value)} />
                  <span className="lsf-unit">%</span>
                  <input className="lsf-sm-input" type="number" min="0" placeholder="0"
                    value={discountRs} onChange={(e) => handleDiscountRs(e.target.value)} />
                </div>
              </div>
              <div className="lsf-totals-row">
                <span className="lsf-totals-lbl">Tax</span>
                <div className="lsf-totals-controls">
                  <select className="lsf-sm-select"><option>NONE</option></select>
                  <span className="lsf-tax-val">0</span>
                </div>
              </div>
              <div className="lsf-totals-row">
                <span className="lsf-totals-lbl">Received</span>
                <div className="lsf-totals-controls lsf-totals-controls--received">
                  <label className="lsf-check-label">
                    <input type="checkbox" checked={showReceived}
                      onChange={(e) => { setShowReceived(e.target.checked); if (e.target.checked) setReceived(total.toFixed(2)); else setReceived(""); }} />
                    <span>Fully Received</span>
                  </label>
                  <input className="lsf-sm-input" type="number" min="0" placeholder="0"
                    value={received} disabled={!showReceived} onChange={(e) => setReceived(e.target.value)} />
                </div>
              </div>
              <div className="lsf-balance-row">
                <span>Balance: {fmt(balance)}</span>
              </div>
            </div>

            {/* Total bar */}
            <div className="lsf-total-bar">
              <span className="lsf-total-bar__lbl">Total Amount (Rs)</span>
              <span className="lsf-total-bar__val">{total}</span>
            </div>
          </div>

          {/* ── Right: invoice preview ── */}
          <div className="lsf-preview">
            <div className="inv">
              {/* Company header */}
              <div className="inv-company-row">
                <div>
                  <div className="inv-company-name">Rootocloud</div>
                  <div className="inv-company-phone">Phone no. : {customerPhone ? `0${customerPhone}` : "—"}</div>
                </div>
                <div className="inv-logo">LOGO</div>
              </div>

              <div className="inv-title">Invoice</div>

              {/* Bill To + Invoice Details */}
              <div className="inv-meta-row">
                <div className="inv-bill-to">
                  <div className="inv-meta-hdr">Bill To</div>
                  <div className="inv-meta-name">{customer || "—"}</div>
                  <div className="inv-meta-sub">Contact No. : {customerPhone || "—"}</div>
                </div>
                <div className="inv-details">
                  <div className="inv-meta-hdr">Invoice Details</div>
                  <div className="inv-meta-sub">Invoice No. : {invoiceNumber}</div>
                  <div className="inv-meta-sub">Date : {invoiceDate.split("-").reverse().join("-")}</div>
                </div>
              </div>

              {/* Items table */}
              <table className="inv-table">
                <thead>
                  <tr className="inv-thead-row">
                    <th className="inv-th inv-th--num">#</th>
                    <th className="inv-th">Item name</th>
                    <th className="inv-th inv-th--num">MRP</th>
                    <th className="inv-th inv-th--num">Quantity</th>
                    <th className="inv-th inv-th--unit">Unit</th>
                    <th className="inv-th inv-th--num">Price/ Unit</th>
                    <th className="inv-th inv-th--num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {validItems.map((item, idx) => (
                    <tr key={item.id} className="inv-tr">
                      <td className="inv-td inv-td--num">{idx+1}</td>
                      <td className="inv-td">{item.name}</td>
                      <td className="inv-td inv-td--num">Rs {fmt(item.mrp||item.rate)}</td>
                      <td className="inv-td inv-td--num">{item.qty}</td>
                      <td className="inv-td">{item.unit}</td>
                      <td className="inv-td inv-td--num">Rs {fmt(item.rate)}</td>
                      <td className="inv-td inv-td--num">Rs {fmt(item.qty*item.rate)}</td>
                    </tr>
                  ))}
                  <tr className="inv-tr-total">
                    <td className="inv-td" colSpan={3}><strong>Total</strong></td>
                    <td className="inv-td inv-td--num"><strong>{totalQty}</strong></td>
                    <td className="inv-td" colSpan={3} />
                  </tr>
                </tbody>
              </table>

              {/* Amount in words */}
              <div className="inv-words-row">
                <div>
                  <div className="inv-words-hdr">Invoice Amount In Words</div>
                  <div className="inv-words-val">{numToWords(total)}</div>
                </div>
                <div className="inv-summary">
                  <div className="inv-summary-row"><span>Sub Total</span><span>Rs {fmt(subtotal)}</span></div>
                  <div className="inv-summary-row inv-summary-row--total"><span>Total</span><span>Rs {fmt(total)}</span></div>
                  <div className="inv-summary-row"><span>Received</span><span>Rs {fmt(receivedAmt)}</span></div>
                  <div className="inv-summary-row"><span>Balance</span><span>Rs {fmt(balance)}</span></div>
                </div>
              </div>

              {/* Terms */}
              <div className="inv-terms">
                <div className="inv-terms-hdr">Terms and Conditions</div>
                <div className="inv-terms-val">Thanks for doing business with us!</div>
              </div>

              {/* Signatories */}
              <div className="inv-sign-row">
                <div />
                <div className="inv-sign">
                  <div className="inv-sign-for">For :Rootocloud</div>
                  <div className="inv-sign-lbl">Authorized Signatory</div>
                </div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="lsf-preview-actions">
              <button type="button" className="lsf-save-new-btn" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save & New"}
              </button>
              <button type="button" className="lsf-icon-action" title="WhatsApp">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.858L.057 23.522a.5.5 0 0 0 .614.663l5.834-1.53A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a10 10 0 0 1-5.197-1.452l-.372-.22-3.858 1.012 1.03-3.748-.242-.386A10 10 0 1 1 12 22z"/></svg>
              </button>
              <button type="button" className="lsf-icon-action" title="Print">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              </button>
              <button type="button" className="lsf-icon-action" title="Download">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
            </div>
          </div>
        </div>
      </>
    ) : (
      /* ═══════════════ FULL SALE LAYOUT ═══════════════ */
      <>
      {/* ── Tab bar ── */}
      <div className="nsf-tabbar">
        <div className="nsf-tab">
          <span className="nsf-tab__label">Sale #1</span>
          <button type="button" className="nsf-tab__close" onClick={() => setShowCloseConfirm(true)}>✕</button>
        </div>
        <button type="button" className="nsf-tab__add">+</button>
        <div className="nsf-tabbar__spacer" />
        <div className="nsf-tabbar__support">
          <span className="nsf-support-icon">💬</span>
          <span>WhatsApp Chat Support</span>
          <span className="nsf-support-divider">|</span>
          <span>(+92) 300 000 0000</span>
          <span className="nsf-support-divider">|</span>
          <span className="nsf-support-link">Get Instant Online Support</span>
        </div>
        <div className="nsf-tabbar__icons">
          <button type="button" className="nsf-icon-btn" title="Calculator">⌨</button>
          <button type="button" className="nsf-icon-btn" title="Settings" onClick={() => setShowSettings((s) => !s)}>⚙</button>
          <button type="button" className="nsf-icon-btn nsf-icon-btn--close" onClick={() => setShowCloseConfirm(true)} title="Close">✕</button>
        </div>
      </div>

      {/* ── Sale header ── */}
      <div className="nsf-header">
        <span className="nsf-header__title">{isEdit ? "Edit Sale Invoice" : "Sale"}</span>
        <div className="nsf-mode-toggle">
          <span className={`nsf-mode-lbl${mode === "credit" ? " nsf-mode-lbl--active" : ""}`}>Credit</span>
          <button
            type="button"
            className={`nsf-toggle-sw${mode === "cash" ? " nsf-toggle-sw--on" : ""}`}
            onClick={() => { if (!partyLocked) setMode((m) => (m === "credit" ? "cash" : "credit")); }}
            disabled={partyLocked}
            style={partyLocked ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
          />
          <span className={`nsf-mode-lbl${mode === "cash" ? " nsf-mode-lbl--active" : ""}`}>Cash</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="nsf-body">

        {/* Customer + Invoice meta row */}
        <div className="nsf-top-row">
          <div className="nsf-customer-area" ref={dropRef}>
            <div className="nsf-customer-field">
              <span className="nsf-customer-lbl">Search by Name/Phone *</span>
              <div className="nsf-customer-input-wrap">
                <input
                  className="nsf-customer-input"
                  placeholder="Search by Name/Phone"
                  value={customer}
                  disabled={partyLocked}
                  style={partyLocked ? { background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" } : undefined}
                  onChange={(e) => { setCustomer(e.target.value); setShowPartyDrop(true); }}
                  onFocus={() => { if (!partyLocked) setShowPartyDrop(true); }}
                />
                <span className="nsf-customer-arrow">▾</span>
              </div>
              {partyLocked && (
                <span style={{ fontSize: "11px", color: "#ef4444", marginTop: 2 }}>
                  Party locked — payment already applied
                </span>
              )}
              {!partyLocked && showPartyDrop && (
                <div className="nsf-party-drop">
                  <button
                    type="button"
                    className="nsf-party-drop__add-btn"
                    onClick={() => { setShowPartyDrop(false); setShowAddParty(true); }}
                  >
                    <span className="nsf-party-drop__add-icon">+</span>
                    Add Party
                  </button>
                  <div className="nsf-party-drop__header-row">
                    <span />
                    <span className="nsf-party-drop__bal-hdr">Party Balance</span>
                  </div>
                  {filteredParties.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="nsf-party-drop__row"
                      onClick={() => { setCustomer(p.name); setCustomerPhone(p.phone || ""); setShowPartyDrop(false); }}
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
                </div>
              )}
            </div>
            <input
              className="nsf-phone-input"
              placeholder="Phone No."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          <div className="nsf-invoice-meta">
            <div className="nsf-invoice-meta__row">
              <span className="nsf-invoice-meta__lbl">Invoice Number</span>
              <span className="nsf-invoice-meta__val">{invoiceNumber}</span>
            </div>
            <div className="nsf-invoice-meta__row">
              <span className="nsf-invoice-meta__lbl">Invoice Date</span>
              <div className="nsf-invoice-date-wrap">
                <input
                  type="date"
                  className="nsf-invoice-date-input"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
                <span className="nsf-invoice-date-icon">📅</span>
              </div>
            </div>
          </div>
        </div>

        {/* Company filter chips */}
        {companies.length > 1 && (
          <div className="nsf-company-chips">
            <button
              type="button"
              className={`nsf-company-chip${selectedCompanyFilters.length === 0 ? " nsf-company-chip--active" : ""}`}
              onClick={() => setSelectedCompanyFilters([])}
            >
              All
            </button>
            {companies.map((c) => {
              const isActive = selectedCompanyFilters.includes(c.name);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`nsf-company-chip${isActive ? " nsf-company-chip--active" : ""}`}
                  onClick={() => setSelectedCompanyFilters((prev) =>
                    isActive ? prev.filter((n) => n !== c.name) : [...prev, c.name]
                  )}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Items table */}
        <div className="nsf-table-wrap" ref={tableWrapRef}>
          <table className="nsf-table">
            <thead>
              <tr>
                <th className="nsf-th nsf-th--num">#</th>
                <th className="nsf-th nsf-th--name">ITEM NAME</th>
                <th className="nsf-th nsf-th--mrp">MRP</th>
                <th className="nsf-th nsf-th--qty">QTY</th>
                <th className="nsf-th nsf-th--unit">UNIT</th>
                <th className="nsf-th nsf-th--rate">PRICE/UNIT</th>
                <th className="nsf-th nsf-th--amt">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={item.id} className={`nsf-tr${activeItemRow === item.id ? " nsf-tr--active" : ""}`}>
                  <td className="nsf-td nsf-td--num">
                    <div className="nsf-num-cell">
                      <span className="nsf-row-num">{idx + 1}</span>
                      <button
                        type="button"
                        className="nsf-del-row-btn"
                        title="Remove row"
                        onClick={() => removeItem(item.id)}
                      >✕</button>
                    </div>
                  </td>
                  <td className="nsf-td nsf-td--name">
                    <input
                      className="nsf-cell-input nsf-cell-input--name"
                      value={item.name}
                      placeholder="Search item…"
                      onChange={(e) => { updateItem(item.id, "name", e.target.value); openItemDrop(item.id, e.currentTarget); }}
                      onFocus={(e) => openItemDrop(item.id, e.currentTarget)}
                      onBlur={() => closeItemDrop(item.id)}
                    />
                  </td>
                  <td className="nsf-td">
                    <input
                      className="nsf-cell-input"
                      type="number"
                      min="0"
                      value={item.mrp || ""}
                      placeholder="0"
                      onChange={(e) => updateItem(item.id, "mrp", parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="nsf-td">
                    <input
                      className="nsf-cell-input"
                      type="number"
                      min="0"
                      value={item.qty || ""}
                      placeholder="0"
                      onChange={(e) => updateItem(item.id, "qty", parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="nsf-td">
                    <select
                      className="nsf-cell-select"
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                    >
                      {UNITS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="nsf-td">
                    <input
                      className="nsf-cell-input"
                      type="number"
                      min="0"
                      value={item.rate || ""}
                      placeholder="0"
                      onChange={(e) => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="nsf-td nsf-td--amt">
                    {item.qty && item.rate ? fmt(item.qty * item.rate) : ""}
                  </td>
                </tr>
              ))}
              {/* Add Item row */}
              <tr className="nsf-tr-add-row">
                <td className="nsf-td nsf-td--num" />
                <td className="nsf-td" colSpan={6}>
                  <button type="button" className="nsf-add-item-row-btn" onClick={addRow}>
                    <span className="nsf-add-item-row-icon">+</span>
                    Add Item
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="nsf-total-row">
                <td className="nsf-total-lbl" colSpan={2}>TOTAL</td>
                <td />
                <td className="nsf-total-qty">{totalQty > 0 ? totalQty : "0"}</td>
                <td /><td />
                <td className="nsf-total-amt">{fmt(subtotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Item catalog dropdown — fixed below the active row, full table width */}
        {activeItemRow && dropPos && (() => {
          const activeItem = lineItems.find((i) => i.id === activeItemRow);
          if (!activeItem) return null;
          return (
            <div
              className="nsf-item-drop"
              style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 400 }}
            >
              <button
                type="button"
                className="nsf-item-drop__add-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setActiveItemRow(null); setDropPos(null); setShowAddItem(true); }}
              >
                <span className="nsf-item-drop__add-icon">+</span>
                Add New Item
              </button>
              <div className="nsf-item-drop__hdr">
                <span className="nsf-item-drop__hdr-name">ITEM NAME</span>
                <span className="nsf-item-drop__hdr-col">SALE PRICE</span>
                <span className="nsf-item-drop__hdr-col">PURCHASE PRICE</span>
                <span className="nsf-item-drop__hdr-col nsf-item-drop__hdr-col--stock">STOCK</span>
                <span className="nsf-item-drop__hdr-col">LOCATION</span>
              </div>
              {catalogFor(activeItem.name).slice(0, 12).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="nsf-item-drop__row"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    updateItem(activeItemRow, "name", c.name);
                    updateItem(activeItemRow, "mrp", c.salePrice ?? 0);
                    updateItem(activeItemRow, "rate", c.salePrice ?? 0);
                    updateItem(activeItemRow, "unit", c.unit || "NONE");
                    updateItem(activeItemRow, "qty", 1);
                    updateItem(activeItemRow, "stock", c.openingStock ?? 0);
                    setActiveItemRow(null);
                    setDropPos(null);
                  }}
                >
                  <span className="nsf-item-drop__item-name">
                    {c.name}
                    {c.sku && <span className="nsf-item-drop__sku"> ({c.sku})</span>}
                  </span>
                  <span className="nsf-item-drop__col">{fmt(c.salePrice ?? 0)}</span>
                  <span className="nsf-item-drop__col">{c.purchasePrice != null ? fmt(c.purchasePrice) : "–"}</span>
                  <span className={`nsf-item-drop__col nsf-item-drop__col--stock${(c.openingStock ?? 0) < 0 ? " nsf-item-drop__col--neg" : (c.openingStock ?? 0) > 0 ? " nsf-item-drop__col--pos" : ""}`}>
                    {c.openingStock ?? 0}
                  </span>
                  <span className="nsf-item-drop__col nsf-item-drop__col--loc">–</span>
                </button>
              ))}
              {catalogFor(activeItem.name).length === 0 && (
                <p className="nsf-item-drop__empty">No items found</p>
              )}
            </div>
          );
        })()}

        {/* Bottom section */}
        <div className="nsf-bottom-section">

          {/* ── Left column ── */}
          <div className="nsf-bottom-left">
            {/* Payment Type floating-label select */}
            <div className="nsf-payment-field">
              <span className="nsf-payment-lbl">Payment Type</span>
              <select
                className="nsf-payment-select"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
              >
                <option>Cash</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Cheque</option>
                <option>Card</option>
              </select>
            </div>
            <button type="button" className="nsf-add-payment-btn">+ Add Payment type</button>

            <div className="nsf-add-btns">
              <button type="button" className="nsf-add-btn">
                <span className="nsf-add-btn__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                </span>
                Add Description
              </button>
              <button type="button" className="nsf-add-btn">
                <span className="nsf-add-btn__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                </span>
                Add Image
              </button>
              <button type="button" className="nsf-add-btn">
                <span className="nsf-add-btn__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </span>
                Add Document
              </button>
            </div>
          </div>

          {/* ── Right column: totals ── */}
          <div className="nsf-totals-area">

            {/* Discount */}
            <div className="nsf-totals-row">
              <span className="nsf-totals-lbl">Discount</span>
              <div className="nsf-discount-controls">
                <input
                  className="nsf-tiny-input"
                  type="number" min="0" placeholder="0"
                  value={discountPct}
                  onChange={(e) => handleDiscountPct(e.target.value)}
                />
                <span className="nsf-tiny-unit">%</span>
                <span className="nsf-tiny-sep">—</span>
                <span className="nsf-tiny-unit">Rs</span>
                <input
                  className="nsf-tiny-input"
                  type="number" min="0" placeholder="0.00"
                  value={discountRs}
                  onChange={(e) => handleDiscountRs(e.target.value)}
                />
              </div>
            </div>

            {/* Tax */}
            <div className="nsf-totals-row">
              <span className="nsf-totals-lbl">Tax</span>
              <div className="nsf-discount-controls">
                <select className="nsf-tiny-select"><option>NONE</option></select>
                <span className="nsf-tax-val">0</span>
              </div>
            </div>

            {/* Round Off  +  Total — same row */}
            <div className="nsf-totals-row nsf-totals-row--rt">
              <label className="nsf-check-label">
                <input
                  type="checkbox"
                  className="nsf-roundoff-cb"
                  checked={roundOff}
                  onChange={(e) => setRoundOff(e.target.checked)}
                />
                <span>Round Off</span>
              </label>
              <input
                className="nsf-tiny-input nsf-tiny-input--ro"
                type="number"
                value={roundOff ? roundOffAmt.toFixed(2) : "0"}
                readOnly
              />
              <span className="nsf-totals-lbl nsf-totals-lbl--total">Total</span>
              <input
                className="nsf-tiny-input nsf-tiny-input--total"
                type="text"
                value={fmt(total)}
                readOnly
              />
            </div>

            {/* Received */}
            <div className="nsf-totals-row nsf-totals-row--rt">
              <label className="nsf-check-label">
                <input
                  type="checkbox"
                  className="nsf-roundoff-cb"
                  checked={showReceived}
                  onChange={(e) => {
                    setShowReceived(e.target.checked);
                    if (e.target.checked) {
                      setReceived(total.toFixed(2));
                    } else {
                      setReceived("");
                    }
                  }}
                />
                <span>Received</span>
              </label>
              <input
                className="nsf-tiny-input nsf-tiny-input--total"
                type="number"
                placeholder="0.00"
                value={received}
                disabled={!showReceived}
                onChange={(e) => setReceived(e.target.value)}
                style={{ marginLeft: "auto" }}
              />
            </div>

            {/* Balance */}
            <div className="nsf-totals-row nsf-totals-row--balance">
              <span className="nsf-balance-lbl">Balance</span>
              <span className="nsf-balance-val">{fmt(balance)}</span>
            </div>

          </div>
        </div>
      </div>

      {error && <p className="nsf-error">{error}</p>}

      {/* ── Settings left drawer ── */}
      {showSettings && (
        <>
          <div className="nsf-settings-backdrop" onClick={() => setShowSettings(false)} />
          <div className="nsf-settings-drawer">
            <div className="nsf-settings-drawer__header">
              <span className="nsf-settings-drawer__title">Settings</span>
              <button type="button" className="nsf-settings-drawer__close" onClick={() => setShowSettings(false)}>✕</button>
            </div>

            <div className="nsf-settings-drawer__body">

              {/* Sale Prefix */}
              <label className="nsf-setting-row">
                <span className="nsf-setting-row__label">Sale Prefix</span>
                <input type="checkbox" className="nsf-setting-cb" checked={salePrefix} onChange={(e) => setSalePrefix(e.target.checked)} />
              </label>

              {/* Add fields to invoice */}
              <div className="nsf-setting-row nsf-setting-row--link">
                <span className="nsf-setting-row__label">Add fields to invoice</span>
                <span className="nsf-setting-row__arrow">›</span>
              </div>

              {/* Quick Entry */}
              <label className="nsf-setting-row">
                <span className="nsf-setting-row__label">
                  Quick Entry
                  <span className="nsf-setting-row__info" title="Enables quick item entry mode">ⓘ</span>
                </span>
                <input type="checkbox" className="nsf-setting-cb" checked={quickEntry} onChange={(e) => setQuickEntry(e.target.checked)} />
              </label>

              {/* Link payment to invoices */}
              <label className="nsf-setting-row">
                <span className="nsf-setting-row__label">
                  Link payment to invoices
                  <span className="nsf-setting-row__info" title="Automatically link payments to outstanding invoices">ⓘ</span>
                </span>
                <input type="checkbox" className="nsf-setting-cb" checked={linkPayment} onChange={(e) => setLinkPayment(e.target.checked)} />
              </label>

              {/* Due dates & payment terms */}
              <label className="nsf-setting-row">
                <span className="nsf-setting-row__label">
                  Due dates &amp; payment terms
                  <span className="nsf-setting-row__info" title="Add due date and payment term fields to invoices">ⓘ</span>
                </span>
                <input type="checkbox" className="nsf-setting-cb" checked={dueDates} onChange={(e) => setDueDates(e.target.checked)} />
              </label>

              {/* Additional charges */}
              <div className="nsf-setting-row nsf-setting-row--link">
                <span className="nsf-setting-row__label">Additional charges</span>
                <span className="nsf-setting-row__arrow">›</span>
              </div>

              {/* Print Settings */}
              <div className="nsf-setting-row nsf-setting-row--link">
                <span className="nsf-setting-row__label">Print Settings</span>
                <span className="nsf-setting-row__arrow">›</span>
              </div>

              {/* Billing Type */}
              <div className="nsf-setting-section">
                <span className="nsf-setting-section__label">Billing Type</span>
                <label className="nsf-setting-radio">
                  <input type="radio" name="billingType" value="lite" checked={(billingType as string) === "lite"}
                    onChange={() => setShowBillingConfirm(true)} />
                  <span>Lite Sale</span>
                </label>
                <label className="nsf-setting-radio">
                  <input type="radio" name="billingType" value="full" checked={billingType === "full"}
                    onChange={() => setBillingType("full")} />
                  <span>Full Sale</span>
                </label>
              </div>

            </div>

            <div className="nsf-settings-drawer__footer">
              <button type="button" className="nsf-settings-drawer__more">⚙ More Settings</button>
            </div>
          </div>
        </>
      )}

      {/* ── Action bar ── */}
      <div className="nsf-actionbar">
        {selectedParty && linkPayment && partyTxns.length > 0 && (
          <button type="button" className="nsf-link-payment-btn" onClick={() => setShowLinkPayment(true)}>
            🔗 Link Payment
            {linkedTxnIds.size > 0 && (
              <span className="nsf-link-payment-btn__badge">{linkedTxnIds.size}</span>
            )}
          </button>
        )}
        <div className="nsf-actionbar__right">
          <div className="nsf-share-wrap">
            <button type="button" className="nsf-share-btn">Share</button>
            <button type="button" className="nsf-share-arrow">▼</button>
          </div>
          <button type="button" className="nsf-save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Update Invoice" : "Save"}
          </button>
        </div>
      </div>

      {showCloseConfirm && (
        <div className="nsf-dialog-overlay">
          <div className="nsf-dialog">
            <div className="nsf-dialog__header">
              <span className="nsf-dialog__title">Close Sale</span>
              <button
                type="button"
                className="nsf-dialog__x"
                onClick={() => setShowCloseConfirm(false)}
              >✕</button>
            </div>
            <p className="nsf-dialog__body">
              Current changes will be discarded. Do you wish to continue?
            </p>
            <div className="nsf-dialog__footer">
              <button
                type="button"
                className="nsf-dialog__btn nsf-dialog__btn--cancel"
                onClick={() => setShowCloseConfirm(false)}
              >Cancel</button>
              <button
                type="button"
                className="nsf-dialog__btn nsf-dialog__btn--ok"
                onClick={onClose}
              >OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attention: switch to Lite Sale ── */}
      {showBillingConfirm && (
        <div className="nsf-dialog-overlay">
          <div className="nsf-dialog">
            <div className="nsf-dialog__header">
              <span className="nsf-dialog__title">Attention!</span>
              <button type="button" className="nsf-dialog__x" onClick={() => setShowBillingConfirm(false)}>✕</button>
            </div>
            <p className="nsf-dialog__body">
              Switching to Lite Sale will simplify the invoice form. Some advanced fields will not be visible.
            </p>
            <p className="nsf-dialog__note">
              ⚠ Changes in the current invoice may be lost after switching.
            </p>
            <div className="nsf-dialog__footer">
              <button
                type="button"
                className="nsf-dialog__btn nsf-dialog__btn--cancel"
                onClick={() => setShowBillingConfirm(false)}
              >No, Cancel</button>
              <button
                type="button"
                className="nsf-dialog__btn nsf-dialog__btn--ok"
                onClick={() => { setBillingType("lite"); setShowBillingConfirm(false); setShowSettings(false); }}
              >Yes, Switch</button>
            </div>
          </div>
        </div>
      )}
      </>
    )}

    {/* Link Payment modal */}
    {showLinkPayment && (
      <LinkPaymentModal
        partyName={selectedParty?.name ?? customer}
        invoiceTotal={total}
        transactions={partyTxns}
        linkedIds={linkedTxnIds}
        onDone={(ids) => { setLinkedTxnIds(ids); setShowLinkPayment(false); }}
        onClose={() => setShowLinkPayment(false)}
      />
    )}

    {/* Stock warning dialog */}
    {stockWarningItems.length > 0 && (
      <div className="nsf-dialog-overlay">
        <div className="nsf-dialog">
          <div className="nsf-dialog__header">
            <span className="nsf-dialog__title">Insufficient Stock</span>
          </div>
          <p className="nsf-dialog__body">
            Your stock for the following item(s) is not sufficient to fulfil this sale:
            <br />
            {stockWarningItems.map((n) => <strong key={n}>{n}</strong>).reduce<React.ReactNode[]>((a, el, i) => i === 0 ? [el] : [...a, ", ", el], [])}
            <br />
            Do you want to continue?
          </p>
          <div className="nsf-dialog__footer">
            <button type="button" className="nsf-dialog__btn nsf-dialog__btn--cancel" onClick={() => setStockWarningItems([])}>
              No
            </button>
            <button type="button" className="nsf-dialog__btn nsf-dialog__btn--ok" onClick={() => void saveConfirmed()}>
              Yes, Continue
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modals — outside ternary so they work in both Lite and Full mode */}
    {showAddParty && (
      <AddPartyModal
        onClose={() => setShowAddParty(false)}
        onSaved={(party) => {
          setCustomer(party.name);
          setCustomerPhone(party.phone ?? "");
          setShowAddParty(false);
        }}
      />
    )}

    {showAddItem && (
      <AddItemModal
        onClose={() => setShowAddItem(false)}
        onSaved={() => setShowAddItem(false)}
      />
    )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LINK PAYMENT MODAL
═══════════════════════════════════════════════════════════ */
function LinkPaymentModal({
  partyName, invoiceTotal, transactions, linkedIds, onDone, onClose,
}: {
  partyName: string;
  invoiceTotal: number;
  transactions: Transaction[];
  linkedIds: Set<string>;
  onDone: (ids: Set<string>) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(linkedIds));
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const filtered = transactions.filter((t) => {
    if (search && !(t.number ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "payment_in" && t.type !== "payment_in") return false;
    return true;
  });

  const linkedAmount = transactions
    .filter((t) => selected.has(t.id))
    .reduce((s, t) => s + Math.min(t.balance, invoiceTotal), 0);
  const remaining = Math.max(0, invoiceTotal - linkedAmount);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function autoLink() {
    const ids = new Set<string>();
    let left = invoiceTotal;
    for (const t of transactions) {
      if (left <= 0) break;
      ids.add(t.id);
      left -= Math.min(t.balance, left);
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
          <div className="lpm-meta__col"><span className="lpm-meta__lbl">Party</span><span className="lpm-meta__val">{partyName}</span></div>
          <div className="lpm-meta__col"><span className="lpm-meta__lbl">Total Amount</span><span className="lpm-meta__val">{fmt(invoiceTotal)}</span></div>
          <div className="lpm-meta__col"><span className="lpm-meta__lbl">Amount to Link</span><span className="lpm-meta__val">{fmt(linkedAmount)}</span></div>
          <div className="lpm-meta__actions">
            <button type="button" className="lpm-auto-btn" onClick={autoLink}>AUTO LINK</button>
            <button type="button" className="lpm-reset-btn" onClick={() => setSelected(new Set())}>↺ RESET</button>
          </div>
        </div>

        <div className="lpm-filters">
          <select className="lpm-filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All transactions</option>
            <option value="payment_in">Payment-In only</option>
          </select>
          <input className="lpm-search" placeholder="Search ref/inv no..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="lpm-table-wrap">
          <table className="lpm-table">
            <thead>
              <tr>
                <th />
                <th>Date</th>
                <th>Type</th>
                <th>Ref/Inv No.</th>
                <th>Amount</th>
                <th>Available</th>
                <th>Linked Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const isChecked = selected.has(t.id);
                const linkAmt = isChecked ? Math.min(t.balance, invoiceTotal) : 0;
                return (
                  <tr key={t.id} className={isChecked ? "lpm-tr--selected" : ""} onClick={() => toggle(t.id)} style={{ cursor: "pointer" }}>
                    <td><input type="checkbox" checked={isChecked} readOnly onClick={(e) => { e.stopPropagation(); toggle(t.id); }} /></td>
                    <td>{new Date(t.date).toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                    <td>{t.type === "payment_in" ? "Payment-In" : t.type}</td>
                    <td>{t.number ?? "–"}</td>
                    <td>{fmt(t.total)}</td>
                    <td>{fmt(t.balance)}</td>
                    <td>{linkAmt > 0 ? fmt(linkAmt) : "–"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "20px", color: "#9ca3af" }}>No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lpm-footer">
          <span className="lpm-remaining">Remaining to Link: <strong>{fmt(remaining)}</strong></span>
          <button type="button" className="lpm-cancel-btn" onClick={onClose}>CANCEL</button>
          <button type="button" className="lpm-done-btn" onClick={() => onDone(selected)}>DONE</button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { api, loadTenant } from "../lib/api";
import type { Transaction, Party, Item } from "@vyapar/api-client";

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" });
}
function today() { return new Date().toISOString().slice(0, 10); }

type PurchaseRow = Transaction & { partyName: string };
type LineItem = { id: string; name: string; mrp: number; qty: number; unit: string; rate: number; stock?: number };
type SubTab = "bills" | "payment_out" | "purchase_order" | "debit_note" | "purchase_return";

type PreviewData = {
  txnNumber: string | null;
  party: Party;
  lineItems: LineItem[];
  subtotal: number;
  total: number;
  balance: number;
  receivedAmt: number;
  billDate: string;
  formTitle: string;
  billNum: number;
};

type TxnType = "purchase" | "payment_out" | "expense" | "purchase_order" | "debit_note";
const TAB_CONFIG: Record<string, { txnType: TxnType; title: string; addLabel: string; emptyMsg: string }> = {
  "purchase-bills":       { txnType: "purchase",       title: "Purchase Bills",              addLabel: "+ Add Purchase",      emptyMsg: "No Purchase Bills to show" },
  "purchase-payment-out": { txnType: "payment_out",    title: "Payment-Out",                 addLabel: "+ Add Payment-Out",   emptyMsg: "No Payment-Out records yet" },
  "purchase-expense":     { txnType: "expense",        title: "Expenses",                    addLabel: "+ Add Expense",       emptyMsg: "No Expenses recorded yet" },
  "purchase-order":       { txnType: "purchase_order", title: "Purchase Order",              addLabel: "+ Add Order",         emptyMsg: "No Purchase Orders to show" },
  "purchase-return":      { txnType: "debit_note",     title: "Purchase Return/ Dr. Note",   addLabel: "+ Add Return",        emptyMsg: "No Purchase Returns to show" },
};

const UNITS = ["NONE", "Pcs", "Kg", "Gm", "L", "ML", "Box", "Pack", "Bag", "Mtr", "Ft"];

function emptyRow(): LineItem {
  return { id: Date.now().toString() + Math.random(), name: "", mrp: 0, qty: 0, unit: "NONE", rate: 0 };
}

const AVATAR_PALETTES = [
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#fff1e6", fg: "#c2410c" },
];
const avatarCache: Record<string, (typeof AVATAR_PALETTES)[0]> = {};
let _pIdx = 0;
function partyColor(name: string) {
  if (!avatarCache[name]) avatarCache[name] = AVATAR_PALETTES[_pIdx++ % AVATAR_PALETTES.length];
  return avatarCache[name];
}

type Props = { isLocked?: boolean; onLockedAction?: () => void; activeKey?: string };

export function PurchaseScreen({ isLocked = false, onLockedAction, activeKey = "purchase-bills" }: Props = {}) {
  const tabCfg = TAB_CONFIG[activeKey] ?? TAB_CONFIG["purchase-bills"];
  const [filter, setFilter]   = useState<"all" | "unpaid" | "paid">("all");
  const [search, setSearch]   = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [parties,  setParties]   = useState<Party[]>([]);
  const [items,    setItems]     = useState<Item[]>([]);
  const [loading,  setLoading]   = useState(true);
  const [showForm, setShowForm]  = useState(false);
  const [showSimpleForm, setShowSimpleForm] = useState(false);
  const [editPurchase, setEditPurchase] = useState<PurchaseRow | null>(null);
  const [menuId,   setMenuId]    = useState<string | null>(null);
  const [menuPos,  setMenuPos]   = useState({ top: 0, left: 0 });
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRow | null>(null);
  const [deleting, setDeleting]  = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<PurchaseRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<PurchaseRow | null>(null);
  const [returnTarget,  setReturnTarget]  = useState<PurchaseRow | null>(null);
  const [previewTarget, setPreviewTarget] = useState<PurchaseRow | null>(null);

  async function loadPurchases() {
    // Load parties + items first — independent of transactions
    let ps: Party[] = [];
    let its: Item[] = [];
    try {
      [ps, its] = await Promise.all([api.getParties(), api.getItems()]);
      setParties(ps);
      setItems(its);
    } catch { /* offline */ }

    // Load transactions for the current tab's type
    try {
      const txns = await api.getTransactionsByType(tabCfg.txnType);
      const map: Record<string, string> = {};
      ps.forEach(p => { map[p.id] = p.name; });
      setPurchases(txns.map(t => ({ ...t, partyName: map[t.partyId] ?? "Unknown" })));
    } catch { /* offline */ }
  }

  useEffect(() => { setLoading(true); loadPurchases().finally(() => setLoading(false)); }, [activeKey]);
  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuId]);

  const filtered = purchases.filter(p => {
    if (filter === "unpaid" && p.balance === 0) return false;
    if (filter === "paid"   && p.balance > 0)  return false;
    if (search) {
      const q = search.toLowerCase();
      return p.partyName.toLowerCase().includes(q);
    }
    return true;
  });

  const now = new Date();
  const fmtDMY = (d: Date) =>
    `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const startDateStr = fmtDMY(new Date(now.getFullYear(), now.getMonth(), 1));
  const endDateStr   = fmtDMY(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const totalPurchase = purchases.reduce((s, p) => s + p.total, 0);
  const totalPaid     = purchases.reduce((s, p) => s + (p.total - p.balance), 0);
  const totalBalance  = purchases.reduce((s, p) => s + p.balance, 0);

  function handleAddPurchase() {
    if (isLocked) { onLockedAction?.(); return; }
    if (activeKey === "purchase-bills" || activeKey === "purchase-order") {
      setShowForm(true);
    } else {
      setShowSimpleForm(true);
    }
  }

  async function handleDuplicate(purchase: PurchaseRow) {
    try {
      await api.createTransaction({
        partyId: purchase.partyId, type: "purchase",
        date: new Date().toISOString(),
        total: purchase.total, balance: purchase.total,
        notes: purchase.notes ?? undefined,
      });
      await loadPurchases();
    } catch { /* ignore */ }
  }

  async function handleDelete(purchase: PurchaseRow) {
    setDeleting(true);
    try {
      await api.deleteTransaction(purchase.id);
      await loadPurchases();
    } catch { /* ignore */ }
    setDeleting(false);
    setDeleteTarget(null);
  }


  function closeForm() { setShowForm(false); setShowSimpleForm(false); setEditPurchase(null); }

  /* ── payment-out tab: use dedicated sub-screen ── */
  if (activeKey === "purchase-payment-out") {
    return <PaymentOutSubScreen isLocked={isLocked} onLockedAction={onLockedAction} />;
  }

  /* ── purchase-return (debit note) tab: dedicated sub-screen ── */
  if (activeKey === "purchase-return") {
    return <PurchaseReturnSubScreen isLocked={isLocked} onLockedAction={onLockedAction} />;
  }

  /* ── expense tab: dedicated sub-screen ── */
  if (activeKey === "purchase-expense") {
    return <ExpenseSubScreen isLocked={isLocked} onLockedAction={onLockedAction} />;
  }

  /* ── debit note (convert to return) ── */
  if (returnTarget) {
    return (
      <DebitNoteForm
        purchase={returnTarget}
        allParties={parties}
        returnNum={purchases.length + 1}
        onClose={() => setReturnTarget(null)}
        onSaved={async () => { setReturnTarget(null); await loadPurchases(); }}
      />
    );
  }

  /* ── simple add form for payment-out / expense / purchase-return tabs ── */
  if (showSimpleForm) {
    return (
      <SimpleTransactionForm
        txnType={tabCfg.txnType}
        title={tabCfg.title}
        allParties={parties}
        txnNum={purchases.length + 1}
        onClose={closeForm}
        onSaved={async () => { closeForm(); await loadPurchases(); }}
      />
    );
  }

  /* ── full-page form (purchase-bills or purchase-order) ── */
  if (showForm || editPurchase) {
    const billNum = editPurchase
      ? (purchases.findIndex(p => p.id === editPurchase.id) + 1)
      : purchases.length + 1;
    return (
      <PurchaseBillForm
        billNum={billNum}
        txnType={tabCfg.txnType}
        formTitle={tabCfg.title}
        onClose={closeForm}
        onSaved={async () => { closeForm(); await loadPurchases(); }}
        editId={editPurchase?.id}
        editData={editPurchase ?? undefined}
      />
    );
  }

  /* ── list view ── */
  return (
    <div className="purchase-layout">
      <div className="purchase-main">
        <>
            {/* ── Date bar ── */}
            <div className="purchase-datebar">
              <button type="button" className="purchase-datebar__period">This Month <span>▾</span></button>
              <div className="purchase-datebar__range">
                <button type="button" className="purchase-datebar__between-btn">Between</button>
                <span className="purchase-datebar__date-val">{startDateStr}</span>
                <span className="purchase-datebar__to">To</span>
                <span className="purchase-datebar__date-val">{endDateStr}</span>
              </div>
              <button type="button" className="purchase-datebar__chip">ALL FIRMS <span>▾</span></button>
              <button type="button" className="purchase-datebar__chip">ALL USERS <span>▾</span></button>
              <div className="purchase-datebar__spacer" />
              <button type="button" className="purchase-datebar__icon-btn" title="Export to Excel">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </button>
              <button type="button" className="purchase-datebar__icon-btn" title="Print" onClick={() => window.print()}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              </button>
            </div>

            {/* ── Summary: Paid + Unpaid = Total ── */}
            <div className="purchase-sumbar">
              <div className="purchase-sumcard purchase-sumcard--paid">
                <span className="purchase-sumcard__label">Paid</span>
                <span className="purchase-sumcard__value">Rs {fmt(totalPaid)}</span>
              </div>
              <span className="purchase-sumbar__op">+</span>
              <div className="purchase-sumcard purchase-sumcard--unpaid">
                <span className="purchase-sumcard__label">Unpaid</span>
                <span className="purchase-sumcard__value">Rs {fmt(totalBalance)}</span>
              </div>
              <span className="purchase-sumbar__op">=</span>
              <div className="purchase-sumcard purchase-sumcard--total">
                <span className="purchase-sumcard__label">Total</span>
                <span className="purchase-sumcard__value">Rs {fmt(totalPurchase)}</span>
              </div>
            </div>

            {/* ── TRANSACTIONS section ── */}
            <div className="purchase-txn-wrap">
              <div className="purchase-txn-header">
                <span className="purchase-txn-title">TRANSACTIONS</span>
                <div className="purchase-txn-header__right">
                  <div className="purchase-filterbar__pills">
                    {(["all", "unpaid", "paid"] as const).map(f => (
                      <button key={f} type="button"
                        className={`purchase-filterbar__pill${filter === f ? " purchase-filterbar__pill--active" : ""}`}
                        onClick={() => setFilter(f)}>
                        {f === "all" ? "All" : f === "unpaid" ? "Unpaid" : "Paid"}
                      </button>
                    ))}
                  </div>
                  <div className="purchase-search-wrap">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      className="purchase-search"
                      placeholder="Search party…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <button type="button" className="purchase-filterbar__icon-btn" title="Export">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </button>
                  <button type="button" className="purchase-filterbar__icon-btn" title="Columns">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                  </button>
                  <button type="button" className="purchase-page-header__add-btn" onClick={handleAddPurchase}>{tabCfg.addLabel}</button>
                </div>
              </div>

              {loading ? (
                <div className="purchase-loading">Loading…</div>
              ) : purchases.length === 0 ? (
                <div className="purchase-empty">
                  <div className="purchase-empty__illustration"><div className="purchase-empty__circle"><span>📦</span></div></div>
                  <p className="purchase-empty__title">{tabCfg.emptyMsg}</p>
                  <p className="purchase-empty__sub">Nothing recorded here yet.</p>
                  <button type="button" className="purchase-empty__btn" onClick={handleAddPurchase}>{tabCfg.addLabel}</button>
                </div>
              ) : (
                <div className="purchase-list">
                  <div className="purchase-table-head">
                    <span>DATE <span className="purchase-sort-icon">▾</span></span>
                    <span>INVOICE NO. <span className="purchase-sort-icon">▾</span></span>
                    <span>PARTY NAME <span className="purchase-sort-icon">▾</span></span>
                    <span>PAYMENT TYPE <span className="purchase-sort-icon">▾</span></span>
                    <span style={{ textAlign: "right" }}>AMOUNT <span className="purchase-sort-icon">▾</span></span>
                    <span style={{ textAlign: "right" }}>BALANCE DUE <span className="purchase-sort-icon">▾</span></span>
                    <span style={{ textAlign: "center" }}>STATUS <span className="purchase-sort-icon">▾</span></span>
                    <span />
                  </div>
                  {filtered.length === 0 ? (
                    <div className="purchase-loading" style={{ padding: "40px" }}>No results for "{search}"</div>
                  ) : filtered.map((purchase, idx) => {
                    const pal = partyColor(purchase.partyName);
                    const isPaid = purchase.balance === 0;
                    const isSelected = selectedId === purchase.id;
                    return (
                      <div key={purchase.id}
                        className={`purchase-row${isSelected ? " purchase-row--selected" : ""}`}
                        onClick={() => setSelectedId(isSelected ? null : purchase.id)}>
                        <span className="purchase-row__cell">{formatDate(purchase.date)}</span>
                        <span className="purchase-row__cell" style={{ color: "#6b7280" }}>#{idx + 1}</span>
                        <div className="purchase-row__party">
                          <div className="purchase-row__avatar" style={{ background: pal.bg, color: pal.fg }}>{purchase.partyName[0].toUpperCase()}</div>
                          <span className="purchase-row__name">{purchase.partyName}</span>
                        </div>
                        <span className="purchase-row__cell" style={{ color: "#6b7280" }}>{isPaid ? "Cash" : "Credit"}</span>
                        <span className="purchase-row__cell" style={{ textAlign: "right" }}>Rs {fmt(purchase.total)}</span>
                        <span className="purchase-row__cell" style={{ textAlign: "right", color: purchase.balance > 0 ? "#ef4444" : "#16a34a", fontWeight: 600 }}>Rs {fmt(purchase.balance)}</span>
                        <span className="purchase-row__cell" style={{ textAlign: "center" }}>
                          <span className={`purchase-status-badge${isPaid ? " purchase-status-badge--paid" : " purchase-status-badge--unpaid"}`}>{isPaid ? "PAID" : "UNPAID"}</span>
                        </span>
                        <div className="purchase-row__actions" onClick={e => e.stopPropagation()}>
                          <button type="button" className="purchase-row__icon-btn" title="Print" onClick={() => window.print()}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                          </button>
                          <button type="button" className="purchase-row__icon-btn" title="More"
                            onClick={e => {
                              if (menuId === purchase.id) { setMenuId(null); return; }
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setMenuPos({ top: r.bottom + 4, left: r.right - 180 });
                              setMenuId(purchase.id);
                            }}>⋯</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
      </div>

      {menuId && (() => {
        const purchase = purchases.find(p => p.id === menuId);
        if (!purchase) return null;
        return (
          <div className="purchase-row-menu" style={{ position: "fixed", top: menuPos.top, left: menuPos.left }} onClick={e => e.stopPropagation()}>
            {[
              { label: "View / Edit",       action: () => { setMenuId(null); setEditPurchase(purchase); } },
              purchase.balance > 0
                ? { label: "Make Payment",  action: () => { setMenuId(null); setPaymentTarget(purchase); } }
                : null,
              { label: "Convert To Return", action: () => { setMenuId(null); setReturnTarget(purchase); } },
              { label: "Duplicate",         action: () => { setMenuId(null); handleDuplicate(purchase); } },
              { label: "Open PDF",          action: () => setMenuId(null) },
              { label: "Preview",           action: () => { setMenuId(null); setPreviewTarget(purchase); } },
              { label: "Print",             action: () => { setMenuId(null); window.print(); } },
              { label: "View History",      action: () => { setMenuId(null); setHistoryTarget(purchase); } },
              { label: "Delete",            action: () => { setMenuId(null); setDeleteTarget(purchase); }, danger: true },
            ].filter(Boolean).map(({ label, action, danger }: any) => (
              <button key={label} type="button"
                className={`purchase-row-menu__item${danger ? " purchase-row-menu__item--danger" : ""}`}
                onClick={action}>{label}</button>
            ))}
          </div>
        );
      })()}

      {/* ── Delete confirmation ── */}
      {deleteTarget && (
        <div className="nsf-dialog-overlay">
          <div className="nsf-dialog">
            <div className="nsf-dialog__header">
              <span className="nsf-dialog__title">Delete Purchase</span>
              <button type="button" className="nsf-dialog__x" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p className="nsf-dialog__body">
              Delete purchase bill for <strong>{deleteTarget.partyName}</strong> (Rs {fmt(deleteTarget.total)})?
              This cannot be undone.
            </p>
            <div className="nsf-dialog__footer">
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--ok" style={{ background: "#ef4444" }}
                disabled={deleting} onClick={() => handleDelete(deleteTarget)}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Make Payment modal (full Payment-Out form) ── */}
      {paymentTarget && (
        <PaymentOutModal
          purchase={paymentTarget}
          allParties={parties}
          receiptNum={purchases.length + 1}
          onClose={() => setPaymentTarget(null)}
          onSaved={async () => { setPaymentTarget(null); await loadPurchases(); }}
        />
      )}

      {/* ── Payment History modal ── */}
      {historyTarget && (
        <PaymentHistoryModal
          purchase={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {previewTarget && (
        <PurchasePreviewModal
          purchase={previewTarget}
          party={parties.find(p => p.id === previewTarget.partyId) ?? null}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PURCHASE BILL FORM  — same structure / classes as Sale form
═══════════════════════════════════════════════════════════ */
function PurchaseBillForm({
  billNum, txnType = "purchase", formTitle = "Purchase", onClose, onSaved, editId, editData,
}: {
  billNum: number;
  txnType?: TxnType;
  formTitle?: string;
  onClose: () => void;
  onSaved: () => void;
  editId?: string;
  editData?: PurchaseRow;
}) {
  const [parties, setParties] = useState<Party[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);

  useEffect(() => {
    api.getParties().then(ps => {
      setParties(ps);
      if (editData) {
        setSupplier(editData.partyName);
        const party = ps.find(p => p.id === editData.partyId);
        if (party?.phone) setSupplierPhone(party.phone);
      }
    }).catch(() => {});
    api.getItems().then(setCatalog).catch(() => {});

    if (editData) {
      setBillDate(editData.date.slice(0, 10));
      if (editData.notes) {
        try {
          const parsed = JSON.parse(editData.notes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLineItems(parsed.map((i: { name?: string; mrp?: number; qty?: number; unit?: string; rate?: number }) => ({
              id: Date.now().toString() + Math.random(),
              name:  i.name  ?? "",
              mrp:   i.mrp   ?? 0,
              qty:   i.qty   ?? 0,
              unit:  i.unit  ?? "NONE",
              rate:  i.rate  ?? 0,
            })));
          }
        } catch { /* ignore */ }
      }
      const paid = editData.total - editData.balance;
      if (paid > 0) { setShowReceived(true); setReceived(paid.toFixed(2)); }
    }
  }, []);

  const [supplier,      setSupplier]      = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const [billDate,      setBillDate]      = useState(today());
  const [lineItems,     setLineItems]     = useState<LineItem[]>([emptyRow(), emptyRow()]);
  const [discountPct,   setDiscountPct]   = useState("");
  const [discountRs,    setDiscountRs]    = useState("");
  const [roundOff,      setRoundOff]      = useState(true);
  const [showReceived,  setShowReceived]  = useState(false);
  const [received,      setReceived]      = useState("");
  const [paymentType,   setPaymentType]   = useState("Cash");
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [showClose,     setShowClose]     = useState(false);
  const [preview,       setPreview]       = useState<PreviewData | null>(null);

  /* item catalog drop */
  const [activeItemRow, setActiveItemRow] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const dropRef      = useRef<HTMLDivElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  /* close party dropdown on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowPartyDrop(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedParty   = parties.find(p => p.name === supplier);
  const filteredParties = parties
    .filter(p => p.partyType === "supplier" || p.partyType === "both" || p.isSystem)
    .filter(p => !supplier || p.name.toLowerCase().includes(supplier.toLowerCase()));

  function catalogFor(search: string) {
    if (!search.trim()) return catalog;
    const q = search.toLowerCase();
    return catalog.filter(c =>
      c.name.toLowerCase().includes(q) || (c.sku ?? "").toLowerCase().includes(q)
    );
  }

  function openItemDrop(itemId: string, inputEl: HTMLElement) {
    const rowEl = inputEl.closest("tr");
    if (!rowEl || !tableWrapRef.current) return;
    const rowRect  = rowEl.getBoundingClientRect();
    const wrapRect = tableWrapRef.current.getBoundingClientRect();
    setActiveItemRow(itemId);
    setDropPos({ top: rowRect.bottom, left: wrapRect.left, width: wrapRect.width });
  }

  function closeItemDrop(itemId: string) {
    setTimeout(() => {
      setActiveItemRow(cur => {
        if (cur === itemId) { setDropPos(null); return null; }
        return cur;
      });
    }, 160);
  }

  /* computations */
  const validItems   = lineItems.filter(i => i.name.trim() && i.qty > 0);
  const subtotal     = validItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const totalQty     = validItems.reduce((s, i) => s + i.qty, 0);
  const discountAmt  = discountPct
    ? (subtotal * parseFloat(discountPct)) / 100
    : parseFloat(discountRs) || 0;
  const afterDiscount  = subtotal - discountAmt;
  const roundOffAmt    = roundOff ? Math.round(afterDiscount) - afterDiscount : 0;
  const total          = afterDiscount + roundOffAmt;
  const receivedAmt    = showReceived ? parseFloat(received) || 0 : 0;
  const balance        = Math.max(0, total - receivedAmt);

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }
  function addRow() { setLineItems(prev => [...prev, emptyRow()]); }
  function removeItem(id: string) { setLineItems(prev => prev.filter(i => i.id !== id)); }


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
    if (!selectedParty) { setError("Select a supplier from the dropdown."); return; }
    if (validItems.length === 0) { setError("Add at least one item with quantity."); return; }
    setSaving(true);
    const notesJson = JSON.stringify(
      validItems.map(i => ({ name: i.name, qty: i.qty, unit: i.unit, rate: i.rate, mrp: i.mrp }))
    );
    try {
      if (editId) {
        await api.updateTransaction(editId, {
          partyId: selectedParty.id,
          date: new Date(billDate).toISOString(),
          total, balance, notes: notesJson,
        });
        onSaved();
      } else {
        const txn = await api.createTransaction({
          partyId: selectedParty.id,
          type: txnType,
          number: String(billNum),
          date: new Date(billDate).toISOString(),
          total, balance, notes: notesJson,
        });
        setPreview({
          txnNumber: txn.number ?? String(billNum),
          party: selectedParty,
          lineItems: validItems,
          subtotal,
          total,
          balance,
          receivedAmt,
          billDate,
          formTitle,
          billNum,
        });
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save. Check connection.");
    } finally {
      setSaving(false);
    }
  }

  if (preview) {
    return (
      <InvoicePreview
        data={preview}
        billNum={billNum}
        formTitle={formTitle}
        onClose={onSaved}
      />
    );
  }

  return (
    <div className="nsf-root">

      {/* ── Tab bar ── */}
      <div className="nsf-tabbar">
        <div className="nsf-tab">
          <span className="nsf-tab__label">{editId ? `Edit ${formTitle} #${billNum}` : `${formTitle} #${billNum}`}</span>
          <button type="button" className="nsf-tab__close" onClick={() => setShowClose(true)}>✕</button>
        </div>
        <button type="button" className="nsf-tab__add">+</button>
        <div className="nsf-tabbar__spacer" />
        <div className="nsf-tabbar__support">
          <span className="nsf-support-icon">💬</span>
          <span>WhatsApp Chat Support</span>
          <span className="nsf-support-divider">|</span>
          <span className="nsf-support-link">Get Instant Online Support</span>
        </div>
        <div className="nsf-tabbar__icons">
          <button type="button" className="nsf-icon-btn" title="Calculator">⌨</button>
          <button type="button" className="nsf-icon-btn" title="Settings">⚙</button>
          <button type="button" className="nsf-icon-btn nsf-icon-btn--close" onClick={() => setShowClose(true)} title="Close">✕</button>
        </div>
      </div>

      {/* ── Header ── */}
      <div className="nsf-header">
        <span className="nsf-header__title">{editId ? `Edit ${formTitle}` : formTitle}</span>
      </div>

      {/* ── Body ── */}
      <div className="nsf-body">

        {/* Party + Bill meta */}
        <div className="nsf-top-row">
          <div className="nsf-customer-area" ref={dropRef}>
            <div className="nsf-customer-field">
              <span className="nsf-customer-lbl">Search by Name/Phone *</span>
              <div className="nsf-customer-input-wrap">
                <input
                  className="nsf-customer-input"
                  placeholder="Search by Name/Phone"
                  value={supplier}
                  onChange={e => { setSupplier(e.target.value); setShowPartyDrop(true); setSupplierPhone(""); }}
                  onFocus={() => setShowPartyDrop(true)}
                  autoComplete="off"
                />
                <span className="nsf-customer-arrow">▾</span>
              </div>
              {showPartyDrop && (
                <div className="nsf-party-drop">
                  <div className="nsf-party-drop__header-row">
                    <span />
                    <span className="nsf-party-drop__bal-hdr">Party Balance</span>
                  </div>
                  {filteredParties.slice(0, 10).map(p => (
                    <button key={p.id} type="button" className="nsf-party-drop__row"
                      onClick={() => { setSupplier(p.name); setSupplierPhone(p.phone || ""); setShowPartyDrop(false); }}>
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
            <input
              className="nsf-phone-input"
              placeholder="Phone No."
              value={supplierPhone}
              onChange={e => setSupplierPhone(e.target.value)}
            />
          </div>

          <div className="nsf-invoice-meta">
            <div className="nsf-invoice-meta__row">
              <span className="nsf-invoice-meta__lbl">Bill Number</span>
              <span className="nsf-invoice-meta__val">{billNum}</span>
            </div>
            <div className="nsf-invoice-meta__row">
              <span className="nsf-invoice-meta__lbl">Bill Date</span>
              <div className="nsf-invoice-date-wrap">
                <input
                  type="date"
                  className="nsf-invoice-date-input"
                  value={billDate}
                  onChange={e => setBillDate(e.target.value)}
                />
                <span className="nsf-invoice-date-icon">📅</span>
              </div>
            </div>
          </div>
        </div>

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
                      <button type="button" className="nsf-del-row-btn" title="Remove row" onClick={() => removeItem(item.id)}>✕</button>
                    </div>
                  </td>
                  <td className="nsf-td nsf-td--name">
                    <input
                      className="nsf-cell-input nsf-cell-input--name"
                      value={item.name}
                      placeholder="Search item…"
                      onChange={e => { updateItem(item.id, "name", e.target.value); openItemDrop(item.id, e.currentTarget); }}
                      onFocus={e => openItemDrop(item.id, e.currentTarget)}
                      onBlur={() => closeItemDrop(item.id)}
                    />
                  </td>
                  <td className="nsf-td">
                    <input className="nsf-cell-input" type="number" min="0" value={item.mrp || ""} placeholder="0"
                      onChange={e => updateItem(item.id, "mrp", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="nsf-td">
                    <input className="nsf-cell-input" type="number" min="0" value={item.qty || ""} placeholder="0"
                      onChange={e => updateItem(item.id, "qty", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="nsf-td">
                    <select className="nsf-cell-select" value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="nsf-td">
                    <input className="nsf-cell-input" type="number" min="0" value={item.rate || ""} placeholder="0"
                      onChange={e => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)} />
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

        {/* Item catalog dropdown — fixed, full table width */}
        {activeItemRow && dropPos && (() => {
          const activeItem = lineItems.find(i => i.id === activeItemRow);
          if (!activeItem) return null;
          return (
            <div className="nsf-item-drop"
              style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 400 }}>
              <div className="nsf-item-drop__hdr">
                <span className="nsf-item-drop__hdr-name">ITEM NAME</span>
                <span className="nsf-item-drop__hdr-col">SALE PRICE</span>
                <span className="nsf-item-drop__hdr-col">PURCHASE PRICE</span>
                <span className="nsf-item-drop__hdr-col nsf-item-drop__hdr-col--stock">STOCK</span>
                <span className="nsf-item-drop__hdr-col">LOCATION</span>
              </div>
              {catalogFor(activeItem.name).slice(0, 12).map(c => (
                <button key={c.id} type="button" className="nsf-item-drop__row"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    updateItem(activeItemRow, "name", c.name);
                    updateItem(activeItemRow, "mrp", c.salePrice ?? 0);
                    updateItem(activeItemRow, "rate", c.purchasePrice ?? c.salePrice ?? 0);
                    updateItem(activeItemRow, "unit", c.unit || "NONE");
                    updateItem(activeItemRow, "qty", 1);
                    updateItem(activeItemRow, "stock", c.openingStock ?? 0);
                    setActiveItemRow(null);
                    setDropPos(null);
                  }}>
                  <span className="nsf-item-drop__item-name">
                    {c.name}
                    {c.sku && <span className="nsf-item-drop__sku"> ({c.sku})</span>}
                  </span>
                  <span className="nsf-item-drop__col">{fmt(c.salePrice ?? 0)}</span>
                  <span className="nsf-item-drop__col">{c.purchasePrice != null ? fmt(c.purchasePrice) : "–"}</span>
                  <span className={`nsf-item-drop__col nsf-item-drop__col--stock${(c.openingStock ?? 0) > 0 ? " nsf-item-drop__col--pos" : (c.openingStock ?? 0) < 0 ? " nsf-item-drop__col--neg" : ""}`}>
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

          {/* Left — payment type + attachments */}
          <div className="nsf-bottom-left">
            <div className="nsf-payment-field">
              <span className="nsf-payment-lbl">Payment Type</span>
              <select className="nsf-payment-select" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                <option>Cash</option>
                <option>Credit</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Cheque</option>
              </select>
            </div>
            <button type="button" className="nsf-add-payment-btn">+ Add Payment type</button>

            <div className="nsf-add-btns">
              <button type="button" className="nsf-add-btn">
                <span className="nsf-add-btn__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
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

          {/* Right — totals */}
          <div className="nsf-totals-area">

            {/* Discount */}
            <div className="nsf-totals-row">
              <span className="nsf-totals-lbl">Discount</span>
              <div className="nsf-discount-controls">
                <input className="nsf-tiny-input" type="number" min="0" placeholder="0"
                  value={discountPct} onChange={e => handleDiscountPct(e.target.value)} />
                <span className="nsf-tiny-unit">%</span>
                <span className="nsf-tiny-sep">—</span>
                <span className="nsf-tiny-unit">Rs</span>
                <input className="nsf-tiny-input" type="number" min="0" placeholder="0.00"
                  value={discountRs} onChange={e => handleDiscountRs(e.target.value)} />
              </div>
            </div>

            {/* Tax */}
            <div className="nsf-totals-row">
              <span className="nsf-totals-lbl">Tax</span>
              <div className="nsf-discount-controls">
                <select className="nsf-tiny-select"><option>NONE</option><option>5%</option><option>10%</option><option>17%</option></select>
                <span className="nsf-tax-val">0</span>
              </div>
            </div>

            {/* Round Off + Total */}
            <div className="nsf-totals-row nsf-totals-row--rt">
              <label className="nsf-check-label">
                <input type="checkbox" className="nsf-roundoff-cb" checked={roundOff} onChange={e => setRoundOff(e.target.checked)} />
                <span>Round Off</span>
              </label>
              <input className="nsf-tiny-input nsf-tiny-input--ro" type="number"
                value={roundOff ? roundOffAmt.toFixed(2) : "0"} readOnly />
              <span className="nsf-totals-lbl nsf-totals-lbl--total">Total</span>
              <input className="nsf-tiny-input nsf-tiny-input--total" type="text" value={fmt(total)} readOnly />
            </div>

            {/* Received */}
            <div className="nsf-totals-row nsf-totals-row--rt">
              <label className="nsf-check-label">
                <input type="checkbox" className="nsf-roundoff-cb" checked={showReceived}
                  onChange={e => { setShowReceived(e.target.checked); if (e.target.checked) setReceived(total.toFixed(2)); else setReceived(""); }} />
                <span>Received</span>
              </label>
              <input className="nsf-tiny-input nsf-tiny-input--total" type="number" placeholder="0.00"
                value={received} disabled={!showReceived}
                onChange={e => setReceived(e.target.value)}
                style={{ marginLeft: "auto" }} />
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

      {/* ── Action bar ── */}
      <div className="nsf-actionbar">
        <div className="nsf-actionbar__right">
          <div className="nsf-share-wrap">
            <button type="button" className="nsf-share-btn">Share</button>
            <button type="button" className="nsf-share-arrow">▼</button>
          </div>
          <button type="button" className="nsf-save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editId ? "Update" : "Save"}
          </button>
        </div>
      </div>

      {/* Close confirm dialog */}
      {showClose && (
        <div className="nsf-dialog-overlay">
          <div className="nsf-dialog">
            <div className="nsf-dialog__header">
              <span className="nsf-dialog__title">Close Purchase</span>
              <button type="button" className="nsf-dialog__x" onClick={() => setShowClose(false)}>✕</button>
            </div>
            <p className="nsf-dialog__body">Current changes will be discarded. Do you wish to continue?</p>
            <div className="nsf-dialog__footer">
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--cancel" onClick={() => setShowClose(false)}>Cancel</button>
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--ok" onClick={onClose}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   INVOICE PREVIEW  (shown after successful save)
═══════════════════════════════════════════════════════════ */
const PREVIEW_THEMES: { name: string; color: string }[] = [
  { name: "Theme 1",        color: "#1565c0" },
  { name: "Theme 2",        color: "#2e7d32" },
  { name: "Theme 3",        color: "#6a1b9a" },
  { name: "Theme 4",        color: "#3b82f6" },
  { name: "Tax Theme 2",    color: "#0277bd" },
  { name: "Tax Theme 4",    color: "#00695c" },
  { name: "Tax Theme 5",    color: "#558b2f" },
  { name: "Tax Theme 6",    color: "#ef6c00" },
  { name: "Thermal Theme 1",color: "#212121" },
  { name: "Thermal Theme 2",color: "#37474f" },
  { name: "Thermal Theme 3",color: "#4e342e" },
  { name: "Thermal Theme 4",color: "#880e4f" },
  { name: "Thermal Theme 5",color: "#1a237e" },
];
const PALETTE_COLORS = [
  "#7c3aed","#374151","#6b7280","#78716c","#1d4ed8","#0ea5e9","#0891b2","#16a34a","#65a30d",
  "#92400e","#7f1d1d","#9a3412","#b45309","#7e22ce","#be185d","#db2777","#e11d48","#dc2626",
  "#ea580c","#d97706","#ca8a04","#4d7c0f","#15803d","#0f766e","#0369a1","#1e40af","#4338ca",
  "#6d28d9","#7c3aed","#a21caf","#be185d","#e11d48","#f43f5e","#ffffff",
];

function InvoicePreview({
  data, billNum, formTitle, onClose,
}: {
  data: PreviewData;
  billNum: number;
  formTitle: string;
  onClose: () => void;
}) {
  const [selectedTheme, setSelectedTheme] = useState("Theme 4");
  const [accentColor,   setAccentColor]   = useState("#3b82f6");
  const [vintageOpen,   setVintageOpen]   = useState(true);
  const [classicOpen,   setClassicOpen]   = useState(false);
  const [skipPreview,   setSkipPreview]   = useState(false);

  const tenant     = loadTenant<{ phone?: string }>();
  const companyPhone = tenant?.phone ?? "";
  const companyName  = "Rootocloud";

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");

  function selectTheme(name: string, color: string) {
    setSelectedTheme(name);
    setAccentColor(color);
  }

  const validRows = data.lineItems.filter(i => i.name.trim() && i.qty > 0);

  return (
    <div className="prev-root">

      {/* ── Tab bar ── */}
      <div className="nsf-tabbar">
        <div className="nsf-tab">
          <span className="nsf-tab__label">{billNum}</span>
          <button type="button" className="nsf-tab__close" onClick={onClose}>✕</button>
        </div>
        <button type="button" className="nsf-tab__add">+</button>
        <div className="nsf-tabbar__spacer" />
        <div className="nsf-tabbar__support">
          <span className="nsf-support-icon">💬</span>
          <span>WhatsApp Chat Support</span>
          <span className="nsf-support-divider">|</span>
          <span className="nsf-support-link">Get Instant Online Support</span>
        </div>
        <div className="nsf-tabbar__icons">
          <button type="button" className="nsf-icon-btn" title="Calculator">⌨</button>
          <button type="button" className="nsf-icon-btn" title="Settings">⚙</button>
          <button type="button" className="nsf-icon-btn nsf-icon-btn--close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      {/* ── Top action row ── */}
      <div className="prev-topbar">
        <span className="prev-topbar__title">Preview</span>
        <div className="prev-topbar__right">
          <label className="prev-skip-label">
            <input type="checkbox" checked={skipPreview} onChange={e => setSkipPreview(e.target.checked)} />
            Do not show invoice preview again
          </label>
          <button type="button" className="prev-save-close-btn" onClick={onClose}>
            Save &amp; Close
          </button>
        </div>
      </div>

      {/* ── Three-column body ── */}
      <div className="prev-body">

        {/* Left — theme + color picker */}
        <aside className="prev-left">
          <p className="prev-left__heading">Select Theme</p>

          {/* Classic Themes */}
          <div className="prev-theme-group">
            <button type="button" className="prev-theme-group__hdr" onClick={() => setClassicOpen(v => !v)}>
              <span>Classic Themes</span>
              <span>{classicOpen ? "▲" : "▾"}</span>
            </button>
            {classicOpen && (
              <div className="prev-theme-list">
                {["Classic 1","Classic 2","Classic 3"].map(n => (
                  <button key={n} type="button"
                    className={`prev-theme-item${selectedTheme === n ? " prev-theme-item--active" : ""}`}
                    onClick={() => selectTheme(n, "#1565c0")}
                  >{n}</button>
                ))}
              </div>
            )}
          </div>

          {/* Vintage Themes */}
          <div className="prev-theme-group">
            <button type="button" className="prev-theme-group__hdr" onClick={() => setVintageOpen(v => !v)}>
              <span>Vintage Themes</span>
              <span>{vintageOpen ? "▲" : "▾"}</span>
            </button>
            {vintageOpen && (
              <div className="prev-theme-list">
                {PREVIEW_THEMES.map(t => (
                  <button key={t.name} type="button"
                    className={`prev-theme-item${selectedTheme === t.name ? " prev-theme-item--active" : ""}`}
                    onClick={() => selectTheme(t.name, t.color)}
                  >{t.name}</button>
                ))}
              </div>
            )}
          </div>

          {/* Color picker */}
          <p className="prev-left__heading" style={{ marginTop: 18 }}>Select Color</p>
          <div className="prev-color-selected">
            <span className="prev-color-swatch" style={{ background: accentColor }} />
            <span className="prev-color-selected__lbl">Selected</span>
          </div>
          <div className="prev-color-grid">
            {PALETTE_COLORS.map(c => (
              <button key={c} type="button"
                className={`prev-color-dot${accentColor === c ? " prev-color-dot--active" : ""}`}
                style={{ background: c, border: c === "#ffffff" ? "1px solid #d1d5db" : "none" }}
                onClick={() => setAccentColor(c)}
              />
            ))}
          </div>
        </aside>

        {/* Center — document */}
        <main className="prev-doc-wrap">
          <div className="prev-doc">
            {/* Company header */}
            <div className="prev-doc__company-row">
              <div>
                <div className="prev-doc__company-name">{companyName}</div>
                {companyPhone && <div className="prev-doc__company-phone">Phone no. : {companyPhone}</div>}
              </div>
              <div className="prev-doc__logo-box">LOGO</div>
            </div>

            <div className="prev-doc__divider" />

            {/* Document title */}
            <div className="prev-doc__title" style={{ color: accentColor }}>{formTitle}</div>

            {/* Order To / Order Details */}
            <div className="prev-doc__meta-row">
              <div className="prev-doc__meta-left">
                <div className="prev-doc__meta-label">Order To</div>
                <div className="prev-doc__meta-party">{data.party.name}</div>
                {data.party.phone && <div className="prev-doc__meta-contact">Contact No. : {data.party.phone}</div>}
              </div>
              <div className="prev-doc__meta-right">
                <div className="prev-doc__meta-label">Order Details</div>
                <div className="prev-doc__meta-detail">Order No. : {data.txnNumber ?? data.billNum}</div>
                <div className="prev-doc__meta-detail">Date : {fmtDate(data.billDate)}</div>
                <div className="prev-doc__meta-detail">Due Date : {fmtDate(data.billDate)}</div>
              </div>
            </div>

            {/* Items table */}
            <table className="prev-doc__table">
              <thead>
                <tr style={{ background: accentColor, color: "#fff" }}>
                  <th className="prev-doc__th prev-doc__th--num">#</th>
                  <th className="prev-doc__th prev-doc__th--name">Item name</th>
                  <th className="prev-doc__th">MRP</th>
                  <th className="prev-doc__th">Quantity</th>
                  <th className="prev-doc__th">Price/ Unit</th>
                  <th className="prev-doc__th prev-doc__th--amt">Amount</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((item, idx) => (
                  <tr key={item.id} className="prev-doc__tr">
                    <td className="prev-doc__td prev-doc__td--num">{idx + 1}</td>
                    <td className="prev-doc__td prev-doc__td--name" style={{ fontWeight: 700 }}>{item.name}</td>
                    <td className="prev-doc__td">Rs {item.mrp.toFixed(4)}</td>
                    <td className="prev-doc__td">{item.qty}</td>
                    <td className="prev-doc__td">Rs {item.rate.toFixed(4)}</td>
                    <td className="prev-doc__td prev-doc__td--amt" style={{ fontWeight: 700 }}>Rs {(item.qty * item.rate).toFixed(4)}</td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="prev-doc__total-row">
                  <td className="prev-doc__td" colSpan={2} style={{ fontWeight: 700 }}>Total</td>
                  <td className="prev-doc__td" />
                  <td className="prev-doc__td" style={{ fontWeight: 700 }}>
                    {validRows.reduce((s, i) => s + i.qty, 0)}
                  </td>
                  <td className="prev-doc__td" />
                  <td className="prev-doc__td prev-doc__td--amt" style={{ fontWeight: 800 }}>
                    Rs {data.total.toFixed(4)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Amount in words + terms */}
            <div className="prev-doc__words-row">
              <div className="prev-doc__words-left">
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 700 }}>Order Amount in Words: </span>
                  <span>{amountInWords(data.total)}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 700 }}>Terms and Conditions </span>
                  <span style={{ color: "#6b7280" }}>Thanks for doing business with us!</span>
                </div>
              </div>
              <div className="prev-doc__summary">
                <div className="prev-doc__summary-row">
                  <span>Sub Total</span>
                  <span>Rs {data.subtotal.toFixed(4)}</span>
                </div>
                <div className="prev-doc__summary-row prev-doc__summary-row--total" style={{ color: accentColor }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span style={{ fontWeight: 700 }}>Rs {data.total.toFixed(4)}</span>
                </div>
                <div className="prev-doc__summary-row">
                  <span>Advance</span>
                  <span>Rs {data.receivedAmt.toFixed(4)}</span>
                </div>
                <div className="prev-doc__summary-row">
                  <span>Balance</span>
                  <span>Rs {data.balance.toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* Signatory */}
            <div className="prev-doc__signatory">
              <div>For : {companyName}</div>
              <div style={{ marginTop: 40, borderTop: "1px solid #374151", paddingTop: 4 }}>
                <strong>Authorized Signatory</strong>
              </div>
            </div>
          </div>
        </main>

        {/* Right — share */}
        <aside className="prev-right">
          <p className="prev-right__heading">Share Invoice</p>
          <div className="prev-right__share-grid">
            <button type="button" className="prev-share-btn">
              <span className="prev-share-icon prev-share-icon--wa">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M11.994 2C6.477 2 2 6.477 2 11.994a9.994 9.994 0 001.399 5.149L2 22l5.016-1.377A9.994 9.994 0 0011.994 22C17.513 22 22 17.522 22 11.994 22 6.477 17.513 2 11.994 2z"/>
                </svg>
              </span>
              <span>Whatsapp</span>
            </button>
            <button type="button" className="prev-share-btn">
              <span className="prev-share-icon prev-share-icon--gmail">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                </svg>
              </span>
              <span>Gmail</span>
            </button>
          </div>
          <div className="prev-right__action-btns">
            <button type="button" className="prev-action-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Download PDF</span>
            </button>
            <button type="button" className="prev-action-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              <span>Print Invoice<br/>(Thermal)</span>
            </button>
            <button type="button" className="prev-action-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              <span>Print Invoice<br/>(Normal)</span>
            </button>
          </div>
        </aside>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAYMENT-OUT SUB-SCREEN  (standalone list + add modal)
═══════════════════════════════════════════════════════════ */
function PaymentOutSubScreen({ isLocked, onLockedAction }: { isLocked?: boolean; onLockedAction?: () => void }) {
  const [rows,      setRows]      = useState<PurchaseRow[]>([]);
  const [parties,   setParties]   = useState<Party[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);

  async function load() {
    try {
      const [txns, ps] = await Promise.all([
        api.getTransactionsByType("payment_out"),
        api.getParties(),
      ]);
      const map: Record<string, string> = {};
      ps.forEach(p => { map[p.id] = p.name; });
      setParties(ps);
      setRows(txns.map(t => ({ ...t, partyName: map[t.partyId] ?? "Unknown" })));
    } catch { /* offline */ }
  }

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  const totalAmt  = rows.reduce((s, r) => s + r.total, 0);
  const totalPaid = rows.reduce((s, r) => s + (r.total - r.balance), 0);

  const now = new Date();
  const fmtDMY = (d: Date) =>
    `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const startDateStr = fmtDMY(new Date(now.getFullYear(), now.getMonth(), 1));
  const endDateStr   = fmtDMY(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  function payType(notes: string | null) {
    if (!notes) return "Cash";
    try { return JSON.parse(notes).paymentType ?? "Cash"; } catch { return "Cash"; }
  }

  return (
    <div className="pout-layout">

      {/* Top bar */}
      <div className="pout-topbar">
        <span className="pout-topbar__title">
          Payment-Out <span className="pout-topbar__chevron">▾</span>
        </span>
        <button type="button" className="pout-add-btn" onClick={() => {
          if (isLocked) { onLockedAction?.(); return; }
          setShowAdd(true);
        }}>
          + Add Payment-Out
        </button>
      </div>

      {/* Filter bar */}
      <div className="pout-filterbar">
        <span className="pout-filterbar__label">Filter by :</span>
        <button type="button" className="pout-filter-pill">This Month <span>▾</span></button>
        <div className="pout-filter-date">
          <span className="pout-filter-date__cal">📅</span>
          <span>{startDateStr}</span>
          <span style={{ color: "#9ca3af" }}>To</span>
          <span>{endDateStr}</span>
        </div>
        <button type="button" className="pout-filter-pill">All Firms <span>▾</span></button>
        <button type="button" className="pout-filter-pill">All Users <span>▾</span></button>
      </div>

      {/* Summary card */}
      <div className="pout-summary">
        <div className="pout-summary-card">
          <div className="pout-summary-card__header">
            <span className="pout-summary-card__label">Total Amount</span>
            {rows.length > 0 && (
              <span className="pout-summary-card__badge">
                100% ↗ <span className="pout-summary-card__vs">vs last month</span>
              </span>
            )}
          </div>
          <span className="pout-summary-card__amount">Rs {fmt(totalAmt)}</span>
          <span className="pout-summary-card__paid">Paid: Rs {fmt(totalPaid)}</span>
        </div>
      </div>

      {/* Transactions table */}
      <div className="pout-txn-section">
        <div className="pout-txn-header">
          <span className="pout-txn-title">Transactions</span>
          <button type="button" className="pout-txn-icon-btn" title="Search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button type="button" className="pout-txn-xlsx">xls</button>
        </div>

        {loading ? (
          <div className="pout-empty"><span style={{ color: "#9ca3af" }}>Loading…</span></div>
        ) : rows.length === 0 ? (
          <div className="pout-empty">
            <span className="pout-empty__title">No Payment-Out records yet</span>
            <span className="pout-empty__sub">Click "+ Add Payment-Out" to record one.</span>
          </div>
        ) : (
          <div className="pout-table">
            <div className="pout-table-head">
              <span>Date <span className="purchase-sort-icon">▾</span></span>
              <span>Ref. no. <span className="purchase-sort-icon">▾</span></span>
              <span>Party Name <span className="purchase-sort-icon">▾</span></span>
              <span style={{ textAlign: "right" }}>Total Amount <span className="purchase-sort-icon">▾</span></span>
              <span style={{ textAlign: "right" }}>Paid <span className="purchase-sort-icon">▾</span></span>
              <span>Payment Type <span className="purchase-sort-icon">▾</span></span>
              <span>Status <span className="purchase-sort-icon">▾</span></span>
              <span>Actions</span>
            </div>

            {rows.map((row, idx) => {
              const pal = partyColor(row.partyName);
              const isUsed = row.balance < row.total;
              const pt = payType(row.notes);
              return (
                <div key={row.id} className="pout-row">
                  <span className="pout-cell">{formatDate(row.date)}</span>
                  <span className="pout-cell" style={{ color: "#6b7280" }}>{idx + 1}</span>
                  <div className="pout-cell pout-cell--party">
                    <div className="pout-party-avatar" style={{ background: pal.bg, color: pal.fg }}>
                      {row.partyName[0].toUpperCase()}
                    </div>
                    <span>{row.partyName}</span>
                  </div>
                  <span className="pout-cell pout-cell--right">Rs {fmt(row.total)}</span>
                  <span className="pout-cell pout-cell--right">Rs {fmt(row.total - row.balance)}</span>
                  <span className="pout-cell">{pt}</span>
                  <span className={isUsed ? "pout-status-used" : "pout-status-unused"}>
                    {isUsed ? "Used" : "Unused"}
                  </span>
                  <div className="pout-actions">
                    <button type="button" className="pout-action-btn" title="Print" onClick={() => window.print()}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    </button>
                    <button type="button" className="pout-action-btn" title="Share">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                    <button type="button" className="pout-action-btn" title="More">⋯</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <StandalonePaymentOutModal
          allParties={parties}
          receiptNum={rows.length + 1}
          onClose={() => setShowAdd(false)}
          onSaved={async () => { setShowAdd(false); await load(); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STANDALONE PAYMENT-OUT MODAL  (party selector, no purchase)
═══════════════════════════════════════════════════════════ */
function StandalonePaymentOutModal({
  allParties, receiptNum, onClose, onSaved,
}: {
  allParties: Party[];
  receiptNum: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [partySearch,     setPartySearch]     = useState("");
  const [showPartyDrop,   setShowPartyDrop]   = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [paymentType,     setPaymentType]     = useState("Cash");
  const [showPayTypeDrop, setShowPayTypeDrop] = useState(false);
  const [receiptNo,       setReceiptNo]       = useState(String(receiptNum));
  const [date,            setDate]            = useState(today());
  const [paidAmount,      setPaidAmount]      = useState("");
  const [linkedTxns,      setLinkedTxns]      = useState<Record<string, number>>({});
  const [partyTxns,       setPartyTxns]       = useState<Transaction[]>([]);
  const [showLink,        setShowLink]        = useState(false);
  const [showHistory,     setShowHistory]     = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState("");

  const selectedParty   = allParties.find(p => p.id === selectedPartyId) ?? null;
  const filteredParties = partySearch
    ? allParties.filter(p => p.name.toLowerCase().includes(partySearch.toLowerCase()))
    : allParties;

  useEffect(() => {
    if (!selectedPartyId) return;
    api.getPartyTransactions(selectedPartyId).then(setPartyTxns).catch(() => {});
  }, [selectedPartyId]);

  const paidNum      = parseFloat(paidAmount) || 0;
  const totalLinked  = Object.values(linkedTxns).reduce((s, v) => s + v, 0);
  const unusedAmount = Math.max(0, paidNum - totalLinked);
  const hasLinked    = Object.keys(linkedTxns).length > 0;

  // Format date for display  (dd/mm/yyyy)
  const displayDate = date
    ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  async function save() {
    if (!selectedPartyId) { setError("Select a party."); return; }
    if (paidNum <= 0) { setError("Enter a payment amount."); return; }
    setSaving(true); setError("");
    try {
      await api.createTransaction({
        partyId: selectedPartyId,
        type: "payment_out",
        number: receiptNo,
        date: new Date(date).toISOString(),
        total: paidNum,
        balance: unusedAmount,
        notes: JSON.stringify({ paymentType, receiptNo }),
      });
      for (const [txnId, linked] of Object.entries(linkedTxns)) {
        const txn = partyTxns.find(t => t.id === txnId);
        if (!txn || linked <= 0) continue;
        await api.updateTransaction(txnId, { balance: Math.max(0, txn.balance - linked) });
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const PAYMENT_TYPES = ["Cash", "Bank Transfer", "UPI / JazzCash", "Cheque", "HBL", "UBL", "Meezan"];

  return (
    <div className="po-backdrop" onClick={onClose}>
      <div className="po-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="po-header">
          <span className="po-header__title">Payment-Out</span>
          <button type="button" className="po-header__icon-btn" title="Calculator">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
          </button>
          <button type="button" className="po-header__icon-btn" title="Settings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button type="button" className="po-header__icon-btn" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="po-body">

          {/* ── Left column ── */}
          <div className="po-left">

            {/* Party outlined field */}
            <div style={{ position: "relative" }}>
              <div style={{
                position: "relative", border: `1.5px solid ${selectedParty ? "#3b82f6" : "#9ca3af"}`,
                borderRadius: 6, padding: "10px 36px 10px 12px", background: "#fff", cursor: "text",
              }}
                onClick={() => setShowPartyDrop(true)}
              >
                <span style={{
                  position: "absolute", top: -9, left: 10, background: "#fff",
                  padding: "0 4px", fontSize: 12, color: selectedParty ? "#3b82f6" : "#6b7280", fontWeight: 500,
                }}>
                  Party *
                </span>
                <input
                  style={{
                    border: "none", outline: "none", width: "100%", fontSize: 14,
                    fontFamily: "inherit", color: "#111827", background: "transparent", padding: 0,
                  }}
                  placeholder=""
                  value={selectedParty ? selectedParty.name : partySearch}
                  onChange={e => {
                    setPartySearch(e.target.value);
                    setShowPartyDrop(true);
                    if (selectedParty) setSelectedPartyId(null);
                  }}
                  onFocus={() => setShowPartyDrop(true)}
                  onBlur={() => setTimeout(() => setShowPartyDrop(false), 160)}
                />
                <span style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  color: "#6b7280", pointerEvents: "none", fontSize: 12,
                }}>▾</span>
              </div>

              {/* Party dropdown */}
              {showPartyDrop && filteredParties.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
                  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.14)", maxHeight: 220, overflowY: "auto",
                }}>
                  {filteredParties.slice(0, 8).map(p => (
                    <button key={p.id} type="button" style={{
                      width: "100%", padding: "9px 14px", textAlign: "left", border: "none",
                      borderBottom: "1px solid #f3f4f6", background: "none", cursor: "pointer",
                      fontFamily: "inherit", fontSize: 14, display: "flex",
                      alignItems: "center", justifyContent: "space-between",
                    }}
                      onMouseDown={() => { setSelectedPartyId(p.id); setPartySearch(""); setShowPartyDrop(false); }}
                    >
                      <span style={{ fontWeight: 600, color: "#111827" }}>{p.name}</span>
                      {p.phone && <span style={{ fontSize: 12, color: "#9ca3af" }}>{p.phone}</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Balance badge */}
              {selectedParty && (
                <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 700, color: "#ef4444" }}>
                  BAL: {Math.abs(selectedParty.balance).toLocaleString()}
                </div>
              )}
            </div>

            {/* Payment Type outlined field */}
            <div style={{ position: "relative" }}>
              <div style={{
                position: "relative", border: "1.5px solid #9ca3af", borderRadius: 6,
                padding: "10px 36px 10px 12px", background: "#fff", cursor: "pointer",
              }}
                onClick={() => setShowPayTypeDrop(v => !v)}
              >
                <span style={{
                  position: "absolute", top: -9, left: 10, background: "#fff",
                  padding: "0 4px", fontSize: 12, color: "#6b7280", fontWeight: 500,
                }}>
                  Payment Type
                </span>
                <span style={{ fontSize: 14, color: "#111827" }}>{paymentType}</span>
                <span style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  color: "#6b7280", fontSize: 12,
                }}>▾</span>
              </div>
              {showPayTypeDrop && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
                  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                }}>
                  {PAYMENT_TYPES.map(t => (
                    <button key={t} type="button" style={{
                      width: "100%", padding: "9px 14px", textAlign: "left", border: "none",
                      borderBottom: "1px solid #f3f4f6", background: paymentType === t ? "#eff6ff" : "none",
                      cursor: "pointer", fontFamily: "inherit", fontSize: 14,
                      color: paymentType === t ? "#2563eb" : "#111827", fontWeight: paymentType === t ? 600 : 400,
                    }}
                      onMouseDown={() => { setPaymentType(t); setShowPayTypeDrop(false); }}
                    >{t}</button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" className="po-add-link">+ Add Payment type</button>

            <button type="button" className="po-desc-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
              ADD DESCRIPTION
            </button>

            <button type="button" className="po-img-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </button>
          </div>

          {/* ── Right column ── */}
          <div className="po-right">
            {/* Receipt No */}
            <div className="po-right__row">
              <span className="po-right__label">Receipt No</span>
              <input
                className="po-right__input"
                value={receiptNo}
                onChange={e => setReceiptNo(e.target.value)}
              />
            </div>

            {/* Date */}
            <div className="po-right__row" style={{ position: "relative" }}>
              <span className="po-right__label">Date</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
                <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{displayDate}</span>
                <label style={{ cursor: "pointer", color: "#6b7280" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                  />
                </label>
              </div>
            </div>

            <div className="po-right__spacer" />

            {/* Paid input */}
            <div className="po-paid-row">
              <span className="po-paid-label">Paid</span>
              <input
                className="po-paid-input"
                type="number"
                min="0"
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                placeholder=""
                autoFocus
              />
            </div>

            {/* Unused amount row */}
            {paidNum > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "2px solid #e5e7eb" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Unused</span>
                <span style={{ fontSize: 19, fontWeight: 800, color: "#3b82f6" }}>{fmt(unusedAmount)}</span>
              </div>
            )}

            {error && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="po-footer">
          {/* LINK PAYMENT — show whenever amount > 0 */}
          {paidNum > 0 && (
            <button
              type="button"
              className="po-link-btn"
              onClick={() => {
                if (!selectedPartyId) { setError("Select a party first."); return; }
                setShowLink(true);
              }}
            >
              LINK PAYMENT <span className="po-link-help">?</span>
            </button>
          )}

          {/* PAYMENT HISTORY — show after linking */}
          {hasLinked && (
            <button type="button" style={{
              padding: "9px 16px", background: "#fff", border: "1.5px solid #d1d5db",
              borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", color: "#374151", letterSpacing: "0.03em",
            }} onClick={() => setShowHistory(true)}>
              PAYMENT HISTORY
            </button>
          )}

          <div className="po-footer__spacer" />
          <div className="po-share-wrap">
            <button type="button" className="po-share-btn">Share</button>
            <button type="button" className="po-share-arrow">▼</button>
          </div>
          <button type="button" className="po-save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {showLink && selectedParty && (
        <LinkPaymentModal
          partyName={selectedParty.name}
          paidAmount={paidNum}
          partyTxns={partyTxns}
          initialLinked={linkedTxns}
          onDone={linked => { setLinkedTxns(linked); setShowLink(false); }}
          onClose={() => setShowLink(false)}
        />
      )}

      {showHistory && selectedParty && (
        <PaymentHistoryModal
          purchase={{ id: "", date: new Date().toISOString(), total: paidNum, balance: unusedAmount, partyName: selectedParty.name, partyId: selectedParty.id, tenantId: "", type: "payment_out", number: receiptNo, notes: null, createdAt: new Date().toISOString() }}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAYMENT HISTORY MODAL
═══════════════════════════════════════════════════════════ */
function PaymentHistoryModal({
  purchase, onClose,
}: {
  purchase: PurchaseRow;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<Transaction[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.getPartyTransactions(purchase.partyId)
      .then(txns => setPayments(txns.filter(t => t.type === "payment_out")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function refNo(notes: string | null) {
    if (!notes) return "–";
    const m = notes.match(/Receipt #(\S+)/);
    return m ? m[1] : "–";
  }

  const total = payments.reduce((s, p) => s + p.total, 0);

  return (
    <div className="ph-backdrop" onClick={onClose}>
      <div className="ph-modal" onClick={e => e.stopPropagation()}>

        <div className="ph-header">
          <span className="ph-header__title">Payment History</span>
          <button type="button" className="ph-header__close" onClick={onClose}>✕</button>
        </div>

        <div className="ph-body">
          {loading ? (
            <div className="ph-empty">Loading…</div>
          ) : payments.length === 0 ? (
            <div className="ph-empty">No payments recorded yet.</div>
          ) : (
            <>
              <div className="ph-table-head">
                <span>Transaction Date</span>
                <span>Ref No</span>
                <span>Transaction Type</span>
                <span style={{ textAlign: "right" }}>Linked Amount</span>
              </div>
              {payments.map(p => (
                <div key={p.id} className="ph-row">
                  <span className="ph-cell">{formatDate(p.date)}</span>
                  <span className="ph-cell">{refNo(p.notes)}</span>
                  <span className="ph-cell">Payment-Out</span>
                  <span className="ph-cell" style={{ textAlign: "right", fontWeight: 600 }}>{fmt(p.total)}</span>
                </div>
              ))}
              <div className="ph-total">Total: {fmt(total)}</div>
            </>
          )}
        </div>

        <div className="ph-footer">
          <button type="button" className="ph-close-btn" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAYMENT-OUT MODAL
═══════════════════════════════════════════════════════════ */
function PaymentOutModal({
  purchase, allParties, receiptNum, onClose, onSaved,
}: {
  purchase: PurchaseRow;
  allParties: Party[];
  receiptNum: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paymentType, setPaymentType] = useState("Cash");
  const [receiptNo,   setReceiptNo]   = useState(String(receiptNum));
  const [date,        setDate]        = useState(today());
  const [paidAmount,  setPaidAmount]  = useState(String(purchase.balance));
  const [linkedTxns,  setLinkedTxns]  = useState<Record<string, number>>({});
  const [partyTxns,   setPartyTxns]   = useState<Transaction[]>([]);
  const [showLink,    setShowLink]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const party = allParties.find(p => p.id === purchase.partyId);

  useEffect(() => {
    api.getPartyTransactions(purchase.partyId).then(setPartyTxns).catch(() => {});
  }, []);

  const paidNum     = parseFloat(paidAmount) || 0;
  const totalLinked = Object.values(linkedTxns).reduce((s, v) => s + v, 0);
  const balance     = Math.max(0, paidNum - totalLinked);

  async function save() {
    if (paidNum <= 0) { setError("Enter a payment amount."); return; }
    setSaving(true);
    setError("");
    try {
      await api.createTransaction({
        partyId: purchase.partyId,
        type: "payment_out",
        date: new Date(date).toISOString(),
        total: paidNum,
        balance: 0,
        notes: `Receipt #${receiptNo}`,
      });
      for (const [txnId, linked] of Object.entries(linkedTxns)) {
        const txn = partyTxns.find(t => t.id === txnId);
        if (!txn || linked <= 0) continue;
        await api.updateTransaction(txnId, { balance: Math.max(0, txn.balance - linked) });
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="po-backdrop" onClick={onClose}>
      <div className="po-modal" onClick={e => e.stopPropagation()}>

        <div className="po-header">
          <span className="po-header__title">Payment-Out</span>
          <button type="button" className="po-header__icon-btn" title="Calculator">⌨</button>
          <button type="button" className="po-header__icon-btn" title="Settings">⚙</button>
          <button type="button" className="po-header__icon-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="po-body">
          <div className="po-left">
            <div className="po-field-group">
              <span className="po-field-label">Party *</span>
              <div className="po-party-select">
                <span>{purchase.partyName}</span>
                <span style={{ color: "#9ca3af" }}>▾</span>
              </div>
              {party && (
                <span className="po-bal-badge">BAL: Rs {Math.abs(party.balance).toLocaleString()}</span>
              )}
            </div>

            <div className="po-field-group">
              <span className="po-field-label">Payment Type</span>
              <select className="po-payment-select" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                <option>Cash</option>
                <option>Credit</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Cheque</option>
              </select>
            </div>

            <button type="button" className="po-add-link">+ Add Payment type</button>

            <button type="button" className="po-desc-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
              ADD DESCRIPTION
            </button>
            <button type="button" className="po-img-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </button>
          </div>

          <div className="po-right">
            <div className="po-right__row">
              <span className="po-right__label">Receipt No</span>
              <input className="po-right__input" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} />
            </div>
            <div className="po-right__row">
              <span className="po-right__label">Date</span>
              <input type="date" className="po-right__input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="po-right__spacer" />
            <div className="po-paid-row">
              <span className="po-paid-label">Paid</span>
              <input className="po-paid-input" type="number" min="0"
                value={paidAmount} onChange={e => setPaidAmount(e.target.value)} autoFocus />
            </div>
            <div className="po-balance-row">
              <span className="po-balance-label">Balance</span>
              <span className="po-balance-val">{balance === 0 ? "0" : fmt(balance)}</span>
            </div>
            {error && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{error}</p>}
          </div>
        </div>

        <div className="po-footer">
          <button type="button" className="po-link-btn" onClick={() => setShowLink(true)}>
            LINK PAYMENT <span className="po-link-help">?</span>
          </button>
          <div className="po-footer__spacer" />
          <div className="po-share-wrap">
            <button type="button" className="po-share-btn">Share</button>
            <button type="button" className="po-share-arrow">▼</button>
          </div>
          <button type="button" className="po-save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {showLink && (
        <LinkPaymentModal
          partyName={purchase.partyName}
          paidAmount={paidNum}
          partyTxns={partyTxns}
          initialLinked={linkedTxns}
          onDone={linked => { setLinkedTxns(linked); setShowLink(false); }}
          onClose={() => setShowLink(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LINK PAYMENT TO TXNS MODAL
═══════════════════════════════════════════════════════════ */
function LinkPaymentModal({
  partyName, paidAmount, partyTxns, initialLinked, onDone, onClose,
}: {
  partyName: string;
  paidAmount: number;
  partyTxns: Transaction[];
  initialLinked: Record<string, number>;
  onDone: (linked: Record<string, number>) => void;
  onClose: () => void;
}) {
  const [linked,     setLinked]     = useState<Record<string, number>>({ ...initialLinked });
  const [typeFilter, setTypeFilter] = useState("All transactions");
  const [search,     setSearch]     = useState("");

  const totalLinked  = Object.values(linked).reduce((s, v) => s + v, 0);
  const unusedAmount = Math.max(0, paidAmount - totalLinked);

  const filtered = partyTxns.filter(t => {
    if (typeFilter === "Purchase"    && t.type !== "purchase")    return false;
    if (typeFilter === "Payment In"  && t.type !== "payment_in")  return false;
    if (typeFilter === "Payment Out" && t.type !== "payment_out") return false;
    if (search) {
      const q = search.toLowerCase();
      return (t.number ?? "").includes(q) || t.type.includes(q);
    }
    return true;
  });

  function toggle(txn: Transaction) {
    setLinked(prev => {
      if (prev[txn.id] !== undefined) {
        const next = { ...prev };
        delete next[txn.id];
        return next;
      }
      const used = Object.values(prev).reduce((s, v) => s + v, 0);
      const remaining = paidAmount - used;
      const amount = Math.min(txn.balance, remaining);
      if (amount <= 0) return prev;
      return { ...prev, [txn.id]: amount };
    });
  }

  function autoLink() {
    const result: Record<string, number> = {};
    let remaining = paidAmount;
    const unpaid = partyTxns
      .filter(t => t.balance > 0 && t.type === "purchase")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const t of unpaid) {
      if (remaining <= 0) break;
      const amt = Math.min(t.balance, remaining);
      result[t.id] = amt;
      remaining -= amt;
    }
    setLinked(result);
  }

  const typeLabel = (t: string) =>
    t === "payment_in"  ? "Payment-In"  :
    t === "payment_out" ? "Payment-Out" :
    t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");

  return (
    <div className="lp-backdrop" onClick={e => e.stopPropagation()}>
      <div className="lp-modal">

        <div className="lp-header">
          <span className="lp-header__title">Link Payment to Txns</span>
          <button type="button" className="lp-header__close" onClick={onClose}>✕</button>
        </div>

        <div className="lp-meta">
          <div className="lp-meta__group">
            <span className="lp-meta__label">Party</span>
            <span className="lp-meta__val">{partyName}</span>
          </div>
          <div className="lp-meta__group">
            <span className="lp-meta__label">Paid Amount</span>
            <span className="lp-meta__val">{fmt(paidAmount)}</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="lp-auto-btn" onClick={autoLink}>AUTO LINK</button>
            <button type="button" className="lp-help-btn">?</button>
            <button type="button" className="lp-reset-btn" onClick={() => setLinked({})}>RESET</button>
          </div>
        </div>

        <div className="lp-filter">
          <select className="lp-filter__select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option>All transactions</option>
            <option>Purchase</option>
            <option>Payment In</option>
            <option>Payment Out</option>
          </select>
          <input className="lp-filter__search" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="lp-table">
          <div className="lp-table-head">
            <span />
            <span>Date</span>
            <span>Type</span>
            <span>Ref/Inv No.</span>
            <span style={{ textAlign: "right" }}>Total</span>
            <span style={{ textAlign: "right" }}>Balance</span>
            <span style={{ textAlign: "right" }}>Linked Amount</span>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No transactions</div>
          ) : filtered.map(t => {
            const isChecked = linked[t.id] !== undefined;
            return (
              <div key={t.id} className={`lp-row${isChecked ? " lp-row--checked" : ""}`}>
                <input type="checkbox" className="lp-checkbox" checked={isChecked} onChange={() => toggle(t)} />
                <span className="lp-cell">{formatDate(t.date)}</span>
                <span className="lp-cell">{typeLabel(t.type)}</span>
                <span className="lp-cell" style={{ color: "#6b7280" }}>{t.number ?? "–"}</span>
                <span className="lp-cell" style={{ textAlign: "right" }}>{fmt(t.total)}</span>
                <span className="lp-cell" style={{ textAlign: "right", color: t.balance > 0 ? "#ef4444" : "#16a34a" }}>{fmt(t.balance)}</span>
                <span className="lp-cell" style={{ textAlign: "right", fontWeight: 600, color: "#3b82f6" }}>
                  {isChecked ? fmt(linked[t.id]) : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="lp-footer">
          <span className="lp-unused">Unused Amount : <strong>{unusedAmount === 0 ? "0" : fmt(unusedAmount)}</strong></span>
          <div className="lp-footer__spacer" />
          <button type="button" className="lp-cancel-btn" onClick={onClose}>CANCEL</button>
          <button type="button" className="lp-done-btn" onClick={() => onDone(linked)}>DONE</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DEBIT NOTE FORM  — "Convert To Return" from a purchase
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   PURCHASE RETURN / DR. NOTE  SUB-SCREEN
═══════════════════════════════════════════════════════════ */
function PurchaseReturnSubScreen({ isLocked, onLockedAction }: { isLocked?: boolean; onLockedAction?: () => void }) {
  const [rows,    setRows]    = useState<PurchaseRow[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState<"all" | "paid" | "unpaid">("all");

  async function load() {
    try {
      const [ps, txns] = await Promise.all([api.getParties(), api.getTransactionsByType("debit_note")]);
      setParties(ps);
      const map: Record<string, string> = {};
      ps.forEach(p => { map[p.id] = p.name; });
      setRows(txns.map(t => ({ ...t, partyName: map[t.partyId] ?? "Unknown" })));
    } catch { /* offline */ }
  }

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  const now = new Date();
  const fmtDMY = (d: Date) =>
    `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const startDateStr = fmtDMY(new Date(now.getFullYear(), now.getMonth(), 1));
  const endDateStr   = fmtDMY(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const filtered = rows.filter(r => {
    if (filter === "paid"   && r.balance > 0)  return false;
    if (filter === "unpaid" && r.balance === 0) return false;
    if (search && !r.partyName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalAmount  = filtered.reduce((s, r) => s + r.total, 0);
  const totalBalance = filtered.reduce((s, r) => s + r.balance, 0);

  function handleAdd() {
    if (isLocked) { onLockedAction?.(); return; }
    setShowForm(true);
  }

  if (showForm) {
    return (
      <DebitNoteForm
        returnNum={rows.length + 1}
        onClose={() => setShowForm(false)}
        onSaved={async () => { setShowForm(false); await load(); }}
      />
    );
  }

  return (
    <div className="dr-root">
      {/* Date bar */}
      <div className="purchase-datebar">
        <button type="button" className="purchase-datebar__period">This Month <span>▾</span></button>
        <div className="purchase-datebar__range">
          <button type="button" className="purchase-datebar__between-btn">Between</button>
          <span className="purchase-datebar__date-val">{startDateStr}</span>
          <span className="purchase-datebar__to">To</span>
          <span className="purchase-datebar__date-val">{endDateStr}</span>
        </div>
        <button type="button" className="purchase-datebar__chip">ALL FIRMS <span>▾</span></button>
        <button type="button" className="purchase-datebar__chip">ALL USERS <span>▾</span></button>
        <div className="purchase-datebar__spacer" />
        <button type="button" className="purchase-datebar__icon-btn" title="Excel Report">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </button>
        <button type="button" className="purchase-datebar__icon-btn" title="Print">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        </button>
      </div>

      {/* Filter dropdowns + search + add button */}
      <div className="dr-filterbar">
        <select className="dr-filter-select">
          <option>Debit Note</option>
          <option>All Types</option>
        </select>
        <select className="dr-filter-select">
          <option>All Payment</option>
          <option>Cash</option>
          <option>Credit</option>
        </select>
        <div className="dr-filterbar__spacer" />
        <div className="dr-search-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="dr-search" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button type="button" className="dr-add-btn" onClick={handleAdd}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          Add Debit Note
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="purchase-loading">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="purchase-empty">
          <div className="purchase-empty__illustration"><div className="purchase-empty__circle"><span>🔄</span></div></div>
          <p className="purchase-empty__title">No Purchase Returns to show</p>
          <p className="purchase-empty__sub">Nothing recorded here yet.</p>
          <button type="button" className="purchase-empty__btn" onClick={handleAdd}>+ Add Debit Note</button>
        </div>
      ) : (
        <div className="dr-table-wrap">
          <table className="dr-table">
            <thead>
              <tr className="dr-thead-row">
                <th className="dr-th dr-th--num">#</th>
                <th className="dr-th">DATE <span className="purchase-sort-icon">▾</span></th>
                <th className="dr-th">REF NO. <span className="purchase-sort-icon">▾</span></th>
                <th className="dr-th">PARTY NAME <span className="purchase-sort-icon">▾</span></th>
                <th className="dr-th">CATEGORY NAME <span className="purchase-sort-icon">▾</span></th>
                <th className="dr-th">TYPE <span className="purchase-sort-icon">▾</span></th>
                <th className="dr-th dr-th--num-right">TOTAL <span className="purchase-sort-icon">▾</span></th>
                <th className="dr-th dr-th--num-right">RECEIVED/PAID <span className="purchase-sort-icon">▾</span></th>
                <th className="dr-th dr-th--num-right">BALANCE <span className="purchase-sort-icon">▾</span></th>
                <th className="dr-th">STATUS <span className="purchase-sort-icon">▾</span></th>
                <th className="dr-th">PRINT / SHA.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>No results for "{search}"</td></tr>
              ) : filtered.map((row, idx) => {
                const isPaid    = row.balance === 0;
                const received  = row.total - row.balance;
                return (
                  <tr key={row.id} className="dr-row">
                    <td className="dr-td dr-td--num">{idx + 1}</td>
                    <td className="dr-td">{new Date(row.date).toLocaleDateString("en-GB").replace(/\//g, "/")}</td>
                    <td className="dr-td" style={{ color: "#6b7280" }}>{row.number ?? idx + 1}</td>
                    <td className="dr-td dr-td--party">{row.partyName}</td>
                    <td className="dr-td" style={{ color: "#9ca3af" }}>—</td>
                    <td className="dr-td" style={{ color: "#374151" }}>Debit Note</td>
                    <td className="dr-td dr-td--right">Rs {row.total.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                    <td className="dr-td dr-td--right">Rs {received.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                    <td className="dr-td dr-td--right">Rs {row.balance.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                    <td className="dr-td">
                      <span style={{ color: isPaid ? "#16a34a" : "#dc2626", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>
                        {isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                    <td className="dr-td dr-td--actions">
                      <button type="button" className="purchase-row__icon-btn" title="Print" onClick={() => window.print()}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                      <button type="button" className="purchase-row__icon-btn" title="Share">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom totals bar */}
      {rows.length > 0 && (
        <div className="dr-total-bar">
          <span className="dr-total-bar__item">
            Total Amount: <strong style={{ color: "#ef4444" }}>Rs {totalAmount.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</strong>
          </span>
          <div className="dr-total-bar__spacer" />
          <span className="dr-total-bar__item">
            Balance: <strong>Rs {totalBalance.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

function DebitNoteForm({
  purchase, allParties, returnNum, onClose, onSaved,
}: {
  purchase?: PurchaseRow;
  allParties?: Party[];
  returnNum: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [supplier,      setSupplier]      = useState(purchase?.partyName ?? "");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const [billNumber,    setBillNumber]    = useState("");
  const [billDate,      setBillDate]      = useState(purchase?.date?.slice(0, 10) ?? "");
  const [date,          setDate]          = useState(today());
  const [lineItems,     setLineItems]     = useState<LineItem[]>(() => {
    if (purchase?.notes) {
      try {
        const parsed = JSON.parse(purchase.notes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((i: { name?: string; mrp?: number; qty?: number; unit?: string; rate?: number }) => ({
            id: Date.now().toString() + Math.random(),
            name: i.name ?? "", mrp: i.mrp ?? 0, qty: i.qty ?? 0,
            unit: i.unit ?? "NONE", rate: i.rate ?? 0,
          }));
        }
      } catch { /* ignore */ }
    }
    return [emptyRow(), emptyRow()];
  });
  const [discountPct,  setDiscountPct]  = useState("");
  const [discountRs,   setDiscountRs]   = useState("");
  const [roundOff,     setRoundOff]     = useState(false);
  const [showReceived, setShowReceived] = useState(false);
  const [received,     setReceived]     = useState("");
  const [paymentType,  setPaymentType]  = useState("Cash");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const [showClose,    setShowClose]    = useState(false);
  const [showLink,     setShowLink]     = useState(false);

  const [parties,  setParties]  = useState<Party[]>(allParties ?? []);
  const [catalog,  setCatalog]  = useState<Item[]>([]);
  const [partyTxns, setPartyTxns] = useState<Transaction[]>([]);
  const [linkedTxns, setLinkedTxns] = useState<Record<string, number>>({});

  const [activeItemRow, setActiveItemRow] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const dropRef      = useRef<HTMLDivElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getParties().then(ps => {
      setParties(ps);
      if (purchase?.partyId) {
        const p = ps.find(x => x.id === purchase.partyId);
        if (p?.phone) setSupplierPhone(p.phone);
      }
    }).catch(() => {});
    api.getItems().then(setCatalog).catch(() => {});
    if (purchase?.partyId) {
      api.getPartyTransactions(purchase.partyId).then(setPartyTxns).catch(() => {});
    }
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowPartyDrop(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedParty   = parties.find(p => p.name === supplier);
  const filteredParties = parties
    .filter(p => p.partyType === "supplier" || p.partyType === "both" || p.isSystem)
    .filter(p => !supplier || p.name.toLowerCase().includes(supplier.toLowerCase()));

  function catalogFor(search: string) {
    if (!search.trim()) return catalog;
    const q = search.toLowerCase();
    return catalog.filter(c => c.name.toLowerCase().includes(q) || (c.sku ?? "").toLowerCase().includes(q));
  }

  function openItemDrop(itemId: string, inputEl: HTMLElement) {
    const rowEl = inputEl.closest("tr");
    if (!rowEl || !tableWrapRef.current) return;
    const rowRect  = rowEl.getBoundingClientRect();
    const wrapRect = tableWrapRef.current.getBoundingClientRect();
    setActiveItemRow(itemId);
    setDropPos({ top: rowRect.bottom, left: wrapRect.left, width: wrapRect.width });
  }

  function closeItemDrop(itemId: string) {
    setTimeout(() => {
      setActiveItemRow(cur => { if (cur === itemId) { setDropPos(null); return null; } return cur; });
    }, 160);
  }

  const validItems  = lineItems.filter(i => i.name.trim() && i.qty > 0);
  const subtotal    = validItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const totalQty    = validItems.reduce((s, i) => s + i.qty, 0);
  const discountAmt = discountPct ? (subtotal * parseFloat(discountPct)) / 100 : parseFloat(discountRs) || 0;
  const afterDiscount = subtotal - discountAmt;
  const roundOffAmt   = roundOff ? Math.round(afterDiscount) - afterDiscount : 0;
  const total         = afterDiscount + roundOffAmt;
  const receivedAmt   = showReceived ? parseFloat(received) || 0 : 0;
  const balance       = Math.max(0, total - receivedAmt);

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }
  function addRow() { setLineItems(prev => [...prev, emptyRow()]); }
  function removeItem(id: string) { setLineItems(prev => prev.filter(i => i.id !== id)); }

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
    if (!selectedParty) { setError("Select a party."); return; }
    if (validItems.length === 0) { setError("Add at least one item."); return; }
    setSaving(true);
    const notesJson = JSON.stringify(validItems.map(i => ({ name: i.name, qty: i.qty, unit: i.unit, rate: i.rate, mrp: i.mrp })));
    try {
      await api.createTransaction({
        partyId: selectedParty.id,
        type: "debit_note",
        date: new Date(date).toISOString(),
        total, balance, notes: notesJson,
        number: billNumber || undefined,
      });
      for (const [txnId, linked] of Object.entries(linkedTxns)) {
        const txn = partyTxns.find(t => t.id === txnId);
        if (!txn || linked <= 0) continue;
        await api.updateTransaction(txnId, { balance: Math.max(0, txn.balance - linked) });
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nsf-root">

      {/* Tab bar */}
      <div className="nsf-tabbar">
        <div className="nsf-tab">
          <span className="nsf-tab__label">Debit Note #{returnNum}</span>
          <button type="button" className="nsf-tab__close" onClick={() => setShowClose(true)}>✕</button>
        </div>
        <button type="button" className="nsf-tab__add">+</button>
        <div className="nsf-tabbar__spacer" />
        <div className="nsf-tabbar__support">
          <span className="nsf-support-icon">💬</span>
          <span>WhatsApp Chat Support</span>
          <span className="nsf-support-divider">|</span>
          <span className="nsf-support-link">Get Instant Online Support</span>
        </div>
        <div className="nsf-tabbar__icons">
          <button type="button" className="nsf-icon-btn" title="Calculator">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
          </button>
          <button type="button" className="nsf-icon-btn" title="Settings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button type="button" className="nsf-icon-btn nsf-icon-btn--close" onClick={() => setShowClose(true)} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="nsf-header">
        <span className="nsf-header__title">Debit Note</span>
      </div>

      {/* Body */}
      <div className="nsf-body">

        {/* Party + meta */}
        <div className="nsf-top-row">
          <div className="nsf-customer-area" ref={dropRef}>

            {/* Party * — uses nsf-customer-field (always blue border) */}
            <div className="nsf-customer-field">
              <span className="nsf-customer-lbl">Party *</span>
              <div className="nsf-customer-input-wrap">
                <input
                  className="nsf-customer-input"
                  placeholder=""
                  value={supplier}
                  onChange={e => { setSupplier(e.target.value); setShowPartyDrop(true); setSupplierPhone(""); }}
                  onFocus={() => setShowPartyDrop(true)}
                  autoComplete="off"
                />
                <span className="nsf-customer-arrow">▾</span>
              </div>
              {selectedParty && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginTop: 3, display: "block" }}>
                  BAL: {Math.abs(selectedParty.balance).toLocaleString()}
                </span>
              )}
              {showPartyDrop && filteredParties.length > 0 && (
                <div className="nsf-party-drop">
                  <div className="nsf-party-drop__header-row">
                    <span /><span className="nsf-party-drop__bal-hdr">Party Balance</span>
                  </div>
                  {filteredParties.slice(0, 10).map(p => (
                    <button key={p.id} type="button" className="nsf-party-drop__row"
                      onMouseDown={() => { setSupplier(p.name); setSupplierPhone(p.phone || ""); setShowPartyDrop(false); }}>
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
              value={supplierPhone}
              onChange={e => setSupplierPhone(e.target.value)}
            />
          </div>

          {/* Right meta — Return No, Bill Number, Bill Date, Date */}
          <div className="nsf-invoice-meta">
            <div className="nsf-invoice-meta__row">
              <span className="nsf-invoice-meta__lbl">Return No.</span>
              <span className="nsf-invoice-meta__val">{returnNum}</span>
            </div>
            <div className="nsf-invoice-meta__row">
              <span className="nsf-invoice-meta__lbl">Bill Number</span>
              <input
                className="nsf-invoice-meta__input"
                placeholder=""
                value={billNumber}
                onChange={e => setBillNumber(e.target.value)}
              />
            </div>
            {/* Bill Date — text display + hidden date picker triggered by calendar icon */}
            <div className="nsf-invoice-meta__row">
              <span className="nsf-invoice-meta__lbl">Bill Date</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: billDate ? "#111827" : "#9ca3af", fontWeight: billDate ? 600 : 400 }}>
                  {billDate
                    ? new Date(billDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "/")
                    : "DD/MM/YYYY"}
                </span>
                <label style={{ cursor: "pointer", position: "relative" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
                    style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                </label>
              </div>
            </div>
            {/* Date — formatted text display + hidden date picker */}
            <div className="nsf-invoice-meta__row">
              <span className="nsf-invoice-meta__lbl">Date</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>
                  {new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "/")}
                </span>
                <label style={{ cursor: "pointer", position: "relative" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="nsf-table-wrap" ref={tableWrapRef}>
          <table className="nsf-table">
            <thead>
              <tr>
                <th className="nsf-th nsf-th--num">#</th>
                <th className="nsf-th nsf-th--name">ITEM</th>
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
                      <button type="button" className="nsf-del-row-btn" onClick={() => removeItem(item.id)}>✕</button>
                    </div>
                  </td>
                  <td className="nsf-td nsf-td--name">
                    <input className="nsf-cell-input nsf-cell-input--name" value={item.name} placeholder="Search item…"
                      onChange={e => { updateItem(item.id, "name", e.target.value); openItemDrop(item.id, e.currentTarget); }}
                      onFocus={e => openItemDrop(item.id, e.currentTarget)}
                      onBlur={() => closeItemDrop(item.id)} />
                  </td>
                  <td className="nsf-td">
                    <input className="nsf-cell-input" type="number" min="0" value={item.mrp || ""} placeholder="0"
                      onChange={e => updateItem(item.id, "mrp", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="nsf-td">
                    <input className="nsf-cell-input" type="number" min="0" value={item.qty || ""} placeholder="0"
                      onChange={e => updateItem(item.id, "qty", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="nsf-td">
                    <select className="nsf-cell-select" value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="nsf-td">
                    <input className="nsf-cell-input" type="number" min="0" value={item.rate || ""} placeholder="0"
                      onChange={e => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="nsf-td nsf-td--amt">
                    {item.qty && item.rate ? fmt(item.qty * item.rate) : ""}
                  </td>
                </tr>
              ))}
              <tr className="nsf-tr-add-row">
                <td className="nsf-td nsf-td--num" />
                <td className="nsf-td" colSpan={6}>
                  <button type="button" className="nsf-add-item-row-btn" onClick={addRow}>
                    <span className="nsf-add-item-row-icon">+</span> ADD ROW
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="nsf-total-row">
                <td className="nsf-total-lbl" colSpan={2}>TOTAL</td>
                <td /><td className="nsf-total-qty">{totalQty > 0 ? totalQty : "0"}</td>
                <td /><td />
                <td className="nsf-total-amt">{fmt(subtotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Item catalog dropdown */}
        {activeItemRow && dropPos && (() => {
          const activeItem = lineItems.find(i => i.id === activeItemRow);
          if (!activeItem) return null;
          return (
            <div className="nsf-item-drop"
              style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 400 }}>
              <div className="nsf-item-drop__hdr">
                <span className="nsf-item-drop__hdr-name">ITEM NAME</span>
                <span className="nsf-item-drop__hdr-col">SALE PRICE</span>
                <span className="nsf-item-drop__hdr-col">PURCHASE PRICE</span>
                <span className="nsf-item-drop__hdr-col nsf-item-drop__hdr-col--stock">STOCK</span>
                <span className="nsf-item-drop__hdr-col">LOCATION</span>
              </div>
              {catalogFor(activeItem.name).slice(0, 12).map(c => (
                <button key={c.id} type="button" className="nsf-item-drop__row"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    updateItem(activeItemRow, "name", c.name);
                    updateItem(activeItemRow, "mrp", c.salePrice ?? 0);
                    updateItem(activeItemRow, "rate", c.purchasePrice ?? c.salePrice ?? 0);
                    updateItem(activeItemRow, "unit", c.unit || "NONE");
                    updateItem(activeItemRow, "qty", 1);
                    setActiveItemRow(null); setDropPos(null);
                  }}>
                  <span className="nsf-item-drop__item-name">{c.name}</span>
                  <span className="nsf-item-drop__col">{fmt(c.salePrice ?? 0)}</span>
                  <span className="nsf-item-drop__col">{c.purchasePrice != null ? fmt(c.purchasePrice) : "–"}</span>
                  <span className={`nsf-item-drop__col nsf-item-drop__col--stock${(c.openingStock ?? 0) > 0 ? " nsf-item-drop__col--pos" : ""}`}>{c.openingStock ?? 0}</span>
                  <span className="nsf-item-drop__col nsf-item-drop__col--loc">–</span>
                </button>
              ))}
              {catalogFor(activeItem.name).length === 0 && <p className="nsf-item-drop__empty">No items found</p>}
            </div>
          );
        })()}

        {/* Bottom section */}
        <div className="nsf-bottom-section">
          <div className="nsf-bottom-left">
            <div className="nsf-payment-field">
              <span className="nsf-payment-lbl">Payment Type</span>
              <select className="nsf-payment-select" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                <option>Cash</option><option>Credit</option><option>UPI</option>
                <option>Bank Transfer</option><option>Cheque</option>
              </select>
            </div>
            <button type="button" className="nsf-add-payment-btn">+ Add Payment type</button>
            <div className="nsf-add-btns">
              <button type="button" className="nsf-add-btn">
                <span className="nsf-add-btn__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                </span>ADD DESCRIPTION
              </button>
              <button type="button" className="nsf-add-btn">
                <span className="nsf-add-btn__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </span>ADD IMAGE
              </button>
            </div>
          </div>

          <div className="nsf-totals-area">
            <div className="nsf-totals-row">
              <span className="nsf-totals-lbl">Discount</span>
              <div className="nsf-discount-controls">
                <input className="nsf-tiny-input" type="number" min="0" placeholder="0" value={discountPct} onChange={e => handleDiscountPct(e.target.value)} />
                <span className="nsf-tiny-unit">%</span>
                <span className="nsf-tiny-sep">—</span>
                <span className="nsf-tiny-unit">Rs</span>
                <input className="nsf-tiny-input" type="number" min="0" placeholder="0.00" value={discountRs} onChange={e => handleDiscountRs(e.target.value)} />
              </div>
            </div>
            <div className="nsf-totals-row">
              <span className="nsf-totals-lbl">Tax</span>
              <div className="nsf-discount-controls">
                <select className="nsf-tiny-select"><option>NONE</option><option>5%</option><option>10%</option><option>17%</option></select>
                <span className="nsf-tax-val">0</span>
              </div>
            </div>
            <div className="nsf-totals-row nsf-totals-row--rt">
              <label className="nsf-check-label">
                <input type="checkbox" className="nsf-roundoff-cb" checked={roundOff} onChange={e => setRoundOff(e.target.checked)} />
                <span>Round Off</span>
              </label>
              <input className="nsf-tiny-input nsf-tiny-input--ro" type="number" value={roundOff ? roundOffAmt.toFixed(2) : "0"} readOnly />
              <span className="nsf-totals-lbl nsf-totals-lbl--total">Total</span>
              <input className="nsf-tiny-input nsf-tiny-input--total" type="text" value={fmt(total)} readOnly />
            </div>
            <div className="nsf-totals-row nsf-totals-row--rt">
              <label className="nsf-check-label">
                <input type="checkbox" className="nsf-roundoff-cb" checked={showReceived}
                  onChange={e => { setShowReceived(e.target.checked); if (e.target.checked) setReceived(total.toFixed(2)); else setReceived(""); }} />
                <span>Received</span>
              </label>
              <input className="nsf-tiny-input nsf-tiny-input--total" type="number" placeholder="0.00"
                value={received} disabled={!showReceived}
                onChange={e => setReceived(e.target.value)} style={{ marginLeft: "auto" }} />
            </div>
            <div className="nsf-totals-row nsf-totals-row--balance">
              <span className="nsf-balance-lbl">Balance</span>
              <span className="nsf-balance-val">{fmt(balance)}</span>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="nsf-error">{error}</p>}

      {/* Action bar */}
      <div className="nsf-actionbar">
        <button type="button" className="po-link-btn" onClick={() => setShowLink(true)}>
          LINK PAYMENT <span className="po-link-help">?</span>
        </button>
        <div className="nsf-actionbar__right">
          <div className="nsf-share-wrap">
            <button type="button" className="nsf-share-btn">Share</button>
            <button type="button" className="nsf-share-arrow">▼</button>
          </div>
          <button type="button" className="nsf-save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Close confirm */}
      {showClose && (
        <div className="nsf-dialog-overlay">
          <div className="nsf-dialog">
            <div className="nsf-dialog__header">
              <span className="nsf-dialog__title">Close Debit Note</span>
              <button type="button" className="nsf-dialog__x" onClick={() => setShowClose(false)}>✕</button>
            </div>
            <p className="nsf-dialog__body">Current changes will be discarded. Do you wish to continue?</p>
            <div className="nsf-dialog__footer">
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--cancel" onClick={() => setShowClose(false)}>Cancel</button>
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--ok" onClick={onClose}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Link Payment modal */}
      {showLink && (
        <LinkPaymentModal
          partyName={purchase?.partyName ?? supplier}
          paidAmount={total}
          partyTxns={partyTxns}
          initialLinked={linkedTxns}
          onDone={linked => { setLinkedTxns(linked); setShowLink(false); }}
          onClose={() => setShowLink(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PURCHASE PREVIEW MODAL
═══════════════════════════════════════════════════════════ */
function numToWords(n: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if (n === 0) return "Zero";
  if (n < 0) return "Minus " + numToWords(-n);
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
  if (n < 1000) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + numToWords(n%100) : "");
  if (n < 100000) return numToWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + numToWords(n%1000) : "");
  if (n < 10000000) return numToWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + numToWords(n%100000) : "");
  return numToWords(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + numToWords(n%10000000) : "");
}

function amountInWords(total: number): string {
  const rupees = Math.floor(total);
  const paise  = Math.round((total - rupees) * 100);
  let w = numToWords(rupees) + " Rupees";
  if (paise > 0) w += " and " + numToWords(paise) + " Paise";
  return w + " only";
}

function PurchasePreviewModal({
  purchase, party, onClose,
}: {
  purchase: PurchaseRow;
  party: Party | null;
  onClose: () => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");

  useEffect(() => {
    api.getMe().then(u => { setCompanyName(u.name); }).catch(() => {});
  }, []);

  const items: { name: string; mrp: number; qty: number; unit: string; rate: number }[] = (() => {
    if (!purchase.notes) return [];
    try { return JSON.parse(purchase.notes); } catch { return []; }
  })();

  const subtotal  = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const paid      = purchase.total - purchase.balance;
  const dateStr   = new Date(purchase.date).toLocaleDateString("en-PK", { day:"2-digit", month:"2-digit", year:"numeric" }).replace(/\//g, "-");

  function printPreview() {
    const el = document.getElementById("purchase-preview-content");
    if (!el) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<html><head><title>Purchase Bill</title><style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      h2 { margin: 0 0 2px; font-size: 20px; }
      .line { border-top: 1px solid #ccc; margin: 10px 0; }
      .bill-title { text-align: center; font-size: 20px; font-weight: 700; color: #1d4ed8; margin: 12px 0; }
      .two-col { display: flex; justify-content: space-between; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th { background: #1d4ed8; color: #fff; padding: 7px 10px; text-align: left; font-size: 13px; }
      td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
      .total-row td { font-weight: 700; }
      .summary { float: right; width: 280px; }
      .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
      .summary-row.bold { font-weight: 700; }
      .for-line { text-align: center; margin-top: 40px; font-size: 13px; color: #374151; }
    </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <div className="prev-backdrop" onClick={onClose}>
      <div className="prev-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="prev-header">
          <span className="prev-header__title">Preview</span>
          <button type="button" className="prev-header__close" onClick={onClose}>×</button>
        </div>

        {/* Content */}
        <div className="prev-body">
          <div id="purchase-preview-content">

            {/* Company header */}
            <div className="prev-company-row">
              <div>
                <div className="prev-company-name">{companyName || "—"}</div>
                {companyPhone && <div className="prev-company-phone">Phone no. : {companyPhone}</div>}
              </div>
            </div>
            <div className="prev-divider" />

            {/* Bill title */}
            <div className="prev-bill-title">Bill</div>

            {/* Bill From + Bill Details */}
            <div className="prev-meta-row">
              <div className="prev-bill-from">
                <div className="prev-section-label">Bill From</div>
                <div className="prev-party-name">{party?.name ?? purchase.partyName}</div>
                {party?.billingAddress && <div className="prev-party-line">{party.billingAddress}</div>}
                {party?.city && <div className="prev-party-line">{party.city}</div>}
                {party?.phone && <div className="prev-party-line">Contact No. : {party.phone}</div>}
              </div>
              <div className="prev-bill-details">
                <div className="prev-section-label">Bill Details</div>
                <div className="prev-party-line">Date : {dateStr}</div>
              </div>
            </div>

            {/* Items table */}
            <table className="prev-table">
              <thead>
                <tr className="prev-table-head">
                  <th>#</th>
                  <th>Item name</th>
                  <th style={{ textAlign: "right" }}>MRP</th>
                  <th style={{ textAlign: "right" }}>Quantity</th>
                  <th style={{ textAlign: "right" }}>Price/ Unit</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="prev-item-row">
                    <td>{idx + 1}</td>
                    <td>{item.name}</td>
                    <td style={{ textAlign: "right" }}>Rs {fmt(item.mrp ?? 0)}</td>
                    <td style={{ textAlign: "right" }}>{item.qty}</td>
                    <td style={{ textAlign: "right" }}>Rs {fmt(item.rate)}</td>
                    <td style={{ textAlign: "right" }}>Rs {fmt(item.qty * item.rate)}</td>
                  </tr>
                ))}
                <tr className="prev-total-row">
                  <td /><td><strong>Total</strong></td>
                  <td />
                  <td style={{ textAlign: "right" }}><strong>{items.reduce((s, i) => s + i.qty, 0)}</strong></td>
                  <td />
                  <td style={{ textAlign: "right" }}><strong>Rs {fmt(purchase.total)}</strong></td>
                </tr>
              </tbody>
            </table>

            {/* Bottom section */}
            <div className="prev-bottom">
              <div className="prev-bottom-left">
                <div className="prev-words-label">Bill Amount in Words:</div>
                <div className="prev-words">{amountInWords(purchase.total)}</div>
                <div className="prev-terms-label" style={{ marginTop: 12 }}>Terms and Conditions</div>
                <div className="prev-terms">Thanks for doing business with us!</div>
              </div>
              <div className="prev-summary">
                {[
                  { label: "Sub Total", val: subtotal },
                  { label: "Total",     val: purchase.total },
                  { label: "Paid",      val: paid },
                  { label: "Balance",   val: purchase.balance },
                ].map(({ label, val }) => (
                  <div key={label} className={`prev-summary-row${label === "Total" ? " prev-summary-row--bold" : ""}`}>
                    <span>{label}</span>
                    <span>Rs {fmt(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="prev-for-line">For : {companyName || "—"}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="prev-footer">
          <button type="button" className="prev-action-btn" onClick={printPreview}>Open PDF</button>
          <button type="button" className="prev-action-btn" onClick={printPreview}>Print</button>
          <button type="button" className="prev-action-btn">Save PDF</button>
          <button type="button" className="prev-action-btn">Email PDF</button>
          <button type="button" className="prev-action-btn prev-action-btn--close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SIMPLE TRANSACTION FORM  — for Payment-Out, Expense, Return
═══════════════════════════════════════════════════════════ */
function SimpleTransactionForm({
  txnType, title, allParties, txnNum, onClose, onSaved,
}: {
  txnType: TxnType;
  title: string;
  allParties: Party[];
  txnNum: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [party, setParty]     = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [amount, setAmount]   = useState("");
  const [date, setDate]       = useState(today());
  const [payType, setPayType] = useState("Cash");
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [showClose, setShowClose] = useState(false);

  const filteredParties = party
    ? allParties.filter(p => p.name.toLowerCase().includes(party.toLowerCase()))
    : allParties;

  const selectedParty = allParties.find(p => p.id === selectedPartyId) ?? null;
  const amt = parseFloat(amount) || 0;

  async function save(goNew = false) {
    setError("");
    if (!selectedPartyId) { setError("Select a party."); return; }
    if (amt <= 0) { setError("Enter a valid amount."); return; }
    setSaving(true);
    try {
      await api.createTransaction({
        partyId: selectedPartyId,
        type: txnType,
        number: String(txnNum),
        date: new Date(date).toISOString(),
        total: amt,
        balance: amt,
        notes: JSON.stringify({ paymentType: payType, description: notes }),
      });
      if (goNew) {
        setParty(""); setSelectedPartyId(null); setAmount(""); setNotes("");
      } else {
        onSaved();
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save. Check connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nsf-root">
      {/* Tab bar */}
      <div className="nsf-tabbar">
        <div className="nsf-tab">
          <span className="nsf-tab__label">{title} #{txnNum}</span>
          <button type="button" className="nsf-tab__close" onClick={() => setShowClose(true)}>✕</button>
        </div>
        <button type="button" className="nsf-tab__add">+</button>
        <div className="nsf-tabbar__spacer" />
        <div className="nsf-tabbar__support">
          <span className="nsf-support-icon">💬</span>
          <span>WhatsApp Chat Support</span>
          <span className="nsf-support-divider">|</span>
          <span className="nsf-support-link">Get Instant Online Support</span>
        </div>
        <div className="nsf-tabbar__icons">
          <button type="button" className="nsf-icon-btn nsf-icon-btn--close" onClick={() => setShowClose(true)} title="Close">✕</button>
        </div>
      </div>

      {/* Header */}
      <div className="nsf-header">
        <span className="nsf-header__title">{title}</span>
      </div>

      <div className="nsf-body">
        {/* Party */}
        <div className="nsf-section">
          <div className="nsf-party-row">
            <div className="nsf-party-field" style={{ position: "relative" }}>
              <label className="nsf-field-label">Party Name *</label>
              <input
                className="nsf-party-input"
                placeholder="Search or select party…"
                value={party}
                onChange={e => { setParty(e.target.value); setShowDrop(true); if (selectedParty && e.target.value !== selectedParty.name) setSelectedPartyId(null); }}
                onFocus={() => setShowDrop(true)}
                onBlur={() => setTimeout(() => setShowDrop(false), 160)}
              />
              {showDrop && filteredParties.length > 0 && (
                <div className="nsf-party-drop">
                  {filteredParties.slice(0, 8).map(p => (
                    <button key={p.id} type="button" className="nsf-party-drop__row"
                      onMouseDown={() => { setParty(p.name); setSelectedPartyId(p.id); setShowDrop(false); }}>
                      <span className="nsf-party-drop__name">{p.name}</span>
                      {p.phone && <span className="nsf-party-drop__phone">{p.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Amount + Date */}
        <div className="nsf-section">
          <table className="nsf-table nsf-table--simple">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount (Rs)</th>
                <th>Payment Type</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input type="date" className="nsf-cell-input" value={date} onChange={e => setDate(e.target.value)} /></td>
                <td><input type="number" className="nsf-cell-input" style={{ textAlign: "right" }} placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" /></td>
                <td>
                  <select className="nsf-cell-input" value={payType} onChange={e => setPayType(e.target.value)}>
                    {["Cash","Bank Transfer","Cheque","UBL","HBL","Meezan"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td><input className="nsf-cell-input" placeholder="Optional note…" value={notes} onChange={e => setNotes(e.target.value)} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="nsf-totals-wrap">
          <div className="nsf-totals-box">
            <div className="nsf-total-row nsf-total-row--grand">
              <span>Total Amount</span>
              <span>Rs {fmt(amt)}</span>
            </div>
          </div>
        </div>

        {error && <div className="nsf-error">{error}</div>}
      </div>

      {/* Footer */}
      <div className="nsf-footer">
        <button type="button" className="nsf-btn nsf-btn--cancel" onClick={() => setShowClose(true)}>Cancel</button>
        <div style={{ flex: 1 }} />
        <button type="button" className="nsf-btn nsf-btn--secondary" disabled={saving} onClick={() => save(true)}>Save &amp; New</button>
        <button type="button" className="nsf-btn nsf-btn--primary" disabled={saving} onClick={() => save(false)}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {showClose && (
        <div className="nsf-dialog-overlay">
          <div className="nsf-dialog">
            <div className="nsf-dialog__header">
              <span className="nsf-dialog__title">Discard changes?</span>
              <button type="button" className="nsf-dialog__x" onClick={() => setShowClose(false)}>✕</button>
            </div>
            <p className="nsf-dialog__body">Are you sure you want to close without saving?</p>
            <div className="nsf-dialog__footer">
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--cancel" onClick={() => setShowClose(false)}>Keep editing</button>
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--ok" onClick={onClose}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXPENSE  — sub-screen + form
═══════════════════════════════════════════════════════════ */
type ExpenseLineItem = { id: string; name: string; qty: number; rate: number };

const EXPENSE_CATEGORY_KEY = "vyapar_expense_categories";
const DEFAULT_EXPENSE_CATEGORIES = ["Petrol", "Rent", "Salary", "Tea", "Transport"];

function loadExpenseCategories(): string[] {
  try {
    const raw = localStorage.getItem(EXPENSE_CATEGORY_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* ignore */ }
  return DEFAULT_EXPENSE_CATEGORIES;
}
function saveExpenseCategories(cats: string[]) {
  try { localStorage.setItem(EXPENSE_CATEGORY_KEY, JSON.stringify(cats)); } catch { /* ignore */ }
}

function ExpenseSubScreen({ isLocked, onLockedAction }: { isLocked?: boolean; onLockedAction?: () => void }) {
  const [rows,    setRows]    = useState<PurchaseRow[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState<string[]>(loadExpenseCategories);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [catSearch, setCatSearch] = useState("");
  const [catTab, setCatTab] = useState<"CATEGORY" | "ITEMS">("CATEGORY");
  const [txnSearch, setTxnSearch] = useState("");

  const now = new Date();
  const fmtDMY = (d: Date) =>
    `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const startDateStr = fmtDMY(new Date(now.getFullYear(), now.getMonth(), 1));
  const endDateStr   = fmtDMY(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  async function load() {
    try {
      const [ps, txns] = await Promise.all([api.getParties(), api.getTransactionsByType("expense")]);
      setParties(ps);
      const map: Record<string, string> = {};
      ps.forEach(p => { map[p.id] = p.name; });
      setRows(txns.map(t => ({ ...t, partyName: map[t.partyId] ?? "—" })));
    } catch { /* offline */ }
  }

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, []);

  function getCategoryFromRow(row: PurchaseRow): string {
    try { return JSON.parse(row.notes ?? "{}").category ?? "Uncategorized"; } catch { return "Uncategorized"; }
  }
  function getPayTypeFromRow(row: PurchaseRow): string {
    try { return JSON.parse(row.notes ?? "{}").paymentType ?? "Cash"; } catch { return "Cash"; }
  }

  const categoryTotals: Record<string, number> = {};
  rows.forEach(r => {
    const cat = getCategoryFromRow(r);
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + r.total;
  });

  const filteredCats = categories.filter(c => c.toLowerCase().includes(catSearch.toLowerCase()));

  const txnRows = selectedCat
    ? rows.filter(r => getCategoryFromRow(r) === selectedCat)
    : rows;
  const filteredTxns = txnSearch
    ? txnRows.filter(r => r.partyName.toLowerCase().includes(txnSearch.toLowerCase()))
    : txnRows;

  const totalAmount  = filteredTxns.reduce((s, r) => s + r.total, 0);
  const totalBalance = filteredTxns.reduce((s, r) => s + r.balance, 0);

  function handleAdd() {
    if (isLocked) { onLockedAction?.(); return; }
    setShowForm(true);
  }

  function handleAddCategory() {
    const name = prompt("New expense category name:");
    if (!name?.trim()) return;
    const updated = [...categories, name.trim()];
    setCategories(updated);
    saveExpenseCategories(updated);
  }

  if (showForm) {
    return (
      <ExpenseForm
        expenseNum={rows.length + 1}
        categories={categories}
        allParties={parties}
        onAddCategory={(name) => {
          const updated = [...categories, name];
          setCategories(updated);
          saveExpenseCategories(updated);
        }}
        onClose={() => setShowForm(false)}
        onSaved={async () => { setShowForm(false); await load(); }}
      />
    );
  }

  return (
    <div className="exp-root">
      {/* Date bar */}
      <div className="purchase-datebar">
        <button type="button" className="purchase-datebar__period">This Month <span>▾</span></button>
        <div className="purchase-datebar__range">
          <button type="button" className="purchase-datebar__between-btn">Between</button>
          <span className="purchase-datebar__date-val">{startDateStr}</span>
          <span className="purchase-datebar__to">To</span>
          <span className="purchase-datebar__date-val">{endDateStr}</span>
        </div>
        <button type="button" className="purchase-datebar__chip">ALL FIRMS <span>▾</span></button>
        <button type="button" className="purchase-datebar__chip">ALL USERS <span>▾</span></button>
        <div className="purchase-datebar__spacer" />
        <button type="button" className="purchase-datebar__icon-btn" title="Excel">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </button>
        <button type="button" className="purchase-datebar__icon-btn" title="Print">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        </button>
      </div>

      <div className="exp-body">
        {/* Left panel: category list */}
        <div className="exp-left">
          <div className="exp-left-top">
            <div className="exp-left-search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="exp-left-search" placeholder="Search category…" value={catSearch} onChange={e => setCatSearch(e.target.value)} />
            </div>
            <button type="button" className="exp-add-btn" onClick={handleAdd}>
              + Add Expense
            </button>
          </div>

          <div className="exp-cat-list">
            {loading ? (
              <div className="exp-cat-loading">Loading…</div>
            ) : (
              <>
                <div
                  className={`exp-cat-row${selectedCat === null ? " exp-cat-row--active" : ""}`}
                  onClick={() => setSelectedCat(null)}>
                  <div className="exp-cat-row__info">
                    <span className="exp-cat-row__name">All Expenses</span>
                    <span className="exp-cat-row__amount">Rs {fmt(rows.reduce((s, r) => s + r.total, 0))}</span>
                  </div>
                </div>
                {filteredCats.map(cat => (
                  <div
                    key={cat}
                    className={`exp-cat-row${selectedCat === cat ? " exp-cat-row--active" : ""}`}
                    onClick={() => setSelectedCat(cat)}>
                    <div className="exp-cat-row__info">
                      <span className="exp-cat-row__name">{cat}</span>
                      <span className="exp-cat-row__amount">Rs {fmt(categoryTotals[cat] ?? 0)}</span>
                    </div>
                    <button type="button" className="exp-cat-row__menu" onClick={e => e.stopPropagation()}>⋮</button>
                  </div>
                ))}
                <button type="button" className="exp-add-cat-btn" onClick={handleAddCategory}>
                  <span style={{ fontSize: 15, marginRight: 4 }}>+</span> Add Expense Category
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right panel: transactions */}
        <div className="exp-right">
          {/* Tab pills + header */}
          <div className="exp-right-header">
            <div className="exp-tab-pills">
              <button
                type="button"
                className={`exp-tab-pill${catTab === "CATEGORY" ? " exp-tab-pill--active" : ""}`}
                onClick={() => setCatTab("CATEGORY")}>CATEGORY</button>
              <button
                type="button"
                className={`exp-tab-pill${catTab === "ITEMS" ? " exp-tab-pill--active" : ""}`}
                onClick={() => setCatTab("ITEMS")}>ITEMS</button>
            </div>
            <div className="exp-right-header__info">
              <div className="exp-right-header__title">{selectedCat ?? "All Expenses"}</div>
              <div className="exp-right-header__sub">Direct Expense</div>
            </div>
            <div className="exp-right-header__totals">
              <span className="exp-right-header__total-item">
                Total: <strong style={{ color: "#ef4444" }}>Rs {fmt(totalAmount)}</strong>
              </span>
              <span className="exp-right-header__total-sep">|</span>
              <span className="exp-right-header__total-item">
                Balance: <strong>Rs {fmt(totalBalance)}</strong>
              </span>
            </div>
          </div>

          {/* Search + column bar */}
          <div className="exp-right-filterbar">
            <div className="dr-search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="dr-search" placeholder="Search party…" value={txnSearch} onChange={e => setTxnSearch(e.target.value)} />
            </div>
            <div style={{ flex: 1 }} />
            <button type="button" className="purchase-filterbar__icon-btn" title="Export">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="purchase-loading">Loading…</div>
          ) : txnRows.length === 0 ? (
            <div className="purchase-empty">
              <div className="purchase-empty__illustration"><div className="purchase-empty__circle"><span>💰</span></div></div>
              <p className="purchase-empty__title">No Expenses recorded yet</p>
              <p className="purchase-empty__sub">Click Add Expense to get started.</p>
              <button type="button" className="purchase-empty__btn" onClick={handleAdd}>+ Add Expense</button>
            </div>
          ) : (
            <div className="exp-table-wrap">
              <table className="exp-table">
                <thead>
                  <tr className="exp-thead-row">
                    <th className="exp-th">DATE <span className="purchase-sort-icon">▾</span></th>
                    <th className="exp-th">EXP NO. <span className="purchase-sort-icon">▾</span></th>
                    <th className="exp-th">PARTY <span className="purchase-sort-icon">▾</span></th>
                    <th className="exp-th">PAYMENT TYPE <span className="purchase-sort-icon">▾</span></th>
                    <th className="exp-th exp-th--right">AMOUNT <span className="purchase-sort-icon">▾</span></th>
                    <th className="exp-th exp-th--right">BALANCE <span className="purchase-sort-icon">▾</span></th>
                    <th className="exp-th">STATUS <span className="purchase-sort-icon">▾</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTxns.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>No results</td></tr>
                  ) : filteredTxns.map((row, idx) => {
                    const isPaid = row.balance === 0;
                    return (
                      <tr key={row.id} className="exp-row">
                        <td className="exp-td">{new Date(row.date).toLocaleDateString("en-GB").replace(/\//g, "/")}</td>
                        <td className="exp-td" style={{ color: "#6b7280" }}>#{idx + 1}</td>
                        <td className="exp-td exp-td--party">{row.partyName}</td>
                        <td className="exp-td">{getPayTypeFromRow(row)}</td>
                        <td className="exp-td exp-td--right">Rs {fmt(row.total)}</td>
                        <td className="exp-td exp-td--right" style={{ color: row.balance > 0 ? "#ef4444" : "#16a34a" }}>Rs {fmt(row.balance)}</td>
                        <td className="exp-td">
                          <span style={{ color: isPaid ? "#16a34a" : "#dc2626", fontWeight: 500, fontSize: 13 }}>
                            {isPaid ? "Paid" : "Unpaid"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom totals bar */}
          {txnRows.length > 0 && (
            <div className="dr-total-bar">
              <span className="dr-total-bar__item">
                Total Amount: <strong style={{ color: "#ef4444" }}>Rs {fmt(totalAmount)}</strong>
              </span>
              <div className="dr-total-bar__spacer" />
              <span className="dr-total-bar__item">
                Balance: <strong>Rs {fmt(totalBalance)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Expense Form ─── */
function ExpenseForm({
  expenseNum, categories, allParties, onAddCategory, onClose, onSaved,
}: {
  expenseNum: number;
  categories: string[];
  allParties: Party[];
  onAddCategory: (name: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category,    setCategory]    = useState("");
  const [showCatDrop, setShowCatDrop] = useState(false);
  const [expNo,       setExpNo]       = useState(String(expenseNum));
  const [expDate,     setExpDate]     = useState(today());
  const [lineItems,   setLineItems]   = useState<ExpenseLineItem[]>([
    { id: "1", name: "", qty: 1, rate: 0 },
    { id: "2", name: "", qty: 1, rate: 0 },
  ]);
  const [activeItemRow, setActiveItemRow] = useState<string | null>(null);
  const [dropPos,       setDropPos]      = useState<{ top: number; left: number; width: number } | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [roundOff,    setRoundOff]    = useState(true);
  const [paidTo,      setPaidTo]      = useState("");
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [showClose, setShowClose] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const subtotal    = lineItems.reduce((s, i) => s + (i.qty * i.rate || 0), 0);
  const roundOffAmt = roundOff ? Math.round(subtotal) - subtotal : 0;
  const total       = subtotal + roundOffAmt;

  function updateItem(id: string, field: keyof ExpenseLineItem, value: string | number) {
    setLineItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }
  function addRow() {
    setLineItems(prev => [...prev, { id: Date.now().toString() + Math.random(), name: "", qty: 1, rate: 0 }]);
  }

  const filteredParties = paidTo
    ? allParties.filter(p => p.name.toLowerCase().includes(paidTo.toLowerCase()))
    : allParties;

  async function save() {
    setError("");
    if (!category) { setError("Select an expense category."); return; }
    if (total <= 0) { setError("Add at least one item with a price."); return; }
    setSaving(true);
    try {
      const partyId = selectedPartyId ?? allParties[0]?.id;
      if (!partyId) { setError("No parties available. Please add a party first."); setSaving(false); return; }
      await api.createTransaction({
        partyId,
        type: "expense",
        number: expNo,
        date: new Date(expDate).toISOString(),
        total,
        balance: total,
        notes: JSON.stringify({
          category,
          paymentType,
          items: lineItems.filter(i => i.name && i.rate > 0).map(i => ({ name: i.name, qty: i.qty, rate: i.rate })),
        }),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save. Check connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nsf-root">
      {/* Tab bar */}
      <div className="nsf-tabbar">
        <div className="nsf-tab">
          <span className="nsf-tab__label">Expense #{expenseNum}</span>
          <button type="button" className="nsf-tab__close" onClick={() => setShowClose(true)}>✕</button>
        </div>
        <button type="button" className="nsf-tab__add">+</button>
        <div className="nsf-tabbar__spacer" />
        <div className="nsf-tabbar__support">
          <span className="nsf-support-icon">💬</span>
          <span>WhatsApp Chat Support</span>
          <span className="nsf-support-divider">|</span>
          <span className="nsf-support-link">Get Instant Online Support</span>
        </div>
        <div className="nsf-tabbar__icons">
          <button type="button" className="nsf-tab-icon-btn" title="Calculator">🧮</button>
          <button type="button" className="nsf-tab-icon-btn" title="Settings">⚙️</button>
        </div>
      </div>

      {/* Form title bar */}
      <div className="nsf-form-titlebar">
        <span className="nsf-form-title">Expense</span>
      </div>

      <div className="nsf-form-body">
        {/* Top fields row */}
        <div className="nsf-top-fields">
          {/* Left: Expense Category + Paid To */}
          <div className="nsf-top-fields__left" style={{ flex: 1 }}>
            <div style={{ position: "relative" }}>
              <div
                className="nsf-customer-field"
                style={{ minWidth: 260, cursor: "pointer" }}
                onClick={() => setShowCatDrop(v => !v)}>
                <span style={{
                  position: "absolute", top: category ? 2 : "50%",
                  transform: category ? "none" : "translateY(-50%)",
                  left: 12, fontSize: category ? 11 : 14,
                  color: "#3b82f6", pointerEvents: "none", transition: "all .15s",
                  fontWeight: category ? 600 : 400,
                  background: "#fff", padding: "0 3px",
                }}>Expense Category *</span>
                <span style={{ paddingTop: 14, paddingBottom: 4, fontSize: 14, color: "#111827", display: "block" }}>
                  {category || ""}
                </span>
              </div>
              {showCatDrop && (
                <div className="exp-cat-drop" onClick={e => e.stopPropagation()}>
                  <button type="button" className="exp-cat-drop__add" onClick={() => { setShowCatDrop(false); setShowAddCat(true); }}>
                    + Add Expense Category
                  </button>
                  {categories.map(c => (
                    <button key={c} type="button" className="exp-cat-drop__item"
                      onClick={() => { setCategory(c); setShowCatDrop(false); }}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: "relative", marginTop: 12 }}>
              <div
                className="nsf-customer-field"
                style={{ minWidth: 260, cursor: "text" }}
                onClick={() => setShowPartyDrop(true)}>
                <span style={{
                  position: "absolute", top: (paidTo || showPartyDrop) ? 2 : "50%",
                  transform: (paidTo || showPartyDrop) ? "none" : "translateY(-50%)",
                  left: 12, fontSize: (paidTo || showPartyDrop) ? 11 : 14,
                  color: "#3b82f6", pointerEvents: "none", transition: "all .15s",
                  fontWeight: (paidTo || showPartyDrop) ? 600 : 400,
                  background: "#fff", padding: "0 3px",
                }}>Paid To (Optional)</span>
                <input
                  className="nsf-customer-input"
                  style={{ paddingTop: 9 }}
                  value={paidTo}
                  onChange={e => { setPaidTo(e.target.value); setSelectedPartyId(null); setShowPartyDrop(true); }}
                  onFocus={() => setShowPartyDrop(true)}
                  onBlur={() => setTimeout(() => setShowPartyDrop(false), 150)}
                />
              </div>
              {showPartyDrop && filteredParties.length > 0 && (
                <div className="nsf-party-drop">
                  {filteredParties.slice(0, 8).map(p => (
                    <button key={p.id} type="button" className="nsf-party-drop__item"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setPaidTo(p.name); setSelectedPartyId(p.id); setShowPartyDrop(false); }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Expense No + Date */}
          <div className="nsf-top-fields__right">
            <div className="nsf-meta-field">
              <span className="nsf-meta-label">Expense No</span>
              <input className="nsf-meta-input" value={expNo} onChange={e => setExpNo(e.target.value)} />
            </div>
            <div className="nsf-meta-field">
              <span className="nsf-meta-label">Date</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: expDate ? "#111827" : "#9ca3af" }}>
                  {expDate
                    ? new Date(expDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "/")
                    : "DD/MM/YYYY"}
                </span>
                <label style={{ cursor: "pointer", position: "relative" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
                    style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }} />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="nsf-table-wrap">
          <table className="nsf-table">
            <thead>
              <tr className="nsf-thead-row">
                <th className="nsf-th nsf-th--num">#</th>
                <th className="nsf-th">ITEM</th>
                <th className="nsf-th nsf-th--qty">QTY</th>
                <th className="nsf-th nsf-th--price">PRICE/UNIT</th>
                <th className="nsf-th nsf-th--amt">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={item.id} className="nsf-tr">
                  <td className="nsf-td nsf-td--num">{idx + 1}</td>
                  <td className="nsf-td nsf-td--name">
                    <input
                      className="nsf-cell-input"
                      placeholder="+ Add Expense Item"
                      value={item.name}
                      onChange={e => updateItem(item.id, "name", e.target.value)}
                      onFocus={e => {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setDropPos({ top: r.bottom + 2, left: r.left, width: Math.max(320, r.width) });
                        setActiveItemRow(item.id);
                      }}
                      onBlur={() => setTimeout(() => { setActiveItemRow(null); setDropPos(null); }, 150)}
                    />
                    {activeItemRow === item.id && dropPos && item.name && (
                      <div className="nsf-item-drop" style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 400 }}>
                        <div className="nsf-item-drop__hdr">
                          <span className="nsf-item-drop__hdr-name">ITEM NAME</span>
                          <span className="nsf-item-drop__hdr-col">PRICE</span>
                        </div>
                        <button type="button" className="nsf-item-drop__row"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setShowAddItemModal(true); setNewItemName(item.name); setActiveItemRow(null); setDropPos(null); }}>
                          <span className="nsf-item-drop__item-name" style={{ color: "#3b82f6" }}>+ Add "{item.name}" as new item</span>
                          <span className="nsf-item-drop__col">—</span>
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="nsf-td">
                    <input className="nsf-cell-input" type="number" min="1" value={item.qty || ""} placeholder="1"
                      onChange={e => updateItem(item.id, "qty", parseFloat(e.target.value) || 1)} />
                  </td>
                  <td className="nsf-td">
                    <input className="nsf-cell-input" type="number" min="0" value={item.rate || ""} placeholder="0"
                      onChange={e => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="nsf-td nsf-td--amt">
                    {item.qty && item.rate ? fmt(item.qty * item.rate) : ""}
                  </td>
                </tr>
              ))}
              <tr className="nsf-tr-add-row">
                <td className="nsf-td nsf-td--num" />
                <td className="nsf-td" colSpan={4}>
                  <button type="button" className="nsf-add-item-row-btn" onClick={addRow}>
                    <span className="nsf-add-item-row-icon">+</span> ADD ROW
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="nsf-total-row">
                <td className="nsf-total-lbl" colSpan={2}>TOTAL</td>
                <td className="nsf-total-qty">{lineItems.reduce((s, i) => s + (i.qty || 0), 0) || "0"}</td>
                <td />
                <td className="nsf-total-amt">{fmt(subtotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom section */}
        <div className="nsf-bottom-section">
          <div className="nsf-bottom-left">
            <div className="nsf-payment-field">
              <span className="nsf-payment-lbl">Payment Type</span>
              <select className="nsf-payment-select" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                <option>Cash</option>
                <option>Credit</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Cheque</option>
              </select>
            </div>
            <button type="button" className="nsf-add-payment-btn">+ Add Payment type</button>
            <div className="nsf-add-btns">
              <button type="button" className="nsf-add-btn">
                <span className="nsf-add-btn__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                </span>ADD DESCRIPTION
              </button>
              <button type="button" className="nsf-add-btn">
                <span className="nsf-add-btn__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </span>ADD IMAGE
              </button>
            </div>
          </div>

          <div className="nsf-totals-area">
            <div className="nsf-totals-row nsf-totals-row--rt">
              <label className="nsf-check-label">
                <input type="checkbox" className="nsf-roundoff-cb" checked={roundOff} onChange={e => setRoundOff(e.target.checked)} />
                <span>Round Off</span>
              </label>
              <input className="nsf-tiny-input nsf-tiny-input--ro" type="number" value={roundOff ? roundOffAmt.toFixed(2) : "0"} readOnly />
              <span className="nsf-totals-lbl nsf-totals-lbl--total">Total</span>
              <input className="nsf-tiny-input nsf-tiny-input--total" type="text" value={fmt(total)} readOnly />
            </div>
            <div className="nsf-totals-row nsf-totals-row--balance">
              <span className="nsf-balance-lbl">Total Expense</span>
              <span className="nsf-balance-val">{fmt(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="nsf-error">{error}</p>}

      {/* Action bar */}
      <div className="nsf-actionbar">
        <div style={{ flex: 1 }} />
        <div className="nsf-actionbar__right">
          <div className="nsf-share-wrap">
            <button type="button" className="nsf-share-btn">Share</button>
            <button type="button" className="nsf-share-arrow">▼</button>
          </div>
          <button type="button" className="nsf-save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Close confirm */}
      {showClose && (
        <div className="nsf-dialog-overlay">
          <div className="nsf-dialog">
            <div className="nsf-dialog__header">
              <span className="nsf-dialog__title">Close Expense</span>
              <button type="button" className="nsf-dialog__x" onClick={() => setShowClose(false)}>✕</button>
            </div>
            <p className="nsf-dialog__body">Current changes will be discarded. Do you wish to continue?</p>
            <div className="nsf-dialog__footer">
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--cancel" onClick={() => setShowClose(false)}>Cancel</button>
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--ok" onClick={onClose}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item modal */}
      {showAddItemModal && (
        <div className="nsf-dialog-overlay">
          <div className="nsf-dialog" style={{ width: 380 }}>
            <div className="nsf-dialog__header">
              <span className="nsf-dialog__title">Add Expense Item</span>
              <button type="button" className="nsf-dialog__x" onClick={() => setShowAddItemModal(false)}>✕</button>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Item Name *</label>
                <input
                  style={{ width: "100%", border: "1.5px solid #3b82f6", borderRadius: 6, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  placeholder="e.g. Petrol charge"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" style={{ fontSize: 12, color: "#3b82f6", background: "none", border: "none", cursor: "pointer" }}>Pricing</button>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Price</label>
                <input
                  style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  type="number" min="0" placeholder="0.00"
                  value={newItemPrice}
                  onChange={e => setNewItemPrice(e.target.value)}
                />
              </div>
            </div>
            <div className="nsf-dialog__footer">
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--cancel" onClick={() => setShowAddItemModal(false)}>Cancel</button>
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--ok"
                onClick={() => {
                  if (!newItemName.trim()) return;
                  const price = parseFloat(newItemPrice) || 0;
                  const row = lineItems.find(i => i.name === newItemName) ?? lineItems.find(i => !i.name);
                  if (row) {
                    updateItem(row.id, "name", newItemName.trim());
                    if (price > 0) updateItem(row.id, "rate", price);
                  }
                  setShowAddItemModal(false);
                  setNewItemName("");
                  setNewItemPrice("");
                }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category modal */}
      {showAddCat && (
        <div className="nsf-dialog-overlay">
          <div className="nsf-dialog" style={{ width: 340 }}>
            <div className="nsf-dialog__header">
              <span className="nsf-dialog__title">Add Expense Category</span>
              <button type="button" className="nsf-dialog__x" onClick={() => setShowAddCat(false)}>✕</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 6 }}>Category Name *</label>
              <input
                style={{ width: "100%", border: "1.5px solid #3b82f6", borderRadius: 6, padding: "8px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                placeholder="e.g. Maintenance"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="nsf-dialog__footer">
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--cancel" onClick={() => setShowAddCat(false)}>Cancel</button>
              <button type="button" className="nsf-dialog__btn nsf-dialog__btn--ok"
                onClick={() => {
                  if (!newCatName.trim()) return;
                  onAddCategory(newCatName.trim());
                  setCategory(newCatName.trim());
                  setShowAddCat(false);
                  setNewCatName("");
                }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import type { Transaction, Party } from "@vyapar/api-client";

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

type PiRow = Transaction & { partyName: string };

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

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
type Props = { isLocked?: boolean; onLockedAction?: () => void };

export function PaymentInScreen({ isLocked = false, onLockedAction }: Props) {
  const [rows, setRows] = useState<PiRow[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<PiRow | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<PiRow | null>(null);
  const [viewHistoryRow, setViewHistoryRow] = useState<PiRow | null>(null);

  async function loadData() {
    try {
      const [txns, ps] = await Promise.all([
        api.getTransactionsByType("payment_in"),
        api.getParties(),
      ]);
      const map = Object.fromEntries(ps.map((p: Party) => [p.id, p]));
      setRows(txns.map((t) => ({ ...t, partyName: map[t.partyId]?.name ?? "Unknown" })));
      setParties(ps);
    } catch { /* offline */ }
  }

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuId]);

  const totalAmount = rows.reduce((s, r) => s + r.total, 0);
  const receivedAmount = rows.reduce((s, r) => s + (r.total - r.balance), 0);

  function handleAdd() {
    if (isLocked) { onLockedAction?.(); return; }
    setEditRow(null);
    setShowForm(true);
  }

  async function handleDuplicate(row: PiRow) {
    try {
      const allTxns = await api.getTransactionsByType("payment_in");
      await api.createTransaction({
        partyId: row.partyId,
        type: "payment_in",
        number: String(allTxns.length + 1),
        date: new Date().toISOString(),
        total: row.total,
        balance: row.total,
        notes: row.notes ?? undefined,
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
        <button type="button" className="pi-filterbar__chip">This Month ▾</button>
        <button type="button" className="pi-filterbar__date">📅 01/05/2026 To 31/05/2026</button>
        <button type="button" className="pi-filterbar__chip">All Firms ▾</button>
        <button type="button" className="pi-filterbar__chip">All Users ▾</button>
        <div className="pi-filterbar__spacer" />
      </div>

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
                        setMenuPos({ top: r.bottom + 4, left: r.right - 160 });
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
  const [paymentType, setPaymentType] = useState<string>(initNotes.paymentType ?? "Cash");
  const [receiptNo, setReceiptNo] = useState(initialRow?.number ?? String(existingCount + 1));

  /* Auto-compute receipt number when opened fresh */
  useEffect(() => {
    if (!initialRow) {
      api.getTransactionsByType("payment_in")
        .then((txns) => setReceiptNo(String(txns.length + 1)))
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

  /* Link Payment state */
  const [partyInvoices, setPartyInvoices] = useState<Transaction[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkedInvoiceIds, setLinkedInvoiceIds] = useState<Set<string>>(new Set());

  const selectedParty = parties.find((p) => p.id === selectedPartyId);
  const filteredParties = customer
    ? parties.filter((p) => p.name.toLowerCase().includes(customer.toLowerCase()))
    : parties;

  /* Load party's outstanding sale invoices when party changes */
  useEffect(() => {
    if (!selectedPartyId) { setPartyInvoices([]); setLinkedInvoiceIds(new Set()); return; }
    api.getPartyTransactions(selectedPartyId)
      .then((txns) => setPartyInvoices(txns.filter((t) => t.type === "sale" && t.balance > 0)))
      .catch(() => {});
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

  const receivedAmt = parseFloat(amount) || 0;
  const linkedTotal = partyInvoices
    .filter((t) => linkedInvoiceIds.has(t.id))
    .reduce((s, t) => s + Math.min(t.balance, receivedAmt), 0);
  const unusedAmt = Math.max(0, receivedAmt - linkedTotal);

  async function save() {
    setError("");
    if (!selectedPartyId) { setError("Select a party."); return; }
    if (receivedAmt <= 0) { setError("Enter a valid amount."); return; }
    setSaving(true);
    const notesJson = JSON.stringify({ paymentType, receiptNo });
    try {
      if (isEdit && initialRow) {
        await api.updateTransaction(initialRow.id, {
          partyId: selectedPartyId,
          date: new Date(date).toISOString(),
          total: receivedAmt,
          balance: unusedAmt,
          notes: notesJson,
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
        });
      }

      /* Reduce balance on each linked sale invoice */
      let remaining = linkedTotal;
      for (const invId of Array.from(linkedInvoiceIds)) {
        if (remaining <= 0) break;
        const inv = partyInvoices.find((t) => t.id === invId);
        if (!inv) continue;
        const deduct = Math.min(inv.balance, remaining);
        await api.updateTransaction(invId, { balance: Math.max(0, inv.balance - deduct) });
        remaining -= deduct;
      }

      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not save. Check connection.");
    } finally {
      setSaving(false);
    }
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
              <select className="pi-payment-select" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                <option>Cash</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Cheque</option>
                <option>Card</option>
              </select>
            </div>

            <button type="button" className="pi-add-payment-btn">+ Add Payment type</button>

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
            <div className="pi-share-wrap">
              <button type="button" className="pi-share-btn">Share</button>
              <button type="button" className="pi-share-arrow">▼</button>
            </div>
            <button type="button" className="pi-save-btn" onClick={save} disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Update" : "Save"}
            </button>
          </div>
        </div>
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

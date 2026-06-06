import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { Party, Transaction } from "@vyapar/api-client";
import { api } from "../lib/api";
import { AddPartyModal } from "./AddPartyModal";
import { PartySettingsDrawer, loadPartySettings, type PartySettings } from "./PartySettingsDrawer";
import { ImportExcelModal } from "./ImportExcelModal";
import { ImportFromPhoneModal } from "./ImportFromPhoneModal";
import { ReminderModal } from "./ReminderModal";
import { PrintOptionsModal, type PrintOptions } from "./PrintOptionsModal";
import { PartyStatementPreview } from "./PartyStatementPreview";
import { ExcelColumnsModal, downloadPartyExcel } from "./ExcelColumnsModal";

function fmt(n: number): string {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type PartiesScreenProps = { isLocked?: boolean; onLockedAction?: () => void };

export function PartiesScreen({ isLocked = false, onLockedAction }: PartiesScreenProps = {}) {
  const [parties, setParties] = useState<Party[]>([]);
  const [selected, setSelected] = useState<Party | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "customer" | "supplier">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editParty, setEditParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<Party | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [partySettings, setPartySettings] = useState<PartySettings>(loadPartySettings);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [showImportPhone, setShowImportPhone] = useState(false);
  const [reminderParty, setReminderParty] = useState<Party | null>(null);
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [printOptions, setPrintOptions] = useState<PrintOptions | null>(null);
  const [showExcelColumns, setShowExcelColumns] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (selected?.id) {
      void loadTransactions(selected.id);
    } else {
      setTransactions([]);
    }
    setSelectedTxnId(null);
  }, [selected?.id]);

  async function loadTransactions(partyId: string) {
    try {
      const data = await api.getPartyTransactions(partyId);
      setTransactions(data);
    } catch {
      setTransactions([]);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api.getParties();
      setParties(data);
      setSelected((prev) => {
        if (!prev) return data[0] ?? null;
        return data.find((p) => p.id === prev.id) ?? data[0] ?? null;
      });
    } finally {
      setLoading(false);
    }
  }

  const displayTxns = useMemo((): Transaction[] => {
    if (!selected) return [];
    return [
      ...transactions,
      ...(selected.openingBalance !== 0
        ? [{
            id: "opening",
            partyId: selected.id,
            tenantId: "",
            type: "opening_balance" as const,
            number: null,
            date: selected.createdAt,
            total: selected.openingBalance,
            balance: selected.openingBalance,
            notes: null,
            createdAt: selected.createdAt,
          }]
        : []),
    ];
  }, [transactions, selected]);

  const filtered = useMemo(
    () => parties.filter((p) => {
      if (!p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter === "customer" && p.partyType !== "customer" && p.partyType !== "both") return false;
      if (typeFilter === "supplier" && p.partyType !== "supplier" && p.partyType !== "both") return false;
      return true;
    }),
    [parties, search, typeFilter],
  );

  function handleSaved(party: Party) {
    setParties((prev) => {
      const idx = prev.findIndex((p) => p.id === party.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = party;
        return next;
      }
      return [...prev, party];
    });
    setSelected(party);
    setShowAdd(false);
    setEditParty(null);
  }

  async function handleDelete(party: Party) {
    setDeleting(true);
    try {
      await api.deleteParty(party.id);
      setParties((prev) => prev.filter((p) => p.id !== party.id));
      setSelected((prev) => {
        if (prev?.id !== party.id) return prev;
        const remaining = parties.filter((p) => p.id !== party.id);
        return remaining[0] ?? null;
      });
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  }

  function openWhatsApp(p: Party) {
    if (!p.phone) return;
    const num = p.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${num}`, "_blank");
  }

  function handleExportParties() {
    const headers = ["Name*", "Contact No.", "Email ID", "Address", "Opening Balance", "Opening Date (dd/MM/yyyy)"];
    const rows = parties.map((p) => [
      p.name,
      p.phone ?? "",
      p.email ?? "",
      p.billingAddress ?? "",
      p.balance ?? "",
      "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
    // Bold header row
    headers.forEach((_, i) => {
      const cell = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[cell]) ws[cell].s = { font: { bold: true } };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Parties");
    XLSX.writeFile(wb, "parties_export.xlsx");
  }

  return (
    <>
      <div className="page-header">
        <button type="button" className="page-header__title">
          Parties
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="page-header__actions">
          <button type="button" className="btn-primary" onClick={() => isLocked ? onLockedAction?.() : setShowAdd(true)}>
            + Add Party
          </button>
          <button type="button" className="page-header__icon-btn" title="Settings" onClick={() => setShowSettings(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="page-header__more-wrap" ref={moreMenuRef}>
            <button
              type="button"
              className="page-header__icon-btn"
              title="More options"
              onClick={() => setShowMoreMenu((v) => !v)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {showMoreMenu && (
              <div className="page-header__dropdown" onClick={() => setShowMoreMenu(false)}>
                <button type="button" className="page-header__dropdown-item" onClick={() => setShowImportExcel(true)}>
                  Import from Excel
                </button>
                <button type="button" className="page-header__dropdown-item" onClick={handleExportParties}>
                  Export All Parties to Excel
                </button>
                <button type="button" className="page-header__dropdown-item" onClick={() => setShowImportPhone(true)}>Import from Phone</button>
                <button type="button" className="page-header__dropdown-item">Import Via Google Contacts</button>
                <button type="button" className="page-header__dropdown-item">Party Statement (Report)</button>
                <button type="button" className="page-header__dropdown-item">All Parties (Report)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="parties-layout">
        {/* Left: party list */}
        <div className="parties-list">
          <div className="parties-search">
            <div className="parties-search__inner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="parties-search__icon">
                <circle cx="11" cy="11" r="6" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                placeholder="Search Party Name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="parties-search__clear" onClick={() => setSearch("")}>×</button>
              )}
            </div>
          </div>

          {/* Type filter pills */}
          <div className="parties-type-filter">
            {(["all", "customer", "supplier"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`parties-type-pill${typeFilter === t ? " parties-type-pill--active" : ""}`}
                style={typeFilter === t ? {
                  background: t === "customer" ? "#3b82f6" : t === "supplier" ? "#f59e0b" : "#374151",
                  color: "#fff",
                } : {}}
                onClick={() => setTypeFilter(t)}
              >
                {t === "all" ? "All" : t === "customer" ? "Customers" : "Suppliers"}
              </button>
            ))}
          </div>

          <div className="parties-list__header">
            <span>Party Name <FilterIcon /></span>
            <span>Balance</span>
          </div>

          <div className="parties-list__items">
            {loading && <div className="parties-list__loading">Loading…</div>}
            {!loading && filtered.length === 0 && (
              <div className="parties-list__empty">
                {search ? "No parties match your search" : "No parties yet.\nClick + Add Party to get started."}
              </div>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`party-row${selected?.id === p.id ? " party-row--active" : ""}`}
                onClick={() => setSelected(p)}
              >
                <span className="party-row__name">
                  {p.name}
                  {!p.isSystem && (
                    <span className="party-row__type-badge" style={{
                      background: p.partyType === "customer" ? "#dbeafe"
                        : p.partyType === "supplier" ? "#fef3c7"
                        : "#ede9fe",
                      color: p.partyType === "customer" ? "#1d4ed8"
                        : p.partyType === "supplier" ? "#b45309"
                        : "#6d28d9",
                    }}>
                      {p.partyType === "customer" ? "C" : p.partyType === "supplier" ? "S" : "B"}
                    </span>
                  )}
                </span>
                <span className={`party-row__amount${p.balance < 0 ? " party-row__amount--negative" : ""}`}>
                  {fmt(Math.abs(p.balance))}
                </span>
              </button>
            ))}
          </div>

          <div className="parties-list__tip">
            <ContactsIcon />
            <span>Easily convert your <strong>Phone contacts</strong> into parties</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Right: party detail */}
        <div className="parties-detail">
          {selected ? (
            <>
              <div className="party-detail__header">
                <div className="party-detail__info">
                  <div className="party-detail__name-row">
                    <h2 className="party-detail__name">{selected.name}</h2>
                    {!selected.isSystem && (
                      <button
                        type="button"
                        className="party-detail__edit-btn"
                        aria-label="Edit"
                        onClick={() => isLocked ? onLockedAction?.() : setEditParty(selected)}
                      >
                        <EditIcon />
                      </button>
                    )}
                  </div>

                  {/* Horizontal fields row */}
                  <div className="party-detail__fields-row">
                    {selected.phone && (
                      <div className="party-detail__field-block">
                        <span className="party-detail__field-label">Phone Number</span>
                        <p className="party-detail__field-value">{selected.phone}</p>
                      </div>
                    )}
                    {selected.email && (
                      <div className="party-detail__field-block">
                        <span className="party-detail__field-label">Email</span>
                        <p className="party-detail__field-value">{selected.email}</p>
                      </div>
                    )}
                    {selected.billingAddress && (
                      <div className="party-detail__field-block">
                        <span className="party-detail__field-label">Billing Address</span>
                        <p className="party-detail__field-value">
                          {[selected.billingAddress, selected.city, selected.state, selected.pincode].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    )}
                    {selected.gstin && (
                      <div className="party-detail__field-block">
                        <span className="party-detail__field-label">GSTIN</span>
                        <p className="party-detail__field-value">{selected.gstin}</p>
                      </div>
                    )}
                    {selected.pan && (
                      <div className="party-detail__field-block">
                        <span className="party-detail__field-label">PAN</span>
                        <p className="party-detail__field-value">{selected.pan}</p>
                      </div>
                    )}
                  </div>

                  {(selected.creditLimit || selected.creditDays) && (
                    <div className="party-detail__credit-row">
                      {selected.creditLimit != null && (
                        <div className="party-detail__credit-chip">
                          <span>Credit Limit</span>
                          <strong>Rs {fmt(selected.creditLimit)}</strong>
                        </div>
                      )}
                      {selected.creditDays != null && (
                        <div className="party-detail__credit-chip">
                          <span>Credit Days</span>
                          <strong>{selected.creditDays} days</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="party-detail__actions">
                  {selected.phone && (
                    <button
                      type="button"
                      className="party-detail__action-btn party-detail__action-btn--whatsapp"
                      title="WhatsApp"
                      onClick={() => openWhatsApp(selected)}
                    >
                      <WhatsAppIcon />
                    </button>
                  )}
                  <button
                    type="button"
                    className="party-detail__action-btn party-detail__action-btn--reminder"
                    title="Set Reminder"
                    onClick={() => setReminderParty(selected)}
                  >
                    <BellIcon />
                  </button>
                  <button
                    type="button"
                    className="party-detail__action-btn party-detail__action-btn--refresh"
                    title="Refresh"
                    onClick={() => void load()}
                  >
                    <RefreshIcon />
                  </button>
                  {!selected.isSystem && (
                    <button
                      type="button"
                      className="party-detail__action-btn party-detail__action-btn--delete"
                      title="Delete party"
                      onClick={() => isLocked ? onLockedAction?.() : setDeleteConfirm(selected)}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>

              <div className="party-transactions">
                <div className="party-transactions__header">
                  <h3 className="party-transactions__title">Transactions</h3>
                  <div className="party-transactions__tools">
                    <button type="button" className="party-transactions__tool-btn" title="Search">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
                        <circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button type="button" className="party-transactions__tool-btn" title="Print" onClick={() => setShowPrintOptions(true)}><PrintIcon /></button>
                    <button type="button" className="party-transactions__tool-btn" title="Download Excel" onClick={() => setShowExcelColumns(true)}><DownloadIcon /></button>
                  </div>
                </div>

                <div className="party-transactions__cols">
                  {["Type", "Number", "Date", "Total", "Balance"].map((col) => (
                    <div key={col} className="party-transactions__col">{col} <FilterIcon /></div>
                  ))}
                </div>

                {displayTxns.length === 0 ? (
                  <div className="party-transactions__empty">
                    <EmptyTransactionsIllustration />
                    <p className="party-transactions__empty-title">No Transactions to show</p>
                    <p className="party-transactions__empty-sub">You haven&apos;t added any transactions yet.</p>
                  </div>
                ) : (
                  <div className="party-txn-rows">
                    {displayTxns.map((txn) => {
                      const isActive = selectedTxnId === txn.id;
                      const hideBalance = txn.balance === 0 && (txn.type === "payment_in" || txn.type === "payment_out");
                      const txnTypeLabel = (t: Transaction): string => {
                        switch (t.type) {
                          case "sale": return "Sale";
                          case "purchase": return "Purchase";
                          case "payment_in": return "Payment-In";
                          case "payment_out": return "Payment-Out";
                          case "credit_note": return "Credit Note";
                          case "debit_note": return "Debit Note";
                          case "expense": return "Expense";
                          case "opening_balance": return t.balance >= 0 ? "Receivable Opening Balance" : "Payable Opening Balance";
                          default: return t.type;
                        }
                      };
                      return (
                        <div
                          key={txn.id}
                          className={`party-txn-row${isActive ? " party-txn-row--active" : ""}`}
                          onClick={() => setSelectedTxnId(isActive ? null : txn.id)}
                        >
                          <span className="party-txn-row__type">{txnTypeLabel(txn)}</span>
                          <span className="party-txn-row__number">{txn.number ?? ""}</span>
                          <span className="party-txn-row__date">{new Date(txn.date).toLocaleDateString("en-GB")}</span>
                          <span className={`party-txn-row__total${txn.total < 0 ? " party-txn-row__total--neg" : ""}`}>
                            Rs {fmt(Math.abs(txn.total))}
                          </span>
                          {!hideBalance && (
                            <span className={`party-txn-row__balance${txn.balance < 0 ? " party-txn-row__balance--neg" : ""}`}>
                              Rs {fmt(Math.abs(txn.balance))}
                            </span>
                          )}
                          {hideBalance && <span className="party-txn-row__balance" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="party-detail__placeholder">Select a party to view details</div>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {(showAdd || editParty) && (
        <AddPartyModal
          party={editParty ?? undefined}
          settings={partySettings}
          defaultType={showAdd && typeFilter !== "all" ? typeFilter : undefined}
          onClose={() => { setShowAdd(false); setEditParty(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Party Settings drawer */}
      {showSettings && (
        <PartySettingsDrawer
          onClose={() => setShowSettings(false)}
          onSaved={(s) => { setPartySettings(s); setShowSettings(false); }}
        />
      )}

      {/* Reminder modal */}
      {reminderParty && (
        <ReminderModal party={reminderParty} onClose={() => setReminderParty(null)} />
      )}

      {/* Print Options modal */}
      {showPrintOptions && (
        <PrintOptionsModal
          onClose={() => setShowPrintOptions(false)}
          onOk={(opts) => { setShowPrintOptions(false); setPrintOptions(opts); }}
        />
      )}

      {/* Excel Columns modal */}
      {showExcelColumns && selected && (
        <ExcelColumnsModal
          onClose={() => setShowExcelColumns(false)}
          onOk={(cols) => {
            setShowExcelColumns(false);
            downloadPartyExcel(selected, displayTxns, cols);
          }}
        />
      )}

      {/* Party Statement Preview */}
      {printOptions && selected && (
        <PartyStatementPreview
          party={selected}
          transactions={transactions}
          displayTxns={displayTxns}
          options={printOptions}
          onClose={() => setPrintOptions(null)}
        />
      )}

      {/* Import from Phone modal */}
      {showImportPhone && (
        <ImportFromPhoneModal
          onClose={() => setShowImportPhone(false)}
          onImported={() => { void load(); }}
        />
      )}

      {/* Import Excel modal */}
      {showImportExcel && (
        <ImportExcelModal
          onClose={() => setShowImportExcel(false)}
          onImported={() => { void load(); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="party-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="party-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="party-confirm-modal__title">Delete Party?</h3>
            <p className="party-confirm-modal__body">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="party-confirm-modal__footer">
              <button type="button" className="party-modal__btn-ghost" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="party-modal__btn-danger"
                disabled={deleting}
                onClick={() => void handleDelete(deleteConfirm)}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Icons ──

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" style={{ marginLeft: 4, flexShrink: 0 }}>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.135.562 4.14 1.542 5.874L0 24l6.302-1.51A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.96 0-3.792-.534-5.362-1.463l-.386-.228-3.98.953.98-3.884-.252-.4A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
      <path d="M4 12a8 8 0 0 1 14-5.3" strokeLinecap="round" />
      <path d="M18 3v4h-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12a8 8 0 0 1-14 5.3" strokeLinecap="round" />
      <path d="M6 21v-4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <path d="M6 9V2h12v7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="14" width="12" height="8" rx="1" strokeLinejoin="round" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m7 10 5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ContactsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18" style={{ color: "#3b82f6", flexShrink: 0 }}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5" strokeLinecap="round" />
      <path d="M19 8h3M19 12h3" strokeLinecap="round" />
    </svg>
  );
}
function EmptyTransactionsIllustration() {
  return (
    <svg viewBox="0 0 120 100" width="120" height="100" fill="none">
      <rect x="20" y="15" width="80" height="70" rx="8" fill="#dbeafe" />
      <rect x="30" y="28" width="60" height="6" rx="3" fill="#93c5fd" />
      <rect x="30" y="40" width="44" height="5" rx="2.5" fill="#bfdbfe" />
      <rect x="30" y="51" width="50" height="5" rx="2.5" fill="#bfdbfe" />
      <rect x="30" y="62" width="38" height="5" rx="2.5" fill="#bfdbfe" />
    </svg>
  );
}

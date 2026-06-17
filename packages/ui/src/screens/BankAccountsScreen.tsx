import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import type { BankAccount } from "@vyapar/api-client";

function todayISO() { return new Date().toISOString().split("T")[0]; }

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtAmt(n: number) {
  return `Rs ${Math.abs(n).toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

type FormData = {
  name: string;
  openingBalance: string;
  openingBalanceDate: string;
  printOnInvoices: boolean;
  accountNumber: string;
  swiftCode: string;
  iban: string;
  bankName: string;
  holderName: string;
};

const EMPTY_FORM: FormData = {
  name: "", openingBalance: "", openingBalanceDate: todayISO(),
  printOnInvoices: false,
  accountNumber: "", swiftCode: "", iban: "", bankName: "", holderName: "",
};

function fromAccount(a: BankAccount): FormData {
  return {
    name: a.name,
    openingBalance: a.openingBalance ? String(a.openingBalance) : "",
    openingBalanceDate: a.openingBalanceDate?.split("T")[0] ?? todayISO(),
    printOnInvoices: a.printOnInvoices,
    accountNumber: "", swiftCode: "", iban: "", bankName: "", holderName: "",
  };
}

function AddBankModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: BankAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormData>(editing ? fromAccount(editing) : EMPTY_FORM);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof FormData, val: string | boolean) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Account Display Name is required."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        name: form.name.trim(),
        openingBalance: form.openingBalance ? Number(form.openingBalance) : 0,
        openingBalanceDate: form.openingBalanceDate,
        printOnInvoices: form.printOnInvoices,
      };
      if (editing) {
        await api.updateBankAccount(editing.id, payload);
      } else {
        await api.createBankAccount(payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ba-overlay" onClick={onClose}>
      <div className="ba-form-page" onClick={e => e.stopPropagation()}>
        <h2 className="ba-form-title">{editing ? "Edit Bank Account" : "Add Bank Account"}</h2>

        {/* Row 1 */}
        <div className="ba-form-row">
          <div className="ba-field">
            <label className="ba-field-label">Account Display Name <span className="ba-req">*</span></label>
            <input
              className="ba-input"
              placeholder="Enter Account Display Name"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              autoFocus
            />
          </div>
          <div className="ba-field">
            <label className="ba-field-label">Opening Balance</label>
            <input
              className="ba-input"
              placeholder="Enter Opening Balance"
              type="number"
              min="0"
              value={form.openingBalance}
              onChange={e => set("openingBalance", e.target.value)}
            />
          </div>
          <div className="ba-field">
            <label className="ba-field-label">As of Date</label>
            <input
              className="ba-input ba-input--date"
              type="date"
              value={form.openingBalanceDate}
              onChange={e => set("openingBalanceDate", e.target.value)}
            />
          </div>
        </div>

        {/* Add more fields toggle */}
        <button type="button" className="ba-more-toggle" onClick={() => setShowMore(v => !v)}>
          <span className="ba-more-plus">{showMore ? "−" : "+"}</span>
          {showMore ? "Hide extra fields" : "Add more fields"}
        </button>

        {showMore && (
          <div className="ba-extra-fields">
            <div className="ba-form-row">
              <div className="ba-field">
                <label className="ba-field-label">Account Number</label>
                <input className="ba-input" placeholder="Enter Account Number" value={form.accountNumber} onChange={e => set("accountNumber", e.target.value)} />
              </div>
              <div className="ba-field">
                <label className="ba-field-label">SWIFT Code</label>
                <input className="ba-input" placeholder="Enter SWIFT" value={form.swiftCode} onChange={e => set("swiftCode", e.target.value)} />
              </div>
              <div className="ba-field">
                <label className="ba-field-label">IBAN</label>
                <input className="ba-input" placeholder="Enter IBAN" value={form.iban} onChange={e => set("iban", e.target.value)} />
              </div>
            </div>
            <div className="ba-form-row">
              <div className="ba-field">
                <label className="ba-field-label">Bank Name</label>
                <input className="ba-input" placeholder="Enter Bank Name" value={form.bankName} onChange={e => set("bankName", e.target.value)} />
              </div>
              <div className="ba-field">
                <label className="ba-field-label">Account Holder Name</label>
                <input className="ba-input" placeholder="Enter Account Holder Name" value={form.holderName} onChange={e => set("holderName", e.target.value)} />
              </div>
              <div className="ba-field" />
            </div>
          </div>
        )}

        {/* Print toggle */}
        <label className="ba-checkbox-row">
          <input
            type="checkbox"
            className="ba-checkbox"
            checked={form.printOnInvoices}
            onChange={e => set("printOnInvoices", e.target.checked)}
          />
          <span className="ba-checkbox-label">Print Bank Details on Invoices</span>
        </label>

        {error && <p className="ba-error">{error}</p>}

        {/* Footer */}
        <div className="ba-form-footer">
          <button type="button" className="ba-btn-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="ba-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Details"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function BankAccountsScreen() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BankAccount | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [showDWMenu, setShowDWMenu] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getBankAccounts();
      setAccounts(data);
      if (data.length > 0 && !selected) setSelected(data[0]);
    } catch { /* offline */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this bank account?")) return;
    setDeleting(id);
    try {
      await api.deleteBankAccount(id);
      const next = accounts.filter(a => a.id !== id);
      setAccounts(next);
      if (selected?.id === id) setSelected(next[0] ?? null);
    } finally { setDeleting(null); }
  }

  const filtered = accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ba-screen">
      {/* ── Left panel ── */}
      <aside className="ba-left">
        <div className="ba-left-header">
          <div className="ba-search-wrap">
            <SearchIcon />
            <input
              className="ba-search"
              placeholder="Search by Account/Amount"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="ba-list-header">
          <span className="ba-col-name">Account Name</span>
          <span className="ba-col-amt">Amount</span>
        </div>

        <div className="ba-list">
          {loading ? (
            <div className="ba-empty">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="ba-empty">No bank accounts yet.<br />Click "+ Add Bank" to create one.</div>
          ) : (
            filtered.map(acc => (
              <button
                key={acc.id}
                type="button"
                className={`ba-list-row${selected?.id === acc.id ? " ba-list-row--active" : ""}`}
                onClick={() => setSelected(acc)}
              >
                <span className="ba-list-name">{acc.name}</span>
                <span className="ba-list-amt">{fmtAmt(acc.openingBalance)}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Right panel ── */}
      <main className="ba-right">
        {/* Topbar */}
        <div className="ba-right-topbar">
          <span />
          <button
            type="button"
            className="ba-btn-add"
            onClick={() => { setEditing(null); setShowAdd(true); }}
          >
            <PlusIcon /> Add Bank
          </button>
        </div>

        {selected ? (
          <>
            {/* Account header */}
            <div className="ba-detail-header">
              <span className="ba-detail-name">{selected.name}</span>
              <div className="ba-detail-actions">
                <button
                  type="button"
                  className="ba-btn-edit"
                  onClick={() => { setEditing(selected); setShowAdd(true); }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="ba-btn-delete"
                  onClick={() => handleDelete(selected.id)}
                  disabled={deleting === selected.id}
                >
                  {deleting === selected.id ? "…" : "Delete"}
                </button>
                <div className="ba-dw-wrap">
                  <button
                    type="button"
                    className="ba-btn-dw"
                    onClick={() => setShowDWMenu(v => !v)}
                  >
                    Deposit / Withdraw <ChevronIcon />
                  </button>
                  {showDWMenu && (
                    <div className="ba-dw-menu" onMouseLeave={() => setShowDWMenu(false)}>
                      <button className="ba-dw-item" onClick={() => setShowDWMenu(false)}>Deposit</button>
                      <button className="ba-dw-item" onClick={() => setShowDWMenu(false)}>Withdraw</button>
                      <button className="ba-dw-item" onClick={() => setShowDWMenu(false)}>Transfer to Cash</button>
                      <button className="ba-dw-item" onClick={() => setShowDWMenu(false)}>Transfer to Bank</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Transactions table */}
            <div className="ba-txn-section">
              <div className="ba-txn-header">
                <span className="ba-txn-title">Transactions</span>
                <button type="button" className="ba-icon-btn" title="Search"><SearchIcon /></button>
              </div>

              <table className="ba-table">
                <thead>
                  <tr>
                    <th className="ba-th">Type <FilterIcon /></th>
                    <th className="ba-th">Name <FilterIcon /></th>
                    <th className="ba-th">Date <SortIcon /></th>
                    <th className="ba-th ba-th--right">Amount <FilterIcon /></th>
                    <th className="ba-th" />
                  </tr>
                </thead>
                <tbody>
                  <tr className="ba-tr">
                    <td className="ba-td">Opening Balance</td>
                    <td className="ba-td">Opening Balance</td>
                    <td className="ba-td">{fmtDate(selected.openingBalanceDate)}</td>
                    <td className="ba-td ba-td--green">{fmtAmt(selected.openingBalance)}</td>
                    <td className="ba-td ba-td--actions">
                      <button type="button" className="ba-icon-btn"><DotsIcon /></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="ba-no-selection">
            <BankPlaceholderIcon />
            <p>Select a bank account to view details</p>
            <button
              type="button"
              className="ba-btn-add"
              onClick={() => { setEditing(null); setShowAdd(true); }}
            >
              <PlusIcon /> Add Bank
            </button>
          </div>
        )}
      </main>

      {/* ── Add/Edit Modal ── */}
      {showAdd && (
        <AddBankModal
          editing={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={async () => {
            setShowAdd(false); setEditing(null);
            setLoading(true);
            const data = await api.getBankAccounts();
            setAccounts(data);
            setSelected(data[data.length - 1] ?? null);
            setLoading(false);
          }}
        />
      )}

      <style>{STYLES}</style>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function FilterIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54Z" />
    </svg>
  );
}
function SortIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 3v18m-6-6 6 6 6-6M6 9l6-6 6 6" />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}
function BankPlaceholderIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
.ba-screen {
  display: flex;
  height: 100%;
  background: #f8fafc;
  overflow: hidden;
}

/* ── Left panel ── */
.ba-left {
  width: 300px;
  min-width: 220px;
  border-right: 1px solid #e5e7eb;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ba-left-header {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}
.ba-search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 7px 10px;
  color: #94a3b8;
}
.ba-search {
  border: none;
  background: transparent;
  outline: none;
  font-size: 12.5px;
  color: #374151;
  flex: 1;
}
.ba-search::placeholder { color: #94a3b8; }

.ba-list-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 14px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid #f1f5f9;
}

.ba-list { flex: 1; overflow-y: auto; }
.ba-empty {
  padding: 40px 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.6;
}

.ba-list-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 14px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  border-bottom: 1px solid #f8fafc;
  transition: background 0.1s;
}
.ba-list-row:hover { background: #f8fafc; }
.ba-list-row--active { background: #eff6ff; }
.ba-list-name { font-size: 13.5px; font-weight: 500; color: #1e293b; }
.ba-list-amt { font-size: 13px; color: #16a34a; font-weight: 500; }

/* ── Right panel ── */
.ba-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ba-right-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.ba-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}
.ba-detail-name {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}
.ba-detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Buttons */
.ba-btn-add {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #dc2626;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.ba-btn-add:hover { background: #b91c1c; }

.ba-btn-edit {
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12.5px;
  color: #374151;
  cursor: pointer;
}
.ba-btn-edit:hover { background: #f8fafc; }

.ba-btn-delete {
  background: none;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12.5px;
  color: #dc2626;
  cursor: pointer;
}
.ba-btn-delete:hover { background: #fef2f2; }

.ba-dw-wrap { position: relative; }
.ba-btn-dw {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 12px;
  background: #fff;
  font-size: 12.5px;
  color: #374151;
  cursor: pointer;
}
.ba-btn-dw:hover { background: #f8fafc; }
.ba-dw-menu {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  z-index: 50;
  min-width: 170px;
  overflow: hidden;
}
.ba-dw-item {
  display: block;
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  border-bottom: 1px solid #f1f5f9;
}
.ba-dw-item:last-child { border-bottom: none; }
.ba-dw-item:hover { background: #f8fafc; }

.ba-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 4px;
}
.ba-icon-btn:hover { background: #f1f5f9; color: #374151; }

/* Transactions */
.ba-txn-section {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
}
.ba-txn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0 10px;
}
.ba-txn-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.ba-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ba-th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  color: #64748b;
  border-bottom: 1px solid #e5e7eb;
  display: table-cell;
}
.ba-th svg { margin-left: 4px; vertical-align: middle; opacity: 0.5; }
.ba-th--right { text-align: right; }
.ba-tr { background: #eff6ff; }
.ba-tr:hover { background: #dbeafe; }
.ba-td {
  padding: 11px 12px;
  color: #374151;
  border-bottom: 1px solid #f1f5f9;
}
.ba-td--green { color: #16a34a; font-weight: 500; text-align: right; }
.ba-td--actions { text-align: right; }

/* Empty state */
.ba-no-selection {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #94a3b8;
  font-size: 14px;
}

/* ── Add form modal ── */
.ba-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 100;
  padding: 40px 20px;
  overflow-y: auto;
}
.ba-form-page {
  background: #fff;
  border-radius: 12px;
  padding: 32px 36px 24px;
  width: 100%;
  max-width: 900px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.15);
}
.ba-form-title {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 24px;
}
.ba-form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.ba-field { display: flex; flex-direction: column; gap: 6px; }
.ba-field-label { font-size: 12px; font-weight: 600; color: #64748b; }
.ba-req { color: #dc2626; }
.ba-input {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 9px 12px;
  font-size: 13.5px;
  color: #1e293b;
  outline: none;
  background: #fff;
  transition: border-color 0.15s;
}
.ba-input:focus { border-color: #3b82f6; }
.ba-input--date { cursor: pointer; }

.ba-more-toggle {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ba-more-plus {
  width: 18px; height: 18px;
  background: #eff6ff;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  color: #3b82f6;
  line-height: 1;
}
.ba-extra-fields { margin-bottom: 16px; }

.ba-checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 20px;
  cursor: pointer;
}
.ba-checkbox { width: 15px; height: 15px; accent-color: #3b82f6; cursor: pointer; }
.ba-checkbox-label { font-size: 13px; color: #374151; }

.ba-error {
  color: #dc2626;
  font-size: 12.5px;
  margin-bottom: 12px;
}

.ba-form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}
.ba-btn-cancel {
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 20px;
  font-size: 13.5px;
  color: #374151;
  cursor: pointer;
}
.ba-btn-cancel:hover { background: #f8fafc; }
.ba-btn-save {
  background: #dc2626;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 22px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}
.ba-btn-save:hover:not(:disabled) { background: #b91c1c; }
.ba-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
`;

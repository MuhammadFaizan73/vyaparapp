import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

type LoanAccount = {
  id: string;
  accountName: string;
  lenderBank?: string | null;
  accountNumber?: string | null;
  description?: string | null;
  currentBalance: number;
  balanceAsOf: string;
  loanReceivedIn: string;
  interestRate?: number | null;
  termDuration?: number | null;
  processingFee?: number | null;
  processingFeePaidFrom: string;
  createdAt: string;
};

const PAYMENT_OPTIONS = ["Cash", "Bank", "UPI", "Cheque", "Card", "Other"];

function todayISO() { return new Date().toISOString().split("T")[0]; }
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}
function rs(n: number) {
  return `Rs ${Math.abs(n).toLocaleString("en-PK", { minimumFractionDigits: 0 })}`;
}

// ─── Add / Edit Modal ────────────────────────────────────────────────────────

type FormData = {
  accountName: string; lenderBank: string; accountNumber: string; description: string;
  currentBalance: string; balanceAsOf: string; loanReceivedIn: string;
  interestRate: string; termDuration: string; processingFee: string; processingFeePaidFrom: string;
};

const EMPTY_FORM: FormData = {
  accountName: "", lenderBank: "", accountNumber: "", description: "",
  currentBalance: "", balanceAsOf: todayISO(), loanReceivedIn: "Cash",
  interestRate: "", termDuration: "", processingFee: "", processingFeePaidFrom: "Cash",
};

function fromAccount(a: LoanAccount): FormData {
  return {
    accountName: a.accountName,
    lenderBank: a.lenderBank ?? "",
    accountNumber: a.accountNumber ?? "",
    description: a.description ?? "",
    currentBalance: String(a.currentBalance),
    balanceAsOf: a.balanceAsOf.split("T")[0],
    loanReceivedIn: a.loanReceivedIn,
    interestRate: a.interestRate != null ? String(a.interestRate) : "",
    termDuration: a.termDuration != null ? String(a.termDuration) : "",
    processingFee: a.processingFee != null ? String(a.processingFee) : "",
    processingFeePaidFrom: a.processingFeePaidFrom,
  };
}

function AddLoanModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: LoanAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormData>(editing ? fromAccount(editing) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof FormData, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    if (!form.accountName.trim()) { setError("Account Name is required."); return; }
    if (!form.currentBalance || isNaN(Number(form.currentBalance))) { setError("Enter a valid Current Balance."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        accountName: form.accountName.trim(),
        lenderBank: form.lenderBank || undefined,
        accountNumber: form.accountNumber || undefined,
        description: form.description || undefined,
        currentBalance: Number(form.currentBalance),
        balanceAsOf: form.balanceAsOf,
        loanReceivedIn: form.loanReceivedIn,
        interestRate: form.interestRate ? Number(form.interestRate) : undefined,
        termDuration: form.termDuration ? Number(form.termDuration) : undefined,
        processingFee: form.processingFee ? Number(form.processingFee) : undefined,
        processingFeePaidFrom: form.processingFeePaidFrom,
      };
      if (editing) {
        await api.updateLoanAccount(editing.id, payload);
      } else {
        await api.createLoanAccount(payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="la-modal-overlay" onClick={onClose}>
      <div className="la-modal" onClick={e => e.stopPropagation()}>
        <div className="la-modal__header">
          <span className="la-modal__title">{editing ? "Edit Loan Account" : "Add Loan Account"}</span>
          <button type="button" className="la-modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="la-modal__body">
          {/* Row 1 */}
          <div className="la-modal__row">
            <div className="la-field">
              <input className="la-input" placeholder="Account Name *" value={form.accountName} onChange={e => set("accountName", e.target.value)} autoFocus />
            </div>
            <div className="la-field">
              <input className="la-input" placeholder="Lender Bank" value={form.lenderBank} onChange={e => set("lenderBank", e.target.value)} />
            </div>
          </div>

          {/* Row 2 */}
          <div className="la-modal__row">
            <div className="la-field">
              <input className="la-input" placeholder="Account Number" value={form.accountNumber} onChange={e => set("accountNumber", e.target.value)} />
            </div>
            <div className="la-field">
              <input className="la-input" placeholder="Description" value={form.description} onChange={e => set("description", e.target.value)} />
            </div>
          </div>

          {/* Row 3 */}
          <div className="la-modal__row">
            <div className="la-field">
              <input className="la-input" placeholder="Current Balance *" type="number" min="0" value={form.currentBalance} onChange={e => set("currentBalance", e.target.value)} />
            </div>
            <div className="la-field la-field--labeled">
              <label className="la-float-label">Balance as of</label>
              <input className="la-input la-input--date" type="date" value={form.balanceAsOf} onChange={e => set("balanceAsOf", e.target.value)} />
            </div>
          </div>

          {/* Row 4 — Loan received In */}
          <div className="la-modal__row la-modal__row--half">
            <div className="la-field la-field--labeled">
              <label className="la-float-label">Loan received In</label>
              <select className="la-input la-input--select" value={form.loanReceivedIn} onChange={e => set("loanReceivedIn", e.target.value)}>
                {PAYMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Row 5 — Interest + Term */}
          <div className="la-modal__row">
            <div className="la-field la-field--suffix">
              <input className="la-input" placeholder="Interest Rate" type="number" min="0" step="0.01" value={form.interestRate} onChange={e => set("interestRate", e.target.value)} />
              <span className="la-suffix">% per annum</span>
            </div>
            <div className="la-field">
              <input className="la-input" placeholder="Term Duration(in Months)" type="number" min="0" value={form.termDuration} onChange={e => set("termDuration", e.target.value)} />
            </div>
          </div>

          {/* Row 6 — Processing Fee */}
          <div className="la-modal__row">
            <div className="la-field">
              <input className="la-input" placeholder="Processing Fee" type="number" min="0" value={form.processingFee} onChange={e => set("processingFee", e.target.value)} />
            </div>
            <div className="la-field la-field--labeled">
              <label className="la-float-label">Processing Fee Paid from</label>
              <select className="la-input la-input--select" value={form.processingFeePaidFrom} onChange={e => set("processingFeePaidFrom", e.target.value)}>
                {PAYMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {error && <div className="la-modal__error">{error}</div>}
        </div>

        <div className="la-modal__footer">
          <button type="button" className="la-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "SAVE"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Loan Account Card ─────────────────────────────────────────────────────

function LoanCard({ account, onEdit, onDelete }: { account: LoanAccount; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="la-card">
      <div className="la-card__header">
        <div className="la-card__name">{account.accountName}</div>
        <div className="la-card__actions">
          <button type="button" className="la-card__btn la-card__btn--edit" onClick={onEdit} title="Edit">✎</button>
          <button type="button" className="la-card__btn la-card__btn--del" onClick={onDelete} title="Delete">✕</button>
        </div>
      </div>
      {account.lenderBank && <div className="la-card__bank">{account.lenderBank}</div>}
      <div className="la-card__balance">
        <span className="la-card__balance-label">Current Balance</span>
        <span className="la-card__balance-value">{rs(account.currentBalance)}</span>
      </div>
      <div className="la-card__meta">
        {account.accountNumber && <span>A/C: {account.accountNumber}</span>}
        {account.interestRate != null && <span>{account.interestRate}% p.a.</span>}
        {account.termDuration != null && <span>{account.termDuration} months</span>}
        <span>as of {fmtDate(account.balanceAsOf)}</span>
      </div>
      <div className="la-card__badges">
        <span className="la-badge">{account.loanReceivedIn}</span>
        {account.processingFee != null && account.processingFee > 0 && (
          <span className="la-badge la-badge--muted">Fee: {rs(account.processingFee)}</span>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="la-empty">
      <div className="la-empty__content">
        <h2 className="la-empty__title">Manage Your Loan Accounts</h2>
        <p className="la-empty__sub">Add your loan accounts and check all loan transactions at one place</p>

        <div className="la-empty__illustration">
          <BankIllustration />
        </div>

        <div className="la-empty__features">
          <div className="la-feature">
            <div className="la-feature__icon"><DashboardIcon /></div>
            <div>
              <div className="la-feature__title">All Loans, One Dashboard</div>
              <div className="la-feature__sub">Easily track business loans kept separate from the daily transactions</div>
            </div>
          </div>
          <div className="la-feature">
            <div className="la-feature__icon"><EmiIcon /></div>
            <div>
              <div className="la-feature__title">Auto EMI Calculation with Every Entry</div>
              <div className="la-feature__sub">Add loan details and the system instantly breaks it down into EMIs</div>
            </div>
          </div>
          <div className="la-feature">
            <div className="la-feature__icon"><FlexIcon /></div>
            <div>
              <div className="la-feature__title">Manual Flexibility</div>
              <div className="la-feature__sub">Add notes, interest details etc. Keeps it flexible for varied use cases</div>
            </div>
          </div>
        </div>
      </div>

      <button type="button" className="la-add-fab" onClick={onAdd}>
        <span>+</span> Add Loan Account
      </button>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function LoanAccountsScreen() {
  const [accounts, setAccounts] = useState<LoanAccount[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [editing,  setEditing]  = useState<LoanAccount | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.getLoanAccounts();
      setAccounts(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load loan accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this loan account?")) return;
    try {
      await api.deleteLoanAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch {
      // ignore
    }
  }

  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);

  if (loading) return <div className="la-screen la-state">Loading…</div>;
  if (error)   return <div className="la-screen la-state la-state--error">{error}</div>;

  if (accounts.length === 0 && !showAdd) {
    return (
      <div className="la-screen">
        <EmptyState onAdd={() => setShowAdd(true)} />
        {showAdd && (
          <AddLoanModal editing={null} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
        )}
      </div>
    );
  }

  return (
    <div className="la-screen">
      {/* Header */}
      <div className="la-header">
        <div className="la-header__left">
          <h1 className="la-header__title">Loan Accounts</h1>
          <span className="la-header__count">{accounts.length} account{accounts.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="la-header__right">
          <div className="la-header__total">
            Total Outstanding: <strong>{rs(totalBalance)}</strong>
          </div>
          <button type="button" className="la-add-btn" onClick={() => { setEditing(null); setShowAdd(true); }}>
            + Add Loan Account
          </button>
        </div>
      </div>

      {/* Cards grid */}
      <div className="la-grid">
        {accounts.map(a => (
          <LoanCard
            key={a.id}
            account={a}
            onEdit={() => { setEditing(a); setShowAdd(true); }}
            onDelete={() => handleDelete(a.id)}
          />
        ))}
      </div>

      {/* Modal */}
      {showAdd && (
        <AddLoanModal
          editing={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { setShowAdd(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BankIllustration() {
  return (
    <svg width="220" height="160" viewBox="0 0 220 160" fill="none">
      {/* Coins floating */}
      <circle cx="48" cy="42" r="14" fill="#f59e0b" opacity="0.9"/>
      <text x="48" y="47" textAnchor="middle" fontSize="12" fill="#fff" fontWeight="700">₨</text>
      <circle cx="172" cy="30" r="12" fill="#f59e0b" opacity="0.85"/>
      <text x="172" y="35" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700">₨</text>
      <circle cx="190" cy="70" r="11" fill="#f59e0b" opacity="0.8"/>
      <text x="190" y="74" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700">₨</text>
      <circle cx="36" cy="80" r="10" fill="#f59e0b" opacity="0.75"/>
      <text x="36" y="84" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="700">₨</text>
      {/* Building */}
      <rect x="68" y="90" width="84" height="58" fill="#d1d5db" rx="2"/>
      <rect x="68" y="90" width="84" height="58" fill="url(#bldg)" rx="2"/>
      <defs>
        <linearGradient id="bldg" x1="68" y1="90" x2="152" y2="148" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e5e7eb"/>
          <stop offset="1" stopColor="#9ca3af"/>
        </linearGradient>
      </defs>
      {/* Roof / pediment */}
      <polygon points="60,90 110,62 160,90" fill="#6b7280"/>
      {/* Triangle detail */}
      <polygon points="76,90 110,70 144,90" fill="#dc2626" opacity="0.8"/>
      {/* Columns */}
      {[82,97,112,127,142].map(x => (
        <rect key={x} x={x} y={90} width={7} height={58} fill="#f3f4f6"/>
      ))}
      {/* Door */}
      <rect x="100" y="120" width="20" height="28" fill="#1f2937" rx="2"/>
      {/* Steps */}
      <rect x="62" y="148" width="96" height="5" fill="#9ca3af" rx="1"/>
      <rect x="58" y="153" width="104" height="4" fill="#6b7280" rx="1"/>
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

function EmiIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20" strokeLinecap="round"/>
      <path d="M7 15h.01M12 15h.01M17 15h.01" strokeLinecap="round" strokeWidth="2.5"/>
    </svg>
  );
}

function FlexIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8">
      <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round"/>
    </svg>
  );
}

import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

type CashTxn = {
  id: string;
  type: string;
  rawType: string;
  name: string;
  date: string;
  amount: number;
  direction: "in" | "out";
  invoiceNo: string | null;
};

type CashData = { balance: number; transactions: CashTxn[] };

function fmt(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function rs(n: number) {
  return `Rs ${Math.abs(n).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// ─── Adjust Cash Modal ────────────────────────────────────────────────────────

function AdjustCashModal({
  currentBalance,
  onClose,
  onSaved,
}: {
  currentBalance: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode]       = useState<"add" | "reduce">("add");
  const [amount, setAmount]   = useState("");
  const [date, setDate]       = useState(today());
  const [desc, setDesc]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const parsedAmount = parseFloat(amount) || 0;
  const updatedBalance =
    mode === "add"
      ? currentBalance + parsedAmount
      : currentBalance - parsedAmount;

  async function handleSave() {
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.adjustCash({ mode, amount: parsedAmount, date, description: desc });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cih-modal-overlay" onClick={onClose}>
      <div className="cih-modal" onClick={e => e.stopPropagation()}>
        <div className="cih-modal__header">
          <span className="cih-modal__title">Adjust Cash</span>
          <button type="button" className="cih-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* Radio row */}
        <div className="cih-modal__radio-row">
          <label className="cih-radio">
            <input type="radio" name="mode" value="add"    checked={mode==="add"}    onChange={() => setMode("add")}    />
            Add Cash
          </label>
          <label className="cih-radio">
            <input type="radio" name="mode" value="reduce" checked={mode==="reduce"} onChange={() => setMode("reduce")} />
            Reduce Cash
          </label>
        </div>

        {/* Amount */}
        <div className="cih-modal__field">
          <label className="cih-modal__label">Enter Amount <span className="cih-required">*</span></label>
          <input
            className="cih-modal__input"
            type="number"
            min="0"
            placeholder="Rs 0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            autoFocus
          />
          <div className="cih-modal__preview">
            Updated Cash: &nbsp;
            <strong style={{ color: updatedBalance >= 0 ? "#16a34a" : "#dc2626" }}>
              {rs(updatedBalance)}
            </strong>
          </div>
        </div>

        {/* Date */}
        <div className="cih-modal__field">
          <label className="cih-modal__label">Adjustment Date</label>
          <input
            className="cih-modal__input cih-modal__date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="cih-modal__field">
          <label className="cih-modal__label">Description</label>
          <input
            className="cih-modal__input"
            type="text"
            placeholder="Enter Description"
            value={desc}
            onChange={e => setDesc(e.target.value)}
          />
        </div>

        {error && <div className="cih-modal__error">{error}</div>}

        <div className="cih-modal__footer">
          <button type="button" className="cih-modal__btn-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="cih-modal__btn-save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function CashInHandScreen() {
  const [data, setData]               = useState<CashData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showAdjust, setShowAdjust]   = useState(false);
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCashInHand();
      setData(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load Cash In Hand data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = data?.transactions.filter(t => {
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.type.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || t.rawType === typeFilter;
    return matchSearch && matchType;
  }) ?? [];

  const uniqueTypes = Array.from(new Set(data?.transactions.map(t => t.rawType) ?? []));

  return (
    <section className="cih-screen">
      {/* ── Header ── */}
      <div className="cih-header">
        <div className="cih-header__left">
          <h1 className="cih-header__title">Cash In Hand</h1>
          {data && (
            <span className="cih-header__balance">
              Rs {data.balance.toLocaleString("en-PK", { minimumFractionDigits: 0 })}
            </span>
          )}
        </div>
        <button
          type="button"
          className="cih-adjust-btn"
          onClick={() => setShowAdjust(true)}
          disabled={loading}
        >
          ⇄ Adjust Cash
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="cih-filterbar">
        <div className="cih-search">
          <SearchIcon />
          <input
            className="cih-search__input"
            placeholder="Search Transactions"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="cih-type-select"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          {uniqueTypes.map(t => (
            <option key={t} value={t}>{data?.transactions.find(x => x.rawType === t)?.type ?? t}</option>
          ))}
        </select>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="cih-state">Loading…</div>
      ) : error ? (
        <div className="cih-state cih-state--error">{error}</div>
      ) : (
        <div className="cih-table-wrap">
          <table className="cih-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Date <SortIcon /></th>
                <th className="cih-num">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cih-empty">No transactions found.</td>
                </tr>
              ) : (
                filtered.map(t => (
                  <tr key={t.id}>
                    <td>
                      <span className={`cih-type-badge cih-type-badge--${t.direction}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="cih-name">{t.name}</td>
                    <td className="cih-date">{fmt(t.date)}</td>
                    <td className={`cih-num ${t.direction === "in" ? "cih-green" : "cih-red"}`}>
                      {t.direction === "out" && "-"}{rs(t.amount)}
                    </td>
                    <td className="cih-actions">
                      <button type="button" className="cih-dots" title="More">⋮</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer total ── */}
      {data && !loading && (
        <div className="cih-footer">
          <span>
            Total Transactions: <strong>{filtered.length}</strong>
          </span>
          <span>
            Cash Balance: &nbsp;
            <strong style={{ color: data.balance >= 0 ? "#16a34a" : "#dc2626" }}>
              Rs {data.balance.toLocaleString("en-PK", { minimumFractionDigits: 0 })}
            </strong>
          </span>
        </div>
      )}

      {/* ── Adjust Cash Modal ── */}
      {showAdjust && (
        <AdjustCashModal
          currentBalance={data?.balance ?? 0}
          onClose={() => setShowAdjust(false)}
          onSaved={() => { setShowAdjust(false); load(); }}
        />
      )}
    </section>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 3, verticalAlign: "middle" }}>
      <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

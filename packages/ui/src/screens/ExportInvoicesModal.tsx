import { useState } from "react";
import { createPortal } from "react-dom";
import type { SaleRow } from "./InvoicePreviewModal";

type Props = {
  sales: SaleRow[];
  filterLabel: string;
  onClose: () => void;
  onContinue: (selected: SaleRow[]) => void;
};

const PK_TZ = "Asia/Karachi";
function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: PK_TZ });
}

// Selection step in front of BulkInvoicePreviewModal — "Export to PDF" used to unconditionally
// export every invoice matching the Sale list's current filters with no way to leave any out.
// This shows that same filtered set (carrying over the exact date range/salesman/status the
// Sale screen already has applied) with a checkbox per row, defaulting to all-selected so the
// old one-click behavior still works, but letting the user narrow it down first.
export function ExportInvoicesModal({ sales, filterLabel, onClose, onContinue }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(sales.map((s) => s.id)));

  const allSelected = selected.size === sales.length && sales.length > 0;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sales.map((s) => s.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return createPortal(
    <div className="eim-overlay">
      <div className="eim-modal">
        <div className="eim-header">
          <div>
            <div className="eim-title">Export Invoices</div>
            <div className="eim-subtitle">{filterLabel}</div>
          </div>
          <button type="button" className="eim-btn" onClick={onClose}>✕ Close</button>
        </div>

        <div className="eim-toolbar">
          <label className="eim-checkall">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Select All
          </label>
          <span className="eim-count">{selected.size} of {sales.length} selected</span>
        </div>

        <div className="eim-list">
          {sales.length === 0 ? (
            <div className="eim-empty">No invoices match the current filters.</div>
          ) : (
            <table className="eim-table">
              <thead>
                <tr>
                  <th className="eim-th-check" />
                  <th>Party Name</th>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale, i) => (
                  <tr key={sale.id} onClick={() => toggleOne(sale.id)}>
                    <td className="eim-th-check">
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

        <div className="eim-footer">
          <button type="button" className="eim-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="eim-btn eim-btn--primary"
            disabled={selected.size === 0}
            onClick={() => onContinue(sales.filter((s) => selected.has(s.id)))}
          >
            Continue with {selected.size} Invoice{selected.size === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

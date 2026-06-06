import { useState } from "react";
import * as XLSX from "xlsx";
import type { Party, Transaction } from "@vyapar/api-client";

export interface ExcelColumns {
  date: boolean;
  type: boolean;
  number: boolean;
  total: boolean;
  receivedPaid: boolean;
  txnBalance: boolean;
  receivableBalance: boolean;
  payableBalance: boolean;
  notes: boolean;
}

const COLUMN_LABELS: [keyof ExcelColumns, string][] = [
  ["date", "Date"],
  ["type", "Transaction Type"],
  ["number", "Ref No."],
  ["total", "Total"],
  ["receivedPaid", "Received / Paid"],
  ["txnBalance", "Txn Balance"],
  ["receivableBalance", "Receivable Balance"],
  ["payableBalance", "Payable Balance"],
  ["notes", "Notes"],
];

function txnTypeLabel(txn: Transaction): string {
  switch (txn.type) {
    case "sale": return "Sale";
    case "purchase": return "Purchase";
    case "payment_in": return "Payment-In";
    case "payment_out": return "Payment-Out";
    case "credit_note": return "Credit Note";
    case "debit_note": return "Debit Note";
    case "expense": return "Expense";
    case "opening_balance": return txn.balance >= 0 ? "Receivable Opening Balance" : "Payable Opening Balance";
    default: return txn.type;
  }
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB");
}

export function downloadPartyExcel(party: Party, displayTxns: Transaction[], cols: ExcelColumns) {
  const headers: string[] = [];
  if (cols.date) headers.push("Date");
  if (cols.type) headers.push("Transaction Type");
  if (cols.number) headers.push("Ref No.");
  if (cols.total) headers.push("Total");
  if (cols.receivedPaid) headers.push("Received / Paid");
  if (cols.txnBalance) headers.push("Txn Balance");
  if (cols.receivableBalance) headers.push("Receivable Balance");
  if (cols.payableBalance) headers.push("Payable Balance");
  if (cols.notes) headers.push("Notes");

  const rows = displayTxns.map((txn) => {
    const row: (string | number)[] = [];
    if (cols.date) row.push(fmtDate(txn.date));
    if (cols.type) row.push(txnTypeLabel(txn));
    if (cols.number) row.push(txn.number ?? "");
    if (cols.total) row.push(txn.total !== 0 ? `Rs ${fmt(txn.total)}` : "");
    if (cols.receivedPaid) row.push("");
    if (cols.txnBalance) row.push(txn.balance !== 0 ? `Rs ${fmt(txn.balance)}` : "");
    if (cols.receivableBalance) row.push(txn.balance > 0 ? `Rs ${fmt(txn.balance)}` : "");
    if (cols.payableBalance) row.push(txn.balance < 0 ? `Rs ${fmt(Math.abs(txn.balance))}` : "");
    if (cols.notes) row.push(txn.notes ?? "");
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  // Style header row bold
  headers.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cell]) ws[cell].s = { font: { bold: true } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Party Statement");
  XLSX.writeFile(wb, `${party.name.replace(/[^a-z0-9]/gi, "_")}_statement.xlsx`);
}

interface Props {
  onClose: () => void;
  onOk: (cols: ExcelColumns) => void;
}

export function ExcelColumnsModal({ onClose, onOk }: Props) {
  const [cols, setCols] = useState<ExcelColumns>({
    date: true,
    type: true,
    number: true,
    total: true,
    receivedPaid: false,
    txnBalance: true,
    receivableBalance: true,
    payableBalance: true,
    notes: false,
  });

  function toggle(key: keyof ExcelColumns) {
    setCols((c) => ({ ...c, [key]: !c[key] }));
  }

  return (
    <div className="po-backdrop" onClick={onClose}>
      <div className="po-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="po-title">Select Columns</h2>

        <div className="po-options">
          {COLUMN_LABELS.map(([key, label]) => (
            <label key={key} className="po-option-row">
              <span className="po-option-label">{label}</span>
              <input
                type="checkbox"
                className="po-checkbox"
                checked={cols[key]}
                onChange={() => toggle(key)}
              />
            </label>
          ))}
        </div>

        <div className="po-footer">
          <button type="button" className="po-btn-cancel" onClick={onClose}>CANCEL</button>
          <button type="button" className="po-btn-ok" onClick={() => onOk(cols)}>
            Download Excel
          </button>
        </div>
      </div>
    </div>
  );
}

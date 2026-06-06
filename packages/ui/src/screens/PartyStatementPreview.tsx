import { useEffect, useRef, useState } from "react";
import type { Party, Transaction } from "@vyapar/api-client";
import { api } from "../lib/api";
import type { PrintOptions } from "./PrintOptionsModal";

interface Props {
  party: Party;
  transactions: Transaction[];
  displayTxns: Transaction[];
  options: PrintOptions;
  onClose: () => void;
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB").replace(/\//g, "/");
}

function typeLabel(txn: Transaction): string {
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

export function PartyStatementPreview({ party, displayTxns, options, onClose }: Props) {
  const [businessName, setBusinessName] = useState("My Business");
  const [businessPhone, setBusinessPhone] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getMe().then((u) => {
      if (u.name) setBusinessName(u.name);
    }).catch(() => {});
  }, []);

  const totalReceivable = displayTxns.reduce((s, t) => t.balance > 0 ? s + t.balance : s, 0);
  const totalPayable = displayTxns.reduce((s, t) => t.balance < 0 ? s + Math.abs(t.balance) : s, 0);

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Party Statement - ${party.name}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
          .stmt-header { text-align: center; margin-bottom: 20px; }
          .stmt-header h1 { font-size: 16px; font-weight: 700; }
          .stmt-header p { font-size: 12px; color: #555; margin-top: 2px; }
          .stmt-title { text-align: center; font-size: 18px; font-weight: 700; text-decoration: underline; margin-bottom: 16px; }
          .stmt-party { margin-bottom: 14px; }
          .stmt-party h2 { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
          .stmt-party p { font-size: 12px; color: #333; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f5f5f5; font-weight: 700; text-align: left; padding: 6px 8px; border: 1px solid #ddd; }
          td { padding: 5px 8px; border: 1px solid #eee; }
          .total-row td { font-weight: 700; background: #f9f9f9; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  function handleSavePDF() {
    handlePrint();
  }

  function handleOpenPDF() {
    handlePrint();
  }

  const statementHtml = (
    <div ref={printRef}>
      <div className="stmt-header">
        <h1>{businessName}</h1>
        {businessPhone && <p>Phone no.: {businessPhone}</p>}
      </div>

      <div className="stmt-title">Party statement</div>

      <div className="stmt-party">
        <h2>Party name: {party.name}</h2>
        {party.phone && <p>Contact No.: {party.phone}</p>}
        {party.email && <p>Email: {party.email}</p>}
        {party.billingAddress && (
          <p>Address: {[party.billingAddress, party.city, party.state].filter(Boolean).join(", ")}</p>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Txn Type</th>
            <th>Ref No.</th>
            <th>Total</th>
            <th>Received / Paid</th>
            <th>Txn Balance</th>
            <th>Receivable Balance</th>
            <th>Payable Balance</th>
          </tr>
        </thead>
        <tbody>
          {displayTxns.map((txn) => (
            <tr key={txn.id}>
              <td>{fmtDate(txn.date)}</td>
              <td><strong>{typeLabel(txn)}</strong></td>
              <td>{txn.number ?? ""}</td>
              <td>{txn.total !== 0 ? `Rs ${fmt(txn.total)}` : ""}</td>
              <td></td>
              <td>{txn.balance !== 0 ? `Rs ${fmt(txn.balance)}` : ""}</td>
              <td>{txn.balance > 0 ? `Rs ${fmt(txn.balance)}` : ""}</td>
              <td>{txn.balance < 0 ? `Rs ${fmt(Math.abs(txn.balance))}` : ""}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td></td>
            <td><strong>Total</strong></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>{totalReceivable > 0 ? `Rs ${fmt(totalReceivable)}` : ""}</td>
            <td>{totalPayable > 0 ? `Rs ${fmt(totalPayable)}` : ""}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="ps-preview-backdrop" onClick={onClose}>
      <div className="ps-preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ps-preview-header">
          <span className="ps-preview-title">Preview</span>
          <button type="button" className="ps-preview-close" onClick={onClose}>×</button>
        </div>

        {/* Statement content */}
        <div className="ps-preview-body">
          <div className="ps-stmt" ref={printRef}>
            <div className="ps-stmt__header">
              <div className="ps-stmt__biz-name">{businessName}</div>
              {businessPhone && <div className="ps-stmt__biz-phone">Phone no.: {businessPhone}</div>}
            </div>

            <div className="ps-stmt__title">Party statement</div>

            <div className="ps-stmt__party">
              <div className="ps-stmt__party-name">Party name: {party.name}</div>
              {party.phone && <div className="ps-stmt__party-field">Contact No.: {party.phone}</div>}
              {party.email && <div className="ps-stmt__party-field">Email: {party.email}</div>}
              {party.billingAddress && (
                <div className="ps-stmt__party-field">
                  Address: {[party.billingAddress, party.city, party.state].filter(Boolean).join(", ")}
                </div>
              )}
            </div>

            <table className="ps-stmt__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Txn Type</th>
                  <th>Ref No.</th>
                  <th>Total</th>
                  <th>Received / Paid</th>
                  <th>Txn Balance</th>
                  <th>Receivable Balance</th>
                  <th>Payable Balance</th>
                </tr>
              </thead>
              <tbody>
                {displayTxns.map((txn) => (
                  <tr key={txn.id}>
                    <td>{fmtDate(txn.date)}</td>
                    <td><strong>{typeLabel(txn)}</strong></td>
                    <td>{txn.number ?? ""}</td>
                    <td>{txn.total !== 0 ? `Rs ${fmt(txn.total)}` : ""}</td>
                    <td></td>
                    <td>{txn.balance !== 0 ? `Rs ${fmt(txn.balance)}` : ""}</td>
                    <td>{txn.balance > 0 ? `Rs ${fmt(txn.balance)}` : ""}</td>
                    <td>{txn.balance < 0 ? `Rs ${fmt(Math.abs(txn.balance))}` : ""}</td>
                  </tr>
                ))}
                <tr className="ps-stmt__total-row">
                  <td></td>
                  <td><strong>Total</strong></td>
                  <td></td><td></td><td></td><td></td>
                  <td>{totalReceivable > 0 ? `Rs ${fmt(totalReceivable)}` : ""}</td>
                  <td>{totalPayable > 0 ? `Rs ${fmt(totalPayable)}` : ""}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer actions */}
        <div className="ps-preview-footer">
          <button type="button" className="ps-preview-btn" onClick={handleOpenPDF}>Open PDF</button>
          <button type="button" className="ps-preview-btn" onClick={handlePrint}>Print</button>
          <button type="button" className="ps-preview-btn" onClick={handleSavePDF}>Save PDF</button>
          <button type="button" className="ps-preview-btn">Email PDF</button>
          <button type="button" className="ps-preview-btn ps-preview-btn--close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

import type { TxnWithParty } from "./txnHandoff";

export function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" });
}

export function numberToWords(n: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (n === 0) return "Zero";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numberToWords(n % 100) : "");
  if (n < 100000) return numberToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numberToWords(n % 1000) : "");
  return numberToWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + numberToWords(n % 100000) : "");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type NoteLineItem = { name?: string; qty?: number; unit?: string; rate?: number; mrp?: number; discount?: number };

// Notes have two shapes in the wild: a bare array of line items, or an object carrying
// `{ items: [...], ... }` alongside metadata like discount/roundOff/paymentType — same
// dual shape the backend's reports service parses for the same historical reason.
export function parseNoteItems(notes: string | null): NoteLineItem[] {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes);
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
    return items.filter((i: any) => i?.name);
  } catch {
    return [];
  }
}

// Shared by the Sale list screen, the Home transaction list, and the transaction detail
// screen — one invoice template so Print/Share/Download all produce the same PDF.
export function buildInvoiceHtml(txn: TxnWithParty, invoiceNo: string | number): string {
  const items = parseNoteItems(txn.notes);
  const received = txn.total - txn.balance;
  const amountWords = numberToWords(Math.round(txn.total)) + " Rupees only";

  const itemRows = items.length
    ? items.map((it, i) => {
        const qty = it.qty ?? 0;
        const rate = it.rate ?? 0;
        return `<tr><td>${i + 1}</td><td>${escapeHtml(it.name ?? "")}</td><td>${qty}</td><td>${escapeHtml(it.unit ?? "—")}</td><td>Rs ${fmt(rate)}</td><td>Rs ${fmt(qty * rate)}</td></tr>`;
      }).join("")
    : `<tr><td>1</td><td>—</td><td>1</td><td>—</td><td>Rs ${fmt(txn.total)}</td><td>Rs ${fmt(txn.total)}</td></tr>`;

  return `
<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; margin: 0; padding: 20px; }
  .company { font-weight: bold; font-size: 14px; }
  .phone { color: #555; font-size: 10px; margin-bottom: 4px; }
  hr { border: none; border-top: 1px solid #aaa; margin: 6px 0; }
  .title { text-align: center; color: #6366f1; font-size: 15px; font-weight: bold; margin: 8px 0; }
  .two-col { display: flex; justify-content: space-between; margin: 8px 0; }
  .bill-to { font-weight: bold; }
  .inv-details { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  thead tr { background: #6366f1; color: #fff; }
  thead th { padding: 6px 8px; text-align: left; font-size: 10px; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .total-row td { font-weight: bold; }
  .summary { display: flex; justify-content: space-between; margin-top: 10px; }
  .words { flex: 1; }
  .amounts { text-align: right; min-width: 200px; }
  .amounts table { margin: 0; }
  .amounts td { padding: 2px 6px; }
  .highlight { background: #6366f1; color: #fff; font-weight: bold; }
  .footer-sig { text-align: right; margin-top: 40px; font-weight: bold; }
  .footer-brand { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; color: #6366f1; font-size: 10px; }
</style></head><body>
  <div class="company">Godigi</div>
  <div class="phone">Phone no.: ${escapeHtml(txn.partyName)}</div>
  <hr/>
  <div class="title">Invoice</div>
  <div class="two-col">
    <div>
      <div style="font-size:10px;color:#555;">Bill To</div>
      <div class="bill-to">${escapeHtml(txn.partyName)}</div>
    </div>
    <div class="inv-details">
      <div style="font-size:10px;color:#555;">Invoice Details</div>
      <div>Invoice No.: ${invoiceNo}</div>
      <div>Date: ${formatDate(txn.date)}</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>Item name</th><th>Quantity</th><th>Unit</th><th>Price/ Unit</th><th>Amount</th>
    </tr></thead>
    <tbody>
      ${itemRows}
      <tr class="total-row"><td colspan="4"><strong>Total</strong></td><td></td><td><strong>Rs ${fmt(txn.total)}</strong></td></tr>
    </tbody>
  </table>
  <div class="summary">
    <div class="words">
      <div><strong>Invoice Amount In Words</strong></div>
      <div>${amountWords}</div>
      <br/>
      <div><strong>Terms And Conditions</strong></div>
      <div>Thanks for doing business with us!</div>
    </div>
    <div class="amounts">
      <table>
        <tr><td>Sub Total</td><td>Rs ${fmt(txn.total)}</td></tr>
        <tr class="highlight"><td>Total</td><td>Rs ${fmt(txn.total)}</td></tr>
        <tr><td>Received</td><td>Rs ${fmt(received)}</td></tr>
        <tr><td>Balance</td><td>Rs ${fmt(txn.balance)}</td></tr>
      </table>
    </div>
  </div>
  <div class="footer-sig">For: Godigi<br/><br/><br/>Authorized Signatory</div>
  <div class="footer-brand"><span>▼ Godigi</span></div>
</body></html>`;
}

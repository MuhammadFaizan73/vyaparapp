import type { TxnWithParty } from "./txnHandoff";
import { THEME_MAP, isLight, type ThemeConfig } from "./invoiceThemes";

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

export type NoteLineItem = { name?: string; qty?: number; unit?: string; rate?: number; mrp?: number; discount?: number; itemId?: string };

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

export type InvoiceHtmlOptions = {
  themeName?: string;
  color?: string;
  companyName?: string;
  companyPhone?: string;
};

// Shared by the Sale list screen, the Home transaction list, and the transaction detail
// screen — one invoice template so Print/Share/Download all produce the same PDF.
// Theme-aware (see invoiceThemes.ts) so it matches whatever's picked in Settings > Print.
export function buildInvoiceHtml(txn: TxnWithParty, invoiceNo: string | number, opts: InvoiceHtmlOptions = {}): string {
  const tc: ThemeConfig = THEME_MAP[opts.themeName ?? "Tally Theme"] ?? THEME_MAP["Tally Theme"];
  const color = opts.color ?? "#3b82f6";
  const fg = isLight(color) ? "#111827" : "#ffffff";
  const companyName = opts.companyName || "Godigi";
  const companyPhone = opts.companyPhone ?? "";

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

  // Tax/discount breakdown isn't persisted per-invoice (only the final total is), so this
  // is a best-effort reconstruction from the raw item subtotal vs. the saved total — same
  // approach as desktop's amountBreakdown() in InvoicePreviewModal.tsx.
  const subTotal = items.length ? items.reduce((s, it) => s + (it.qty ?? 0) * (it.rate ?? 0), 0) : txn.total;
  const discount = Math.max(0, subTotal - txn.total);

  const headerHtml = tc.bannerRounded
    ? `<div style="background:${color};color:${fg};padding:12px 16px;border-radius:0 0 24px 0;display:flex;justify-content:space-between;align-items:center;">
         <div style="font-weight:bold;font-size:16px;">${escapeHtml(companyName)}</div>
         ${companyPhone ? `<div style="font-size:10px;padding:3px 10px;border-radius:12px;background:rgba(255,255,255,0.2);">${escapeHtml(companyPhone)}</div>` : ""}
       </div>`
    : tc.headerBand
    ? `<div style="background:${color};color:${fg};padding:10px 14px;">
         <div style="font-weight:bold;font-size:14px;">${escapeHtml(companyName)}</div>
         ${companyPhone ? `<div style="font-size:10px;opacity:0.85;">Phone no.: ${escapeHtml(companyPhone)}</div>` : ""}
       </div>`
    : `<div class="company">${escapeHtml(companyName)}</div>
       ${companyPhone ? `<div class="phone">Phone no.: ${escapeHtml(companyPhone)}</div><hr/>` : "<hr/>"}`;

  const titleColor = tc.colorTitle ? color : "#111827";
  const sectionHdrStyle = tc.colorSectionHead ? `background:${color};color:${fg};padding:3px 8px;` : `color:#555;`;
  const tableHeadStyle = tc.colorTableHead ? `background:${color};color:${fg};` : `background:#f3f4f6;color:#374151;`;
  const borderStyle = tc.bordered ? "border:1px solid #111827;" : "";

  const amountsHtml = tc.taxSummaryTable
    ? `<div style="display:flex;flex-wrap:wrap;${tc.bordered ? "border-top:1px solid #111827;border-bottom:1px solid #111827;" : "border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;"}margin-top:10px;">
         ${[["Sub Total", subTotal], ["Discount", discount], ["Tax", 0], ["TCS", 0], ["Total", txn.total], ["Received", received], ["Balance", txn.balance], ["You Saved", discount]]
           .map(([label, val]) => `<div style="flex:1;min-width:90px;padding:5px 8px;font-size:9.5px;display:flex;justify-content:space-between;border-right:1px solid #e5e7eb;"><span>${label}</span><span>Rs ${fmt(Number(val))}</span></div>`).join("")}
       </div>
       <table style="${borderStyle}margin-top:6px;">
         <thead><tr style="${tableHeadStyle}"><th>HSN/SAC</th><th>Taxable amount(Rs)</th><th>Rate(%)</th><th>Tax amount(Rs)</th></tr></thead>
         <tbody><tr><td>—</td><td>Rs ${fmt(subTotal)}</td><td>0%</td><td>Rs 0.00</td></tr></tbody>
       </table>`
    : `<div class="summary">
    <div class="words">
      <div style="${sectionHdrStyle}"><strong>Invoice Amount In Words</strong></div>
      <div>${amountWords}</div>
      <br/>
      <div style="${sectionHdrStyle}"><strong>Terms And Conditions</strong></div>
      <div>Thanks for doing business with us!</div>
    </div>
    <div class="amounts">
      <table>
        <tr><td>Sub Total</td><td>Rs ${fmt(txn.total)}</td></tr>
        <tr class="highlight" style="background:${color};color:${fg};"><td>Total</td><td>Rs ${fmt(txn.total)}</td></tr>
        <tr><td>Received</td><td>Rs ${fmt(received)}</td></tr>
        <tr><td>Balance</td><td>Rs ${fmt(txn.balance)}</td></tr>
      </table>
    </div>
  </div>`;

  return `
<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; margin: 0; padding: 20px; }
  .company { font-weight: bold; font-size: 14px; padding: 14px 0 0; }
  .phone { color: #555; font-size: 10px; margin-bottom: 4px; }
  hr { border: none; border-top: 1px solid #aaa; margin: 6px 0; }
  .title { text-align: center; font-size: 15px; font-weight: bold; margin: 8px 0; color: ${titleColor}; }
  .two-col { display: flex; justify-content: space-between; margin: 8px 0; ${borderStyle} }
  .bill-to { font-weight: bold; }
  .inv-details { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; ${borderStyle} }
  thead tr { ${tableHeadStyle} }
  thead th { padding: 6px 8px; text-align: left; font-size: 10px; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .total-row td { font-weight: bold; }
  .summary { display: flex; justify-content: space-between; margin-top: 10px; }
  .words { flex: 1; }
  .amounts { text-align: right; min-width: 200px; }
  .amounts table { margin: 0; }
  .amounts td { padding: 2px 6px; }
  .footer-sig { text-align: right; margin-top: 40px; font-weight: bold; }
  .footer-brand { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; color: ${color}; font-size: 10px; }
</style></head><body>
  ${headerHtml}
  <div class="title">${txn.type === "sale" ? "Invoice" : "Purchase Bill"}</div>
  <div class="two-col">
    <div style="padding:6px 10px;">
      <div style="${sectionHdrStyle}font-size:10px;">Bill To</div>
      <div class="bill-to">${escapeHtml(txn.partyName)}</div>
    </div>
    <div class="inv-details" style="padding:6px 10px;">
      <div style="${sectionHdrStyle}font-size:10px;">Invoice Details</div>
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
  ${amountsHtml}
  <div class="footer-sig">For: ${escapeHtml(companyName)}<br/><br/><br/>Authorized Signatory</div>
  <div class="footer-brand"><span>▼ ${escapeHtml(companyName)}</span></div>
</body></html>`;
}

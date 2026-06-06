import { createPortal } from "react-dom";
import type { Transaction, Party } from "@vyapar/api-client";

export type SaleRow = Transaction & { partyName: string };

type LineItem = { name: string; qty: number; unit: string };

function parseLineItems(notes: string | null): LineItem[] {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((i) => ({
        name: i.name ?? "",
        qty:  Number(i.qty)  || 0,
        unit: i.unit ?? "—",
      })).filter((i) => i.name.trim() && i.qty > 0);
    }
  } catch { /* not JSON */ }
  return [];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

type Props = {
  sale:          SaleRow;
  invoiceNumber: number;
  party?:        Party;
  onClose:       () => void;
};

export function DeliveryChallanModal({ sale, invoiceNumber, party, onClose }: Props) {
  const lineItems   = parseLineItems(sale.notes);
  const totalQty    = lineItems.reduce((s, i) => s + i.qty, 0);
  const companyName = "Rootocloud";
  const companyPhone = party?.phone ?? "03139200720";

  function handlePrint() {
    window.print();
  }

  return createPortal(
    <div className="dc-overlay" onClick={onClose}>
      <div className="dc-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header bar */}
        <div className="dc-modal-header">
          <span className="dc-modal-title">Preview</span>
          <button type="button" className="dc-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Document */}
        <div className="dc-body">
          <div className="dc-paper" id="dc-printable">

            {/* Company band */}
            <div className="dc-band">
              <div className="dc-band__name">{companyName}</div>
              <div className="dc-band__phone">Phone no. : {companyPhone}</div>
            </div>

            {/* Document title */}
            <div className="dc-doc-title">Delivery Challan</div>

            {/* Bill To + Invoice Details */}
            <div className="dc-meta">
              <div className="dc-meta__col">
                <div className="dc-meta__hdr">Bill To</div>
                <div className="dc-meta__body">
                  <div className="dc-meta__name">{sale.partyName}</div>
                  {party?.billingAddress && (
                    <div className="dc-meta__sub">{party.billingAddress}</div>
                  )}
                  {party?.phone && (
                    <div className="dc-meta__sub">Contact No. : {party.phone}</div>
                  )}
                </div>
              </div>
              <div className="dc-meta__col">
                <div className="dc-meta__hdr">Invoice Details</div>
                <div className="dc-meta__body">
                  <div className="dc-meta__sub">Invoice No. : {invoiceNumber}</div>
                  <div className="dc-meta__sub">Date : {fmtDate(sale.date)}</div>
                </div>
              </div>
            </div>

            {/* Items table — no price columns */}
            <table className="dc-table">
              <thead>
                <tr className="dc-thead-row">
                  <th className="dc-th dc-th--num">#</th>
                  <th className="dc-th">Item name</th>
                  <th className="dc-th dc-th--num">Quantity</th>
                  <th className="dc-th dc-th--unit">Unit</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length > 0 ? lineItems.map((item, idx) => (
                  <tr key={idx} className="dc-tr">
                    <td className="dc-td dc-td--num">{idx + 1}</td>
                    <td className="dc-td">{item.name}</td>
                    <td className="dc-td dc-td--num">{item.qty}</td>
                    <td className="dc-td">{item.unit}</td>
                  </tr>
                )) : (
                  <tr className="dc-tr">
                    <td className="dc-td dc-td--num">1</td>
                    <td className="dc-td">Sale</td>
                    <td className="dc-td dc-td--num">1</td>
                    <td className="dc-td">—</td>
                  </tr>
                )}
                <tr className="dc-tr dc-tr--total">
                  <td className="dc-td dc-td--num" />
                  <td className="dc-td"><strong>Total</strong></td>
                  <td className="dc-td dc-td--num"><strong>{lineItems.length > 0 ? totalQty : 1}</strong></td>
                  <td className="dc-td" />
                </tr>
              </tbody>
            </table>

            {/* Terms */}
            <div className="dc-section-hdr">Terms and Conditions</div>
            <div className="dc-terms">Thanks for doing business with us!</div>

            {/* Signature row */}
            <div className="dc-sign-row">
              <div className="dc-sign-box">
                <div className="dc-sign-box__hdr">Received By</div>
                <div className="dc-sign-field"><span>Name:</span></div>
                <div className="dc-sign-field"><span>Comment:</span></div>
                <div className="dc-sign-field"><span>Date:</span></div>
                <div className="dc-sign-field"><span>Signature:</span></div>
              </div>
              <div className="dc-sign-box">
                <div className="dc-sign-box__hdr">Delivered By</div>
                <div className="dc-sign-field"><span>Name:</span></div>
                <div className="dc-sign-field"><span>Comment:</span></div>
                <div className="dc-sign-field"><span>Date:</span></div>
                <div className="dc-sign-field"><span>Signature:</span></div>
              </div>
              <div className="dc-sign-auth">
                <div>For : {companyName}</div>
                <div className="dc-sign-auth__lbl">Authorized Signatory</div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer actions */}
        <div className="dc-footer">
          <button type="button" className="dc-footer-btn dc-footer-btn--outline" onClick={handlePrint}>
            Open PDF
          </button>
          <button type="button" className="dc-footer-btn dc-footer-btn--outline" onClick={handlePrint}>
            Print
          </button>
          <button type="button" className="dc-footer-btn dc-footer-btn--outline" onClick={handlePrint}>
            Save PDF
          </button>
          <button type="button" className="dc-footer-btn dc-footer-btn--outline">
            Email PDF
          </button>
          <button type="button" className="dc-footer-btn dc-footer-btn--primary" onClick={onClose}>
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { Party } from "@vyapar/api-client";
import { loadSettings } from "./SettingsScreen";
import { THEME_MAP, InvoicePaper, type SaleRow } from "./InvoicePreviewModal";

type Props = { sales: SaleRow[]; parties: Party[]; onClose: () => void };

// Bulk "Export to PDF" was producing a flat spreadsheet-style table — this instead reuses
// the same per-invoice paper (theme, colors, layout) the single-invoice preview shows, so a
// bulk export actually looks like the invoices themselves, one per page.
export function BulkInvoicePreviewModal({ sales, parties, onClose }: Props) {
  const [downloading, setDownloading] = useState<{ done: number; total: number } | null>(null);
  const paperRefs = useRef<Array<HTMLDivElement | null>>([]);

  const settings = loadSettings();
  // Same reasoning as the single-invoice preview — "Tally Theme" has no color band or
  // colored headers, so an unconfigured install should default to a nicer-looking theme.
  const theme = settings.printThemeName || "Theme 3";
  const color = settings.printColor || "#3b82f6";
  const tc = THEME_MAP[theme] ?? THEME_MAP["Theme 3"];
  const partyById = new Map(parties.map((p) => [p.id, p]));

  async function handleDownloadPdf() {
    if (downloading) return;
    setDownloading({ done: 0, total: sales.length });
    try {
      let doc: jsPDF | null = null;
      for (let i = 0; i < sales.length; i++) {
        const node = paperRefs.current[i];
        if (!node) continue;
        const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
        const imgData = canvas.toDataURL("image/png");
        const pxToMm = 25.4 / 96;
        const widthMm = canvas.width * pxToMm / 2;
        const heightMm = canvas.height * pxToMm / 2;
        if (!doc) {
          doc = new jsPDF({ orientation: heightMm > widthMm ? "portrait" : "landscape", unit: "mm", format: [widthMm, heightMm] });
        } else {
          doc.addPage([widthMm, heightMm], heightMm > widthMm ? "portrait" : "landscape");
        }
        doc.addImage(imgData, "PNG", 0, 0, widthMm, heightMm);
        setDownloading({ done: i + 1, total: sales.length });
      }
      doc?.save(`SaleInvoices_${sales.length}.pdf`);
    } finally {
      setDownloading(null);
    }
  }

  return createPortal(
    <div className="bipv-overlay">
      <div className="bipv-root">
        <div className="bipv-actionbar">
          <span className="bipv-actionbar__title">{sales.length} Invoice{sales.length === 1 ? "" : "s"}</span>
          <div className="bipv-actionbar__actions">
            <button type="button" className="bipv-btn" onClick={() => window.print()}>🖨 Print</button>
            <button type="button" className="bipv-btn bipv-btn--primary" disabled={!!downloading} onClick={handleDownloadPdf}>
              {downloading ? `Preparing ${downloading.done}/${downloading.total}…` : "📄 Download PDF"}
            </button>
            <button type="button" className="bipv-btn" onClick={onClose}>✕ Close</button>
          </div>
        </div>
        <div className="bipv-pages">
          {sales.map((sale, i) => (
            <div key={sale.id} ref={(el) => { paperRefs.current[i] = el; }}
              className={`bipv-page ipv-paper${tc.thermal ? " ipv-paper--thermal" : ""}`}
              style={i > 0 ? { breakBefore: "page" } : undefined}>
              <InvoicePaper
                tc={tc} color={color} sale={sale} party={partyById.get(sale.partyId)}
                invoiceNumber={i + 1} received={sale.total - sale.balance}
              />
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

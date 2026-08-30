import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Mirrors exportToExcel's shape (array of plain row objects, keys = column headers) so every
// screen's existing Excel row-builder can feed both exporters without writing the columns twice.
export function exportRowsToPdf(rows: Record<string, unknown>[], title: string, filename: string) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]!);
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });

  doc.setFontSize(14);
  doc.text(title, 14, 15);

  autoTable(doc, {
    startY: 20,
    head: [columns],
    body: rows.map((r) => columns.map((c) => {
      const v = r[c];
      return typeof v === "number" ? v.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : String(v ?? "");
    })),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save(`${filename}.pdf`);
}

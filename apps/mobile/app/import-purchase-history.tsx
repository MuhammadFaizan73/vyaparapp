import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as XLSX from "xlsx";
import { colors } from "../src/theme";
import { api } from "../src/auth";
import { useSelectedCompany } from "../src/useSelectedCompany";
import { pickWorkbook, parseSheetDate } from "../src/xlsxImport";

const PURCHASE_REPORT_SHEET = "Purchase Report";
const ITEM_DETAILS_SHEET = "Item Details";
const REQUIRED_PURCHASE_REPORT_HEADERS = ["Date", "Invoice No", "Party Name", "Total Amount"];
const REQUIRED_ITEM_DETAILS_HEADERS = ["Invoice No./Txn No.", "Item Name", "Quantity", "UnitPrice"];

type RawRow = Record<string, unknown>;
type LineItem = { name: string; qty: number; unit?: string; rate: number };
type AggregatedItem = { name: string; unit?: string; sku?: string; purchasePrice?: number; lastTimestamp: number };
type AggregatedParty = { name: string; phone?: string };
type AggregatedInvoice = { number: string; date: string; partyName: string; transactionType: string; total: number; balance: number; lineItems: LineItem[] };
type Summary = {
  totalInvoiceRows: number; totalItemRows: number; items: AggregatedItem[]; parties: AggregatedParty[];
  invoices: AggregatedInvoice[]; skippedInvoices: number; skippedItemRows: number; minDate: string | null; maxDate: string | null;
};

// Unlike the Sale/Cash Flow exports, this report has a title/timestamp row (and sometimes
// a blank row) above the real header row — scan for the row that actually contains every
// required column. Ported from ImportPurchaseHistoryPage.tsx.
function findHeaderRowIndex(ws: XLSX.WorkSheet, requiredHeaders: string[], maxScanRows = 8): number {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  for (let i = 0; i < Math.min(maxScanRows, aoa.length); i++) {
    const row = (aoa[i] ?? []).map((c) => String(c ?? "").trim());
    if (requiredHeaders.every((h) => row.includes(h))) return i;
  }
  return -1;
}

function readSheetRows(ws: XLSX.WorkSheet, requiredHeaders: string[]): { rows: RawRow[]; headerRowIndex: number } {
  const headerRowIndex = findHeaderRowIndex(ws, requiredHeaders);
  if (headerRowIndex === -1) return { rows: [], headerRowIndex: -1 };
  const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { range: headerRowIndex, defval: "" });
  return { rows, headerRowIndex };
}

function buildSummary(purchaseRows: RawRow[], itemRows: RawRow[]): Summary {
  const itemRowsByInvoice = new Map<string, RawRow[]>();
  for (const r of itemRows) {
    const invoiceNo = String(r["Invoice No./Txn No."] ?? "").trim();
    if (!invoiceNo) continue;
    const list = itemRowsByInvoice.get(invoiceNo);
    if (list) list.push(r); else itemRowsByInvoice.set(invoiceNo, [r]);
  }

  const itemsByKey = new Map<string, AggregatedItem>();
  const partiesByKey = new Map<string, AggregatedParty>();
  const invoices: AggregatedInvoice[] = [];
  const seenInvoiceNumbers = new Set<string>();
  let skippedInvoices = 0, skippedItemRows = 0, minMs = Infinity, maxMs = -Infinity;

  for (const r of purchaseRows) {
    const invoiceNo = String(r["Invoice No"] ?? "").trim();
    const partyName = String(r["Party Name"] ?? "").trim();
    const dateIso = parseSheetDate(r["Date"]);
    const total = Number(r["Total Amount"]) || 0;
    const balanceRaw = r["Balance Due"];
    const balance = balanceRaw !== undefined && String(balanceRaw).trim() !== "" ? Number(balanceRaw) || 0 : total;
    const phone = String(r["Party Phone No."] ?? "").trim() || undefined;

    if (!invoiceNo || !partyName || !dateIso || seenInvoiceNumbers.has(invoiceNo)) { skippedInvoices++; continue; }
    seenInvoiceNumbers.add(invoiceNo);

    const timestamp = new Date(dateIso).getTime();
    minMs = Math.min(minMs, timestamp);
    maxMs = Math.max(maxMs, timestamp);

    const partyKey = partyName.toLowerCase();
    const existingParty = partiesByKey.get(partyKey);
    if (!existingParty) partiesByKey.set(partyKey, { name: partyName, phone });
    else if (!existingParty.phone && phone) existingParty.phone = phone;

    const rawLineItems = itemRowsByInvoice.get(invoiceNo) ?? [];
    const lineItems: LineItem[] = [];
    let transactionType = "Purchase";
    for (const lr of rawLineItems) {
      const itemName = String(lr["Item Name"] ?? "").trim();
      if (!itemName) { skippedItemRows++; continue; }
      const qty = Number(lr["Quantity"]) || 0;
      const unit = String(lr["Unit"] ?? "").trim() || undefined;
      const sku = String(lr["Item Code"] ?? "").trim() || undefined;
      const rate = Number(lr["UnitPrice"]) || 0;
      const lrType = String(lr["Transaction Type"] ?? "").trim();
      if (lrType) transactionType = lrType;

      lineItems.push({ name: itemName, qty, unit, rate });

      const itemKey = itemName.toLowerCase();
      const existingItem = itemsByKey.get(itemKey);
      if (!existingItem || timestamp >= existingItem.lastTimestamp) {
        itemsByKey.set(itemKey, { name: itemName, unit, sku, purchasePrice: rate || undefined, lastTimestamp: timestamp });
      }
    }

    invoices.push({ number: invoiceNo, date: dateIso, partyName, transactionType, total, balance, lineItems });
  }

  return {
    totalInvoiceRows: purchaseRows.length, totalItemRows: itemRows.length,
    items: [...itemsByKey.values()], parties: [...partiesByKey.values()], invoices,
    skippedInvoices, skippedItemRows,
    minDate: Number.isFinite(minMs) ? new Date(minMs).toISOString() : null,
    maxDate: Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : null,
  };
}

type Stage = "upload" | "preview" | "importing" | "done";
type JobProgress = { status: "processing" | "done" | "error"; total: number; processed: number; itemsCreated: number; partiesCreated: number; invoicesImported: number; invoicesSkipped: number; error?: string };

export default function ImportPurchaseHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedCompanyId, selectedCompany } = useSelectedCompany();

  const [stage, setStage] = useState<Stage>("upload");
  const [picking, setPicking] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);

  async function handlePickFile() {
    setPicking(true);
    setParseError(null);
    try {
      const picked = await pickWorkbook();
      if (!picked) return;
      setFileName(picked.fileName);
      const wb = picked.workbook;
      const findSheet = (name: string) => wb.SheetNames.find((n) => n.trim().toLowerCase() === name.toLowerCase());
      const purchaseSheetName = findSheet(PURCHASE_REPORT_SHEET);
      const itemSheetName = findSheet(ITEM_DETAILS_SHEET);
      if (!purchaseSheetName || !itemSheetName) {
        const missingTabs = [!purchaseSheetName && `"${PURCHASE_REPORT_SHEET}"`, !itemSheetName && `"${ITEM_DETAILS_SHEET}"`].filter(Boolean);
        setParseError(`This file is missing the ${missingTabs.join(" and ")} tab. Found: ${wb.SheetNames.join(", ")}`);
        return;
      }
      const { rows: purchaseRows, headerRowIndex: purchaseIdx } = readSheetRows(wb.Sheets[purchaseSheetName]!, REQUIRED_PURCHASE_REPORT_HEADERS);
      const { rows: itemRows, headerRowIndex: itemIdx } = readSheetRows(wb.Sheets[itemSheetName]!, REQUIRED_ITEM_DETAILS_HEADERS);
      if (purchaseIdx === -1 || itemIdx === -1) {
        const parts: string[] = [];
        if (purchaseIdx === -1) parts.push(`Couldn't find the expected header row in "${PURCHASE_REPORT_SHEET}"`);
        if (itemIdx === -1) parts.push(`Couldn't find the expected header row in "${ITEM_DETAILS_SHEET}"`);
        setParseError(parts.join(" — "));
        return;
      }
      setSummary(buildSummary(purchaseRows, itemRows));
      setStage("preview");
    } catch (err: any) {
      setParseError(err?.message ?? `Couldn't read this file. Make sure it's a valid .xls or .xlsx file with "${PURCHASE_REPORT_SHEET}" and "${ITEM_DETAILS_SHEET}" tabs.`);
    } finally {
      setPicking(false);
    }
  }

  async function startImport() {
    if (!summary) return;
    setStage("importing");
    setProgress({ status: "processing", total: summary.invoices.length, processed: 0, itemsCreated: 0, partiesCreated: 0, invoicesImported: 0, invoicesSkipped: 0 });
    try {
      const { jobId } = await api.startPurchaseHistoryImport({
        companyTag: selectedCompany?.name || undefined,
        companyId: selectedCompanyId ?? undefined,
        items: summary.items.map((i) => ({ name: i.name, unit: i.unit, sku: i.sku, purchasePrice: i.purchasePrice })),
        parties: summary.parties.map((p) => ({ name: p.name, phone: p.phone })),
        invoices: summary.invoices.map((inv) => ({
          number: inv.number, date: inv.date, partyName: inv.partyName,
          transactionType: inv.transactionType, total: inv.total, balance: inv.balance, lineItems: inv.lineItems,
        })),
      });
      const poll = async () => {
        const status = await api.getPurchaseHistoryImportStatus(jobId);
        setProgress(status);
        if (status.status === "processing") setTimeout(poll, 1500);
        else setStage("done");
      };
      void poll();
    } catch {
      setProgress((p) => p ? { ...p, status: "error", error: "Failed to start import. Check your connection and try again." } : p);
      setStage("done");
    }
  }

  function resetAll() {
    setStage("upload"); setFileName(""); setParseError(null); setSummary(null); setProgress(null);
  }

  const progressPct = progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Import Purchase History</Text>
      </View>

      {stage === "upload" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <View style={s.guideCard}>
            <Text style={s.guideTitle}>📋  Export your old purchase register</Text>
            <Text style={s.guideText}>Needs two tabs: a "{PURCHASE_REPORT_SHEET}" tab (one row per bill) and an "{ITEM_DETAILS_SHEET}" tab (one row per item purchased, linked by invoice number).</Text>
            <Text style={[s.guideText, { fontWeight: "700" }]}>{PURCHASE_REPORT_SHEET} needs:</Text>
            <View style={s.chipsRow}>{REQUIRED_PURCHASE_REPORT_HEADERS.map((h) => <Text key={h} style={s.chip}>{h}</Text>)}</View>
            <Text style={[s.guideText, { fontWeight: "700", marginTop: 8 }]}>{ITEM_DETAILS_SHEET} needs:</Text>
            <View style={s.chipsRow}>{REQUIRED_ITEM_DETAILS_HEADERS.map((h) => <Text key={h} style={s.chip}>{h}</Text>)}</View>
          </View>

          <TouchableOpacity style={[s.pickBtn, picking && s.disabled]} onPress={handlePickFile} disabled={picking}>
            {picking ? <ActivityIndicator color="#fff" /> : <><Ionicons name="cloud-upload-outline" size={20} color="#fff" /><Text style={s.pickTxt}>Choose Excel File</Text></>}
          </TouchableOpacity>
          {fileName ? <Text style={s.fileNameTxt}>📄 {fileName}</Text> : null}
          {parseError && <View style={s.errorBanner}><Text style={s.errorTxt}>{parseError}</Text></View>}
        </ScrollView>
      )}

      {stage === "preview" && summary && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          <Text style={s.fileBadge}>{fileName}</Text>
          <View style={s.chipsRow}>
            <Text style={s.chip}>{summary.items.length} items</Text>
            <Text style={s.chip}>{summary.parties.length} suppliers</Text>
            <Text style={s.chip}>{summary.invoices.length} bills</Text>
          </View>
          {(summary.skippedInvoices > 0 || summary.skippedItemRows > 0) && (
            <View style={s.errorBanner}>
              <Text style={s.errorTxt}>
                {summary.skippedInvoices > 0 && `${summary.skippedInvoices} bill(s) skipped (missing/duplicate data). `}
                {summary.skippedItemRows > 0 && `${summary.skippedItemRows} item row(s) skipped.`}
              </Text>
            </View>
          )}
          <Text style={s.sectionTitle}>Bills</Text>
          <View style={s.previewCard}>
            {summary.invoices.slice(0, 100).map((inv) => (
              <View key={inv.number} style={s.previewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.previewName} numberOfLines={1}>{inv.partyName} · #{inv.number}</Text>
                  <Text style={s.previewSub}>{new Date(inv.date).toLocaleDateString()} · {inv.lineItems.length} items</Text>
                </View>
                <Text style={s.previewAmt}>Rs {inv.total.toLocaleString()}</Text>
              </View>
            ))}
            {summary.invoices.length > 100 && <Text style={s.moreTxt}>+ {summary.invoices.length - 100} more bills</Text>}
          </View>
          <Text style={s.footNote}>Items, Suppliers, and Purchase bills are created automatically. Re-running this same file is safe — already-imported bills are skipped.</Text>
          <View style={s.footerRow}>
            <TouchableOpacity style={s.outlineBtn} onPress={resetAll}><Text style={s.outlineTxt}>Back</Text></TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={() => void startImport()}>
              <Text style={s.primaryTxt}>Import {summary.invoices.length} Bills</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {stage === "importing" && progress && (
        <View style={s.centerBox}>
          <Text style={s.doneTitle}>Importing… {progress.processed}/{progress.total}</Text>
          <View style={s.progressTrack}><View style={[s.progressFill, { width: `${progressPct}%` }]} /></View>
          <Text style={s.footNote}>{progress.invoicesImported} imported · {progress.invoicesSkipped} skipped</Text>
        </View>
      )}

      {stage === "done" && progress && (
        <View style={s.centerBox}>
          {progress.status === "error" ? (
            <>
              <Ionicons name="close-circle" size={48} color="#dc2626" />
              <Text style={s.doneTitle}>Import failed</Text>
              <Text style={s.footNote}>{progress.error ?? "Something went wrong."}</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
              <Text style={s.doneTitle}>{progress.invoicesImported} bills imported</Text>
              <Text style={s.footNote}>{progress.itemsCreated} items created · {progress.partiesCreated} suppliers created{progress.invoicesSkipped > 0 ? ` · ${progress.invoicesSkipped} skipped` : ""}</Text>
            </>
          )}
          <TouchableOpacity style={[s.primaryBtn, { marginTop: 20 }]} onPress={() => router.back()}>
            <Text style={s.primaryTxt}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={resetAll}><Text style={[s.outlineTxt, { marginTop: 12 }]}>Import Another File</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  guideCard: { backgroundColor: "#fffbeb", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#fde68a", marginBottom: 16 },
  guideTitle: { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 8 },
  guideText: { fontSize: 13, color: "#78350f", marginBottom: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: { fontSize: 12, fontWeight: "600", color: colors.text, backgroundColor: "#f1f5f9", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5, overflow: "hidden" },
  pickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 16, gap: 10 },
  disabled: { opacity: 0.6 },
  pickTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
  fileNameTxt: { fontSize: 13, color: colors.primary, fontWeight: "600", marginTop: 10, textAlign: "center" },
  fileBadge: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  errorBanner: { backgroundColor: "#fef2f2", borderRadius: 8, padding: 12, marginTop: 12 },
  errorTxt: { fontSize: 13, color: "#b91c1c" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 8, marginBottom: 8 },
  previewCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  previewRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewName: { fontSize: 13, fontWeight: "600", color: colors.text },
  previewSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  previewAmt: { fontSize: 13, fontWeight: "700", color: colors.text },
  moreTxt: { fontSize: 12, color: colors.textMuted, textAlign: "center", padding: 10, fontStyle: "italic" },
  footNote: { fontSize: 12, color: colors.textMuted, marginTop: 12, textAlign: "center" },
  footerRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  outlineBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 100, borderWidth: 1, borderColor: colors.border },
  outlineTxt: { fontSize: 14, fontWeight: "600", color: colors.textMuted, textAlign: "center" },
  primaryBtn: { flex: 2, backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 13, alignItems: "center" },
  primaryTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  doneTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 12, marginBottom: 8, textAlign: "center" },
  progressTrack: { width: "100%", height: 8, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden", marginVertical: 12 },
  progressFill: { height: 8, backgroundColor: colors.primary },
});

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

const REQUIRED_HEADERS = ["Date", "Category Name", "Payment Type", "Total Amount"];
const DEFAULT_PARTY_NAME = "Business Expenses";

type RawRow = Record<string, unknown>;
type ExpenseEntry = { category: string; paymentType: string; date: string; amount: number; balance: number; number: string; description?: string };
type CategoryBreakdown = { category: string; count: number; total: number };
type Summary = {
  totalRows: number; skippedRows: number; entries: ExpenseEntry[];
  perCategory: CategoryBreakdown[]; totalAmount: number; minDate: string | null; maxDate: string | null;
};

function buildSummary(rows: RawRow[]): Summary {
  const perCategoryByKey = new Map<string, CategoryBreakdown>();
  const entries: ExpenseEntry[] = [];
  let skippedRows = 0, minMs = Infinity, maxMs = -Infinity, totalAmount = 0, autoIndex = 0;

  for (const r of rows) {
    autoIndex++;
    const category = String(r["Category Name"] ?? "").trim();
    const dateIso = parseSheetDate(r["Date"]);
    const amount = Number(r["Total Amount"]) || 0;
    const paymentType = String(r["Payment Type"] ?? "").trim() || "Cash";
    const refNo = String(r["Invoice No"] ?? "").trim();
    const description = String(r["Description"] ?? "").trim() || undefined;
    const balanceRaw = r["Balance Due"];
    const balance = balanceRaw !== undefined && String(balanceRaw).trim() !== "" ? Number(balanceRaw) || 0 : amount;

    if (!category || !dateIso || !(amount > 0)) { skippedRows++; continue; }

    const timestamp = new Date(dateIso).getTime();
    minMs = Math.min(minMs, timestamp);
    maxMs = Math.max(maxMs, timestamp);

    const number = refNo || `AUTO-${autoIndex}`;
    entries.push({ category, paymentType, date: dateIso, amount, balance, number, description });
    totalAmount += amount;

    const key = category.toLowerCase();
    const agg = perCategoryByKey.get(key) ?? { category, count: 0, total: 0 };
    agg.count++; agg.total += amount;
    perCategoryByKey.set(key, agg);
  }

  return {
    totalRows: rows.length, skippedRows, entries,
    perCategory: [...perCategoryByKey.values()].sort((a, b) => b.total - a.total),
    totalAmount,
    minDate: Number.isFinite(minMs) ? new Date(minMs).toISOString() : null,
    maxDate: Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : null,
  };
}

type Stage = "upload" | "preview" | "importing" | "done";
type JobProgress = { status: "processing" | "done" | "error"; total: number; processed: number; entriesImported: number; entriesSkipped: number; error?: string };

export default function ImportExpensesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedCompanyId } = useSelectedCompany();

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
      const ws = picked.workbook.Sheets[picked.workbook.SheetNames[0]!];
      if (!ws) { setParseError("This file has no readable sheet."); return; }
      const headerRow = (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })[0] ?? []) as unknown[];
      const cleanHeaders = headerRow.map((h) => String(h ?? "").trim()).filter(Boolean);
      const missing = REQUIRED_HEADERS.filter((h) => !cleanHeaders.includes(h));
      if (missing.length) {
        setParseError(`This doesn't look like an expense export. Missing columns: ${missing.join(", ")}`);
        return;
      }
      const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "" });
      setSummary(buildSummary(rows));
      setStage("preview");
    } catch (err: any) {
      setParseError(err?.message ?? "Couldn't read this file. Make sure it's a valid .xls or .xlsx file.");
    } finally {
      setPicking(false);
    }
  }

  async function startImport() {
    if (!summary) return;
    setStage("importing");
    setProgress({ status: "processing", total: summary.entries.length, processed: 0, entriesImported: 0, entriesSkipped: 0 });
    try {
      const { jobId } = await api.startExpenseImport({
        partyName: DEFAULT_PARTY_NAME,
        companyId: selectedCompanyId ?? undefined,
        entries: summary.entries.map((e) => ({
          category: e.category, paymentType: e.paymentType, date: e.date,
          amount: e.amount, balance: e.balance, number: e.number, description: e.description,
        })),
      });
      const poll = async () => {
        const status = await api.getExpenseImportStatus(jobId);
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
        <Text style={s.headerTitle}>Import Expenses</Text>
      </View>

      {stage === "upload" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <View style={s.guideCard}>
            <Text style={s.guideTitle}>📋  Export your expense report</Text>
            <Text style={s.guideText}>Needs these columns (in any order):</Text>
            <View style={s.chipsRow}>
              {REQUIRED_HEADERS.map((h) => <Text key={h} style={s.chip}>{h}</Text>)}
            </View>
            <Text style={s.guideNote}>Expenses here have no vendor of their own — every imported expense is recorded against a single "{DEFAULT_PARTY_NAME}" party.</Text>
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
            <Text style={s.chip}>{summary.entries.length} expenses</Text>
            <Text style={s.chip}>{summary.perCategory.length} categories</Text>
            <Text style={s.chip}>Total: Rs {summary.totalAmount.toLocaleString()}</Text>
          </View>
          {summary.skippedRows > 0 && (
            <View style={s.errorBanner}><Text style={s.errorTxt}>{summary.skippedRows} row(s) skipped — missing category, date, or amount.</Text></View>
          )}
          <Text style={s.sectionTitle}>Totals by category</Text>
          <View style={s.previewCard}>
            {summary.perCategory.map((c) => (
              <View key={c.category} style={s.previewRow}>
                <Text style={s.previewName} numberOfLines={1}>{c.category}</Text>
                <Text style={s.previewAmt}>{c.count}× · Rs {c.total.toLocaleString()}</Text>
              </View>
            ))}
          </View>
          <Text style={s.footNote}>Each row becomes an Expense against "{DEFAULT_PARTY_NAME}". Re-running this same file later will skip expenses already imported.</Text>
          <View style={s.footerRow}>
            <TouchableOpacity style={s.outlineBtn} onPress={resetAll}><Text style={s.outlineTxt}>Back</Text></TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={() => void startImport()}>
              <Text style={s.primaryTxt}>Import {summary.entries.length} Expenses</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {stage === "importing" && progress && (
        <View style={s.centerBox}>
          <Text style={s.doneTitle}>Importing… {progress.processed}/{progress.total}</Text>
          <View style={s.progressTrack}><View style={[s.progressFill, { width: `${progressPct}%` }]} /></View>
          <Text style={s.footNote}>{progress.entriesImported} imported · {progress.entriesSkipped} skipped</Text>
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
              <Text style={s.doneTitle}>{progress.entriesImported} expenses imported</Text>
              {progress.entriesSkipped > 0 && <Text style={s.footNote}>{progress.entriesSkipped} skipped (already imported)</Text>}
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
  guideText: { fontSize: 13, color: "#78350f", marginBottom: 10 },
  guideNote: { fontSize: 12, color: "#92400e", marginTop: 8 },
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
  previewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewName: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text, marginRight: 8 },
  previewAmt: { fontSize: 12, color: colors.textMuted },
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

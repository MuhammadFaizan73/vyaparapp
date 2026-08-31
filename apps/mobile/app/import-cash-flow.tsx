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

const REQUIRED_HEADERS = ["Date", "Name", "Type", "Cash In Amount", "Cash Out Amount"];

// The app's own report exports don't use these exact column names — accept their real
// headers too. Covers both the dedicated Cash Flow report (Party/"Cash In"/"Cash Out")
// and the All Transactions report (Party Name/Received/Paid) — the latter has no
// separate Cash In/Cash Out columns, but a Payment-In row only ever has Received
// populated and a Payment-Out row only ever has Paid populated, so they line up 1:1
// once the Type column is used to pick a side. Kept identical to
// packages/ui/src/screens/ImportCashFlowPage.tsx.
const HEADER_ALIASES: Record<string, string[]> = {
  "Name": ["Name", "Party", "Party Name"],
  "Cash In Amount": ["Cash In Amount", "Cash In", "Received"],
  "Cash Out Amount": ["Cash Out Amount", "Cash Out", "Paid"],
  "Reference No": ["Reference No", "Ref No.", "Ref #"],
};

function canonicalizeHeader(h: string): string {
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(h)) return canonical;
  }
  return h;
}

type RawRow = Record<string, unknown>;
type CashFlowEntry = {
  partyName: string; type: "payment_in" | "payment_out"; date: string;
  amount: number; number: string; description?: string;
};
type PartyBreakdown = { partyName: string; cashInCount: number; cashInTotal: number; cashOutCount: number; cashOutTotal: number };
type Summary = {
  totalRows: number; ignoredNonPartyRows: number; skippedRows: number;
  entries: CashFlowEntry[]; perParty: PartyBreakdown[];
  cashInTotal: number; cashOutTotal: number; minDate: string | null; maxDate: string | null;
};

function buildSummary(rows: RawRow[]): Summary {
  const perPartyByKey = new Map<string, PartyBreakdown>();
  const entries: CashFlowEntry[] = [];
  let ignoredNonPartyRows = 0, skippedRows = 0, minMs = Infinity, maxMs = -Infinity;
  let cashInTotal = 0, cashOutTotal = 0, autoIndex = 0;

  for (const r of rows) {
    autoIndex++;
    const typeRaw = String(r["Type"] ?? "").trim().toLowerCase();
    if (typeRaw !== "payment-in" && typeRaw !== "payment-out") { ignoredNonPartyRows++; continue; }

    const partyName = String(r["Name"] ?? "").trim();
    const dateIso = parseSheetDate(r["Date"]);
    const cashIn = Number(r["Cash In Amount"]) || 0;
    const cashOut = Number(r["Cash Out Amount"]) || 0;
    const type: "payment_in" | "payment_out" = typeRaw === "payment-in" ? "payment_in" : "payment_out";
    const amount = type === "payment_in" ? cashIn : cashOut;
    const refNo = String(r["Reference No"] ?? "").trim();
    const description = String(r["Description"] ?? "").trim() || undefined;

    if (!partyName || !dateIso || !(amount > 0)) { skippedRows++; continue; }

    const timestamp = new Date(dateIso).getTime();
    minMs = Math.min(minMs, timestamp);
    maxMs = Math.max(maxMs, timestamp);

    const number = refNo || `AUTO-${autoIndex}`;
    entries.push({ partyName, type, date: dateIso, amount, number, description });

    const partyKey = partyName.toLowerCase();
    const agg = perPartyByKey.get(partyKey) ?? { partyName, cashInCount: 0, cashInTotal: 0, cashOutCount: 0, cashOutTotal: 0 };
    if (type === "payment_in") { agg.cashInCount++; agg.cashInTotal += amount; cashInTotal += amount; }
    else { agg.cashOutCount++; agg.cashOutTotal += amount; cashOutTotal += amount; }
    perPartyByKey.set(partyKey, agg);
  }

  return {
    totalRows: rows.length, ignoredNonPartyRows, skippedRows,
    entries, perParty: [...perPartyByKey.values()].sort((a, b) => (b.cashInTotal + b.cashOutTotal) - (a.cashInTotal + a.cashOutTotal)),
    cashInTotal, cashOutTotal,
    minDate: Number.isFinite(minMs) ? new Date(minMs).toISOString() : null,
    maxDate: Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : null,
  };
}

type Stage = "upload" | "preview" | "importing" | "done";
type JobProgress = {
  status: "processing" | "done" | "error";
  total: number; processed: number;
  entriesImported: number; entriesSkipped: number; partiesCreated: number;
  error?: string;
};

export default function ImportCashFlowScreen() {
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
      const cleanHeaders = headerRow.map((h) => canonicalizeHeader(String(h ?? "").trim())).filter(Boolean);
      const missing = REQUIRED_HEADERS.filter((h) => !cleanHeaders.includes(h));
      if (missing.length) {
        setParseError(`This doesn't look like a cash flow export. Missing columns: ${missing.join(", ")}`);
        return;
      }
      const rawRows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "" });
      const rows = rawRows.map((r) => {
        const out: RawRow = {};
        for (const [k, v] of Object.entries(r)) out[canonicalizeHeader(k.trim())] = v;
        return out;
      });
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
    setProgress({ status: "processing", total: summary.entries.length, processed: 0, entriesImported: 0, entriesSkipped: 0, partiesCreated: 0 });
    try {
      const { jobId } = await api.startCashFlowImport({
        companyId: selectedCompanyId ?? undefined,
        parties: summary.perParty.map((p) => ({ name: p.partyName })),
        entries: summary.entries.map((e) => ({
          partyName: e.partyName, type: e.type, date: e.date,
          amount: e.amount, number: e.number, description: e.description,
        })),
      });
      const poll = async () => {
        const status = await api.getCashFlowImportStatus(jobId);
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
        <Text style={s.headerTitle}>Import Cash Flow</Text>
      </View>

      {stage === "upload" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <View style={s.guideCard}>
            <Text style={s.guideTitle}>📋  Export your cash flow / cash book</Text>
            <Text style={s.guideText}>Needs these columns (in any order):</Text>
            <View style={s.chipsRow}>
              {REQUIRED_HEADERS.map((h) => <Text key={h} style={s.chip}>{h}</Text>)}
            </View>
            <Text style={s.guideNote}>Only Payment-In and Payment-Out rows are imported, each against the named party. Expense, cash-counter Sale, and other rows are skipped.</Text>
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
            <Text style={s.chip}>{summary.entries.length} entries</Text>
            <Text style={s.chip}>{summary.perParty.length} parties</Text>
            <Text style={s.chip}>Cash In: Rs {summary.cashInTotal.toLocaleString()}</Text>
            <Text style={s.chip}>Cash Out: Rs {summary.cashOutTotal.toLocaleString()}</Text>
          </View>
          {summary.skippedRows > 0 && (
            <View style={s.errorBanner}><Text style={s.errorTxt}>{summary.skippedRows} row(s) skipped — missing party, date, or amount.</Text></View>
          )}
          <Text style={s.sectionTitle}>Cash in/out per party</Text>
          <View style={s.previewCard}>
            {summary.perParty.slice(0, 100).map((p) => (
              <View key={p.partyName} style={s.previewRow}>
                <Text style={s.previewName} numberOfLines={1}>{p.partyName}</Text>
                <Text style={s.previewAmt}>In: {p.cashInTotal.toLocaleString()} · Out: {p.cashOutTotal.toLocaleString()}</Text>
              </View>
            ))}
            {summary.perParty.length > 100 && <Text style={s.moreTxt}>+ {summary.perParty.length - 100} more parties</Text>}
          </View>
          <Text style={s.footNote}>Re-running this same file later will skip entries already imported — it's safe to retry.</Text>
          <View style={s.footerRow}>
            <TouchableOpacity style={s.outlineBtn} onPress={resetAll}><Text style={s.outlineTxt}>Back</Text></TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={() => void startImport()}>
              <Text style={s.primaryTxt}>Import {summary.entries.length} Entries</Text>
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
              <Text style={s.doneTitle}>{progress.entriesImported} entries imported</Text>
              <Text style={s.footNote}>{progress.partiesCreated} parties created{progress.entriesSkipped > 0 ? ` · ${progress.entriesSkipped} skipped (already imported)` : ""}</Text>
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
  previewRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewName: { fontSize: 13, fontWeight: "600", color: colors.text },
  previewAmt: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
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

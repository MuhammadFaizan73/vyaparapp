import { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as XLSX from "xlsx";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";

type PartyRow = { name: string; phone: string; email: string };

function parseCSV(text: string): PartyRow[] {
  return text
    .trim()
    .split("\n")
    .filter(l => l.trim())
    .map(line => {
      const parts = line.split(",").map(p => p.trim().replace(/^"|"$/g, ""));
      return { name: parts[0] ?? "", phone: parts[1] ?? "", email: parts[2] ?? "" };
    })
    .filter(r => r.name.length > 0);
}

function parseSheet(wb: XLSX.WorkBook): PartyRow[] {
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (!ws) return [];
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  // Skip header row if first cell looks like a label
  const start = /^name$/i.test(String(rows[0]?.[0] ?? "")) ? 1 : 0;
  return rows
    .slice(start)
    .map((r) => ({ name: String(r[0] ?? "").trim(), phone: String(r[1] ?? "").trim(), email: String(r[2] ?? "").trim() }))
    .filter(r => r.name.length > 0);
}

export default function ImportPartyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [preview, setPreview] = useState<PartyRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [imported, setImported] = useState(0);

  async function handlePickFile() {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setFileName(asset.name ?? "file");
      const uri = asset.uri;
      const name = (asset.name ?? "").toLowerCase();

      let rows: PartyRow[] = [];

      if (name.endsWith(".csv") || (asset.mimeType ?? "").includes("csv")) {
        const text = await FileSystem.readAsStringAsync(uri);
        rows = parseCSV(text);
      } else {
        // Excel or unknown — read as binary
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" as any });
        const wb = XLSX.read(b64, { type: "base64" });
        rows = parseSheet(wb);
      }

      if (rows.length === 0) {
        Alert.alert("No Data", "Could not find any parties in the file. Make sure columns are: Name, Phone, Email");
        return;
      }
      setPreview(rows);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not read the file.");
    } finally {
      setPicking(false);
    }
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setImporting(true);
    let count = 0;
    for (const row of preview) {
      try {
        await api.createParty({
          name: row.name,
          phone: row.phone || undefined,
          email: row.email || undefined,
        });
        count++;
      } catch {
        // skip failed rows
      }
    }
    setImporting(false);
    setImported(count);
    setDone(true);
  }

  if (done) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Import Party</Text>
        </View>
        <View style={s.successState}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>{imported} Parties Imported!</Text>
          <Text style={s.successText}>Your parties have been successfully added.</Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => router.back()}>
            <Text style={s.doneBtnTxt}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Import Party</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Format guide */}
        <View style={s.guideCard}>
          <Text style={s.guideTitle}>📋  Supported Formats</Text>
          <Text style={s.guideText}>
            Upload a <Text style={s.bold}>.csv</Text> or <Text style={s.bold}>.xlsx</Text> file with the following columns:
          </Text>
          <View style={s.guideExample}>
            <Text style={s.guideCode}>Column 1: Party Name  (required)</Text>
            <Text style={s.guideCode}>Column 2: Phone       (optional)</Text>
            <Text style={s.guideCode}>Column 3: Email       (optional)</Text>
          </View>
          <Text style={s.guideNote}>The first row can be a header — it will be skipped automatically.</Text>
        </View>

        {/* Pick File Button */}
        <TouchableOpacity
          style={[s.pickBtn, picking && s.pickBtnDisabled]}
          onPress={handlePickFile}
          disabled={picking}
        >
          {picking ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={s.pickIcon}>📂</Text>
              <Text style={s.pickTxt}>Choose File (.csv / .xlsx)</Text>
            </>
          )}
        </TouchableOpacity>

        {fileName ? (
          <View style={s.fileNameRow}>
            <Text style={s.fileNameIcon}>📄</Text>
            <Text style={s.fileNameTxt} numberOfLines={1}>{fileName}</Text>
            <TouchableOpacity onPress={() => { setPreview([]); setFileName(""); }}>
              <Text style={s.fileNameClear}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Preview Table */}
        {preview.length > 0 && (
          <View style={s.previewCard}>
            <Text style={s.previewTitle}>Preview — {preview.length} parties found</Text>
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 2 }]}>Name</Text>
              <Text style={[s.th, { flex: 1.5 }]}>Phone</Text>
              <Text style={[s.th, { flex: 2 }]}>Email</Text>
            </View>
            {preview.slice(0, 50).map((row, i) => (
              <View key={i} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                <Text style={[s.td, { flex: 2 }]} numberOfLines={1}>{row.name}</Text>
                <Text style={[s.td, { flex: 1.5 }]} numberOfLines={1}>{row.phone || "—"}</Text>
                <Text style={[s.td, { flex: 2 }]} numberOfLines={1}>{row.email || "—"}</Text>
              </View>
            ))}
            {preview.length > 50 && (
              <Text style={s.previewMore}>… and {preview.length - 50} more rows</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      {preview.length > 0 && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={s.cancelBtn} onPress={() => { setPreview([]); setFileName(""); }}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.importBtn, importing && s.importBtnDisabled]}
            onPress={handleImport}
            disabled={importing}
          >
            {importing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.importTxt}>Import {preview.length} Parties</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },

  guideCard: {
    backgroundColor: "#fffbeb", margin: 16, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#fde68a",
  },
  guideTitle: { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 8 },
  guideText: { fontSize: 13, color: "#78350f", marginBottom: 10 },
  bold: { fontWeight: "700" },
  guideExample: {
    backgroundColor: "#fff8d6", borderRadius: 8, padding: 10, gap: 4, marginBottom: 8,
  },
  guideCode: { fontSize: 12, color: "#1c1917" },
  guideNote: { fontSize: 12, color: "#92400e" },

  pickBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginHorizontal: 16, backgroundColor: colors.primary, borderRadius: 100,
    paddingVertical: 16, gap: 10, marginBottom: 12,
  },
  pickBtnDisabled: { opacity: 0.6 },
  pickIcon: { fontSize: 22 },
  pickTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },

  fileNameRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, backgroundColor: "#e0f2fe",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    gap: 8, marginBottom: 12,
  },
  fileNameIcon: { fontSize: 16 },
  fileNameTxt: { flex: 1, fontSize: 13, color: colors.primary, fontWeight: "600" },
  fileNameClear: { fontSize: 16, color: colors.textMuted, padding: 2 },

  previewCard: {
    marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 16,
  },
  previewTitle: {
    fontSize: 13, fontWeight: "700", color: colors.text,
    padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tableHeader: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    paddingHorizontal: 12, paddingVertical: 8,
  },
  th: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  tableRow: {
    flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  td: { fontSize: 12, color: colors.text },
  previewMore: {
    fontSize: 12, color: colors.textMuted, textAlign: "center",
    padding: 10, fontStyle: "italic",
  },

  footer: {
    flexDirection: "row", backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingHorizontal: 16, gap: 12,
  },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 13 },
  cancelTxt: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  importBtn: {
    flex: 2, backgroundColor: colors.primary, borderRadius: 100,
    paddingVertical: 13, alignItems: "center",
  },
  importBtnDisabled: { opacity: 0.6 },
  importTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },

  successState: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 40,
  },
  successIcon: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 8 },
  successText: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginBottom: 24 },
  doneBtn: {
    backgroundColor: colors.primary, borderRadius: 100,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  doneBtnTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
});

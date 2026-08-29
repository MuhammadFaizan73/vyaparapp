import { View, Text, StyleSheet } from "react-native";
import { THEME_MAP, isLight, type ThemeConfig } from "../invoiceThemes";

// Fixed sample invoice — mirrors packages/ui/src/screens/SettingsScreen.tsx's
// PRINT_PREVIEW_SALE fixture, so both platforms' Print Settings previews show the same
// placeholder numbers and only the layout/color differs by theme.
const FIXTURE_ITEMS = [
  { name: "ITEM 1", qty: 2, rate: 10 },
  { name: "ITEM 2", qty: 1, rate: 30 },
];
const SUBTOTAL = FIXTURE_ITEMS.reduce((s, i) => s + i.qty * i.rate, 0); // 50
const TOTAL = 42.32;
const RECEIVED = 12;
const BALANCE = TOTAL - RECEIVED;
const DISCOUNT = Math.max(0, SUBTOTAL - TOTAL);

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoicePreviewNative({ themeName, color }: { themeName: string; color: string }) {
  const tc: ThemeConfig = THEME_MAP[themeName] ?? THEME_MAP["Tally Theme"];
  const fg = isLight(color) ? "#111827" : "#ffffff";
  const border = tc.bordered ? { borderWidth: 1, borderColor: "#111827" } : {};

  return (
    <View style={[styles.paper, border]}>
      {tc.bannerRounded ? (
        <View style={[styles.banner, { backgroundColor: color }]}>
          <Text style={[styles.bannerCompany, { color: fg }]}>Classic enterprises</Text>
          <Text style={[styles.bannerPhone, { color: fg }]}>8888888888</Text>
        </View>
      ) : tc.headerBand ? (
        <View style={[styles.headerBand, { backgroundColor: color }]}>
          <Text style={[styles.companyName, { color: fg }]}>Classic enterprises</Text>
          <Text style={[styles.companyPhone, { color: fg }]}>Ph. no.: 8888888888</Text>
        </View>
      ) : (
        <View style={styles.plainHeader}>
          <Text style={styles.companyName}>Classic enterprises</Text>
          <Text style={[styles.companyPhone, { color: "#555" }]}>Ph. no.: 8888888888</Text>
        </View>
      )}

      <Text style={[styles.title, { color: tc.colorTitle ? color : "#111827" }]}>Sale</Text>

      <View style={[styles.meta, tc.bordered && border]}>
        <View style={[styles.metaCol, border]}>
          <View style={[styles.metaHdr, tc.colorSectionHead && { backgroundColor: color }]}>
            <Text style={[styles.metaHdrTxt, tc.colorSectionHead && { color: fg }]}>Bill To</Text>
          </View>
          <Text style={styles.metaName}>Classic enterprises</Text>
        </View>
        <View style={styles.metaCol}>
          <View style={[styles.metaHdr, tc.colorSectionHead && { backgroundColor: color }]}>
            <Text style={[styles.metaHdrTxt, tc.colorSectionHead && { color: fg }]}>Invoice Details</Text>
          </View>
          <Text style={styles.metaSub}>Inv. 101</Text>
        </View>
      </View>

      <View style={[styles.tableHead, tc.colorTableHead ? { backgroundColor: color } : { backgroundColor: "#f3f4f6" }, tc.bordered && border]}>
        {["Item", "Qty", "Rate", "Amt"].map((h) => (
          <Text key={h} style={[styles.th, { color: tc.colorTableHead ? fg : "#374151" }]}>{h}</Text>
        ))}
      </View>
      {FIXTURE_ITEMS.map((it) => (
        <View key={it.name} style={styles.tr}>
          <Text style={styles.td}>{it.name}</Text>
          <Text style={styles.td}>{it.qty}</Text>
          <Text style={styles.td}>{fmt(it.rate)}</Text>
          <Text style={styles.td}>{fmt(it.qty * it.rate)}</Text>
        </View>
      ))}

      {tc.taxSummaryTable ? (
        <View style={[styles.taxStrip, border]}>
          {[["Sub", SUBTOTAL], ["Disc", DISCOUNT], ["Total", TOTAL], ["Bal", BALANCE]].map(([label, val]) => (
            <View key={label as string} style={styles.taxStripItem}>
              <Text style={styles.taxStripLabel}>{label}</Text>
              <Text style={styles.taxStripVal}>{fmt(Number(val))}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.amounts}>
          <View style={styles.amtRow}><Text style={styles.amtLabel}>Sub Total</Text><Text style={styles.amtVal}>Rs {fmt(TOTAL)}</Text></View>
          <View style={[styles.amtRow, { backgroundColor: color }]}>
            <Text style={[styles.amtLabel, { color: fg, fontWeight: "700" }]}>Total</Text>
            <Text style={[styles.amtVal, { color: fg, fontWeight: "700" }]}>Rs {fmt(TOTAL)}</Text>
          </View>
          <View style={styles.amtRow}><Text style={styles.amtLabel}>Received</Text><Text style={styles.amtVal}>Rs {fmt(RECEIVED)}</Text></View>
          <View style={styles.amtRow}><Text style={styles.amtLabel}>Balance</Text><Text style={styles.amtVal}>Rs {fmt(BALANCE)}</Text></View>
        </View>
      )}

      <Text style={styles.sign}>Authorized Signatory</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: "#fff", borderRadius: 6, overflow: "hidden" },
  banner: { padding: 12, borderRadius: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bannerCompany: { fontSize: 14, fontWeight: "700" },
  bannerPhone: { fontSize: 10 },
  headerBand: { padding: 10 },
  companyName: { fontSize: 13, fontWeight: "700" },
  companyPhone: { fontSize: 9, marginTop: 2 },
  plainHeader: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  title: { textAlign: "center", fontSize: 13, fontWeight: "700", paddingVertical: 6 },
  meta: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#e5e7eb" },
  metaCol: { flex: 1, padding: 8 },
  metaHdr: { paddingVertical: 2, paddingHorizontal: 4, marginBottom: 4 },
  metaHdrTxt: { fontSize: 9, color: "#6b7280", fontWeight: "600" },
  metaName: { fontSize: 11, fontWeight: "600", color: "#111827" },
  metaSub: { fontSize: 10, color: "#374151" },
  tableHead: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6 },
  th: { flex: 1, fontSize: 9, fontWeight: "700" },
  tr: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  td: { flex: 1, fontSize: 10, color: "#111827" },
  taxStrip: { flexDirection: "row", borderTopWidth: 1, borderColor: "#e5e7eb", marginTop: 4 },
  taxStripItem: { flex: 1, padding: 6, borderRightWidth: 1, borderRightColor: "#e5e7eb" },
  taxStripLabel: { fontSize: 8, color: "#6b7280" },
  taxStripVal: { fontSize: 10, fontWeight: "600", color: "#111827" },
  amounts: { marginTop: 4, alignSelf: "flex-end", width: 140 },
  amtRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 6 },
  amtLabel: { fontSize: 9.5, color: "#374151" },
  amtVal: { fontSize: 9.5, color: "#111827" },
  sign: { fontSize: 9, color: "#9ca3af", textAlign: "right", padding: 10, marginTop: 20 },
});

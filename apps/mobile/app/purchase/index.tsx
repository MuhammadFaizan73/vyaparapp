import { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Modal, Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import type { Transaction, Party } from "@vyapar/api-client";

type PurchaseRow = Transaction & { partyName: string };

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" });
}

function buildHtml(row: PurchaseRow, idx: number) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#111}
    h2{text-align:center;color:#0f5a72}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th{background:#0f5a72;color:#fff;padding:8px;text-align:left}
    td{padding:8px;border-bottom:1px solid #eee}
    .total{font-weight:bold}
  </style></head><body>
    <h2>Purchase Bill</h2>
    <p><strong>Supplier:</strong> ${row.partyName} &nbsp;&nbsp; <strong>Bill No.:</strong> #${idx + 1} &nbsp;&nbsp; <strong>Date:</strong> ${fmtDate(row.date)}</p>
    <table><thead><tr><th>#</th><th>Description</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>—</td><td>Rs ${fmt(row.total)}</td></tr>
      <tr class="total"><td colspan="2">Total</td><td>Rs ${fmt(row.total)}</td></tr>
      <tr><td colspan="2">Balance Due</td><td>Rs ${fmt(row.balance)}</td></tr>
    </tbody></table>
  </body></html>`;
}

export default function PurchaseListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState(0);
  const [search, setSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [shareTarget, setShareTarget] = useState<{ row: PurchaseRow; idx: number } | null>(null);
  const [menuTarget, setMenuTarget] = useState<{ row: PurchaseRow; idx: number } | null>(null);

  async function load() {
    try {
      const [txns, parties]: [Transaction[], Party[]] = await Promise.all([
        api.getTransactionsByType("purchase"),
        api.getParties(),
      ]);
      const map: Record<string, string> = {};
      parties.forEach((p) => { map[p.id] = p.name; });
      setRows(
        txns
          .map((t) => ({ ...t, partyName: map[t.partyId] ?? "Unknown" }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
    } catch { /* offline */ }
  }

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []));

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  async function handlePrint(row: PurchaseRow, idx: number) {
    try { await Print.printAsync({ html: buildHtml(row, idx) }); }
    catch { Alert.alert("Print failed"); }
  }

  async function handleSharePdf(row: PurchaseRow, idx: number) {
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml(row, idx) });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
    } catch { Alert.alert("Error", "Could not generate PDF."); }
  }

  const FILTERS = ["All", "Unpaid", "Paid"];
  const filtered = rows.filter((r) => {
    const matchFilter =
      activeFilter === 0 ||
      (activeFilter === 1 && r.balance > 0) ||
      (activeFilter === 2 && r.balance === 0);
    const matchSearch = !searchText.trim() ||
      r.partyName.toLowerCase().includes(searchText.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalPurchase = rows.reduce((s, r) => s + r.total, 0);
  const balanceDue = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Purchase List</Text>
        <View style={s.appBarRight}>
          <TouchableOpacity onPress={() => setSearch((v) => !v)} hitSlop={8}>
            <Ionicons name="search-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={s.pdfChip} hitSlop={8}>
            <Text style={s.pdfChipTxt}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      {search && (
        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput style={s.searchInput} value={searchText} onChangeText={setSearchText}
            placeholder="Search by party name…" placeholderTextColor={colors.textLight} autoFocus />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter chips */}
      <View style={s.chipsRow}>
        {FILTERS.map((f, i) => (
          <TouchableOpacity key={f} style={[s.chip, i === activeFilter && s.chipActive]}
            onPress={() => setActiveFilter(i)}>
            <Text style={[s.chipTxt, i === activeFilter && s.chipTxtActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[s.list, filtered.length === 0 && { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={s.summaryRow}>
              <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>Total Purchase</Text>
                <Text style={s.summaryVal}>Rs {fmt(totalPurchase)}</Text>
              </View>
              <View style={[s.summaryCard, s.summaryCardRight]}>
                <Text style={s.summaryLabel}>Balance Due</Text>
                <Text style={[s.summaryVal, { color: colors.red }]}>Rs {fmt(balanceDue)}</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={48} color={colors.textLight} />
              <Text style={s.emptyTxt}>No purchases yet</Text>
              <Text style={s.emptySub}>Tap + Add Purchase to record your first bill</Text>
            </View>
          }
          renderItem={({ item: row, index: idx }) => {
            const isPaid = row.balance === 0;
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <View style={s.cardLeft}>
                    <View style={s.nameRow}>
                      <Text style={s.partyName} numberOfLines={1}>{row.partyName}</Text>
                      <View style={[s.badge, isPaid ? s.badgePaid : s.badgeUnpaid]}>
                        <Text style={[s.badgeTxt, isPaid ? s.badgeTxtPaid : s.badgeTxtUnpaid]}>
                          {isPaid ? "PAID" : "UNPAID"}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.cardAmt}>Rs {fmt(row.total)}</Text>
                  </View>
                  <View style={s.cardRight}>
                    <Text style={s.cardType}>Purchase</Text>
                    <Text style={s.cardDate}>{fmtDate(row.date)}</Text>
                  </View>
                </View>
                <View style={s.cardBottom}>
                  <Text style={s.balanceTxt}>Balance: Rs {fmt(row.balance)}</Text>
                  <View style={s.actions}>
                    <TouchableOpacity hitSlop={10} onPress={() => handlePrint(row, idx)}>
                      <Ionicons name="print-outline" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={10} onPress={() => setShareTarget({ row, idx })}>
                      <Ionicons name="share-social-outline" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={10} onPress={() => setMenuTarget({ row, idx })}>
                      <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={[s.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/purchase/new" as never)}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={s.fabTxt}>Add Purchase</Text>
      </TouchableOpacity>

      {/* Share sheet */}
      <Modal visible={!!shareTarget} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShareTarget(null)}>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShareTarget(null)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={s.sheetTitle}>Share transaction</Text>
            <View style={s.shareRow}>
              <TouchableOpacity style={s.sharePdfBtn}
                onPress={async () => { const t = shareTarget; setShareTarget(null); if (t) await handleSharePdf(t.row, t.idx); }}>
                <View style={s.pdfIcon}><Text style={s.pdfIconTxt}>PDF</Text></View>
                <Text style={s.sharePdfTxt}>Share as PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.shareImgBtn} onPress={() => { setShareTarget(null); Alert.alert("Coming soon"); }}>
                <Ionicons name="image-outline" size={24} color="#fff" />
                <Text style={s.shareImgTxt}>Share as Image</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* More menu */}
      <Modal visible={!!menuTarget} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setMenuTarget(null)}>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setMenuTarget(null)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}>
            {[
              { label: "Duplicate", icon: "copy-outline" as const },
              { label: "Make Payment", icon: "cash-outline" as const },
              { label: "Return / Debit Note", icon: "return-down-back-outline" as const },
              { label: "Share as PDF", icon: "share-outline" as const },
            ].map(({ label, icon }, i, arr) => (
              <TouchableOpacity key={label}
                style={[s.menuRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                onPress={async () => {
                  const t = menuTarget; setMenuTarget(null);
                  if (label === "Share as PDF" && t) await handleSharePdf(t.row, t.idx);
                  else Alert.alert(label, "Coming soon.");
                }}>
                <Ionicons name={icon} size={20} color={colors.text} />
                <Text style={s.menuLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#dce6f0" },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  appBarRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  pdfChip: { backgroundColor: "#ffe4e6", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  pdfChipTxt: { fontSize: 11, fontWeight: "700", color: "#ef4444" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  searchBar: {
    backgroundColor: "#fff", flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },

  chipsRow: {
    backgroundColor: "#fff", flexDirection: "row", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100,
    borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
  chipTxtActive: { color: "#fff", fontWeight: "600" },

  list: { padding: 10, paddingBottom: 100 },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  summaryCard: {
    flex: 1, backgroundColor: "#e8f0f7", borderRadius: 8,
    padding: 14, borderWidth: 1, borderColor: "#c8d8e8",
  },
  summaryCardRight: {},
  summaryLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  summaryVal: { fontSize: 15, fontWeight: "700", color: colors.text },

  card: {
    backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1, borderColor: "#dce6f0", overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8,
  },
  cardLeft: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  partyName: { fontSize: 14, fontWeight: "700", color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgePaid: { backgroundColor: "#d1fae5" },
  badgeUnpaid: { backgroundColor: "#fff3e0" },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
  badgeTxtPaid: { color: colors.green },
  badgeTxtUnpaid: { color: "#e65100" },
  cardAmt: { fontSize: 14, fontWeight: "700", color: colors.text },
  cardRight: { alignItems: "flex-end" },
  cardType: { fontSize: 12, color: colors.textMuted },
  cardDate: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  cardBottom: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
  },
  balanceTxt: { fontSize: 12.5, color: colors.textMuted },
  actions: { flexDirection: "row", gap: 16, alignItems: "center" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 60 },
  emptyTxt: { fontSize: 15, fontWeight: "600", color: colors.text },
  emptySub: { fontSize: 12, color: colors.textMuted, textAlign: "center" },

  fab: {
    position: "absolute", alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.red, borderRadius: 100,
    paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  fabTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  shareRow: { flexDirection: "row", gap: 12 },
  sharePdfBtn: { flex: 1, backgroundColor: "#f1f5f9", borderRadius: 12, paddingVertical: 16, alignItems: "center", gap: 8 },
  pdfIcon: { backgroundColor: "#ffe4e6", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pdfIconTxt: { fontSize: 11, fontWeight: "700", color: "#ef4444" },
  sharePdfTxt: { color: colors.text, fontWeight: "600", fontSize: 14 },
  shareImgBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", gap: 8 },
  shareImgTxt: { color: "#fff", fontWeight: "600", fontSize: 14 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  menuLabel: { fontSize: 15, fontWeight: "500", color: colors.text },
});

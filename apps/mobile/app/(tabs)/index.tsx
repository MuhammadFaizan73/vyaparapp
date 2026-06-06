import { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, RefreshControl, Modal,
  ScrollView, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import type { Transaction, Party } from "@vyapar/api-client";

type Tab = "txn" | "party";
type TxnRow = Transaction & { partyName: string };
type BadgeCfg = { label: string; bg: string; fg: string };

function getBadge(type: string, balance: number): BadgeCfg {
  switch (type) {
    case "sale":             return balance > 0 ? { label: "SALE: UNPAID", bg: "#fef3c7", fg: "#b45309" } : { label: "SALE: PAID", bg: "#dcfce7", fg: "#15803d" };
    case "purchase":         return balance > 0 ? { label: "PURCHASE: DUE", bg: "#fef3c7", fg: "#b45309" } : { label: "PURCHASE: PAID", bg: "#dcfce7", fg: "#15803d" };
    case "expense":          return { label: "EXPENSE", bg: "#ede9fe", fg: "#6d28d9" };
    case "delivery_challan": return balance > 0 ? { label: "DN: UNPAID", bg: "#fef3c7", fg: "#b45309" } : { label: "DN: PAID", bg: "#dcfce7", fg: "#15803d" };
    case "purchase_order":   return balance > 0 ? { label: "PO: OPEN", bg: "#fef3c7", fg: "#b45309" } : { label: "PO: CLOSED", bg: "#dcfce7", fg: "#15803d" };
    case "credit_note":      return { label: "CREDIT NOTE", bg: "#fee2e2", fg: "#dc2626" };
    case "payment_in":       return { label: "PAYMENT IN", bg: "#dcfce7", fg: "#15803d" };
    case "payment_out":      return { label: "PAYMENT OUT", bg: "#fee2e2", fg: "#dc2626" };
    case "estimate":         return { label: "ESTIMATE", bg: "#dbeafe", fg: "#1d4ed8" };
    default:                 return { label: type.replace(/_/g, " ").toUpperCase(), bg: "#f3f4f6", fg: "#374151" };
  }
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}, ${String(d.getFullYear()).slice(2)}`;
}

function fmtAmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/* ── Add Transaction bottom-sheet data ── */
type TxnTypeItem = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  route?: string;
  iconBg: string;
};

const TXN_SECTIONS: Array<{ title: string; items: TxnTypeItem[] }> = [
  {
    title: "Sale Transactions",
    items: [
      { label: "Payment-In",         icon: "arrow-down-circle-outline",  route: "/payment-in/new",    iconBg: "#dbeafe" },
      { label: "Sale Return",        icon: "return-down-back-outline",   route: "/sale-return/new",   iconBg: "#fee2e2" },
      { label: "Delivery Note",      icon: "car-outline",                route: "/delivery-note/new", iconBg: "#dbeafe" },
      { label: "Estimate/Quotation", icon: "calculator-outline",         route: undefined,            iconBg: "#dbeafe" },
      { label: "Proforma Invoice",   icon: "document-text-outline",      route: undefined,            iconBg: "#dbeafe" },
      { label: "Sale Order",         icon: "bag-outline",                route: undefined,            iconBg: "#dbeafe" },
      { label: "Sale Invoice",       icon: "receipt-outline",            route: "/sale/new",          iconBg: "#dbeafe" },
    ],
  },
  {
    title: "Purchase Transactions",
    items: [
      { label: "Purchase",          icon: "cart-outline",               route: undefined, iconBg: "#dcfce7" },
      { label: "Payment-Out",       icon: "arrow-up-circle-outline",    route: undefined, iconBg: "#fee2e2" },
      { label: "Purchase Return",   icon: "return-up-back-outline",     route: undefined, iconBg: "#dcfce7" },
      { label: "Purchase Order",    icon: "clipboard-outline",          route: undefined, iconBg: "#dcfce7" },
    ],
  },
  {
    title: "Other Transactions",
    items: [
      { label: "Expenses",     icon: "wallet-outline",    route: undefined, iconBg: "#ede9fe" },
      { label: "P2P Transfer", icon: "swap-horizontal-outline", route: undefined, iconBg: "#fef3c7" },
    ],
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("txn");
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [companyName, setCompanyName] = useState("My Company");
  const [showAddTxn, setShowAddTxn] = useState(false);

  const load = useCallback(async () => {
    try {
      const [allTxns, allParties, tenant] = await Promise.all([
        api.getAllTransactions(),
        api.getParties(),
        api.getTenant(),
      ]);
      const map: Record<string, string> = {};
      allParties.forEach((p) => { map[p.id] = p.name; });
      setTxns(allTxns.map((t) => ({ ...t, partyName: map[t.partyId] ?? "–" })));
      setParties(allParties);
      setCompanyName(tenant.companyName || tenant.phone || "My Company");
    } catch { /* offline */ }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function handleTxnTypePress(item: TxnTypeItem) {
    setShowAddTxn(false);
    if (item.route) {
      router.push(item.route as never);
    }
  }

  const q = search.toLowerCase();
  const filteredTxns = txns.filter((t) =>
    !q || t.partyName.toLowerCase().includes(q) || t.type.includes(q) || (t.number ?? "").includes(q)
  );
  const filteredParties = parties.filter((p) =>
    !q || p.name.toLowerCase().includes(q) || (p.phone ?? "").includes(q)
  );

  /* ── Transaction card ── */
  function TxnCard({ item }: { item: TxnRow }) {
    const badge = getBadge(item.type, item.balance);
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardParty} numberOfLines={1}>{item.partyName}</Text>
            <View style={[s.badge, { backgroundColor: badge.bg }]}>
              <Text style={[s.badgeTxt, { color: badge.fg }]}>{badge.label}</Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {item.number ? <Text style={s.cardNum}>#{item.number}</Text> : null}
            <Text style={s.cardDate}>{fmtDate(item.date)}</Text>
          </View>
        </View>
        <View style={s.cardMid}>
          <View>
            <Text style={s.amtLbl}>Total</Text>
            <Text style={s.amtVal}>Rs {fmtAmt(item.total)}</Text>
          </View>
          <View>
            <Text style={s.amtLbl}>Balance</Text>
            <Text style={[s.amtVal, item.balance > 0 && { color: "#dc2626" }]}>
              Rs {fmtAmt(item.balance)}
            </Text>
          </View>
          <View style={s.cardActions}>
            <TouchableOpacity style={s.actionBtn} hitSlop={8}>
              <Ionicons name="print-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} hitSlop={8}>
              <Ionicons name="share-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} hitSlop={8}>
              <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  /* ── Party card ── */
  function PartyCard({ item }: { item: Party }) {
    const bal = item.balance ?? 0;
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => router.push(`/party/${item.id}` as never)}
        activeOpacity={0.8}
      >
        <View style={s.partyRow}>
          <View style={s.partyAvatar}>
            <Text style={s.partyAvatarTxt}>{item.name[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.partyName}>{item.name}</Text>
            {item.phone ? <Text style={s.partyPhone}>{item.phone}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.partyBal, { color: bal > 0 ? "#dc2626" : bal < 0 ? "#16a34a" : colors.textMuted }]}>
              Rs {Math.abs(bal).toLocaleString("en-PK")}
            </Text>
            <Text style={s.partyBalLbl}>{bal > 0 ? "You'll receive" : bal < 0 ? "You'll pay" : "Settled"}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <View style={s.appBarLeft}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{companyName[0]?.toUpperCase()}</Text>
          </View>
          <Text style={s.companyName} numberOfLines={1}>{companyName}</Text>
        </View>
        <View style={s.appBarRight}>
          <TouchableOpacity style={s.filterBtn}>
            <Ionicons name="funnel" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab toggle */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tabBtn, tab === "txn" && s.tabBtnActive]}
          onPress={() => setTab("txn")}
        >
          <Text style={[s.tabTxt, tab === "txn" && s.tabTxtActive]}>Transaction Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === "party" && s.tabBtnActive]}
          onPress={() => setTab("party")}
        >
          <Text style={[s.tabTxt, tab === "party" && s.tabTxtActive]}>Party Details</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Links */}
      <View style={s.quickLinks}>
        <Text style={s.quickLinksTitle}>Quick Links</Text>
        <View style={s.quickLinksRow}>
          <TouchableOpacity style={s.quickItem} onPress={() => setShowAddTxn(true)}>
            <View style={s.quickIcon}>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            </View>
            <Text style={s.quickLabel}>Add Txn</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickItem} onPress={() => router.push("/reports/sale" as never)}>
            <View style={s.quickIcon}>
              <Ionicons name="bar-chart-outline" size={22} color={colors.primary} />
            </View>
            <Text style={s.quickLabel}>Sale Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickItem} onPress={() => router.push("/sale" as never)}>
            <View style={s.quickIcon}>
              <Ionicons name="apps-outline" size={22} color={colors.primary} />
            </View>
            <Text style={s.quickLabel}>Show All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickItem} onPress={() => router.push("/sale/new" as never)}>
            <View style={s.quickIcon}>
              <Ionicons name="receipt-outline" size={22} color={colors.primary} />
            </View>
            <Text style={s.quickLabel}>Sale Invoice</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search for a transaction"
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity hitSlop={8}>
          <Ionicons name="filter-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : tab === "txn" ? (
        <FlatList
          data={filteredTxns}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[s.list, filteredTxns.length === 0 && s.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => <TxnCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="receipt-outline" size={52} color={colors.border} />
              <Text style={s.emptyTxt}>No transactions yet.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/sale/new" as never)}>
                <Text style={s.emptyBtnTxt}>Add First Sale</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredParties}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[s.list, filteredParties.length === 0 && s.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => <PartyCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="people-outline" size={52} color={colors.border} />
              <Text style={s.emptyTxt}>No parties yet.</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => setShowAddTxn(true)}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={s.fabTxt}>Add New Sale</Text>
      </TouchableOpacity>

      {/* ── Add Transaction bottom sheet ── */}
      <Modal
        visible={showAddTxn}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddTxn(false)}
      >
        <View style={s.modalContainer}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowAddTxn(false)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
            {/* Handle + header */}
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Sale Transactions</Text>
              <TouchableOpacity onPress={() => setShowAddTxn(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {TXN_SECTIONS.map((section) => (
                <View key={section.title} style={s.sheetSection}>
                  <Text style={s.sheetSectionTitle}>{section.title}</Text>
                  <View style={s.sheetGrid}>
                    {section.items.map((item) => (
                      <TouchableOpacity
                        key={item.label}
                        style={s.sheetItem}
                        onPress={() => handleTxnTypePress(item)}
                        activeOpacity={0.7}
                      >
                        <View style={[s.sheetIcon, { backgroundColor: item.iconBg }]}>
                          <Ionicons name={item.icon} size={26} color={item.route ? colors.primary : colors.textMuted} />
                        </View>
                        <Text style={[s.sheetItemLabel, !item.route && { color: colors.textLight }]}>
                          {item.label}
                        </Text>
                        {!item.route && (
                          <View style={s.soonBadge}>
                            <Text style={s.soonTxt}>Soon</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f0f2f5" },

  appBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  appBarLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.primary + "40",
  },
  avatarTxt: { fontSize: 16, fontWeight: "700", color: colors.primary },
  companyName: { fontSize: 17, fontWeight: "700", color: colors.text, flex: 1 },
  appBarRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  filterBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#f59e0b", alignItems: "center", justifyContent: "center",
    marginRight: 4,
  },
  iconBtn: { padding: 6 },

  tabRow: {
    flexDirection: "row", backgroundColor: "#fff",
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 8, gap: 10,
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  tabBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#e0e7ef",
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: colors.red, borderColor: colors.red },
  tabTxt: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  tabTxtActive: { color: "#fff" },

  quickLinks: {
    backgroundColor: "#fff", paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  quickLinksTitle: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 12 },
  quickLinksRow: { flexDirection: "row", justifyContent: "space-between" },
  quickItem: { alignItems: "center", gap: 6, flex: 1 },
  quickIcon: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: "#f0f4ff", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#dde8f8",
  },
  quickLabel: { fontSize: 11, color: colors.text, fontWeight: "500", textAlign: "center" },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", marginHorizontal: 12, marginVertical: 10,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: "#e0e7ef",
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 12, paddingBottom: 120 },
  listEmpty: { flex: 1 },

  card: {
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: "#e8ecf0",
    paddingHorizontal: 14, paddingTop: 13, paddingBottom: 11,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, gap: 8 },
  cardParty: { fontSize: 14.5, fontWeight: "700", color: colors.text, marginBottom: 5 },
  badge: { alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  badgeTxt: { fontSize: 10.5, fontWeight: "700" },
  cardNum: { fontSize: 11, color: colors.textMuted, textAlign: "right", marginBottom: 2 },
  cardDate: { fontSize: 11.5, color: colors.textMuted },
  cardMid: { flexDirection: "row", alignItems: "center", gap: 20 },
  amtLbl: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  amtVal: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  cardActions: { flexDirection: "row", gap: 4, marginLeft: "auto" },
  actionBtn: { padding: 6 },

  partyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  partyAvatar: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
  },
  partyAvatarTxt: { fontSize: 16, fontWeight: "700", color: colors.primary },
  partyName: { fontSize: 14, fontWeight: "600", color: colors.text },
  partyPhone: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  partyBal: { fontSize: 13.5, fontWeight: "700" },
  partyBalLbl: { fontSize: 10.5, color: colors.textMuted, marginTop: 2 },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, marginTop: 60 },
  emptyTxt: { fontSize: 14, color: colors.textMuted },
  emptyBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  emptyBtnTxt: { fontSize: 14, fontWeight: "600", color: "#fff" },

  fab: {
    position: "absolute", alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.red, borderRadius: 100,
    paddingHorizontal: 28, paddingVertical: 15,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  fabTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },

  /* ── Bottom sheet ── */
  modalContainer: {
    flex: 1, justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 10,
    maxHeight: "88%",
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#d1d5db", alignSelf: "center", marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text },

  sheetSection: { marginBottom: 20 },
  sheetSectionTitle: {
    fontSize: 13, fontWeight: "700", color: colors.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 14, paddingLeft: 2,
  },
  sheetGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
  },
  sheetItem: {
    width: "29%", alignItems: "center", gap: 8,
  },
  sheetIcon: {
    width: 64, height: 64, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  sheetItemLabel: {
    fontSize: 11.5, fontWeight: "500", color: colors.text,
    textAlign: "center", lineHeight: 16,
  },
  soonBadge: {
    backgroundColor: "#fef3c7", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, marginTop: -2,
  },
  soonTxt: { fontSize: 9.5, fontWeight: "700", color: "#b45309" },
});

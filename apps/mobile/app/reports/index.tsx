import { useState, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, SectionList,
  StyleSheet, StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";

type ReportItem  = { key: string; label: string; icon: string };
type ReportGroup = { title: string; groupColor: string; data: ReportItem[] };

const REPORT_GROUPS: ReportGroup[] = [
  {
    title: "Transaction Reports",
    groupColor: colors.primary,
    data: [
      { key: "sale",             label: "Sale",             icon: "trending-up-outline" },
      { key: "purchase",         label: "Purchase",         icon: "trending-down-outline" },
      { key: "day-book",         label: "Day Book",         icon: "book-outline" },
      { key: "all-transactions", label: "All Transactions", icon: "list-outline" },
      { key: "profit-and-loss",  label: "Profit & Loss",    icon: "bar-chart-outline" },
      { key: "cash-flow",        label: "Cash Flow",        icon: "water-outline" },
      { key: "expense",          label: "Expense",          icon: "wallet-outline" },
    ],
  },
  {
    title: "Party Reports",
    groupColor: "#6d28d9",
    data: [
      { key: "party-statement",              label: "Party Statement",              icon: "person-outline" },
      { key: "all-parties",                  label: "All Parties",                  icon: "people-outline" },
      { key: "sale-purchase-by-party",       label: "Sale Purchase By Party",       icon: "swap-horizontal-outline" },
      { key: "party-report-by-item",         label: "Party Report By Item",         icon: "grid-outline" },
      { key: "sale-purchase-by-party-group", label: "Sale Purchase By Party Group", icon: "layers-outline" },
    ],
  },
  {
    title: "Item / Stock Reports",
    groupColor: "#b45309",
    data: [
      { key: "stock-summary",      label: "Stock Summary",           icon: "cube-outline" },
      { key: "low-stock",          label: "Low Stock Summary",       icon: "alert-circle-outline" },
      { key: "stock-detail",       label: "Stock Detail",            icon: "search-outline" },
      { key: "item-detail",        label: "Item Detail",             icon: "document-text-outline" },
      { key: "item-wise-pnl",      label: "Item Wise Profit & Loss", icon: "bar-chart-outline" },
      { key: "item-wise-discount", label: "Item Wise Discount",      icon: "pricetag-outline" },
    ],
  },
  {
    title: "Business Status",
    groupColor: "#be185d",
    data: [
      { key: "discount-report",  label: "Discount Report",  icon: "gift-outline" },
      { key: "expense-category", label: "Expense Category", icon: "folder-outline" },
      { key: "expense-item",     label: "Expense Item",     icon: "receipt-outline" },
    ],
  },
  {
    title: "Taxes",
    groupColor: "#c2410c",
    data: [
      { key: "tax-report",      label: "Tax Report",      icon: "calculator-outline" },
      { key: "tax-rate-report", label: "Tax Rate Report", icon: "document-text-outline" },
    ],
  },
  {
    title: "Orders",
    groupColor: "#0369a1",
    data: [
      { key: "sale-purchase-orders",      label: "Sale / Purchase Orders",      icon: "clipboard-outline" },
      { key: "sale-purchase-order-items", label: "Sale / Purchase Order Items", icon: "list-outline" },
    ],
  },
];

export default function ReportsIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const filtered = useMemo<ReportGroup[]>(() => {
    if (!search.trim()) return REPORT_GROUPS;
    const q = search.toLowerCase();
    return REPORT_GROUPS
      .map(g => ({ ...g, data: g.data.filter(i => i.label.toLowerCase().includes(q)) }))
      .filter(g => g.data.length > 0);
  }, [search]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Reports</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textLight} />
        <TextInput
          style={s.searchInput}
          placeholder="Search reports…"
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <SectionList
        sections={filtered}
        keyExtractor={item => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => {
          const grp = section as unknown as ReportGroup;
          return (
            <View style={s.sectionHeader}>
              <View style={[s.sectionDot, { backgroundColor: grp.groupColor }]} />
              <Text style={[s.sectionTitle, { color: grp.groupColor }]}>{section.title}</Text>
            </View>
          );
        }}
        renderSectionFooter={() => <View style={{ height: 8 }} />}
        renderItem={({ item, section }) => {
          const grp = section as unknown as ReportGroup;
          return (
            <TouchableOpacity
              style={s.row}
              activeOpacity={0.65}
              onPress={() => router.push(`/reports/${item.key}` as never)}
            >
              <View style={[s.rowIconWrap, { backgroundColor: grp.groupColor + "18" }]}>
                <Ionicons name={item.icon as any} size={17} color={grp.groupColor} />
              </View>
              <Text style={s.rowLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={s.divider} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },

  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", marginHorizontal: 16, marginVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },

  listContent: { paddingBottom: 32 },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.7,
  },

  row: {
    backgroundColor: "#fff",
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  rowLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "500" },
  divider: { height: 1, backgroundColor: colors.borderLight, marginLeft: 62 },
});

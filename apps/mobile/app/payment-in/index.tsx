import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

const TRANSACTIONS = [
  // empty for now — shows empty state
];

const DATE_FILTERS = ["This Month", "Last Month", "Custom"];
const TYPE_FILTERS = ["All", "Payment-In", "Payment-Out"];

export default function PaymentInListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [dateFilter, setDateFilter] = useState("This Month");
  const [typeFilter, setTypeFilter] = useState("All");
  const [partySearch, setPartySearch] = useState("");
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Transactions</Text>
        <TouchableOpacity style={styles.headerIconBtn}>
          <Text style={styles.headerIcon}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pdfBtn}>
          <Text style={styles.pdfBtnText}>PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Filter row */}
      <View style={styles.filterRow}>
        {/* Date filter */}
        <View style={styles.filterWrap}>
          <TouchableOpacity
            style={styles.filterDropdown}
            onPress={() => { setShowDateDropdown(!showDateDropdown); setShowTypeDropdown(false); }}
          >
            <Text style={styles.filterText}>{dateFilter}</Text>
            <Text style={styles.filterChevron}>∨</Text>
          </TouchableOpacity>
          {showDateDropdown && (
            <View style={styles.dropdownMenu}>
              {DATE_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={styles.dropdownItem}
                  onPress={() => { setDateFilter(f); setShowDateDropdown(false); }}
                >
                  <Text style={[styles.dropdownItemText, f === dateFilter && styles.dropdownItemActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Type filter */}
        <View style={styles.filterWrap}>
          <TouchableOpacity
            style={styles.filterDropdown}
            onPress={() => { setShowTypeDropdown(!showTypeDropdown); setShowDateDropdown(false); }}
          >
            <Text style={styles.filterText}>{typeFilter}</Text>
            <Text style={styles.filterChevron}>∨</Text>
          </TouchableOpacity>
          {showTypeDropdown && (
            <View style={styles.dropdownMenu}>
              {TYPE_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={styles.dropdownItem}
                  onPress={() => { setTypeFilter(f); setShowTypeDropdown(false); }}
                >
                  <Text style={[styles.dropdownItemText, f === typeFilter && styles.dropdownItemActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Party name search */}
        <View style={styles.partySearchWrap}>
          <TextInput
            style={styles.partySearch}
            placeholder="Party Name"
            placeholderTextColor={colors.textLight}
            value={partySearch}
            onChangeText={setPartySearch}
          />
        </View>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Payment-In</Text>
          <Text style={[styles.summaryValue, { color: colors.green }]}>Rs 0.00</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Payment-Out</Text>
          <Text style={[styles.summaryValue, { color: colors.red }]}>Rs 0.00</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ flexGrow: 1 }}>
        {TRANSACTIONS.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySub}>Record a payment-in to get started.</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/payment-in/new" as never)}
      >
        <Text style={styles.fabText}>+ Add Payment-In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.teal,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backArrow: { fontSize: 22, color: "#fff" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#fff" },
  headerIconBtn: { padding: 4 },
  headerIcon: { fontSize: 18 },
  pdfBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  pdfBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
    zIndex: 10,
  },
  filterWrap: { position: "relative" },
  filterDropdown: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f8fafc",
    gap: 4,
  },
  filterText: { fontSize: 12, color: colors.text, fontWeight: "500" },
  filterChevron: { fontSize: 10, color: colors.textMuted },
  dropdownMenu: {
    position: "absolute",
    top: 38,
    left: 0,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 130,
    zIndex: 100,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  dropdownItemText: { fontSize: 13, color: colors.text },
  dropdownItemActive: { color: colors.primary, fontWeight: "600" },
  partySearchWrap: { flex: 1 },
  partySearch: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: colors.text,
    backgroundColor: "#f8fafc",
  },

  summaryBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryCell: { flex: 1, padding: 14, alignItems: "center" },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 8 },
  summaryLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: "700" },

  scroll: { flex: 1 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 80 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.textMuted },
  emptySub: { fontSize: 13, color: colors.textLight },

  fab: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.teal,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});

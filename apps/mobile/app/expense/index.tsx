import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";

const CATEGORIES = [
  { name: "Office rent", amt: 25000, icon: "🏢", tint: "#dbeafe", fg: "#1d4ed8", count: 1 },
  { name: "Salaries", amt: 84000, icon: "👥", tint: "#fce7f3", fg: "#be185d", count: 4 },
  { name: "Utilities", amt: 8500, icon: "⚡", tint: "#fef3c7", fg: "#b45309", count: 3 },
  { name: "Travel & Fuel", amt: 12200, icon: "🚗", tint: "#dcfce7", fg: "#15803d", count: 6 },
  { name: "Marketing", amt: 6400, icon: "📣", tint: "#ede9fe", fg: "#6d28d9", count: 2 },
  { name: "Misc", amt: 3200, icon: "📦", tint: "#e0e7ff", fg: "#4338ca", count: 4 },
];

function fmtRs(n: number) { return "₨ " + n.toLocaleString("en-IN"); }

export default function ExpenseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const total = CATEGORIES.reduce((a, c) => a + c.amt, 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Expense</Text>
        <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.totalCard}>
          <View>
            <Text style={styles.totalLabel}>Total expenses · this month</Text>
            <Text style={styles.totalAmt}>{fmtRs(total)}</Text>
          </View>
          <View style={styles.trendBadge}>
            <Text style={styles.trendTxt}>↑ 8%</Text>
          </View>
        </View>

        <Text style={styles.sectionTxt}>Categories</Text>
        <View style={styles.grid}>
          {CATEGORIES.map((c) => {
            const pct = ((c.amt / total) * 100).toFixed(0);
            return (
              <View key={c.name} style={styles.catCard}>
                <View style={styles.catCardTop}>
                  <View style={[styles.catIcon, { backgroundColor: c.tint }]}>
                    <Text style={{ fontSize: 17 }}>{c.icon}</Text>
                  </View>
                  <Text style={[styles.catPct, { color: c.fg }]}>{pct}%</Text>
                </View>
                <Text style={styles.catName}>{c.name}</Text>
                <Text style={styles.catAmt}>{fmtRs(c.amt)}</Text>
                <Text style={styles.catCount}>{c.count} {c.count === 1 ? "entry" : "entries"}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.fabWrap, { bottom: 24 + (insets.bottom || 8) }]}>
        <TouchableOpacity style={styles.fab} onPress={() => router.push("/expense/new" as never)}>
          <View style={styles.fabPlus}><Text style={styles.fabPlusTxt}>+</Text></View>
          <Text style={styles.fabLabel}>Add Expense</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  body: { padding: 18, paddingBottom: 120 },
  totalCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  totalLabel: { fontSize: 11, color: colors.textLight, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.3 },
  totalAmt: { fontSize: 24, fontWeight: "700", color: colors.text, marginTop: 5, letterSpacing: -0.3 },
  trendBadge: { backgroundColor: "#fff7ed", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  trendTxt: { fontSize: 11, fontWeight: "700", color: "#c2410c" },
  sectionTxt: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 20, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catCard: {
    width: "48%", backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  catCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  catPct: { fontSize: 11, fontWeight: "700" },
  catName: { fontSize: 12.5, fontWeight: "600", color: colors.text, marginTop: 12 },
  catAmt: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 4, letterSpacing: -0.2 },
  catCount: { fontSize: 10.5, color: colors.textLight, marginTop: 2 },
  fabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  fab: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: colors.primary, borderRadius: 100,
    paddingHorizontal: 24, paddingVertical: 13,
    shadowColor: colors.primary, shadowOpacity: 0.32, shadowRadius: 20, elevation: 8,
  },
  fabPlus: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  fabPlusTxt: { fontSize: 18, fontWeight: "700", color: "#fff", lineHeight: 20 },
  fabLabel: { fontSize: 14, fontWeight: "600", color: "#fff" },
});

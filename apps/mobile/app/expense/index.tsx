import { useState, useCallback } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import { parseExpenseCategory, styleForCategory } from "../../src/expenseCategory";
import type { Transaction } from "@vyapar/api-client";

type CategoryBucket = { name: string; amt: number; count: number };

function fmtRs(n: number) { return "₨ " + n.toLocaleString("en-IN"); }

export default function ExpenseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rows = await api.getTransactionsByType("expense");
      setTxns(rows);
    } catch {
      /* offline — keep showing whatever already loaded */
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  // Group the real transactions by their notes.category — this replaces the old
  // hardcoded CATEGORIES constant (Office rent Rs 25000, Salaries Rs 84000, etc.), which
  // was entirely made-up data never tied to an actual Transaction row.
  const bucketsByKey = new Map<string, CategoryBucket>();
  for (const t of txns) {
    const category = parseExpenseCategory(t.notes);
    const key = category.toLowerCase();
    const bucket = bucketsByKey.get(key) ?? { name: category, amt: 0, count: 0 };
    bucket.amt += t.total;
    bucket.count += 1;
    bucketsByKey.set(key, bucket);
  }
  const categories = [...bucketsByKey.values()].sort((a, b) => b.amt - a.amt);
  const total = categories.reduce((a, c) => a + c.amt, 0);

  // Real month-over-month trend, computed from the actual transaction dates — the old
  // "↑ 8%" badge was invented with no computation behind it at all. Shown only when
  // there's data to compare against; otherwise it's just omitted rather than faked.
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${prevMonthDate.getMonth()}`;
  let thisMonthTotal = 0;
  let prevMonthTotal = 0;
  for (const t of txns) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key === thisMonthKey) thisMonthTotal += t.total;
    else if (key === prevMonthKey) prevMonthTotal += t.total;
  }
  const trendPct = prevMonthTotal > 0 ? Math.round(((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) : null;

  const q = search.toLowerCase();
  const filteredCategories = categories.filter((c) => c.name.toLowerCase().includes(q));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Expense</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={colors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by category"
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <View style={styles.totalCard}>
            <View>
              <Text style={styles.totalLabel}>Total Expenses</Text>
              <Text style={styles.totalAmt}>{fmtRs(total)}</Text>
            </View>
            {trendPct !== null && (
              <View style={[styles.trendBadge, trendPct > 0 ? styles.trendBadgeUp : styles.trendBadgeDown]}>
                <Text style={[styles.trendTxt, trendPct > 0 ? styles.trendTxtUp : styles.trendTxtDown]}>
                  {trendPct > 0 ? "↑" : trendPct < 0 ? "↓" : "•"} {Math.abs(trendPct)}% vs last month
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTxt}>Categories</Text>
          {filteredCategories.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color={colors.border} />
              <Text style={styles.emptyTitle}>
                {search ? "No matching records" : txns.length === 0 ? "No expenses yet" : "No categories yet"}
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {filteredCategories.map((c) => {
                const pct = total > 0 ? ((c.amt / total) * 100).toFixed(0) : "0";
                const style = styleForCategory(c.name);
                return (
                  <TouchableOpacity
                    key={c.name}
                    style={styles.catCard}
                    onPress={() => router.push(`/expense/category/${encodeURIComponent(c.name)}` as never)}
                  >
                    <View style={styles.catCardTop}>
                      <View style={[styles.catIcon, { backgroundColor: style.tint }]}>
                        <Text style={{ fontSize: 17 }}>{style.icon}</Text>
                      </View>
                      <Text style={[styles.catPct, { color: style.fg }]}>{pct}%</Text>
                    </View>
                    <Text style={styles.catName}>{c.name}</Text>
                    <Text style={styles.catAmt}>{fmtRs(c.amt)}</Text>
                    <Text style={styles.catCount}>{c.count} {c.count === 1 ? "entry" : "entries"}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 18, paddingBottom: 120 },
  totalCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  totalLabel: { fontSize: 11, color: colors.textLight, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.3 },
  totalAmt: { fontSize: 24, fontWeight: "700", color: colors.text, marginTop: 5, letterSpacing: -0.3 },
  trendBadge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  trendBadgeUp: { backgroundColor: "#fff7ed" },
  trendBadgeDown: { backgroundColor: "#e6f9ee" },
  trendTxt: { fontSize: 11, fontWeight: "700" },
  trendTxtUp: { color: "#c2410c" },
  trendTxtDown: { color: colors.green },
  sectionTxt: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 20, marginBottom: 12 },
  emptyState: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: colors.textLight },
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

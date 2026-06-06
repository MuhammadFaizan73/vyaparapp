import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const PALETTES = [
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#ede9fe", fg: "#6d28d9" },
];

function hue(name: string) { return PALETTES[name.length % PALETTES.length]; }
function fmtRs(n: number) { return "₨ " + Math.round(n).toLocaleString("en-PK"); }

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [totalPaymentsIn, setTotalPaymentsIn] = useState(0);
  const [topCustomers, setTopCustomers] = useState<{ name: string; total: number; count: number }[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ m: string; v: number }[]>([]);

  useFocusEffect(useCallback(() => {
    loadDashboard();
  }, []));

  async function loadDashboard() {
    setLoading(true);
    try {
      const [sales, parties, paymentsIn] = await Promise.all([
        api.getTransactionsByType("sale"),
        api.getParties(),
        api.getTransactionsByType("payment_in"),
      ]);

      const partyMap: Record<string, string> = {};
      parties.forEach((p: any) => { partyMap[p.id] = p.name; });

      // Totals
      const saleTotals = sales.reduce((s: number, t: any) => s + t.total, 0);
      const pendingTotals = sales.filter((t: any) => t.balance > 0).reduce((s: number, t: any) => s + t.balance, 0);
      const receivedTotals = sales.reduce((s: number, t: any) => s + (t.total - t.balance), 0);
      const payInTotals = paymentsIn.reduce((s: number, t: any) => s + t.total, 0);

      setTotalSales(saleTotals);
      setTotalPending(pendingTotals);
      setTotalReceived(receivedTotals);
      setTotalPaymentsIn(payInTotals);

      // Top customers
      const customerMap: Record<string, { name: string; total: number; count: number }> = {};
      sales.forEach((t: any) => {
        const name = partyMap[t.partyId] ?? "Unknown";
        if (!customerMap[name]) customerMap[name] = { name, total: 0, count: 0 };
        customerMap[name].total += t.total;
        customerMap[name].count += 1;
      });
      const sorted = Object.values(customerMap).sort((a, b) => b.total - a.total).slice(0, 5);
      setTopCustomers(sorted);

      // Monthly revenue — last 6 months
      const now = new Date();
      const months: { m: string; total: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          m: d.toLocaleString("en-PK", { month: "short" }),
          total: 0,
        });
      }
      sales.forEach((t: any) => {
        const d = new Date(t.date);
        const key = d.toLocaleString("en-PK", { month: "short" });
        const idx = months.findIndex((m) => m.m === key);
        if (idx !== -1) months[idx].total += t.total;
      });
      const maxTotal = Math.max(...months.map((m) => m.total), 1);
      setMonthlyRevenue(months.map((m) => ({ m: m.m, v: m.total / maxTotal })));
    } catch {
      // offline — keep zeros
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Dashboard</Text>
        <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {/* Hero KPI */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroLabel}>Total Sales</Text>
                <Text style={styles.heroAmount}>{fmtRs(totalSales)}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeTxt}>This month</Text>
              </View>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStats}>
              <StatChip label="You'll get" value={fmtRs(totalPending)} tint="#0c8b4a" />
              <View style={styles.statDivider} />
              <StatChip label="Received" value={fmtRs(totalReceived)} tint="#1d4ed8" />
              <View style={styles.statDivider} />
              <StatChip label="Payments In" value={fmtRs(totalPaymentsIn)} />
            </View>
          </View>

          {/* Revenue chart */}
          <SectionH title="Revenue · last 6 months" right="View report" onRight={() => router.push("/reports" as never)} />
          <View style={styles.chartCard}>
            <View style={styles.chartBars}>
              {monthlyRevenue.map((m, i) => (
                <View key={m.m} style={styles.barCol}>
                  <View style={styles.barWrapper}>
                    {i === monthlyRevenue.length - 1 && m.v > 0 && (
                      <Text style={styles.barLabel}>{fmtRs(totalSales)}</Text>
                    )}
                    <View
                      style={[
                        styles.bar,
                        {
                          height: m.v > 0 ? `${Math.max(m.v * 100, 4)}%` as any : 4,
                          backgroundColor: i === monthlyRevenue.length - 1 ? colors.primary : "#e2e8f0",
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barMonth, i === monthlyRevenue.length - 1 && styles.barMonthActive]}>
                    {m.m}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Top customers */}
          <SectionH title="Top customers" right="See all" onRight={() => router.push("/party" as never)} />
          <View style={styles.listCard}>
            {topCustomers.length === 0 ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ color: colors.textLight, fontSize: 13 }}>No sales yet</Text>
              </View>
            ) : topCustomers.map((c, i) => {
              const p = hue(c.name);
              return (
                <View key={c.name} style={[styles.customerRow, i === topCustomers.length - 1 && styles.lastRow]}>
                  <View style={[styles.avatar, { backgroundColor: p.bg }]}>
                    <Text style={[styles.avatarTxt, { color: p.fg }]}>{c.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.customerMid}>
                    <Text style={styles.customerName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.customerSub}>{c.count} {c.count === 1 ? "invoice" : "invoices"}</Text>
                  </View>
                  <Text style={styles.customerAmt}>{fmtRs(c.total)}</Text>
                </View>
              );
            })}
          </View>

          {/* Quick reports */}
          <SectionH title="Reports" />
          <View style={styles.reportsGrid}>
            <ReportTile label="Sale Report" tint="#dbeafe" fg="#1d4ed8" icon="receipt-outline" onPress={() => router.push("/reports/sale" as never)} />
            <ReportTile label="Profit & Loss" tint="#dcfce7" fg="#15803d" icon="trending-up-outline" onPress={() => router.push("/reports/profit-and-loss" as never)} />
            <ReportTile label="Stock Summary" tint="#fef3c7" fg="#b45309" icon="cube-outline" onPress={() => router.push("/reports/stock-summary" as never)} />
            <ReportTile label="Cashflow" tint="#ede9fe" fg="#6d28d9" icon="bar-chart-outline" onPress={() => router.push("/reports/cash-flow" as never)} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function StatChip({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statChipLabel}>{label}</Text>
      <Text style={[styles.statChipValue, tint ? { color: tint } : {}]}>{value}</Text>
    </View>
  );
}

function SectionH({ title, right, onRight }: { title: string; right?: string; onRight?: () => void }) {
  return (
    <View style={styles.sectionH}>
      <Text style={styles.sectionHTxt}>{title}</Text>
      {right && (
        <TouchableOpacity onPress={onRight}>
          <Text style={styles.sectionHRight}>{right}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ReportTile({ label, tint, fg, icon, onPress }: { label: string; tint: string; fg: string; icon: IoniconsName; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.reportTile} activeOpacity={0.75} onPress={onPress}>
      <View style={[styles.reportIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={16} color={fg} />
      </View>
      <Text style={styles.reportLabel} numberOfLines={2}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.textLight} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { fontSize: 17, fontWeight: "600", color: colors.text, letterSpacing: -0.1 },
  body: { padding: 18, paddingBottom: 110 },

  heroCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: colors.border,
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  heroLabel: { fontSize: 11, color: colors.textLight, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.3 },
  heroAmount: { fontSize: 26, fontWeight: "700", color: colors.text, marginTop: 6, letterSpacing: -0.4 },
  heroBadge: { backgroundColor: "#e6f9ee", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  heroBadgeTxt: { fontSize: 11, fontWeight: "700", color: "#0c8b4a" },
  heroDivider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 14 },
  heroStats: { flexDirection: "row" },
  statChip: { flex: 1, paddingHorizontal: 4 },
  statChipLabel: { fontSize: 10.5, color: colors.textLight, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.3 },
  statChipValue: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: "#f1f5f9" },

  chartCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  chartBars: { flexDirection: "row", alignItems: "flex-end", height: 110, gap: 8 },
  barCol: { flex: 1, alignItems: "center", gap: 6 },
  barWrapper: { flex: 1, width: "100%", justifyContent: "flex-end", position: "relative" },
  bar: { width: "100%", borderRadius: 5 },
  barLabel: {
    position: "absolute", top: -20, width: 60, textAlign: "center",
    left: "50%", marginLeft: -30,
    fontSize: 9, fontWeight: "700", color: colors.primary,
  },
  barMonth: { fontSize: 10.5, color: colors.textLight, fontWeight: "600" },
  barMonthActive: { color: colors.primary },

  listCard: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  customerRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa",
  },
  lastRow: { borderBottomWidth: 0 },
  avatar: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 15, fontWeight: "700" },
  customerMid: { flex: 1 },
  customerName: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  customerSub: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  customerAmt: { fontSize: 13, fontWeight: "700", color: colors.text },

  reportsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  reportTile: {
    width: "48%", backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  reportIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  reportLabel: { flex: 1, fontSize: 12.5, fontWeight: "600", color: colors.text },

  sectionH: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 18,
  },
  sectionHTxt: { fontSize: 13, fontWeight: "600", color: colors.text },
  sectionHRight: { fontSize: 12, color: colors.primary, fontWeight: "600" },
});

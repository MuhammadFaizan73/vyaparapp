import { useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import type { Transaction, Party } from "@vyapar/api-client";

type PiRow = Transaction & { partyName: string; colorIdx: number };

const ROW_COLORS = [
  colors.primary,
  "#15803d",
  "#1d4ed8",
  "#b45309",
  "#6d28d9",
  "#be185d",
  "#c2410c",
];

function fmt4(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "2-digit", month: "short", year: "2-digit",
  });
}

export default function PaymentInListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<PiRow[]>([]);
  const [loading, setLoading] = useState(true);

  // FAB animation
  const micPulse = useRef(new Animated.Value(1)).current;

  async function loadData() {
    try {
      const [txns, parties] = await Promise.all([
        api.getTransactionsByType("payment_in"),
        api.getParties(),
      ]);
      const partyMap = Object.fromEntries(parties.map((p: Party) => [p.id, p.name]));
      const colorMap: Record<string, number> = {};
      let colorCounter = 0;
      setRows(
        txns.map((t) => {
          if (!(t.partyId in colorMap)) {
            colorMap[t.partyId] = colorCounter++ % ROW_COLORS.length;
          }
          return { ...t, partyName: partyMap[t.partyId] ?? "Unknown", colorIdx: colorMap[t.partyId] };
        })
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadData();
    }, [])
  );

  // Today's date formatted for filter row
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric" });
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric" });

  function startMicPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(micPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Teal app bar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>All Transactions</Text>
        <View style={styles.appBarRight}>
          <TouchableOpacity style={styles.pdfPill} hitSlop={8}>
            <Text style={styles.pdfPillTxt}>Pdf</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.xlsPill} hitSlop={8}>
            <Text style={styles.xlsPillTxt}>xls</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter rows */}
      <View style={styles.filterSection}>
        {/* Row 1: User */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>User</Text>
          <TouchableOpacity style={styles.filterDropdown}>
            <Text style={styles.filterDropdownTxt}>All Users</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Row 2: Date range */}
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterDropdown}>
            <Text style={styles.filterDropdownTxt}>This month</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.dateRangeRight}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={styles.filterDropdownTxt}>{monthStart}</Text>
            <Text style={styles.toLabel}>to</Text>
            <Text style={styles.filterDropdownTxt}>{monthEnd}</Text>
          </View>
        </View>

        {/* Row 3: Type / Status — split */}
        <View style={[styles.filterRow, { paddingHorizontal: 0 }]}>
          <TouchableOpacity style={styles.filterHalf}>
            <Text style={styles.filterDropdownTxt}>Payment-In</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.filterDivider} />
          <TouchableOpacity style={styles.filterHalf}>
            <Text style={styles.filterDropdownTxt}>All Statuses</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Row 4: Party Name */}
        <View style={[styles.filterRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.filterLabelTeal}>Party Name</Text>
          <TouchableOpacity style={styles.filterDropdown}>
            <Text style={styles.filterDropdownTxt}>All parties</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerWrap}>
          <Text style={styles.loadingTxt}>Loading…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centerWrap}>
          <View style={styles.docIllustration}>
            <View style={styles.docPage}>
              <View style={styles.docLine} />
              <View style={styles.docLine} />
              <View style={[styles.docLine, { width: "55%" }]} />
            </View>
            <View style={styles.docAccent} />
          </View>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptySub}>Record a payment to get started.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          renderItem={({ item, index }) => (
            <TouchableOpacity activeOpacity={0.7} style={styles.txnRow}>
              {/* Left color bar */}
              <View style={[styles.colorBar, { backgroundColor: ROW_COLORS[item.colorIdx] }]} />

              {/* Party + date */}
              <View style={styles.txnLeft}>
                <Text style={styles.txnParty}>{item.partyName}</Text>
                <Text style={styles.txnDate}>{fmtDate(item.date)}</Text>
              </View>

              {/* PayIn : N */}
              <View style={styles.txnMid}>
                <Text style={styles.txnPayIn}>PayIn : {index + 1}</Text>
              </View>

              {/* Total + Balance */}
              <View style={styles.txnRight}>
                <Text style={styles.txnAmtLabel}>Total : Rs</Text>
                <Text style={styles.txnAmt}>{fmt4(item.total)}</Text>
                <Text style={styles.txnAmtLabel}>Balance: Rs</Text>
                <Text style={styles.txnBalance}>{fmt4(item.balance)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* 3-button FAB bar */}
      <View style={[styles.fabBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.fabCirclePurple}>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fabRedPill}
          onPress={() => router.push("/payment-in/new" as never)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.fabPillTxt}>Add Payment-In</Text>
        </TouchableOpacity>

        <Animated.View style={{ transform: [{ scale: micPulse }] }}>
          <TouchableOpacity style={styles.fabCircleOrange} onPress={startMicPulse}>
            <Ionicons name="mic" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  /* App bar */
  appBar: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#fff" },
  appBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  pdfPill: {
    backgroundColor: "#fee2e2", borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  pdfPillTxt: { fontSize: 11, fontWeight: "700", color: colors.red },
  xlsPill: {
    backgroundColor: "#dcfce7", borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  xlsPillTxt: { fontSize: 11, fontWeight: "700", color: colors.green },

  /* Filter section */
  filterSection: {
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa",
    gap: 8,
  },
  filterLabel: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  filterLabelTeal: { fontSize: 13.5, fontWeight: "700", color: colors.primary },
  filterDropdown: { flexDirection: "row", alignItems: "center", gap: 4 },
  filterDropdownTxt: { fontSize: 12.5, color: colors.textSecondary, fontWeight: "500" },
  filterHalf: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 11, gap: 4,
  },
  filterDivider: { width: 1, height: 32, backgroundColor: colors.border },
  dateRangeRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  toLabel: { fontSize: 12, color: colors.textMuted },

  /* List row */
  txnRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", paddingVertical: 12, paddingRight: 14,
  },
  colorBar: { width: 4, alignSelf: "stretch", marginRight: 12 },
  txnLeft: { flex: 1.5, gap: 2 },
  txnParty: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  txnDate: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  txnMid: { flex: 1, alignItems: "center" },
  txnPayIn: { fontSize: 11.5, color: colors.textMuted, fontWeight: "500" },
  txnRight: { alignItems: "flex-end", gap: 1 },
  txnAmtLabel: { fontSize: 10, color: colors.textLight },
  txnAmt: { fontSize: 12.5, fontWeight: "700", color: colors.text },
  txnBalance: { fontSize: 12.5, fontWeight: "700", color: colors.primary },
  separator: { height: 1, backgroundColor: "#f0f4f8", marginLeft: 16 },

  /* Empty / loading */
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  loadingTxt: { fontSize: 13, color: colors.textMuted },
  docIllustration: { width: 110, height: 110, position: "relative", marginBottom: 4 },
  docPage: {
    width: 78, height: 88, backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 7,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  docLine: { height: 5, backgroundColor: "#dde6f0", borderRadius: 3, width: "82%" },
  docAccent: {
    position: "absolute", right: 0, top: 14,
    width: 28, height: 78, backgroundColor: colors.primary,
    borderRadius: 8, opacity: 0.7,
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  emptySub: { fontSize: 13, color: colors.textMuted },

  /* FAB bar */
  fabBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: "transparent",
  },
  fabCirclePurple: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#6d28d9",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#6d28d9", shadowOpacity: 0.4, shadowRadius: 8, elevation: 5,
  },
  fabRedPill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 46, borderRadius: 23,
    backgroundColor: colors.red,
    shadowColor: colors.red, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  fabPillTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
  fabCircleOrange: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#c2410c",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#c2410c", shadowOpacity: 0.4, shadowRadius: 8, elevation: 5,
  },
});

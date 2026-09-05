import { useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Animated, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import { DateRangeFilterBar, type DateRange, getRange, isWithinRange } from "../../src/components/DateRangeFilter";
import { useTeamMembers } from "../../src/useTeamMembers";
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
  const [range, setRange] = useState<DateRange>(() => getRange("all"));
  const [salesmanFilter, setSalesmanFilter] = useState("");
  const [showSalesmanPicker, setShowSalesmanPicker] = useState(false);
  const teamMembers = useTeamMembers();

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

  const filtered = rows.filter((r) =>
    isWithinRange(r.date, range) && (!salesmanFilter || r.bookerId === salesmanFilter)
  );
  const selectedSalesmanName = salesmanFilter ? teamMembers.find((m) => m.id === salesmanFilter)?.name : null;
  const filteredTotal = filtered.reduce((s, r) => s + r.total, 0);
  const filteredBalance = filtered.reduce((s, r) => s + r.balance, 0);

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
          <TouchableOpacity style={styles.filterDropdown} onPress={() => setShowSalesmanPicker(true)}>
            <Text style={styles.filterDropdownTxt}>{selectedSalesmanName ?? "All Users"}</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Row 2: Date range */}
        <DateRangeFilterBar range={range} onChange={setRange} datesOnly />

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
      ) : filtered.length === 0 ? (
        <View style={styles.centerWrap}>
          <View style={styles.docIllustration}>
            <View style={styles.docPage}>
              <View style={styles.docLine} />
              <View style={styles.docLine} />
              <View style={[styles.docLine, { width: "55%" }]} />
            </View>
            <View style={styles.docAccent} />
          </View>
          <Text style={styles.emptyTitle}>No transactions in this period</Text>
          <Text style={styles.emptySub}>Try a wider date range.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 142 }}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.txnRow}
              onPress={() => router.push(`/txn/${item.id}` as never)}
            >
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

      {/* Fixed summary footer — reflects whatever the current filters (date range etc.)
          show, same as the list above it, not an all-time total. */}
      {!loading && rows.length > 0 && (
        <TouchableOpacity style={[styles.summaryBar, { paddingBottom: insets.bottom + 10 }]} activeOpacity={0.85}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>No of Txn</Text>
            <Text style={styles.summaryValue}>{filtered.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Amount</Text>
            <Text style={styles.summaryValue}>Rs {fmt4(filteredTotal)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Balance</Text>
            <Text style={styles.summaryValue}>Rs {fmt4(filteredBalance)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#fff" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      )}

      {/* 3-button FAB bar */}
      <View style={[styles.fabBar, { bottom: insets.bottom + 62, paddingBottom: 0 }]}>
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

      {/* Salesman picker */}
      <Modal visible={showSalesmanPicker} transparent animationType="slide" onRequestClose={() => setShowSalesmanPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowSalesmanPicker(false)} />
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>Filter by User</Text>
          <TouchableOpacity style={styles.pickerRow} onPress={() => { setSalesmanFilter(""); setShowSalesmanPicker(false); }}>
            <Text style={styles.pickerRowTxt}>All Users</Text>
            {!salesmanFilter && <Ionicons name="checkmark" size={18} color={colors.primary} />}
          </TouchableOpacity>
          {teamMembers.map((m) => (
            <TouchableOpacity key={m.id} style={styles.pickerRow} onPress={() => { setSalesmanFilter(m.id); setShowSalesmanPicker(false); }}>
              <Text style={styles.pickerRowTxt}>{m.name}</Text>
              {salesmanFilter === m.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
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
  summaryBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#7c6fd1",
    paddingVertical: 10, paddingHorizontal: 12,
  },
  summaryCol: { flex: 1, alignItems: "flex-start", paddingHorizontal: 6 },
  summaryDivider: { width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.3)" },
  summaryLabel: { fontSize: 10.5, color: "rgba(255,255,255,0.85)", marginBottom: 2 },
  summaryValue: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
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

  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  pickerSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" },
  pickerTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 12 },
  pickerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  pickerRowTxt: { fontSize: 14.5, color: colors.text },
});

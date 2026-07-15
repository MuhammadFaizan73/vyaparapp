import { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Modal, FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { useParties } from "../../src/useParties";
import { api } from "../../src/auth";
import type { Transaction } from "@vyapar/api-client";

type DateRange = "this_month" | "last_month" | "this_year" | "all_time";

const RANGE_LABELS: Record<DateRange, string> = {
  this_month: "This Month",
  last_month: "Last Month",
  this_year: "This Year",
  all_time: "All Time",
};

const TXN_TYPE_LABEL: Record<string, string> = {
  sale: "Sale",
  purchase: "Purchase",
  payment_in: "Payment In",
  payment_out: "Payment Out",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
  expense: "Expense",
  opening_balance: "Opening Bal",
};

function getDateRange(range: DateRange): { from: Date; to: Date } {
  const now = new Date();
  if (range === "this_month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }
  if (range === "last_month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 0),
    };
  }
  if (range === "this_year") {
    return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31) };
  }
  return { from: new Date(2000, 0, 1), to: new Date(2099, 11, 31) };
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getFullYear()).slice(-2)}`;
}

function fmtDateShort(d: Date) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function PartyStatementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parties, loading: partiesLoading } = useParties();

  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("this_month");
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);

  const [showPartyPicker, setShowPartyPicker] = useState(false);
  const [showRangePicker, setShowRangePicker] = useState(false);

  const selectedParty = parties.find(p => p.id === selectedPartyId);
  const range = getDateRange(dateRange);

  async function selectParty(id: string) {
    setShowPartyPicker(false);
    setSelectedPartyId(id);
    setTxnLoading(true);
    try {
      const data = await api.getPartyTransactions(id);
      setTxns(data);
    } catch {
      setTxns([]);
    } finally {
      setTxnLoading(false);
    }
  }

  const filteredTxns = useMemo(() => {
    return txns.filter(t => {
      const d = new Date(t.date);
      return d >= range.from && d <= range.to;
    });
  }, [txns, dateRange]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Party Statement</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerBtn}>
            <Text style={s.headerBtnTxt}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn}>
            <Text style={s.headerBtnTxt}>XLS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Range Row */}
      <View style={s.rangeRow}>
        <TouchableOpacity style={s.rangeBtn} onPress={() => setShowRangePicker(true)}>
          <Text style={s.rangeIcon}>📅</Text>
          <Text style={s.rangeTxt}>{RANGE_LABELS[dateRange]}</Text>
          <Text style={s.rangeSub}>
            {fmtDateShort(range.from)} – {fmtDateShort(range.to)}
          </Text>
          <Text style={s.rangeChevron}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chip */}
      <View style={s.filterRow}>
        <Text style={s.filterLabel}>Filters Applied</Text>
        <View style={s.filterChip}>
          <Text style={s.filterChipTxt}>Theme - Godigi View  ✕</Text>
        </View>
      </View>

      {/* Party Selector */}
      <TouchableOpacity style={s.partySelector} onPress={() => setShowPartyPicker(true)}>
        <Text style={s.partySelectorIcon}>👤</Text>
        <Text style={[s.partySelectorTxt, selectedParty && s.partySelectorTxtSelected]}>
          {selectedParty ? selectedParty.name : "Select Party"}
        </Text>
        <Text style={s.partySelectorChevron}>▾</Text>
      </TouchableOpacity>

      {/* Content */}
      {!selectedPartyId ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIllustration}>📋</Text>
          <Text style={s.emptyTitle}>No Party Selected</Text>
          <Text style={s.emptyText}>
            To see the statement in full detail, please select a party.
          </Text>
        </View>
      ) : txnLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : filteredTxns.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIllustration}>📭</Text>
          <Text style={s.emptyTitle}>No Transactions</Text>
          <Text style={s.emptyText}>No transactions found for this period.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {/* Table Header */}
            <View style={s.tableHeader}>
              {["Date", "Type", "Ref #", "Total", "Balance"].map(h => (
                <Text key={h} style={[s.th, (h === "Total" || h === "Balance") && s.thRight]}>
                  {h}
                </Text>
              ))}
            </View>
            {/* Table Rows */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredTxns.map((t, i) => (
                <View key={t.id} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                  <Text style={s.td}>{fmtDate(t.date)}</Text>
                  <Text style={[s.td, s.tdType]}>{TXN_TYPE_LABEL[t.type] ?? t.type}</Text>
                  <Text style={s.td}>{t.number ?? `#${t.id.slice(-4)}`}</Text>
                  <Text style={[s.td, s.tdRight]}>Rs {fmtAmt(t.total)}</Text>
                  <Text style={[s.td, s.tdRight, t.balance < 0 ? s.tdRed : s.tdGreen]}>
                    Rs {fmtAmt(t.balance)}
                  </Text>
                </View>
              ))}
            </ScrollView>
            {/* Summary */}
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Closing Balance</Text>
              <Text style={[s.summaryAmt, (selectedParty?.balance ?? 0) < 0 ? s.tdRed : s.tdGreen]}>
                Rs {fmtAmt(selectedParty?.balance ?? 0)}
                {(selectedParty?.balance ?? 0) < 0 ? "  You'll Give" : "  You'll Get"}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Party Picker Modal */}
      <Modal
        visible={showPartyPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPartyPicker(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.pickerSheet}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Select Party</Text>
              <TouchableOpacity onPress={() => setShowPartyPicker(false)}>
                <Text style={s.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {partiesLoading ? (
              <ActivityIndicator color={colors.primary} style={{ margin: 24 }} />
            ) : parties.length === 0 ? (
              <Text style={s.pickerEmpty}>No parties found. Add a party first.</Text>
            ) : (
              <FlatList
                data={parties}
                keyExtractor={p => p.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={s.pickerRow} onPress={() => selectParty(item.id)}>
                    <View style={s.pickerAvatar}>
                      <Text style={s.pickerAvatarTxt}>{item.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={s.pickerRowText}>
                      <Text style={s.pickerRowName}>{item.name}</Text>
                      {item.phone ? <Text style={s.pickerRowPhone}>{item.phone}</Text> : null}
                    </View>
                    {item.id === selectedPartyId && <Text style={s.pickerCheck}>✓</Text>}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={s.pickerDivider} />}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Date Range Picker Modal */}
      <Modal
        visible={showRangePicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowRangePicker(false)}
      >
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowRangePicker(false)}>
          <View style={s.rangeSheet}>
            {(Object.keys(RANGE_LABELS) as DateRange[]).map(r => (
              <TouchableOpacity
                key={r}
                style={[s.rangeOption, dateRange === r && s.rangeOptionActive]}
                onPress={() => { setDateRange(r); setShowRangePicker(false); }}
              >
                <Text style={[s.rangeOptionTxt, dateRange === r && s.rangeOptionTxtActive]}>
                  {RANGE_LABELS[r]}
                </Text>
                {dateRange === r && <Text style={s.rangeOptionCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  headerRight: { flexDirection: "row", gap: 8 },
  headerBtn: {
    backgroundColor: "#f1f5f9", borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  headerBtnTxt: { fontSize: 12, fontWeight: "700", color: colors.textMuted },

  rangeRow: {
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rangeBtn: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  rangeIcon: { fontSize: 16 },
  rangeTxt: { fontSize: 14, fontWeight: "700", color: colors.text },
  rangeSub: { flex: 1, fontSize: 12, color: colors.textMuted },
  rangeChevron: { fontSize: 12, color: colors.textMuted },

  filterRow: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8,
  },
  filterLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  filterChip: {
    backgroundColor: "#e0f2fe", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  filterChipTxt: { fontSize: 12, color: colors.primary, fontWeight: "600" },

  partySelector: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: colors.primary, gap: 10, marginBottom: 8,
  },
  partySelectorIcon: { fontSize: 18 },
  partySelectorTxt: { flex: 1, fontSize: 15, color: colors.textMuted, fontWeight: "500" },
  partySelectorTxtSelected: { color: colors.text, fontWeight: "700" },
  partySelectorChevron: { fontSize: 14, color: colors.textMuted },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyIllustration: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 22 },

  tableHeader: {
    flexDirection: "row", backgroundColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  th: { width: 90, fontSize: 12, fontWeight: "700", color: "#fff" },
  thRight: { textAlign: "right" },
  tableRow: {
    flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tableRowAlt: { backgroundColor: "#f8fafc" },
  td: { width: 90, fontSize: 12, color: colors.text },
  tdType: { width: 90, fontSize: 11, color: colors.textMuted },
  tdRight: { textAlign: "right" },
  tdGreen: { color: colors.green },
  tdRed: { color: colors.red },
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.bg, paddingHorizontal: 12, paddingVertical: 12,
    borderTopWidth: 2, borderTopColor: colors.border,
  },
  summaryLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  summaryAmt: { fontSize: 14, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "70%",
  },
  pickerHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  pickerClose: { fontSize: 20, color: colors.textMuted, padding: 4 },
  pickerEmpty: { padding: 24, textAlign: "center", color: colors.textMuted, fontSize: 14 },
  pickerRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  pickerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
  },
  pickerAvatarTxt: { fontSize: 16, fontWeight: "700", color: colors.primary },
  pickerRowText: { flex: 1 },
  pickerRowName: { fontSize: 15, fontWeight: "600", color: colors.text },
  pickerRowPhone: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pickerCheck: { fontSize: 18, color: colors.primary, fontWeight: "700" },
  pickerDivider: { height: 1, backgroundColor: colors.border, marginLeft: 68 },

  rangeSheet: { backgroundColor: "#fff", borderRadius: 12, margin: 24, overflow: "hidden" },
  rangeOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rangeOptionActive: { backgroundColor: "#e0f2fe" },
  rangeOptionTxt: { fontSize: 15, color: colors.text },
  rangeOptionTxtActive: { color: colors.primary, fontWeight: "700" },
  rangeOptionCheck: { fontSize: 16, color: colors.primary },
});

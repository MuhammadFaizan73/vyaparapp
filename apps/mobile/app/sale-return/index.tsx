import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, RefreshControl, Modal, Pressable, Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import type { Transaction, Party } from "@vyapar/api-client";

type TxnRow = Transaction & { partyName: string };

type Preset = "Today" | "This Week" | "This Month" | "Last Month" | "This Quarter" | "This Year" | "Custom";
const PRESETS: Preset[] = ["Today", "This Week", "This Month", "Last Month", "This Quarter", "This Year", "Custom"];

function getPresetRange(preset: Preset, customFrom?: Date, customTo?: Date): { from: Date; to: Date } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (preset) {
    case "Today":         return { from: new Date(y, m, d), to: new Date(y, m, d + 1) };
    case "This Week": {
      const day = now.getDay();
      const mon = new Date(y, m, d - (day === 0 ? 6 : day - 1));
      return { from: mon, to: new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7) };
    }
    case "This Month":    return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
    case "Last Month":    return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
    case "This Quarter": {
      const q = Math.floor(m / 3);
      return { from: new Date(y, q * 3, 1), to: new Date(y, q * 3 + 3, 1) };
    }
    case "This Year":     return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
    case "Custom":
      return {
        from: customFrom ?? new Date(y, m, 1),
        to: customTo ? new Date(customTo.getFullYear(), customTo.getMonth(), customTo.getDate() + 1) : new Date(y, m + 1, 1),
      };
    default:              return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
  }
}

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" })
    .toUpperCase();
}
function fmtDd(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function SaleReturnListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Preset filter
  const [preset, setPreset] = useState<Preset>("This Month");
  const [showPresets, setShowPresets] = useState(false);

  // Custom date range
  const [customFrom, setCustomFrom] = useState<Date>(new Date());
  const [customTo, setCustomTo] = useState<Date>(new Date());
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStep, setCustomStep] = useState<"from" | "to">("from");
  // Android shows one native picker at a time
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const { from, to } = getPresetRange(preset, customFrom, customTo);

  const load = useCallback(async () => {
    try {
      const [txns, parties]: [Transaction[], Party[]] = await Promise.all([
        api.getTransactionsByType("credit_note"),
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

  const filtered = rows.filter((r) => {
    const d = new Date(r.date);
    return d >= from && d < to;
  });

  const totalAmt = filtered.reduce((s, r) => s + r.total, 0);
  const totalBalance = filtered.reduce((s, r) => s + r.balance, 0);

  function openCustomPicker() {
    setPreset("Custom");
    if (Platform.OS === "android") {
      setCustomStep("from");
      setShowAndroidPicker(true);
    } else {
      setShowCustomModal(true);
    }
  }

  function handleAndroidPickerChange(_: any, date?: Date) {
    setShowAndroidPicker(false);
    if (!date) return;
    if (customStep === "from") {
      setCustomFrom(date);
      setTimeout(() => {
        setCustomStep("to");
        setShowAndroidPicker(true);
      }, 300);
    } else {
      setCustomTo(date);
    }
  }

  function renderItem({ item: row }: { item: TxnRow }) {
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <Text style={s.cardParty}>{row.partyName}</Text>
          <Text style={s.cardRef}>CN {row.number ?? "–"}  {fmtDate(row.date)}</Text>
        </View>
        <View style={s.cardBottom}>
          <View>
            <Text style={s.cardMetaLbl}>Amount</Text>
            <Text style={s.cardMetaVal}>Rs {fmt(row.total)}</Text>
          </View>
          <View>
            <Text style={s.cardMetaLbl}>Balance</Text>
            <Text style={s.cardMetaVal}>Rs {fmt(row.balance)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Sale Return</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Date filter bar */}
      <View style={s.filterBar}>
        <TouchableOpacity style={s.presetBtn} onPress={() => setShowPresets(true)}>
          <Text style={s.presetTxt}>{preset}</Text>
          <Ionicons name="chevron-down" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={s.calendarBtn} onPress={openCustomPicker}>
          <Ionicons name="calendar" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={s.dateRangeTxt}>
          {fmtDd(from)}  –  {fmtDd(new Date(to.getTime() - 1))}
        </Text>
      </View>

      {/* Android native date pickers (one at a time) */}
      {showAndroidPicker && Platform.OS === "android" && (
        <DateTimePicker
          value={customStep === "from" ? customFrom : customTo}
          mode="date"
          display="default"
          onChange={handleAndroidPickerChange}
        />
      )}

      {/* Blue band */}
      <View style={s.blueBand} />

      {/* Summary cards */}
      <View style={s.summaryRow}>
        <View style={s.summaryCard}>
          <Text style={s.summaryCardLbl}>No of Txns</Text>
          <Text style={s.summaryCardVal}>{filtered.length}</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.summaryCardLbl}>Total Sale Return</Text>
          <Text style={s.summaryCardVal}>- Rs {fmt(totalAmt)}</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.summaryCardLbl}>Balance Due</Text>
          <Text style={[s.summaryCardVal, { color: colors.red }]}>Rs {fmt(totalBalance)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[s.list, filtered.length === 0 && s.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="receipt-outline" size={52} color={colors.border} />
              <Text style={s.emptyTxt}>No sale returns in this period.</Text>
            </View>
          }
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/sale-return/new" as never)}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={s.fabTxt}>Add Sale Return</Text>
      </TouchableOpacity>

      {/* Preset picker modal */}
      <Modal visible={showPresets} transparent animationType="fade" onRequestClose={() => setShowPresets(false)}>
        <View style={s.modalContainer}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowPresets(false)} />
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Select Period</Text>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[s.modalRow, p === preset && s.modalRowActive]}
                onPress={() => {
                  if (p === "Custom") {
                    setShowPresets(false);
                    openCustomPicker();
                  } else {
                    setPreset(p);
                    setShowPresets(false);
                  }
                }}
              >
                <Text style={[s.modalRowTxt, p === preset && s.modalRowTxtActive]}>{p}</Text>
                {p === preset && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* iOS custom date range picker modal */}
      <Modal visible={showCustomModal} transparent animationType="slide" onRequestClose={() => setShowCustomModal(false)}>
        <View style={s.customModalContainer}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowCustomModal(false)} />
          <View style={s.customModalBox}>
            <View style={s.customModalHeader}>
              <Text style={s.customModalTitle}>Custom Date Range</Text>
              <TouchableOpacity onPress={() => setShowCustomModal(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Step tabs */}
            <View style={s.customStepRow}>
              <TouchableOpacity
                style={[s.customStepTab, customStep === "from" && s.customStepTabActive]}
                onPress={() => setCustomStep("from")}
              >
                <Text style={[s.customStepLbl, customStep === "from" && s.customStepLblActive]}>FROM</Text>
                <Text style={[s.customStepVal, customStep === "from" && s.customStepValActive]}>{fmtDd(customFrom)}</Text>
              </TouchableOpacity>
              <View style={s.customStepArrow}>
                <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
              </View>
              <TouchableOpacity
                style={[s.customStepTab, customStep === "to" && s.customStepTabActive]}
                onPress={() => setCustomStep("to")}
              >
                <Text style={[s.customStepLbl, customStep === "to" && s.customStepLblActive]}>TO</Text>
                <Text style={[s.customStepVal, customStep === "to" && s.customStepValActive]}>{fmtDd(customTo)}</Text>
              </TouchableOpacity>
            </View>

            <DateTimePicker
              value={customStep === "from" ? customFrom : customTo}
              mode="date"
              display="spinner"
              onChange={(_, date) => {
                if (!date) return;
                if (customStep === "from") setCustomFrom(date);
                else setCustomTo(date);
              }}
              style={{ width: "100%" }}
            />

            <TouchableOpacity
              style={s.customApplyBtn}
              onPress={() => {
                setPreset("Custom");
                setShowCustomModal(false);
              }}
            >
              <Text style={s.customApplyTxt}>Apply</Text>
            </TouchableOpacity>
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
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  filterBar: {
    backgroundColor: "#fff", flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8,
  },
  presetBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  presetTxt: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  calendarBtn: { padding: 4 },
  dateRangeTxt: { flex: 1, fontSize: 12, color: colors.textMuted },

  blueBand: { height: 6, backgroundColor: "#b8d4e8" },

  summaryRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 10, gap: 8 },
  summaryCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 6,
    padding: 12, borderWidth: 1, borderColor: "#dde8f0",
  },
  summaryCardLbl: { fontSize: 11, color: colors.textMuted, marginBottom: 6, fontWeight: "500" },
  summaryCardVal: { fontSize: 13, fontWeight: "700", color: colors.text },

  list: { paddingHorizontal: 10, paddingBottom: 100 },
  listEmpty: { flex: 1 },

  card: {
    backgroundColor: "#fff", borderRadius: 8,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  cardTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 10,
  },
  cardParty: { fontSize: 14, fontWeight: "700", color: colors.text },
  cardRef: { fontSize: 11.5, color: colors.textMuted, textAlign: "right" },
  cardBottom: { flexDirection: "row", gap: 32 },
  cardMetaLbl: { fontSize: 11.5, color: colors.textMuted, marginBottom: 3 },
  cardMetaVal: { fontSize: 13, fontWeight: "600", color: colors.text },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, marginTop: 80 },
  emptyTxt: { fontSize: 14, color: colors.textMuted },

  fab: {
    position: "absolute", alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.red, borderRadius: 100,
    paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  fabTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Preset modal
  modalContainer: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  modalBox: {
    backgroundColor: "#fff", borderRadius: 12,
    width: 260, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  modalTitle: {
    fontSize: 14, fontWeight: "700", color: colors.text,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalRowActive: { backgroundColor: "#eff6ff" },
  modalRowTxt: { fontSize: 14, color: colors.text },
  modalRowTxtActive: { color: colors.primary, fontWeight: "600" },

  // Custom date modal
  customModalContainer: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  customModalBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  customModalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  customModalTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  customStepRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  customStepTab: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 8, padding: 10, alignItems: "center",
  },
  customStepTabActive: { borderColor: colors.primary, backgroundColor: "#eff6ff" },
  customStepLbl: { fontSize: 10, fontWeight: "700", color: colors.textMuted, marginBottom: 2 },
  customStepLblActive: { color: colors.primary },
  customStepVal: { fontSize: 14, fontWeight: "600", color: colors.text },
  customStepValActive: { color: colors.primary },
  customStepArrow: { alignItems: "center", justifyContent: "center" },
  customApplyBtn: {
    marginHorizontal: 20, marginTop: 16,
    backgroundColor: colors.primary, borderRadius: 8,
    paddingVertical: 14, alignItems: "center",
  },
  customApplyTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
});

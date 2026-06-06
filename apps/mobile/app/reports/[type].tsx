import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, FlatList, StatusBar, Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as XLSX from "xlsx";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";

type ExportRow = Record<string, string | number>;

// ─── Date helpers ─────────────────────────────────────────────────────────────

type PeriodPreset = "today" | "week" | "month" | "quarter" | "financial_year" | "custom";
interface DateRange { from: string; to: string; preset: PeriodPreset; label: string; }

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function todayStr() { return isoDate(new Date()); }
function monthStart() {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}
function monthEnd() {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function getRange(preset: PeriodPreset, customFrom?: string, customTo?: string): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === "today") {
    const d = todayStr();
    return { from: d, to: d, preset, label: "Today" };
  }
  if (preset === "week") {
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: isoDate(mon), to: isoDate(sun), preset, label: "This Week" };
  }
  if (preset === "quarter") {
    const qStart = Math.floor(m / 3) * 3;
    return { from: isoDate(new Date(y, qStart, 1)), to: isoDate(new Date(y, qStart + 3, 0)), preset, label: "This Quarter" };
  }
  if (preset === "financial_year") {
    const fyStart = m >= 6 ? y : y - 1;
    return { from: isoDate(new Date(fyStart, 6, 1)), to: isoDate(new Date(fyStart + 1, 5, 30)), preset, label: "This Fin. Year" };
  }
  if (preset === "custom") {
    return { from: customFrom ?? monthStart(), to: customTo ?? monthEnd(), preset, label: "Custom" };
  }
  return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)), preset, label: "This Month" };
}

function fmt(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function rs(n: number) {
  return `Rs ${(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function txnLabel(type: string) {
  const M: Record<string, string> = {
    sale: "Sale", purchase: "Purchase", payment_in: "Payment-In",
    payment_out: "Payment-Out", credit_note: "Credit Note",
    debit_note: "Debit Note", expense: "Expense",
    sale_order: "Sale Order", estimate: "Estimate", purchase_order: "Purchase Order",
  };
  return M[type] ?? type;
}

function statusColor(s: string) {
  if (s === "paid")      return "#16a34a";
  if (s === "partial")   return "#3b82f6";
  if (s === "unpaid")    return "#d97706";
  if (s === "cancelled") return "#dc2626";
  return "#6b7280";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_PRESETS: { label: string; preset: PeriodPreset }[] = [
  { label: "Today",               preset: "today" },
  { label: "This Week",           preset: "week" },
  { label: "This Month",          preset: "month" },
  { label: "This Quarter",        preset: "quarter" },
  { label: "This Financial Year", preset: "financial_year" },
  { label: "Custom",              preset: "custom" },
];

const TXN_TYPES = [
  { label: "All Transactions", value: "" },
  { label: "Sale",             value: "sale" },
  { label: "Purchase",         value: "purchase" },
  { label: "Payment-In",       value: "payment_in" },
  { label: "Payment-Out",      value: "payment_out" },
  { label: "Credit Note",      value: "credit_note" },
  { label: "Debit Note",       value: "debit_note" },
  { label: "Expense",          value: "expense" },
  { label: "Sale Order",       value: "sale_order" },
  { label: "Purchase Order",   value: "purchase_order" },
  { label: "Estimate",         value: "estimate" },
];

const STATUSES = [
  { label: "All Statuses", value: "" },
  { label: "Paid",         value: "paid" },
  { label: "Partial",      value: "partial" },
  { label: "Unpaid",       value: "unpaid" },
  { label: "Cancelled",    value: "cancelled" },
];

const REPORT_LABELS: Record<string, string> = {
  "sale": "Sale Report", "purchase": "Purchase Report", "day-book": "Day Book",
  "all-transactions": "All Transactions", "profit-and-loss": "Profit & Loss",
  "cash-flow": "Cash Flow", "expense": "Expense Report",
  "party-statement": "Party Statement", "all-parties": "All Parties",
  "sale-purchase-by-party": "Sale Purchase By Party",
  "party-report-by-item": "Party Report By Item",
  "sale-purchase-by-party-group": "Sale Purchase By Party Group",
  "stock-summary": "Stock Summary", "low-stock": "Low Stock Summary",
  "stock-detail": "Stock Detail", "item-detail": "Item Detail",
  "item-wise-pnl": "Item Wise Profit & Loss", "item-wise-discount": "Item Wise Discount",
  "discount-report": "Discount Report", "expense-category": "Expense Category",
  "expense-item": "Expense Item", "tax-report": "Tax Report",
  "tax-rate-report": "Tax Rate Report",
  "sale-purchase-orders": "Sale / Purchase Orders",
  "sale-purchase-order-items": "Sale / Purchase Order Items",
};

// ─── PeriodModal ───────────────────────────────────────────────────────────────

function PeriodModal({ visible, range, onClose, onChange }: {
  visible: boolean; range: DateRange;
  onClose: () => void; onChange: (r: DateRange) => void;
}) {
  const [customFrom, setCustomFrom] = useState(range.preset === "custom" ? range.from : monthStart());
  const [customTo, setCustomTo]     = useState(range.preset === "custom" ? range.to   : monthEnd());
  const [selected, setSelected]     = useState<PeriodPreset>(range.preset);

  function apply(preset: PeriodPreset) {
    setSelected(preset);
    if (preset !== "custom") { onChange(getRange(preset)); onClose(); }
  }
  function applyCustom() { onChange(getRange("custom", customFrom, customTo)); onClose(); }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={onClose} />
      <View style={pm.sheet}>
        <View style={pm.handle} />
        <View style={pm.header}>
          <Text style={pm.title}>Select Period</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        {PERIOD_PRESETS.map((p) => (
          <TouchableOpacity key={p.preset} style={pm.row} onPress={() => apply(p.preset)}>
            <Text style={[pm.rowTxt, selected === p.preset && pm.rowTxtActive]}>{p.label}</Text>
            {selected === p.preset
              ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              : <View style={pm.circle} />
            }
          </TouchableOpacity>
        ))}
        {selected === "custom" && (
          <View style={pm.customRow}>
            <View style={pm.customGroup}>
              <Text style={pm.customLabel}>From</Text>
              <TextInput style={pm.customInput} value={customFrom} onChangeText={setCustomFrom} placeholder="YYYY-MM-DD" keyboardType="numeric" />
            </View>
            <View style={pm.customGroup}>
              <Text style={pm.customLabel}>To</Text>
              <TextInput style={pm.customInput} value={customTo} onChangeText={setCustomTo} placeholder="YYYY-MM-DD" keyboardType="numeric" />
            </View>
            <TouchableOpacity style={pm.applyBtn} onPress={applyCustom}>
              <Text style={pm.applyTxt}>Apply</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 24 }} />
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 10, marginBottom: 2 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.bg, alignItems: "center", justifyContent: "center",
  },

  // Search bar (parties picker)
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginVertical: 10,
    backgroundColor: colors.bg, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },

  // Option rows
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  rowSelected: { backgroundColor: colors.primary + "08" },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  rowInitial: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center",
  },
  rowInitialTxt: { fontSize: 13, fontWeight: "700", color: colors.primary },
  rowTxt: { fontSize: 14, color: colors.text, flex: 1 },
  rowTxtActive: { color: colors.primary, fontWeight: "600" },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  checkCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },

  // Period modal specific
  circle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border },
  customRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 16, alignItems: "flex-end" },
  customGroup: { flex: 1 },
  customLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  customInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 10, fontSize: 13, color: colors.text,
  },
  applyBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  applyTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
});

// ─── FilterPickerModal ─────────────────────────────────────────────────────────

function FilterPickerModal({ visible, title, options, selected, onClose, onSelect, searchable }: {
  visible: boolean; title: string;
  options: { label: string; value: string; color?: string }[];
  selected: string; onClose: () => void; onSelect: (v: string) => void;
  searchable?: boolean;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  function handleClose() { setQuery(""); onClose(); }
  function handleSelect(v: string) { setQuery(""); onSelect(v); onClose(); }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={handleClose} />
      <View style={pm.sheet}>
        <View style={pm.handle} />
        <View style={pm.header}>
          <Text style={pm.title}>{title}</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={8} style={pm.closeBtn}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {searchable && (
          <View style={pm.searchWrap}>
            <Ionicons name="search-outline" size={15} color={colors.textMuted} />
            <TextInput
              style={pm.searchInput}
              placeholder="Search…"
              placeholderTextColor={colors.textLight}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={6}>
                <Ionicons name="close-circle" size={15} color={colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {filtered.map((o) => {
            const isSelected = selected === o.value;
            return (
              <TouchableOpacity
                key={o.value}
                style={[pm.row, isSelected && pm.rowSelected]}
                activeOpacity={0.7}
                onPress={() => handleSelect(o.value)}
              >
                <View style={pm.rowLeft}>
                  {o.color !== undefined ? (
                    <View style={[pm.statusDot, { backgroundColor: o.color || colors.border }]} />
                  ) : (
                    <View style={pm.rowInitial}>
                      <Text style={pm.rowInitialTxt}>{o.label.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={[pm.rowTxt, isSelected && pm.rowTxtActive]}>{o.label}</Text>
                </View>
                <View style={[pm.checkCircle, isSelected && pm.checkCircleActive]}>
                  {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
          {filtered.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>No results</Text>
            </View>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── PeriodBar ─────────────────────────────────────────────────────────────────

function PeriodBar({ range, onPress }: { range: DateRange; onPress: () => void }) {
  return (
    <View style={pb.bar}>
      <TouchableOpacity style={pb.presetBtn} onPress={onPress} activeOpacity={0.7}>
        <Text style={pb.presetTxt}>{range.label}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.text} />
      </TouchableOpacity>
      <View style={pb.divider} />
      <TouchableOpacity style={pb.dateRange} onPress={onPress} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
        <Text style={pb.dateTxt}>{fmt(range.from)}</Text>
        <Text style={pb.toTxt}>TO</Text>
        <Text style={pb.dateTxt}>{fmt(range.to)}</Text>
      </TouchableOpacity>
    </View>
  );
}

const pb = StyleSheet.create({
  bar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  presetBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  presetTxt: { fontSize: 13.5, fontWeight: "500", color: colors.text },
  divider: { width: 1, height: 22, backgroundColor: "#d1d5db", marginHorizontal: 14 },
  dateRange: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  dateTxt: { fontSize: 13.5, color: colors.text, fontWeight: "400" },
  toTxt: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
});

// ─── FilterChip ────────────────────────────────────────────────────────────────

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[fb.chip, active && fb.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {active && <View style={fb.activeDot} />}
      <Text style={[fb.chipTxt, active && fb.chipTxtActive]} numberOfLines={1}>{label}</Text>
      <Ionicons name={active ? "chevron-up" : "chevron-down"} size={13} color={active ? colors.primary : colors.textMuted} />
    </TouchableOpacity>
  );
}

const fb = StyleSheet.create({
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff",
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "12" },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  chipTxt: { fontSize: 12.5, color: colors.textMuted, maxWidth: 120 },
  chipTxtActive: { color: colors.primary, fontWeight: "700" },
});

// ─── ActiveFiltersBar ──────────────────────────────────────────────────────────

function ActiveFiltersBar({ filters, onRemove }: { filters: { key: string; label: string }[]; onRemove: (key: string) => void }) {
  if (filters.length === 0) return null;
  return (
    <ScrollView
      horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={af.row}
      style={af.wrap}
    >
      {filters.map((f) => (
        <View key={f.key} style={af.chip}>
          <Text style={af.txt}>{f.label}</Text>
          <TouchableOpacity onPress={() => onRemove(f.key)} hitSlop={4}>
            <Ionicons name="close-circle" size={15} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const af = StyleSheet.create({
  wrap: { backgroundColor: colors.primary + "08", borderBottomWidth: 1, borderBottomColor: colors.borderLight, flexGrow: 0 },
  row: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: "center" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: colors.primary + "15", borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.primary + "30",
  },
  txt: { fontSize: 11, color: colors.primary, fontWeight: "600" },
});

// ─── Shared hooks ──────────────────────────────────────────────────────────────

function useReport(
  type: string,
  params: Record<string, string | undefined>,
  onDataLoaded?: (rows: ExportRow[]) => void,
) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getReport(type, params);
      setData(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, JSON.stringify(params)]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data || !onDataLoaded) return;
    const rows: ExportRow[] =
      (data.transactions ?? data.parties ?? data.items ?? data.categories ?? data.orders ?? data.rates ?? [])
        .map((r: any) => ({
          Party:       r.partyName  ?? r.name    ?? "–",
          Date:        r.date       ? fmt(r.date) : "–",
          "Invoice #": r.invoiceNo  ?? r.refNo   ?? r.number ?? "–",
          Type:        r.type       ? txnLabel(r.type) : "–",
          Total:       r.amount     ?? r.total   ?? r.saleAmount ?? r.stockValue ?? 0,
          Balance:     r.balance    ?? 0,
          Status:      r.status     ?? "–",
        }));
    onDataLoaded(rows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return { data, loading, error, reload: load };
}

function usePartiesList() {
  const [parties, setParties] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    api.getParties()
      .then((list) => setParties(list.map((p: any) => ({ id: p.id, name: p.name }))))
      .catch(() => {});
  }, []);
  return parties;
}

function useCompaniesList() {
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    api.getTenant().then((t) => {
      const mainName = t.companyName || t.phone || "My Company";
      const extras = Array.isArray(t.extraCompanies) ? t.extraCompanies : [];
      setCompanies([{ id: "__main__", name: mainName }, ...extras.map((e: any) => ({ id: e.id, name: e.name }))]);
    }).catch(() => {});
  }, []);
  return companies;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, tint }: {
  label: string; value: string; color?: string; tint?: string;
}) {
  return (
    <View style={[sc.card, tint ? { backgroundColor: tint } : null]}>
      <Text style={[sc.value, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 3,
  },
  value: { fontSize: 14, fontWeight: "800", color: colors.text, textAlign: "center" },
  label: { fontSize: 10, color: colors.textMuted, textAlign: "center", fontWeight: "500" },
});

function TxnRow({ item }: { item: any }) {
  const color = statusColor(item.status ?? "");
  return (
    <View style={tr.row}>
      <View style={[tr.bar, { backgroundColor: color }]} />
      <View style={tr.left}>
        <View style={tr.topRow}>
          <Text style={tr.name} numberOfLines={1}>{item.partyName || item.name || "—"}</Text>
          <Text style={tr.amount}>{rs(item.amount ?? item.total ?? 0)}</Text>
        </View>
        <View style={tr.botRow}>
          <Text style={tr.sub} numberOfLines={1}>
            {fmt(item.date)}  ·  {txnLabel(item.type)}
            {item.invoiceNo ? `  ·  ${item.invoiceNo}` : item.refNo ? `  ·  ${item.refNo}` : ""}
          </Text>
          {item.status && (
            <View style={[tr.badge, { backgroundColor: color + "1a" }]}>
              <View style={[tr.badgeDot, { backgroundColor: color }]} />
              <Text style={[tr.badgeTxt, { color }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          )}
        </View>
        {item.balance !== undefined && (
          <Text style={[tr.balance, item.balance > 0 ? { color: "#dc2626" } : { color: "#16a34a" }]}>
            Balance: {rs(Math.abs(item.balance))} {item.balance > 0 ? "due" : "excess"}
          </Text>
        )}
      </View>
    </View>
  );
}
const tr = StyleSheet.create({
  row: {
    backgroundColor: "#fff", flexDirection: "row",
    paddingVertical: 13, paddingRight: 16,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  bar: { width: 3, alignSelf: "stretch", marginRight: 13, borderRadius: 2 },
  left: { flex: 1, gap: 5 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  botRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  sub: { flex: 1, fontSize: 11, color: colors.textMuted },
  amount: { fontSize: 14, fontWeight: "700", color: colors.text, flexShrink: 0 },
  balance: { fontSize: 11, fontWeight: "500" },
  badge: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, gap: 4, flexShrink: 0 },
  badgeDot: { width: 5, height: 5, borderRadius: 2.5 },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
});

function ItemRow({ item }: { item: any }) {
  return (
    <View style={ir.row}>
      <View style={ir.left}>
        <Text style={ir.name} numberOfLines={1}>{item.name || item.itemName || item.partyName || "—"}</Text>
        {item.contact && <Text style={ir.sub}>{item.contact}</Text>}
      </View>
      <View style={ir.right}>
        {item.saleAmount   !== undefined && <Text style={ir.green}>Sale: {rs(item.saleAmount)}</Text>}
        {item.purchaseAmount !== undefined && <Text style={ir.red}>Purchase: {rs(item.purchaseAmount)}</Text>}
        {item.stockQty    !== undefined && <Text style={[ir.qty, item.stockQty < 0 ? { color: "#dc2626" } : {}]}>Qty: {item.stockQty}</Text>}
        {item.stockValue  !== undefined && <Text style={ir.sub}>Val: {rs(item.stockValue)}</Text>}
        {item.balance     !== undefined && <Text style={item.balance > 0 ? ir.red : ir.green}>{rs(item.balance)}</Text>}
      </View>
    </View>
  );
}
const ir = StyleSheet.create({
  row: {
    backgroundColor: "#fff", flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  left: { flex: 1 },
  right: { alignItems: "flex-end", gap: 2 },
  name: { fontSize: 14, fontWeight: "600", color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted },
  qty: { fontSize: 13, fontWeight: "600", color: "#16a34a" },
  green: { fontSize: 12, color: "#16a34a", fontWeight: "600" },
  red: { fontSize: 12, color: "#dc2626", fontWeight: "600" },
});

function FilterRow({ children }: { children: React.ReactElement | React.ReactElement[] }) {
  return (
    <ScrollView
      horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={fr.content}
      style={fr.bar}
    >
      {children}
    </ScrollView>
  );
}
const fr = StyleSheet.create({
  bar: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.borderLight, flexGrow: 0 },
  content: { gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" },
});

function NoData() {
  return (
    <View style={{ flex: 1, backgroundColor: "#e8eef6", alignItems: "center", justifyContent: "center", padding: 48, minHeight: 380 }}>
      {/* Stacked document illustration */}
      <View style={{ position: "relative", width: 110, height: 110, marginBottom: 28 }}>
        <View style={{
          position: "absolute", left: 16, top: 8, width: 78, height: 94,
          backgroundColor: "#d0dbe9", borderRadius: 8, borderWidth: 1, borderColor: "#c4d0de",
          transform: [{ rotate: "-6deg" }],
        }}>
          {[20, 36, 52, 68].map((t) => (
            <View key={t} style={{ position: "absolute", top: t, left: 12, right: 20, height: 7, backgroundColor: "#b8c8d8", borderRadius: 4 }} />
          ))}
        </View>
        <View style={{
          position: "absolute", left: 22, top: 4, width: 78, height: 94,
          backgroundColor: "#dde7f2", borderRadius: 8, borderWidth: 1, borderColor: "#c8d6e6",
          transform: [{ rotate: "-2deg" }],
        }}>
          {[20, 36, 52, 68].map((t) => (
            <View key={t} style={{ position: "absolute", top: t, left: 12, right: 20, height: 7, backgroundColor: "#c4d4e4", borderRadius: 4 }} />
          ))}
        </View>
        <View style={{
          position: "absolute", left: 18, top: 6, width: 78, height: 94,
          backgroundColor: "#eef3f9", borderRadius: 8, borderWidth: 1.5, borderColor: "#d0dcec",
        }}>
          {[18, 32, 46, 60].map((t) => (
            <View key={t} style={{ position: "absolute", top: t, left: 10, right: 16, height: 7, backgroundColor: "#d8e4f0", borderRadius: 4 }} />
          ))}
          <View style={{ position: "absolute", bottom: 14, right: 14, width: 20, height: 6, backgroundColor: "#2563eb", borderRadius: 3 }} />
        </View>
      </View>
      <Text style={{ fontSize: 17, fontWeight: "700", color: "#1e293b", marginBottom: 8 }}>No Data Available</Text>
      <Text style={{ fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 20 }}>
        No data is available for this report. Please try again after making relevant changes.
      </Text>
    </View>
  );
}

function LoadError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <View style={{ alignItems: "center", padding: 48 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Ionicons name="alert-circle-outline" size={30} color="#dc2626" />
      </View>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", marginBottom: 4 }}>Failed to load</Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", marginBottom: 20 }}>{error}</Text>
      <TouchableOpacity
        style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 }}
        onPress={onRetry}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Report renderers ─────────────────────────────────────────────────────────

function SaleReport({ onDataLoaded }: { onDataLoaded?: (rows: ExportRow[]) => void }) {
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [status, setStatus] = useState("");
  const [partyId, setPartyId] = useState("");
  const [companyTag, setCompanyTag] = useState("");
  const [showPeriod, setShowPeriod] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const parties = usePartiesList();
  const companies = useCompaniesList();

  const { data, loading, error, reload } = useReport("sale", {
    from: range.from, to: range.to,
    ...(status     ? { status }     : {}),
    ...(partyId    ? { partyId }    : {}),
    ...(companyTag ? { companyTag } : {}),
  }, onDataLoaded);

  const companyOptions = [{ label: "All Companies", value: "" }, ...companies.map((c) => ({ label: c.name, value: c.name }))];
  const partyOptions = [{ label: "All Parties", value: "" }, ...parties.map((p) => ({ label: p.name, value: p.id }))];
  const activeFilters = [
    ...(status     ? [{ key: "status",     label: `Status: ${STATUSES.find(s => s.value === status)?.label}` }] : []),
    ...(partyId    ? [{ key: "partyId",    label: `Party: ${parties.find(p => p.id === partyId)?.name ?? ""}` }] : []),
    ...(companyTag ? [{ key: "companyTag", label: `Company: ${companyTag}` }] : []),
  ];
  function removeFilter(key: string) {
    if (key === "status") setStatus("");
    else if (key === "partyId") setPartyId("");
    else setCompanyTag("");
  }

  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const chipLabels = [
    `URP User - ${companyTag || "All Users"}`,
    `Txns Type - Sale & Cr. Note`,
    partyId ? `Party - ${parties.find(p => p.id === partyId)?.name ?? ""}` : "Party - All Parties",
    status ? `Status - ${STATUSES.find(s => s.value === status)?.label}` : "Status - All",
  ];

  return (
    <>
      <PeriodBar range={range} onPress={() => setShowPeriod(true)} />

      {/* Filters Applied header row */}
      <View style={srf.filtersHeader}>
        <Text style={srf.filtersAppliedTxt}>Filters Applied:</Text>
        <TouchableOpacity style={srf.filtersBtn} onPress={() => setShowFiltersPanel(true)}>
          <Ionicons name="filter-outline" size={14} color="#1d4ed8" />
          <Text style={srf.filtersBtnTxt}>Filters</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable flat chips */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={srf.chipsRow}
        style={srf.chipsWrap}
      >
        {chipLabels.map((label) => (
          <View key={label} style={srf.chip}>
            <Text style={srf.chipTxt}>{label}</Text>
          </View>
        ))}
      </ScrollView>

      {loading
        ? <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} size="large" />
        : error
          ? <LoadError error={error} onRetry={reload} />
          : <FlatList
              data={data?.transactions ?? []}
              keyExtractor={(_, i) => String(i)}
              ListHeaderComponent={data?.summary ? (
                <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 6 }}>
                  <SummaryCard label="Transactions" value={String(data.transactions?.length ?? 0)} />
                  <SummaryCard label="Total Sale" value={rs(data.summary.totalAmount ?? 0)} color={colors.green} tint={colors.greenLight} />
                  <SummaryCard label="Balance Due" value={rs(data.summary.balance ?? 0)} color={colors.red} tint={colors.redLight} />
                </View>
              ) : null}
              ListEmptyComponent={<NoData />}
              renderItem={({ item }) => <TxnRow item={{ ...item, amount: item.amount }} />}
            />
      }

      <PeriodModal visible={showPeriod} range={range} onClose={() => setShowPeriod(false)} onChange={setRange} />

      {/* Filters panel modal */}
      <Modal visible={showFiltersPanel} transparent animationType="slide" onRequestClose={() => setShowFiltersPanel(false)}>
        <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={() => setShowFiltersPanel(false)} />
        <View style={pm.sheet}>
          <View style={pm.handle} />
          <View style={pm.header}>
            <Text style={pm.title}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFiltersPanel(false)} hitSlop={8} style={pm.closeBtn}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 24 }}>
            <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: "600" }}>Payment Status</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {STATUSES.map((s) => (
                <TouchableOpacity key={s.value} onPress={() => { setStatus(s.value); setShowFiltersPanel(false); }}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                    borderColor: status === s.value ? colors.primary : colors.border,
                    backgroundColor: status === s.value ? colors.primary + "12" : "#fff" }}>
                  <Text style={{ fontSize: 13, color: status === s.value ? colors.primary : colors.text, fontWeight: status === s.value ? "700" : "400" }}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: "600", marginTop: 4 }}>Party</Text>
            <TouchableOpacity onPress={() => { setShowFiltersPanel(false); setTimeout(() => setShowParty(true), 200); }}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                borderWidth: 1.5, borderColor: colors.border, borderRadius: 10,
                paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fff" }}>
              <Text style={{ fontSize: 14, color: partyId ? colors.text : colors.textMuted }}>
                {partyId ? (parties.find(p => p.id === partyId)?.name ?? "Party") : "All Parties"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {(status || partyId || companyTag) && (
              <TouchableOpacity onPress={() => { setStatus(""); setPartyId(""); setCompanyTag(""); setShowFiltersPanel(false); }}
                style={{ alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#dc2626", marginTop: 8 }}>
                <Text style={{ fontSize: 14, color: "#dc2626", fontWeight: "600" }}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <FilterPickerModal visible={showParty} title="Select Party" options={partyOptions} selected={partyId} onClose={() => setShowParty(false)} onSelect={setPartyId} searchable />
      <FilterPickerModal visible={showCompany} title="Select Company" options={companyOptions} selected={companyTag} onClose={() => setShowCompany(false)} onSelect={setCompanyTag} />
    </>
  );
}

const srf = StyleSheet.create({
  filtersHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  filtersAppliedTxt: { fontSize: 13.5, color: colors.text, fontWeight: "500" },
  filtersBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  filtersBtnTxt: { fontSize: 12.5, color: "#1d4ed8", fontWeight: "600" },
  chipsWrap: { backgroundColor: "#fff", flexGrow: 0, borderBottomWidth: 1, borderBottomColor: "#e8ecf0" },
  chipsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" },
  chip: {
    backgroundColor: "#f1f5f9", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  chipTxt: { fontSize: 12, color: "#374151", fontWeight: "500" },
});

function PurchaseReport({ onDataLoaded }: { onDataLoaded?: (rows: ExportRow[]) => void }) {
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [status, setStatus] = useState("");
  const [partyId, setPartyId] = useState("");
  const [showPeriod, setShowPeriod] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const parties = usePartiesList();

  const { data, loading, error, reload } = useReport("purchase", {
    from: range.from, to: range.to,
    ...(status  ? { status }  : {}),
    ...(partyId ? { partyId } : {}),
  }, onDataLoaded);

  const partyOptions = [{ label: "All Parties", value: "" }, ...parties.map((p) => ({ label: p.name, value: p.id }))];
  const activeFilters = [
    ...(status  ? [{ key: "status",  label: `Status: ${STATUSES.find(s => s.value === status)?.label}`   }] : []),
    ...(partyId ? [{ key: "partyId", label: `Party: ${parties.find(p => p.id === partyId)?.name ?? ""}` }] : []),
  ];

  return (
    <>
      <PeriodBar range={range} onPress={() => setShowPeriod(true)} />
      <FilterRow>
        <FilterChip label={status ? STATUSES.find(s => s.value === status)!.label : "All Statuses"} active={!!status} onPress={() => setShowStatus(true)} />
        <FilterChip label={partyId ? (parties.find(p => p.id === partyId)?.name ?? "Party") : "All Parties"} active={!!partyId} onPress={() => setShowParty(true)} />
      </FilterRow>
      <ActiveFiltersBar filters={activeFilters} onRemove={(k) => { if (k === "status") setStatus(""); else setPartyId(""); }} />

      {loading
        ? <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} size="large" />
        : error
          ? <LoadError error={error} onRetry={reload} />
          : <FlatList
              data={data?.transactions ?? []}
              keyExtractor={(_, i) => String(i)}
              ListHeaderComponent={data?.summary ? (
                <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 6 }}>
                  <SummaryCard label="Total" value={rs(data.summary.total ?? 0)} />
                  <SummaryCard label="Paid" value={rs(data.summary.paid ?? 0)} color={colors.green} tint={colors.greenLight} />
                  <SummaryCard label="Unpaid" value={rs(data.summary.unpaid ?? 0)} color={colors.red} tint={colors.redLight} />
                </View>
              ) : null}
              ListEmptyComponent={<NoData />}
              renderItem={({ item }) => <TxnRow item={item} />}
            />
      }

      <PeriodModal visible={showPeriod} range={range} onClose={() => setShowPeriod(false)} onChange={setRange} />
      <FilterPickerModal visible={showStatus} title="Payment Status" options={STATUSES.map(s => ({ ...s, color: s.value ? statusColor(s.value) : undefined }))} selected={status} onClose={() => setShowStatus(false)} onSelect={setStatus} />
      <FilterPickerModal visible={showParty} title="Select Party" options={partyOptions} selected={partyId} onClose={() => setShowParty(false)} onSelect={setPartyId} searchable />
    </>
  );
}

function AllTransactionsReport({ onDataLoaded }: { onDataLoaded?: (rows: ExportRow[]) => void }) {
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [txnType, setTxnType] = useState("");
  const [status, setStatus] = useState("");
  const [partyId, setPartyId] = useState("");
  const [showPeriod, setShowPeriod] = useState(false);
  const [showTxnType, setShowTxnType] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const parties = usePartiesList();

  const { data, loading, error, reload } = useReport("all-transactions", {
    from: range.from, to: range.to,
    ...(txnType ? { txnType } : {}),
    ...(status  ? { status }  : {}),
    ...(partyId ? { partyId } : {}),
  }, onDataLoaded);

  const partyOptions = [{ label: "All Parties", value: "" }, ...parties.map((p) => ({ label: p.name, value: p.id }))];
  const activeFilters = [
    ...(txnType ? [{ key: "txnType", label: `Type: ${TXN_TYPES.find(t => t.value === txnType)?.label}`   }] : []),
    ...(status  ? [{ key: "status",  label: `Status: ${STATUSES.find(s => s.value === status)?.label}`   }] : []),
    ...(partyId ? [{ key: "partyId", label: `Party: ${parties.find(p => p.id === partyId)?.name ?? ""}` }] : []),
  ];
  function removeFilter(key: string) {
    if (key === "txnType") setTxnType(""); else if (key === "status") setStatus(""); else setPartyId("");
  }

  return (
    <>
      <PeriodBar range={range} onPress={() => setShowPeriod(true)} />
      <FilterRow>
        <FilterChip label={txnType ? TXN_TYPES.find(t => t.value === txnType)!.label : "All Types"} active={!!txnType} onPress={() => setShowTxnType(true)} />
        <FilterChip label={status ? STATUSES.find(s => s.value === status)!.label : "All Statuses"} active={!!status} onPress={() => setShowStatus(true)} />
        <FilterChip label={partyId ? (parties.find(p => p.id === partyId)?.name ?? "Party") : "All Parties"} active={!!partyId} onPress={() => setShowParty(true)} />
      </FilterRow>
      <ActiveFiltersBar filters={activeFilters} onRemove={removeFilter} />

      {loading
        ? <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} size="large" />
        : error
          ? <LoadError error={error} onRetry={reload} />
          : <FlatList
              data={data?.transactions ?? []}
              keyExtractor={(_, i) => String(i)}
              ListHeaderComponent={
                <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 6 }}>
                  <SummaryCard label="Total Transactions" value={String(data?.transactions?.length ?? 0)} />
                </View>
              }
              ListEmptyComponent={<NoData />}
              renderItem={({ item }) => <TxnRow item={{ ...item, amount: item.total }} />}
            />
      }

      <PeriodModal visible={showPeriod} range={range} onClose={() => setShowPeriod(false)} onChange={setRange} />
      <FilterPickerModal visible={showTxnType} title="Transaction Type" options={TXN_TYPES} selected={txnType} onClose={() => setShowTxnType(false)} onSelect={setTxnType} />
      <FilterPickerModal visible={showStatus} title="Payment Status" options={STATUSES.map(s => ({ ...s, color: s.value ? statusColor(s.value) : undefined }))} selected={status} onClose={() => setShowStatus(false)} onSelect={setStatus} />
      <FilterPickerModal visible={showParty} title="Select Party" options={partyOptions} selected={partyId} onClose={() => setShowParty(false)} onSelect={setPartyId} searchable />
    </>
  );
}

function DayBookReport({ onDataLoaded }: { onDataLoaded?: (rows: ExportRow[]) => void }) {
  const [date, setDate] = useState(todayStr);
  const [showPeriod, setShowPeriod] = useState(false);
  const range: DateRange = { from: date, to: date, preset: "today", label: "Day" };
  const { data, loading, error, reload } = useReport("day-book", { date }, onDataLoaded);

  return (
    <>
      <PeriodBar range={range} onPress={() => setShowPeriod(true)} />
      {loading
        ? <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} size="large" />
        : error
          ? <LoadError error={error} onRetry={reload} />
          : <ScrollView>
              {data && (
                <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 6 }}>
                  <SummaryCard label="Money In" value={rs(data.totalMoneyIn ?? 0)} color={colors.green} tint={colors.greenLight} />
                  <SummaryCard label="Money Out" value={rs(data.totalMoneyOut ?? 0)} color={colors.red} tint={colors.redLight} />
                  <SummaryCard label="Net" value={rs((data.totalMoneyIn ?? 0) - (data.totalMoneyOut ?? 0))} />
                </View>
              )}
              {!data?.transactions?.length ? <NoData /> :
                data.transactions.map((t: any, i: number) => (
                  <View key={i} style={tr.row}>
                    <View style={[tr.bar, { backgroundColor: t.moneyIn > 0 ? "#16a34a" : "#dc2626" }]} />
                    <View style={tr.left}>
                      <View style={tr.topRow}>
                        <Text style={tr.name}>{t.name}</Text>
                        {t.moneyIn  > 0 && <Text style={{ color: "#16a34a", fontWeight: "700", fontSize: 14 }}>+{rs(t.moneyIn)}</Text>}
                        {t.moneyOut > 0 && <Text style={{ color: "#dc2626", fontWeight: "700", fontSize: 14 }}>-{rs(t.moneyOut)}</Text>}
                      </View>
                      <Text style={tr.sub}>{txnLabel(t.type)} · {t.refNo || "—"}</Text>
                    </View>
                  </View>
                ))}
            </ScrollView>
      }
      <Modal visible={showPeriod} transparent animationType="slide" onRequestClose={() => setShowPeriod(false)}>
        <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={() => setShowPeriod(false)} />
        <View style={pm.sheet}>
          <View style={pm.handle} />
          <View style={pm.header}>
            <Text style={pm.title}>Select Date</Text>
            <TouchableOpacity onPress={() => setShowPeriod(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <TextInput style={[pm.customInput, { marginBottom: 12 }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numeric" />
            <TouchableOpacity style={pm.applyBtn} onPress={() => setShowPeriod(false)}>
              <Text style={pm.applyTxt}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ProfitLossReport({ onDataLoaded }: { onDataLoaded?: (rows: ExportRow[]) => void }) {
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [showPeriod, setShowPeriod] = useState(false);
  const { data, loading, error, reload } = useReport("profit-and-loss", { from: range.from, to: range.to }, onDataLoaded);

  const rows = data ? [
    { label: "Sale (+)",          value: data.saleTotal ?? 0,         color: "#16a34a" },
    { label: "Credit Note (-)",   value: data.creditNoteTotal ?? 0,   color: "#dc2626" },
    { label: "Purchase (-)",      value: data.purchaseTotal ?? 0,     color: "#dc2626" },
    { label: "Debit Note (+)",    value: data.debitNoteTotal ?? 0,    color: "#16a34a" },
    { label: "Opening Stock (-)", value: data.openingStockValue ?? 0, color: "#dc2626" },
    { label: "Closing Stock (+)", value: data.closingStockValue ?? 0, color: "#16a34a" },
    { label: "Expenses (-)",      value: data.expenseTotal ?? 0,      color: "#dc2626" },
  ] : [];

  return (
    <>
      <PeriodBar range={range} onPress={() => setShowPeriod(true)} />
      {loading
        ? <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} size="large" />
        : error
          ? <LoadError error={error} onRetry={reload} />
          : <ScrollView>
              {data && (
                <>
                  <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 14 }}>
                    <SummaryCard label="Gross Profit" value={rs(data.grossProfit ?? 0)} color={data.grossProfit >= 0 ? colors.green : colors.red} tint={data.grossProfit >= 0 ? colors.greenLight : colors.redLight} />
                    <SummaryCard label="Net Profit"   value={rs(data.netProfit ?? 0)}   color={data.netProfit   >= 0 ? colors.green : colors.red} tint={data.netProfit   >= 0 ? colors.greenLight : colors.redLight} />
                  </View>
                  <View style={{ backgroundColor: "#fff", borderRadius: 12, marginHorizontal: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                    {rows.map((r, i) => (
                      <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
                        <Text style={{ fontSize: 13, color: colors.text }}>{r.label}</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: r.color }}>{rs(r.value)}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ height: 24 }} />
                </>
              )}
              {!data && <NoData />}
            </ScrollView>
      }
      <PeriodModal visible={showPeriod} range={range} onClose={() => setShowPeriod(false)} onChange={setRange} />
    </>
  );
}

function CashFlowReport({ onDataLoaded }: { onDataLoaded?: (rows: ExportRow[]) => void }) {
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [showPeriod, setShowPeriod] = useState(false);
  const { data, loading, error, reload } = useReport("cash-flow", { from: range.from, to: range.to }, onDataLoaded);

  return (
    <>
      <PeriodBar range={range} onPress={() => setShowPeriod(true)} />
      {loading
        ? <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} size="large" />
        : error
          ? <LoadError error={error} onRetry={reload} />
          : <ScrollView>
              {data && (
                <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 6 }}>
                  <SummaryCard label="Cash In"  value={rs(data.totalCashIn ?? 0)}  color={colors.green} tint={colors.greenLight} />
                  <SummaryCard label="Cash Out" value={rs(data.totalCashOut ?? 0)} color={colors.red}   tint={colors.redLight} />
                  <SummaryCard label="Closing"  value={rs(data.closingCash ?? 0)} />
                </View>
              )}
              {!data?.transactions?.length ? <NoData /> :
                data.transactions.map((t: any, i: number) => (
                  <View key={i} style={tr.row}>
                    <View style={[tr.bar, { backgroundColor: t.cashIn > 0 ? "#16a34a" : "#dc2626" }]} />
                    <View style={tr.left}>
                      <View style={tr.topRow}>
                        <Text style={tr.name}>{t.name}</Text>
                        {t.cashIn  > 0 && <Text style={{ color: "#16a34a", fontWeight: "700", fontSize: 14 }}>+{rs(t.cashIn)}</Text>}
                        {t.cashOut > 0 && <Text style={{ color: "#dc2626", fontWeight: "700", fontSize: 14 }}>-{rs(t.cashOut)}</Text>}
                      </View>
                      <View style={tr.botRow}>
                        <Text style={tr.sub}>{fmt(t.date)} · {txnLabel(t.type)}</Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>Bal: {rs(t.runningBalance)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
            </ScrollView>
      }
      <PeriodModal visible={showPeriod} range={range} onClose={() => setShowPeriod(false)} onChange={setRange} />
    </>
  );
}

function AllPartiesReport({ onDataLoaded }: { onDataLoaded?: (rows: ExportRow[]) => void }) {
  const { data, loading, error, reload } = useReport("all-parties", {}, onDataLoaded);
  if (loading) return <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} size="large" />;
  if (error)   return <LoadError error={error} onRetry={reload} />;
  return (
    <ScrollView>
      {data && (
        <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 6 }}>
          <SummaryCard label="Receivable" value={rs(data.totalReceivable ?? 0)} color={colors.green} tint={colors.greenLight} />
          <SummaryCard label="Payable"    value={rs(data.totalPayable ?? 0)}    color={colors.red}   tint={colors.redLight} />
        </View>
      )}
      {!data?.parties?.length ? <NoData /> :
        data.parties.map((p: any, i: number) => (
          <ItemRow key={i} item={{ name: p.name, contact: p.phone, balance: p.receivableBalance - p.payableBalance }} />
        ))}
    </ScrollView>
  );
}

function StockSummaryReport({ onDataLoaded }: { onDataLoaded?: (rows: ExportRow[]) => void }) {
  const [asOf, setAsOf] = useState(todayStr);
  const { data, loading, error, reload } = useReport("stock-summary", { asOf }, onDataLoaded);
  if (loading) return <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} size="large" />;
  if (error)   return <LoadError error={error} onRetry={reload} />;
  return (
    <ScrollView>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 4 }}>
        <Text style={{ fontSize: 13, color: colors.textMuted }}>As of</Text>
        <TextInput
          style={{ flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: colors.text, backgroundColor: "#fff" }}
          value={asOf} onChangeText={setAsOf} placeholder="YYYY-MM-DD"
        />
      </View>
      {data?.total && (
        <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 16, marginVertical: 12 }}>
          <SummaryCard label="Total Qty"   value={String(data.total.stockQty ?? 0)} />
          <SummaryCard label="Total Value" value={rs(data.total.stockValue ?? 0)} />
        </View>
      )}
      {!data?.items?.length ? <NoData /> : data.items.map((item: any, i: number) => <ItemRow key={i} item={item} />)}
    </ScrollView>
  );
}

function LowStockReport({ onDataLoaded }: { onDataLoaded?: (rows: ExportRow[]) => void }) {
  const { data, loading, error, reload } = useReport("low-stock", {}, onDataLoaded);
  if (loading) return <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} size="large" />;
  if (error)   return <LoadError error={error} onRetry={reload} />;
  return (
    <ScrollView>
      <View style={{ height: 12 }} />
      {!data?.items?.length ? <NoData /> :
        data.items.map((item: any, i: number) => (
          <View key={i} style={tr.row}>
            <View style={[tr.bar, { backgroundColor: item.stockQty <= 0 ? "#dc2626" : "#d97706" }]} />
            <View style={tr.left}>
              <View style={tr.topRow}>
                <Text style={tr.name}>{item.name}</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: item.stockQty <= 0 ? "#dc2626" : "#d97706" }}>
                  {item.stockQty} left
                </Text>
              </View>
              <Text style={tr.sub}>Min: {item.minStockQty}  ·  Val: {rs(item.stockValue ?? 0)}</Text>
            </View>
          </View>
        ))}
    </ScrollView>
  );
}

function GenericDateReport({ type, onDataLoaded }: { type: string; onDataLoaded?: (rows: ExportRow[]) => void }) {
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [showPeriod, setShowPeriod] = useState(false);
  const { data, loading, error, reload } = useReport(type, { from: range.from, to: range.to }, onDataLoaded);

  const rows: any[] = data?.transactions ?? data?.parties ?? data?.items ?? data?.categories ?? data?.groups ?? data?.orders ?? data?.rates ?? [];

  return (
    <>
      <PeriodBar range={range} onPress={() => setShowPeriod(true)} />
      {loading
        ? <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} size="large" />
        : error
          ? <LoadError error={error} onRetry={reload} />
          : <ScrollView>
              {rows.length === 0 ? <NoData /> :
                rows.map((item: any, i: number) => (
                  <View key={i} style={tr.row}>
                    <View style={[tr.bar, { backgroundColor: colors.primary }]} />
                    <View style={tr.left}>
                      <View style={tr.topRow}>
                        <Text style={tr.name} numberOfLines={1}>
                          {item.partyName || item.name || item.itemName || item.category || item.groupName || item.orderNo || item.taxName || "—"}
                        </Text>
                        {(item.amount !== undefined || item.total !== undefined) && (
                          <Text style={tr.amount}>{rs(item.amount ?? item.total)}</Text>
                        )}
                      </View>
                      <View style={tr.botRow}>
                        {item.date && <Text style={tr.sub}>{fmt(item.date)}</Text>}
                        {item.type && <Text style={tr.sub}>{txnLabel(item.type)}</Text>}
                        <View style={{ flex: 1 }} />
                        {item.saleAmount     !== undefined && <Text style={{ fontSize: 12, color: "#16a34a", fontWeight: "600" }}>{rs(item.saleAmount)}</Text>}
                        {item.purchaseAmount !== undefined && <Text style={{ fontSize: 12, color: "#dc2626", fontWeight: "600" }}>{rs(item.purchaseAmount)}</Text>}
                        {item.netProfit      !== undefined && <Text style={{ fontSize: 12, fontWeight: "600", color: item.netProfit >= 0 ? "#16a34a" : "#dc2626" }}>{rs(item.netProfit)}</Text>}
                      </View>
                    </View>
                  </View>
                ))}
            </ScrollView>
      }
      <PeriodModal visible={showPeriod} range={range} onClose={() => setShowPeriod(false)} onChange={setRange} />
    </>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

function ReportBody({ type, onDataLoaded }: { type: string; onDataLoaded: (rows: ExportRow[]) => void }) {
  switch (type) {
    case "sale":             return <SaleReport onDataLoaded={onDataLoaded} />;
    case "purchase":         return <PurchaseReport onDataLoaded={onDataLoaded} />;
    case "day-book":         return <DayBookReport onDataLoaded={onDataLoaded} />;
    case "all-transactions": return <AllTransactionsReport onDataLoaded={onDataLoaded} />;
    case "profit-and-loss":  return <ProfitLossReport onDataLoaded={onDataLoaded} />;
    case "cash-flow":        return <CashFlowReport onDataLoaded={onDataLoaded} />;
    case "all-parties":      return <AllPartiesReport onDataLoaded={onDataLoaded} />;
    case "stock-summary":    return <StockSummaryReport onDataLoaded={onDataLoaded} />;
    case "low-stock":        return <LowStockReport onDataLoaded={onDataLoaded} />;
    default:                 return <GenericDateReport type={type} onDataLoaded={onDataLoaded} />;
  }
}

export default function ReportDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams<{ type: string }>();
  const title = REPORT_LABELS[type] ?? type;

  const [exportRows, setExportRows] = useState<ExportRow[]>([]);
  const [exporting, setExporting] = useState<"pdf" | "xls" | null>(null);

  async function exportPDF() {
    if (!exportRows.length) {
      Alert.alert("No Data", "There is no data to export. Apply filters and wait for data to load.");
      return;
    }
    setExporting("pdf");
    try {
      const headers = Object.keys(exportRows[0]);
      const headerRow = headers.map((h) => `<th>${h}</th>`).join("");
      const bodyRows = exportRows.map((row) =>
        `<tr>${headers.map((h) => `<td>${row[h] ?? ""}</td>`).join("")}</tr>`
      ).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#1e293b}
          h2{font-size:15px;color:#0f5a72;margin-bottom:4px}
          p{color:#64748b;font-size:10px;margin-bottom:16px}
          table{width:100%;border-collapse:collapse}
          th{background:#0f5a72;color:#fff;padding:8px 10px;text-align:left;font-size:10px;font-weight:700}
          td{padding:7px 10px;border-bottom:1px solid #e8ecf0;font-size:10px}
          tr:nth-child(even) td{background:#f8fafc}
        </style></head><body>
        <h2>${title}</h2>
        <p>Generated: ${new Date().toLocaleString("en-PK")} &nbsp;|&nbsp; ${exportRows.length} record(s)</p>
        <table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
        </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `${title}.pdf`,
        UTI: "com.adobe.pdf",
      });
    } catch (e: any) {
      Alert.alert("Export Failed", e?.message ?? "Could not generate PDF.");
    } finally {
      setExporting(null);
    }
  }

  async function exportXLS() {
    if (!exportRows.length) {
      Alert.alert("No Data", "There is no data to export. Apply filters and wait for data to load.");
      return;
    }
    setExporting("xls");
    try {
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
      const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const safeName = title.replace(/[^a-z0-9]/gi, "_");
      const fileUri = `${FileSystem.cacheDirectory}${safeName}.xlsx`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: `${title}.xlsx`,
        UTI: "com.microsoft.excel.xlsx",
      });
    } catch (e: any) {
      Alert.alert("Export Failed", e?.message ?? "Could not generate Excel file.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.appBarTitle} numberOfLines={1}>{title}</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <TouchableOpacity
            style={s.exportBtn}
            onPress={exportPDF}
            disabled={exporting !== null}
          >
            {exporting === "pdf"
              ? <ActivityIndicator size={12} color="#fff" />
              : <Ionicons name="document-outline" size={12} color="#fff" />
            }
            <Text style={s.exportTxt}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.exportBtn, { backgroundColor: "#16a34a" }]}
            onPress={exportXLS}
            disabled={exporting !== null}
          >
            {exporting === "xls"
              ? <ActivityIndicator size={12} color="#fff" />
              : <Ionicons name="grid-outline" size={12} color="#fff" />
            }
            <Text style={s.exportTxt}>XLS</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.body}>
        <ReportBody type={type} onDataLoaded={setExportRows} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: "#fff" },
  exportBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#dc2626", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  exportTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  body: { flex: 1 },
});

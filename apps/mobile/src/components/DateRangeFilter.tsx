import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

// Shared by every transaction list screen (Sale, Purchase, Payment-In/Out, Credit/Debit
// Note, Sale/Purchase Order, etc.) — one date-range picker instead of each screen growing
// its own, ported from the reports screen's proven PeriodBar/PeriodModal pair.

export type PeriodPreset = "all" | "today" | "week" | "month" | "quarter" | "financial_year" | "custom";
export interface DateRange { from: string; to: string; preset: PeriodPreset; label: string; }

// Wide enough to cover any real transaction without a special-cased "no filter" branch
// through isWithinRange — list screens default here (unlike the reports screen, which
// defaults to "This Month") since they've always shown every record with no date scoping;
// suddenly hiding older ones by default would look like data went missing.
const ALL_TIME_FROM = "2000-01-01";
const ALL_TIME_TO = "2100-01-01";

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

export function getRange(preset: PeriodPreset, customFrom?: string, customTo?: string): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === "all") {
    return { from: ALL_TIME_FROM, to: ALL_TIME_TO, preset, label: "All Time" };
  }
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

// `range.to` is a bare "YYYY-MM-DD" — comparing it directly against a full ISO timestamp
// would treat it as that day's midnight and silently exclude every transaction recorded
// later that same day (the exact bug already fixed server-side in the reports service;
// same fix needed here since this filtering runs entirely on the client).
export function isWithinRange(dateIso: string, range: DateRange): boolean {
  const t = new Date(dateIso).getTime();
  return t >= new Date(`${range.from}T00:00:00`).getTime() && t <= new Date(`${range.to}T23:59:59.999`).getTime();
}

function fmtShort(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const PERIOD_PRESETS: { label: string; preset: PeriodPreset }[] = [
  { label: "All Time",            preset: "all" },
  { label: "Today",               preset: "today" },
  { label: "This Week",           preset: "week" },
  { label: "This Month",          preset: "month" },
  { label: "This Quarter",        preset: "quarter" },
  { label: "This Financial Year", preset: "financial_year" },
  { label: "Custom",              preset: "custom" },
];

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
        {range.preset === "all" ? (
          <Text style={pb.dateTxt}>Every record</Text>
        ) : (
          <>
            <Text style={pb.dateTxt}>{fmtShort(range.from)}</Text>
            <Text style={pb.toTxt}>TO</Text>
            <Text style={pb.dateTxt}>{fmtShort(range.to)}</Text>
          </>
        )}
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
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  rowTxt: { fontSize: 14, color: colors.text, flex: 1 },
  rowTxtActive: { color: colors.primary, fontWeight: "600" },
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

// The one thing every list screen actually needs to own is `range` (it drives their own
// row filtering) — this bundles the button + picker modal so call sites don't each repeat
// the same showPeriod visibility state.
export function DateRangeFilterBar({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const [showPeriod, setShowPeriod] = useState(false);
  return (
    <>
      <PeriodBar range={range} onPress={() => setShowPeriod(true)} />
      <PeriodModal visible={showPeriod} range={range} onClose={() => setShowPeriod(false)} onChange={onChange} />
    </>
  );
}

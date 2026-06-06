import { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { setPendingUnit } from "../../src/itemsStore";

const UNITS = [
  { label: "BAGS", short: "Bags" },
  { label: "BOTTLES", short: "Btl" },
  { label: "BOX", short: "Box" },
  { label: "BUNDLES", short: "Bdl" },
  { label: "CARTONS", short: "Ctn" },
  { label: "DOZENS", short: "Doz" },
  { label: "GRAMS", short: "Gms" },
  { label: "KILOGRAMS", short: "Kg" },
  { label: "LITRE", short: "Ltr" },
  { label: "METERS", short: "Mtr" },
  { label: "MILILITRE", short: "Ml" },
  { label: "NUMBERS", short: "Nos" },
  { label: "PAIRS", short: "Prs" },
  { label: "PIECES", short: "Pcs" },
  { label: "QUINTAL", short: "Qtl" },
  { label: "ROLLS", short: "Rol" },
  { label: "SQUARE METERS", short: "Sqm" },
  { label: "STRIP", short: "Strip" },
  { label: "TABLETS", short: "Tbs" },
];

type ConversionDir = "p2s" | "s2p";

export default function ItemUnitScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ unit?: string; secondaryUnit?: string; conversionRate?: string }>();

  const [primaryUnit, setPrimaryUnit] = useState(params.unit ?? "");
  const [secondaryUnit, setSecondaryUnit] = useState(params.secondaryUnit ?? "");
  const [conversionRate, setConversionRate] = useState(params.conversionRate ?? "");
  const [convDir, setConvDir] = useState<ConversionDir>("p2s");

  const [showPrimaryPicker, setShowPrimaryPicker] = useState(false);
  const [showSecondaryPicker, setShowSecondaryPicker] = useState(false);

  function handleSave() {
    setPendingUnit(primaryUnit, secondaryUnit, conversionRate);
    router.back();
  }

  const primaryShort = UNITS.find((u) => u.label === primaryUnit)?.short ?? primaryUnit;
  const secondaryShort = UNITS.find((u) => u.label === secondaryUnit)?.short ?? secondaryUnit;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Add Item Unit</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Primary Unit */}
        <Text style={s.sectionLabel}>Primary Unit</Text>
        <TouchableOpacity
          style={[s.dropdownBtn, showPrimaryPicker && s.dropdownBtnOpen]}
          onPress={() => { setShowPrimaryPicker(!showPrimaryPicker); setShowSecondaryPicker(false); }}
        >
          <Text style={[s.dropdownTxt, !primaryUnit && s.placeholder]}>
            {primaryUnit ? `${primaryUnit}  ·  ${primaryShort}` : "Select Primary Unit"}
          </Text>
          <Ionicons name={showPrimaryPicker ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {showPrimaryPicker && (
          <View style={s.pickerList}>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 280 }}>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u.label}
                  style={s.pickerRow}
                  onPress={() => { setPrimaryUnit(u.label); setShowPrimaryPicker(false); }}
                >
                  <View style={s.pickerRowLeft}>
                    <Text style={[s.pickerRowTxt, primaryUnit === u.label && s.pickerRowActive]}>{u.label}</Text>
                    <Text style={s.pickerRowShort}>{u.short}</Text>
                  </View>
                  {primaryUnit === u.label && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[s.pickerRow, s.addUnitRow]}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={s.addUnitTxt}>Add Custom Unit</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Secondary Unit */}
        <Text style={[s.sectionLabel, { marginTop: 20 }]}>Secondary Unit <Text style={s.optional}>(optional)</Text></Text>
        <TouchableOpacity
          style={[s.dropdownBtn, showSecondaryPicker && s.dropdownBtnOpen]}
          onPress={() => { setShowSecondaryPicker(!showSecondaryPicker); setShowPrimaryPicker(false); }}
        >
          <Text style={[s.dropdownTxt, !secondaryUnit && s.placeholder]}>
            {secondaryUnit ? `${secondaryUnit}  ·  ${secondaryShort}` : "Select Secondary Unit"}
          </Text>
          <Ionicons name={showSecondaryPicker ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {showSecondaryPicker && (
          <View style={s.pickerList}>
            <TouchableOpacity
              style={[s.pickerRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => { setSecondaryUnit(""); setConversionRate(""); setShowSecondaryPicker(false); }}
            >
              <Text style={[s.pickerRowTxt, { color: colors.textMuted }]}>None</Text>
              {!secondaryUnit && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
            </TouchableOpacity>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }}>
              {UNITS.filter((u) => u.label !== primaryUnit).map((u) => (
                <TouchableOpacity
                  key={u.label}
                  style={s.pickerRow}
                  onPress={() => { setSecondaryUnit(u.label); setShowSecondaryPicker(false); }}
                >
                  <View style={s.pickerRowLeft}>
                    <Text style={[s.pickerRowTxt, secondaryUnit === u.label && s.pickerRowActive]}>{u.label}</Text>
                    <Text style={s.pickerRowShort}>{u.short}</Text>
                  </View>
                  {secondaryUnit === u.label && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[s.pickerRow, s.addUnitRow]}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={s.addUnitTxt}>Add Custom Unit</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Conversion Rate */}
        {primaryUnit && secondaryUnit && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>Conversion Rate</Text>
            <View style={s.convCard}>
              {/* 1 Primary = X Secondary */}
              <TouchableOpacity style={s.convRow} onPress={() => setConvDir("p2s")}>
                <View style={[s.radio, convDir === "p2s" && s.radioActive]}>
                  {convDir === "p2s" && <View style={s.radioDot} />}
                </View>
                <Text style={s.convLabel}>1 {primaryShort}  =</Text>
                <TextInput
                  style={[s.convInput, convDir === "p2s" && s.convInputActive]}
                  value={convDir === "p2s" ? conversionRate : ""}
                  onChangeText={setConversionRate}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textLight}
                  onFocus={() => setConvDir("p2s")}
                />
                <Text style={s.convLabel}>{secondaryShort}</Text>
              </TouchableOpacity>

              <View style={s.convDivider} />

              {/* 1 Secondary = X Primary */}
              <TouchableOpacity style={s.convRow} onPress={() => setConvDir("s2p")}>
                <View style={[s.radio, convDir === "s2p" && s.radioActive]}>
                  {convDir === "s2p" && <View style={s.radioDot} />}
                </View>
                <Text style={s.convLabel}>1 {secondaryShort}  =</Text>
                <TextInput
                  style={[s.convInput, convDir === "s2p" && s.convInputActive]}
                  value={convDir === "s2p" ? conversionRate : ""}
                  onChangeText={setConversionRate}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textLight}
                  onFocus={() => setConvDir("s2p")}
                />
                <Text style={s.convLabel}>{primaryShort}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.saveBtn, !primaryUnit && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!primaryUnit}
        >
          <Text style={s.saveBtnTxt}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  appBar: {
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: "#fff" },

  body: { padding: 18, paddingBottom: 100 },

  sectionLabel: {
    fontSize: 12, fontWeight: "700", color: colors.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
  },
  optional: { fontSize: 11, fontWeight: "400", color: colors.textLight, textTransform: "none" },

  dropdownBtn: {
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.border,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  dropdownBtnOpen: { borderColor: colors.primary },
  dropdownTxt: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "500" },
  placeholder: { color: colors.textLight },

  pickerList: {
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, marginTop: 4,
    overflow: "hidden",
  },
  pickerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  pickerRowLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  pickerRowTxt: { fontSize: 13.5, color: colors.text },
  pickerRowActive: { color: colors.primary, fontWeight: "700" },
  pickerRowShort: { fontSize: 12, color: colors.textLight, backgroundColor: colors.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  addUnitRow: { borderBottomWidth: 0, gap: 8, paddingVertical: 13, borderTopWidth: 1, borderTopColor: colors.border },
  addUnitTxt: { fontSize: 13.5, color: colors.primary, fontWeight: "600" },

  convCard: {
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  convRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 16, gap: 10,
  },
  convDivider: { height: 1, backgroundColor: colors.borderLight },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.textLight,
    alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  convLabel: { fontSize: 14, color: colors.text, fontWeight: "500" },
  convInput: {
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
    minWidth: 64, fontSize: 16, fontWeight: "600", color: colors.text,
    textAlign: "center", padding: 2,
  },
  convInputActive: { borderBottomColor: colors.primary },

  footer: {
    flexDirection: "row", backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingHorizontal: 18, gap: 12,
  },
  cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13 },
  cancelTxt: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  saveBtn: {
    flex: 2, backgroundColor: colors.primary, borderRadius: 8,
    paddingVertical: 14, alignItems: "center",
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: "#cbd5e1", shadowOpacity: 0 },
  saveBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

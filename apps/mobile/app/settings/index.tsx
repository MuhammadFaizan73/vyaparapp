import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { useSettings } from "../../src/useSettings";
import { TransactionSettingsBody } from "../transaction-settings";
import { PartySettingsBody } from "../party/settings";
import { InvoicePreviewNative } from "../../src/components/InvoicePreviewNative";
import { REGULAR_THEMES, THERMAL_THEMES, COLOR_SWATCHES } from "../../src/invoiceThemes";

type Tab = "general" | "transaction" | "print" | "party";
const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "transaction", label: "Transaction" },
  { key: "print", label: "Print" },
  { key: "party", label: "Party" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = (TABS.some((t) => t.key === params.tab) ? params.tab : "general") as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.tabStrip}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.tabBtnTxt, tab === t.key && s.tabBtnTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "general" && <GeneralTab />}
      {tab === "transaction" && <TransactionSettingsBody />}
      {tab === "print" && <PrintTab />}
      {tab === "party" && <PartySettingsBody />}
    </View>
  );
}

function GeneralTab() {
  const { settings, toggle, update } = useSettings();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <View style={s.row}>
        <Text style={s.rowLabel}>Enable Passcode</Text>
        <Switch
          value={settings.enablePasscode}
          onValueChange={() => toggle("enablePasscode")}
          trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
        />
      </View>
      <View style={s.labeledField}>
        <Text style={s.fieldLabel}>Currency</Text>
        <Text style={s.fieldInput} onPress={() => update({ currency: settings.currency === "Rs" ? "PKR" : "Rs" })}>
          {settings.currency}
        </Text>
      </View>
    </ScrollView>
  );
}

function PrintTab() {
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  const [printerType, setPrinterType] = useState<"regular" | "thermal">("regular");
  const isRegular = printerType === "regular";
  const themeList = isRegular ? REGULAR_THEMES : THERMAL_THEMES;
  const activeTheme = isRegular ? settings.printThemeName : settings.thermalThemeName;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <View style={s.tabStrip}>
        <TouchableOpacity
          style={[s.subTabBtn, isRegular && s.subTabBtnActive]}
          onPress={() => setPrinterType("regular")}
        >
          <Text style={[s.subTabTxt, isRegular && s.subTabTxtActive]}>Regular Printer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.subTabBtn, !isRegular && s.subTabBtnActive]}
          onPress={() => setPrinterType("thermal")}
        >
          <Text style={[s.subTabTxt, !isRegular && s.subTabTxtActive]}>Thermal Printer</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionLabel}>Theme</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.themeRow}>
        {themeList.map((name) => (
          <TouchableOpacity
            key={name}
            style={[s.themeCard, activeTheme === name && s.themeCardActive]}
            onPress={() => update(isRegular ? { printThemeName: name } : { thermalThemeName: name })}
          >
            <Text style={[s.themeCardTxt, activeTheme === name && s.themeCardTxtActive]} numberOfLines={2}>{name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isRegular && (
        <>
          <Text style={s.sectionLabel}>Color</Text>
          <View style={s.colorGrid}>
            {COLOR_SWATCHES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[s.swatch, { backgroundColor: c }, settings.printColor === c && s.swatchActive, c === "#ffffff" && s.swatchWhiteBorder]}
                onPress={() => update({ printColor: c })}
              />
            ))}
          </View>
        </>
      )}

      <View style={s.labeledField}>
        <Text style={s.fieldLabel}>Company Name</Text>
        <Text style={s.fieldInput}>{settings.companyName}</Text>
      </View>

      <Text style={s.sectionLabel}>Preview</Text>
      <View style={s.previewWrap}>
        <InvoicePreviewNative themeName={activeTheme} color={isRegular ? settings.printColor : "#111827"} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  appBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" },

  tabStrip: {
    flexDirection: "row", backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: colors.primary },
  tabBtnTxt: { fontSize: 13, fontWeight: "600", color: "#9ca3af" },
  tabBtnTxtActive: { color: colors.primary },

  subTabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  subTabBtnActive: { borderBottomColor: "#dc2626" },
  subTabTxt: { fontSize: 12, fontWeight: "600", color: "#9ca3af" },
  subTabTxtActive: { color: "#dc2626" },

  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: "#9ca3af", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },

  themeRow: { paddingHorizontal: 16, gap: 10 },
  themeCard: {
    width: 76, padding: 8, borderRadius: 8, borderWidth: 2, borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", minHeight: 56,
  },
  themeCardActive: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  themeCardTxt: { fontSize: 10, color: "#64748b", textAlign: "center" },
  themeCardTxtActive: { color: "#1d4ed8", fontWeight: "600" },

  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  swatchActive: { borderWidth: 2, borderColor: "#1e293b" },
  swatchWhiteBorder: { borderWidth: 1, borderColor: "#d1d5db" },

  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  rowLabel: { fontSize: 15, fontWeight: "500", color: "#111827" },

  labeledField: { paddingHorizontal: 16, paddingVertical: 10 },
  fieldLabel: { fontSize: 11, color: "#6b7280", marginBottom: 4 },
  fieldInput: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#111827", backgroundColor: "#fff",
  },

  previewWrap: { marginHorizontal: 16, marginBottom: 24, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, overflow: "hidden" },
});

import { useState } from "react";
import {
  View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { usePartySettings, type PartySettings } from "../../src/usePartySettings";

export default function PartySettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, toggle, save } = usePartySettings();
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  async function handleSave() {
    setSaving(true);
    await save();
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1800);
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Party Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

        <ToggleRow label="TIN number"              value={settings.tinNumber}           onToggle={() => toggle("tinNumber")} />
        <ToggleRow label="Party Shipping Address"  value={settings.shippingAddress}     onToggle={() => toggle("shippingAddress")} />
        <ToggleRow
          label="Print Shipping Address"
          value={settings.printShippingAddress}
          onToggle={() => toggle("printShippingAddress")}
          disabled={!settings.shippingAddress}
        />

        {/* OTHERS */}
        <View style={s.sectionLabel}>
          <Text style={s.sectionLabelText}>OTHERS</Text>
        </View>

        <ToggleRow label="Party Grouping" value={settings.partyGrouping} onToggle={() => toggle("partyGrouping")} />

        {/* Party Additional Fields — collapsible */}
        <TouchableOpacity
          style={s.row}
          activeOpacity={0.7}
          onPress={() => setAdditionalOpen((v) => !v)}
        >
          <View style={s.rowLabelWrap}>
            <Text style={s.rowLabel}>Party Additional Fields</Text>
            <InfoIcon />
          </View>
          <Ionicons
            name={additionalOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color="#6b7280"
          />
        </TouchableOpacity>

        {additionalOpen && (
          <View style={s.collapsibleBody}>
            <CheckboxRow label="Additional Field 1" checked={settings.additionalField1} onChange={() => toggle("additionalField1")} />
            <CheckboxRow label="Additional Field 2" checked={settings.additionalField2} onChange={() => toggle("additionalField2")} />
            <CheckboxRow label="Additional Field 3" checked={settings.additionalField3} onChange={() => toggle("additionalField3")} />
            <CheckboxRow label="Date Field"         checked={settings.dateField}         onChange={() => toggle("dateField")}         last />
          </View>
        )}

        {/* Save */}
        <View style={s.saveWrap}>
          <TouchableOpacity
            style={[s.saveBtn, savedMsg && s.saveBtnSuccess]}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.saveBtnText}>{savedMsg ? "✓ Saved!" : "Save"}</Text>
            }
          </TouchableOpacity>
        </View>

        <ToggleRow
          label="Invite parties to add themselves"
          value={settings.inviteParties}
          onToggle={() => toggle("inviteParties")}
        />
      </ScrollView>
    </View>
  );
}

/* ── Sub-components ── */

function ToggleRow({ label, value, onToggle, disabled }: {
  label: string; value: boolean; onToggle: () => void; disabled?: boolean;
}) {
  return (
    <View style={[s.row, disabled && { opacity: 0.45 }]}>
      <View style={s.rowLabelWrap}>
        <Text style={s.rowLabel}>{label}</Text>
        <InfoIcon />
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onToggle}
        trackColor={{ false: "#d1d5db", true: "#3b82f6" }}
        thumbColor="#fff"
        ios_backgroundColor="#d1d5db"
        disabled={disabled}
      />
    </View>
  );
}

function CheckboxRow({ label, checked, onChange, last }: {
  label: string; checked: boolean; onChange: () => void; last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.checkboxRow, last && { borderBottomWidth: 0 }]}
      activeOpacity={0.7}
      onPress={onChange}
    >
      <View style={[s.checkboxBox, checked && s.checkboxBoxChecked]}>
        {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      <Text style={s.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoIcon() {
  return (
    <View style={s.infoIcon}>
      <Text style={s.infoIconTxt}>i</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  header: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" },

  sectionLabel: {
    paddingHorizontal: 20, paddingVertical: 9,
    backgroundColor: "#f3f4f6",
    borderTopWidth: 1, borderTopColor: "#e5e7eb",
    borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
  },
  sectionLabelText: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: "#9ca3af",
  },

  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  rowLabelWrap: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "500", color: "#111827" },

  collapsibleBody: { backgroundColor: "#fafafa", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  checkboxRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#fff", paddingHorizontal: 28, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  checkboxBox: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 1.5, borderColor: "#d1d5db", backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  checkboxBoxChecked: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  checkboxLabel: { fontSize: 14, color: "#374151" },

  saveWrap: {
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  saveBtn: {
    backgroundColor: "#3b82f6", borderRadius: 10,
    paddingVertical: 14, alignItems: "center", justifyContent: "center",
  },
  saveBtnSuccess: { backgroundColor: "#22c55e" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  infoIcon: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center",
  },
  infoIconTxt: { fontSize: 11, fontWeight: "700", color: "#6b7280" },
});

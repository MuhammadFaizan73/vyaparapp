import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";

function formatDateDisplay(iso: string) {
  const d = new Date(iso);
  const dd   = String(d.getDate()).padStart(2, "0");
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function AddBankAccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name,             setName]             = useState("");
  const [openingBalance,   setOpeningBalance]   = useState("");
  const [asOn,             setAsOn]             = useState(todayISO());
  const [printOnInvoices,  setPrintOnInvoices]  = useState(false);
  const [saving,           setSaving]           = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a bank name.");
      return;
    }
    const balance = parseFloat(openingBalance) || 0;
    setSaving(true);
    try {
      await api.createBankAccount({
        name:               name.trim(),
        openingBalance:     balance,
        openingBalanceDate: asOn,
        printOnInvoices,
      });
      router.back();
    } catch {
      Alert.alert("Error", "Could not save bank account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Add Bank Account</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bank name */}
        <View style={s.fieldOutline}>
          <Text style={s.fieldLabel}>Bank Name/ Account Display Name</Text>
          <TextInput
            style={s.fieldInput}
            value={name}
            onChangeText={setName}
            placeholder=""
            placeholderTextColor={colors.textLight}
            autoFocus
          />
        </View>

        {/* Opening balance + As On */}
        <View style={s.row2}>
          {/* Plain grey box — no floating label */}
          <View style={s.balanceField}>
            <TextInput
              style={s.balanceInput}
              value={openingBalance}
              onChangeText={setOpeningBalance}
              placeholder="Opening Balance"
              placeholderTextColor="#aab2be"
              keyboardType="decimal-pad"
            />
          </View>
          {/* Blue outlined box with floating label */}
          <View style={s.asOnField}>
            <Text style={s.asOnLabel}>As On</Text>
            <View style={s.dateRow}>
              <Text style={s.dateText}>{formatDateDisplay(asOn)}</Text>
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Print bank details on invoices */}
        <View style={s.toggleRow}>
          <View style={s.toggleLeft}>
            <Text style={s.toggleLabel}>Print bank details on invoices</Text>
            <TouchableOpacity hitSlop={6}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Switch
            value={printOnInvoices}
            onValueChange={setPrintOnInvoices}
            trackColor={{ false: "#e5e7eb", true: colors.primary + "80" }}
            thumbColor={printOnInvoices ? colors.primary : "#9ca3af"}
          />
        </View>
      </ScrollView>

      {/* Save button */}
      <TouchableOpacity
        style={[s.saveBtn, saving && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.saveTxt}>Save</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },

  appBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  appBarTitle: { fontSize: 17, fontWeight: "600", color: colors.text },

  body: { paddingTop: 24 },

  /* Outlined field (Google-style label) */
  fieldOutline: {
    marginHorizontal: 16, marginBottom: 18,
    borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: 4, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8,
    position: "relative",
  },
  fieldLabel: {
    fontSize: 11, color: colors.primary, fontWeight: "500",
    marginBottom: 4,
  },
  fieldInput: {
    fontSize: 15, color: colors.text, padding: 0, minHeight: 28,
  },

  row2: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 18 },

  /* Opening Balance — plain grey border */
  balanceField: {
    flex: 1,
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 6,
    height: 52, justifyContent: "center", paddingHorizontal: 12,
  },
  balanceInput: {
    fontSize: 14, color: colors.text, padding: 0,
  },

  /* As On — blue outlined with floating label */
  asOnField: {
    flex: 1.3,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 4,
    height: 52, paddingHorizontal: 12, paddingTop: 5, paddingBottom: 4,
    justifyContent: "space-between",
  },
  asOnLabel: {
    fontSize: 11, color: colors.primary, fontWeight: "500",
  },

  dateRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    flex: 1,
  },
  dateText: { fontSize: 14.5, color: colors.text },

  divider: { height: 1, backgroundColor: "#e8f0f8", marginVertical: 4 },

  toggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 18,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  toggleLabel: { fontSize: 14.5, color: colors.text },

  saveBtn: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.red,
    paddingVertical: 18, alignItems: "center",
  },
  saveTxt: { fontSize: 16, fontWeight: "700", color: "#fff" },
});

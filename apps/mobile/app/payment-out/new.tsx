import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { useParties } from "../../src/useParties";

const PAYMENT_METHODS = [
  { icon: "cash-outline" as const, label: "Cash" },
  { icon: "business-outline" as const, label: "Bank" },
  { icon: "phone-portrait-outline" as const, label: "JazzCash" },
  { icon: "document-text-outline" as const, label: "Cheque" },
];

export default function NewPaymentOutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parties } = useParties();
  const [supplier, setSupplier] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");

  const filtered = parties.filter((p) =>
    p.name.toLowerCase().includes(supplier.toLowerCase())
  );
  const d = new Date();
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Payment-Out</Text>
        <TouchableOpacity hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={colors.textLight} />
        </TouchableOpacity>
      </View>

      <View style={s.refRow}>
        <View style={s.refCell}>
          <Text style={s.refLabel}>Payment No.</Text>
          <TouchableOpacity style={s.refValRow}>
            <Text style={s.refValTxt}>#1</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textLight} />
          </TouchableOpacity>
        </View>
        <View style={s.refDiv} />
        <View style={s.refCell}>
          <Text style={s.refLabel}>Date</Text>
          <TouchableOpacity style={s.refValRow}>
            <Text style={s.refValTxt}>{date}</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scrollContent}>
        {/* Party */}
        <View style={s.card}>
          <View style={s.formRow}>
            <Text style={s.formLabel}>Supplier *</Text>
            <TextInput
              style={s.formInput}
              value={supplier}
              onChangeText={(t) => { setSupplier(t); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Select or type name"
              placeholderTextColor={colors.textLight}
              autoFocus
            />
          </View>
        </View>

        {showDropdown && filtered.length > 0 && (
          <View style={s.dropdown}>
            <View style={s.dropdownHeader}>
              <Text style={s.dropdownTitle}>Saved Parties</Text>
              <TouchableOpacity onPress={() => setShowDropdown(false)} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {filtered.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                style={[s.dropdownRow, i === filtered.length - 1 && s.dropdownRowLast]}
                onPress={() => { setSupplier(p.name); setShowDropdown(false); }}
              >
                <View style={s.dropdownAvatar}>
                  <Text style={s.dropdownAvatarTxt}>{p.name[0]?.toUpperCase()}</Text>
                </View>
                <View style={s.dropdownMid}>
                  <Text style={s.dropdownName}>{p.name}</Text>
                  {p.phone ? <Text style={s.dropdownPhone}>{p.phone}</Text> : null}
                </View>
                <Text style={s.dropdownBal}>
                  {p.balance !== 0 ? `Rs ${Math.abs(p.balance).toLocaleString()}` : "—"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Amount */}
        <View style={s.amountCard}>
          <Text style={s.amountLabel}>Amount to Pay</Text>
          <View style={s.amountRow}>
            <Text style={s.amountRs}>Rs</Text>
            <TextInput
              style={s.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textLight}
              keyboardType="numeric"
              textAlign="right"
            />
          </View>
        </View>

        {/* Payment method */}
        <Text style={s.sectionLabel}>Payment Method</Text>
        <View style={s.card}>
          {PAYMENT_METHODS.map((m, i) => (
            <TouchableOpacity
              key={m.label}
              style={[s.methodRow, i === PAYMENT_METHODS.length - 1 && s.methodRowLast]}
              onPress={() => setMethod(m.label)}
            >
              <View style={s.methodIcon}>
                <Ionicons name={m.icon} size={18} color={colors.primary} />
              </View>
              <Text style={s.methodLabel}>{m.label}</Text>
              <View style={[s.radio, method === m.label && s.radioFilled]}>
                {method === m.label && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={s.draftBtn}>
          <Text style={s.draftBtnTxt}>Save Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={() => router.back()}>
          <Text style={s.saveBtnTxt}>Save Payment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },

  refRow: {
    flexDirection: "row", backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  refCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  refDiv: { width: 1, backgroundColor: colors.border, marginVertical: 8 },
  refLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: "500" },
  refValRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  refValTxt: { fontSize: 13, color: colors.text, fontWeight: "600" },

  scrollContent: { padding: 16, gap: 12, paddingBottom: 90 },

  card: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  formRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  formLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: "500", flexShrink: 0 },
  formInput: { flex: 1, fontSize: 13, color: colors.text, textAlign: "right" },

  dropdown: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  dropdownHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa",
  },
  dropdownTitle: { fontSize: 13, fontWeight: "600", color: colors.text },
  dropdownRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa",
  },
  dropdownRowLast: { borderBottomWidth: 0 },
  dropdownAvatar: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
  },
  dropdownAvatarTxt: { fontSize: 14, fontWeight: "700", color: "#1d4ed8" },
  dropdownMid: { flex: 1 },
  dropdownName: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  dropdownPhone: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  dropdownBal: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },

  amountCard: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    padding: 18, gap: 8,
  },
  amountLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  amountRs: { fontSize: 18, fontWeight: "700", color: colors.textMuted },
  amountInput: { flex: 1, fontSize: 28, fontWeight: "700", color: colors.text },

  sectionLabel: { fontSize: 13, fontWeight: "600", color: colors.text },

  methodRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa",
  },
  methodRowLast: { borderBottomWidth: 0 },
  methodIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#e0f0f7", alignItems: "center", justifyContent: "center",
  },
  methodLabel: { flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.text },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: "#cbd5e1",
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  radioFilled: { backgroundColor: colors.primary, borderColor: colors.primary },

  footer: {
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingHorizontal: 18, flexDirection: "row", gap: 10,
  },
  draftBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 100,
    borderWidth: 1.5, borderColor: colors.primary, alignItems: "center",
  },
  draftBtnTxt: { fontSize: 13.5, fontWeight: "600", color: colors.primary },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 100,
    backgroundColor: colors.primary, alignItems: "center",
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  saveBtnTxt: { fontSize: 13.5, fontWeight: "600", color: "#fff" },
});

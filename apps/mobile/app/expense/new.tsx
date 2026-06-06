import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";

const CATEGORIES = ["Rent", "Salary", "Utilities", "Transport", "Manufacturing", "Other"];
const PAYMENT_METHODS = [
  { icon: "cash-outline" as const, label: "Cash" },
  { icon: "business-outline" as const, label: "Bank" },
  { icon: "phone-portrait-outline" as const, label: "JazzCash" },
  { icon: "card-outline" as const, label: "Card" },
];

export default function NewExpenseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const d = new Date();
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Expense</Text>
        <TouchableOpacity hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={colors.textLight} />
        </TouchableOpacity>
      </View>

      <View style={s.refRow}>
        <View style={s.refCell}>
          <Text style={s.refLabel}>Expense No.</Text>
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
        {/* Category */}
        <View style={s.card}>
          <View style={s.formRow}>
            <Text style={s.formLabel}>Category *</Text>
            <TextInput
              style={s.formInput}
              value={category}
              onChangeText={setCategory}
              placeholder="Select category"
              placeholderTextColor={colors.textLight}
              autoFocus
            />
          </View>
        </View>

        <View style={s.chipsWrap}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[s.chip, category === c && s.chipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[s.chipTxt, category === c && s.chipTxtActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount */}
        <View style={s.card}>
          <View style={[s.formRow, s.formRowLast]}>
            <Text style={s.formLabel}>Amount *</Text>
            <View style={s.amountInputRow}>
              <Text style={s.rsPrefix}>Rs</Text>
              <TextInput
                style={[s.formInput, s.amountInput]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textLight}
                keyboardType="numeric"
              />
            </View>
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

        {/* Note */}
        <View style={s.noteCard}>
          <TextInput
            style={s.noteInput}
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.textLight}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={s.draftBtn}>
          <Text style={s.draftBtnTxt}>Save Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={() => router.back()}>
          <Text style={s.saveBtnTxt}>Save</Text>
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
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa", gap: 12,
  },
  formRowLast: { borderBottomWidth: 0 },
  formLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: "500", flexShrink: 0 },
  formInput: { flex: 1, fontSize: 13, color: colors.text, textAlign: "right" },
  amountInputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  amountInput: { flex: 1 },
  rsPrefix: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100,
    borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 12.5, color: colors.textMuted, fontWeight: "500" },
  chipTxtActive: { color: "#fff", fontWeight: "600" },

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

  noteCard: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  noteInput: { fontSize: 13, color: colors.text, minHeight: 64, textAlignVertical: "top" },

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

import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import { useParties } from "../../src/useParties";
import { useSelectedCompany } from "../../src/useSelectedCompany";
import { takeHandoffTxn } from "../../src/txnHandoff";

const PAYMENT_METHODS = [
  { icon: "cash-outline" as const, label: "Cash" },
  { icon: "business-outline" as const, label: "Bank" },
  { icon: "phone-portrait-outline" as const, label: "JazzCash" },
  { icon: "document-text-outline" as const, label: "Cheque" },
];

export default function NewPaymentOutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ editId?: string }>();
  const isEdit = Boolean(params.editId);
  const { parties } = useParties();
  const { selectedCompanyId } = useSelectedCompany();
  const [supplier, setSupplier] = useState("");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);

  // Load the existing payment when opened via txn/[id].tsx's Edit action — mirrors
  // purchase/new.tsx's own editId handling. Deliberately not depending on `parties` so
  // this only ever runs once per editId; a re-run when parties finish loading later
  // would wipe out edits the user already made.
  useEffect(() => {
    if (!params.editId) return;
    const handed = takeHandoffTxn(params.editId);
    const load = handed
      ? Promise.resolve(handed)
      : api.getTransaction(params.editId).catch(() => null);

    load.then(async (txn) => {
      if (!txn) { Alert.alert("Not found", "Could not load this payment."); router.back(); return; }

      let party = parties.find((p) => p.id === txn.partyId) ?? null;
      if (!party) {
        try { party = (await api.getParties()).find((p) => p.id === txn.partyId) ?? null; }
        catch { /* fall through with whatever the handoff/notes already gave us */ }
      }
      setSupplier(party?.name ?? "");
      setSupplierId(txn.partyId);
      setAmount(String(txn.total));
      setDateIso(txn.date);

      try {
        const notes = JSON.parse(txn.notes ?? "{}");
        if (notes.paymentType) setMethod(notes.paymentType);
      } catch { /* ignore */ }

      setLoadingEdit(false);
    }).catch(() => {
      Alert.alert("Error", "Could not load this payment.");
      router.back();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.editId]);

  async function handleSave() {
    if (!supplier.trim()) { Alert.alert("Select a supplier"); return; }
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) { Alert.alert("Enter the amount to pay"); return; }
    setSaving(true);
    try {
      const party = parties.find((p) => p.id === supplierId) ?? parties.find((p) => p.name === supplier);
      if (!party) { Alert.alert("Select a valid supplier from the list"); setSaving(false); return; }
      const total = amt;
      const balance = 0;
      const notes = JSON.stringify({ paymentType: method });
      if (params.editId) {
        await api.updateTransaction(params.editId, {
          partyId: party.id,
          date: dateIso ?? new Date().toISOString(),
          total,
          balance,
          notes,
        });
      } else {
        await api.createTransaction({
          partyId: party.id,
          type: "payment_out",
          date: new Date().toISOString(),
          total,
          balance,
          notes,
          companyId: selectedCompanyId ?? undefined,
        });
      }
      router.back();
    } catch {
      Alert.alert("Error", `Could not ${params.editId ? "update" : "save"}. Check your connection.`);
    } finally {
      setSaving(false);
    }
  }

  const filtered = parties.filter((p) =>
    p.name.toLowerCase().includes(supplier.toLowerCase())
  );
  const d = dateIso ? new Date(dateIso) : new Date();
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>{isEdit ? "Edit Payment-Out" : "Payment-Out"}</Text>
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
              onChangeText={(t) => { setSupplier(t); setSupplierId(null); setShowDropdown(true); }}
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
                onPress={() => { setSupplier(p.name); setSupplierId(p.id); setShowDropdown(false); }}
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
        <TouchableOpacity style={s.draftBtn} disabled={saving || loadingEdit}>
          <Text style={s.draftBtnTxt}>Save Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving || loadingEdit}>
          <Text style={s.saveBtnTxt}>{saving ? "Saving…" : isEdit ? "Update" : "Save Payment"}</Text>
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

import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { useParties } from "../useParties";

interface Props {
  title: string;
  refLabel: string;
  refNumber?: string;
  partyLabel: string;
  showAddItems?: boolean;
  extraFields?: React.ReactNode;
}

export function TxnForm({ title, refLabel, refNumber = "1", partyLabel, showAddItems = true, extraFields }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parties } = useParties();
  const [party, setParty] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const d = new Date();
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  const filteredParties = parties.filter((p) =>
    p.name.toLowerCase().includes(party.toLowerCase())
  );

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>{title}</Text>
        <TouchableOpacity hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={colors.textLight} />
        </TouchableOpacity>
      </View>

      <View style={s.refRow}>
        <View style={s.refCell}>
          <Text style={s.refLabel}>{refLabel}</Text>
          <TouchableOpacity style={s.refValRow}>
            <Text style={s.refValTxt}>#{refNumber}</Text>
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
        <View style={s.card}>
          <View style={s.formRow}>
            <Text style={s.formLabel}>{partyLabel}</Text>
            <TextInput
              style={s.formInput}
              value={party}
              onChangeText={(t) => { setParty(t); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Select or type name"
              placeholderTextColor={colors.textLight}
              autoFocus
            />
          </View>
          {extraFields}
        </View>

        {showDropdown && filteredParties.length > 0 && (
          <View style={s.dropdown}>
            <View style={s.dropdownHeader}>
              <Text style={s.dropdownTitle}>Saved Parties</Text>
              <TouchableOpacity onPress={() => setShowDropdown(false)} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {filteredParties.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                style={[s.dropdownRow, i === filteredParties.length - 1 && s.dropdownRowLast]}
                onPress={() => { setParty(p.name); setShowDropdown(false); }}
              >
                <View style={s.dropdownAvatar}>
                  <Text style={s.dropdownAvatarTxt}>{p.name[0]?.toUpperCase()}</Text>
                </View>
                <View style={s.dropdownMid}>
                  <Text style={s.dropdownName}>{p.name}</Text>
                  {p.phone ? <Text style={s.dropdownPhone}>{p.phone}</Text> : null}
                </View>
                <Text style={[s.dropdownBalance, { color: p.balance < 0 ? colors.green : colors.textMuted }]}>
                  {p.balance !== 0 ? `Rs ${Math.abs(p.balance).toLocaleString()}` : "—"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showAddItems && (
          <TouchableOpacity style={s.addItemsCard}>
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            <Text style={s.addItemsTxt}>Add Items</Text>
          </TouchableOpacity>
        )}

        <View style={s.card}>
          <View style={[s.formRow, s.formRowLast]}>
            <Text style={s.totalLabel}>Total Amount</Text>
            <Text style={s.totalValue}>Rs 0.00</Text>
          </View>
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
  dropdownBalance: { fontSize: 12.5, fontWeight: "600" },

  addItemsCard: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed",
    paddingVertical: 18, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
  },
  addItemsTxt: { fontSize: 14, fontWeight: "600", color: colors.primary },

  totalLabel: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  totalValue: { fontSize: 16, fontWeight: "700", color: colors.text },

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

import { useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { useTeamMembers } from "../useTeamMembers";

// A single-select "which salesman/staff member made this entry" filter — the
// transaction-list counterpart to the Booker picker already on the Sale create form.
// Reused across Sale/Purchase/Payment-In/Payment-Out/Expense lists so each doesn't
// reimplement its own team-member fetch + picker UI.
export function SalesmanFilter({
  value, onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const teamMembers = useTeamMembers();
  const [open, setOpen] = useState(false);
  const selectedName = value ? teamMembers.find((m) => m.id === value)?.name : null;

  if (teamMembers.length === 0) return null;

  return (
    <>
      <TouchableOpacity style={[s.chip, value && s.chipActive]} onPress={() => setOpen(true)}>
        <Ionicons name="person-outline" size={13} color={value ? "#fff" : colors.textMuted} />
        <Text style={[s.chipTxt, value && s.chipTxtActive]} numberOfLines={1}>
          {selectedName ?? "Salesman"}
        </Text>
        <Ionicons name="chevron-down" size={12} color={value ? "#fff" : colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={s.sheet}>
          <Text style={s.title}>Filter by Salesman</Text>
          <TouchableOpacity style={s.row} onPress={() => { onChange(""); setOpen(false); }}>
            <Text style={s.rowTxt}>All Salesmen</Text>
            {!value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
          </TouchableOpacity>
          {teamMembers.map((m) => (
            <TouchableOpacity key={m.id} style={s.row} onPress={() => { onChange(m.id); setOpen(false); }}>
              <Text style={s.rowTxt}>{m.name}</Text>
              {value === m.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 12, fontWeight: "600", color: colors.textMuted, maxWidth: 90 },
  chipTxtActive: { color: "#fff" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 12 },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  rowTxt: { fontSize: 14.5, color: colors.text },
});

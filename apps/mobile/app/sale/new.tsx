import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

const PARTIES = [
  { id: "1", name: "Muhammad Faizan", phone: "3139200720", balance: 0 },
  { id: "2", name: "Noor Medical store", phone: "0313222222", balance: -31000 },
];

export default function NewSaleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"credit" | "cash">("credit");
  const [customer, setCustomer] = useState("");
  const [showParties, setShowParties] = useState(false);

  const filtered = PARTIES.filter((p) =>
    p.name.toLowerCase().includes(customer.toLowerCase())
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sale</Text>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "credit" && styles.modeBtnActive]}
            onPress={() => setMode("credit")}
          >
            <Text style={[styles.modeBtnText, mode === "credit" && styles.modeBtnTextActive]}>
              Credit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "cash" && styles.modeBtnActive]}
            onPress={() => setMode("cash")}
          >
            <Text style={[styles.modeBtnText, mode === "cash" && styles.modeBtnTextActive]}>
              Cash
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.settingsBtn}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Invoice meta row */}
      <View style={styles.metaRow}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Invoice No.</Text>
          <TouchableOpacity style={styles.metaValue}>
            <Text style={styles.metaValueText}>6 ∨</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Date</Text>
          <TouchableOpacity style={styles.metaValue}>
            <Text style={styles.metaValueText}>21/04/2026 ∨</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Customer field */}
        <View style={styles.fieldContainer}>
          <TextInput
            style={styles.customerInput}
            placeholder=""
            value={customer}
            onChangeText={(t) => { setCustomer(t); setShowParties(true); }}
            onFocus={() => setShowParties(true)}
          />
          <Text style={[styles.floatLabel, customer ? styles.floatLabelUp : styles.floatLabelCenter]}>
            Customer *
          </Text>
        </View>

        {/* Party dropdown */}
        {showParties && (
          <View style={styles.partyDropdown}>
            <View style={styles.partyDropdownHeader}>
              <Text style={styles.partyDropdownTitle}>Showing Saved Parties</Text>
              <TouchableOpacity>
                <Text style={styles.addNewParty}>Add new party</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.partyDivider} />
            {filtered.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.partyRow}
                onPress={() => { setCustomer(p.name); setShowParties(false); }}
              >
                <View style={styles.partyRowLeft}>
                  <Text style={styles.partyName}>{p.name}</Text>
                  <Text style={styles.partyPhone}>{p.phone}</Text>
                </View>
                <View style={styles.partyRowRight}>
                  {p.balance !== 0 && (
                    <Text style={[styles.partyBalance, { color: colors.green }]}>
                      ↓ {Math.abs(p.balance).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                    </Text>
                  )}
                  {p.balance === 0 && (
                    <Text style={styles.partyBalance}>0.00</Text>
                  )}
                  <Text style={styles.partyChevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Warning banner */}
      <TouchableOpacity style={styles.warningBanner}>
        <Text style={styles.warningText}>Your current plan may not support some features.</Text>
        <Text style={styles.warningChevron}>›</Text>
      </TouchableOpacity>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.footerBtnGhost}>
          <Text style={styles.footerBtnGhostText}>Save &amp; New</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerBtnPrimary}>
          <Text style={styles.footerBtnPrimaryText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerMore}>
          <Text style={styles.footerMoreText}>⋮</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f5f5" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  backArrow: { fontSize: 22, color: colors.text },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    padding: 3,
  },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  modeBtnActive: { backgroundColor: colors.green },
  modeBtnText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  modeBtnTextActive: { color: "#fff" },
  settingsBtn: { padding: 4 },
  settingsIcon: { fontSize: 18 },

  metaRow: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metaCell: { flex: 1, padding: 14 },
  metaDivider: { width: 1, backgroundColor: colors.border, marginVertical: 8 },
  metaLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  metaValue: { flexDirection: "row", alignItems: "center" },
  metaValueText: { fontSize: 14, color: colors.textMuted },

  scroll: { flex: 1 },

  fieldContainer: {
    margin: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 10,
    backgroundColor: colors.card,
    position: "relative",
  },
  customerInput: { fontSize: 15, color: colors.text, height: 28 },
  floatLabel: {
    position: "absolute",
    left: 12,
    fontSize: 14,
    color: colors.primary,
    fontWeight: "500",
  },
  floatLabelCenter: { top: 14 },
  floatLabelUp: { top: 6, fontSize: 12 },

  partyDropdown: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  partyDropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  partyDropdownTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  addNewParty: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  partyDivider: { height: 1, backgroundColor: colors.border },
  partyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  partyRowLeft: { flex: 1 },
  partyName: { fontSize: 14, fontWeight: "600", color: colors.text },
  partyPhone: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  partyRowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  partyBalance: { fontSize: 14, color: colors.textMuted },
  partyChevron: { fontSize: 16, color: colors.textMuted },

  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff5f5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#fecaca",
  },
  warningText: { fontSize: 12, color: "#ef4444", flex: 1 },
  warningChevron: { fontSize: 14, color: "#ef4444" },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  footerBtnGhost: { flex: 1, paddingVertical: 12, alignItems: "center" },
  footerBtnGhostText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  footerBtnPrimary: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  footerBtnPrimaryText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  footerMore: { padding: 10 },
  footerMoreText: { fontSize: 18, color: colors.textMuted },
});

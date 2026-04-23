import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

const PARTIES = [
  { id: "1", name: "Muhammad Faizan", phone: "3139200720", balance: 0 },
  { id: "2", name: "Noor Medical store", phone: "0313222222", balance: -31000 },
];

export default function NewPaymentInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [customer, setCustomer] = useState("");
  const [showParties, setShowParties] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [note, setNote] = useState("");

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
        <Text style={styles.headerTitle}>Payment-In</Text>
        <TouchableOpacity style={styles.settingsBtn}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Invoice meta row */}
      <View style={styles.metaRow}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Receipt No.</Text>
          <TouchableOpacity style={styles.metaValue}>
            <Text style={styles.metaValueText}>1 ∨</Text>
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
            style={styles.input}
            placeholder=""
            value={customer}
            onChangeText={(t) => { setCustomer(t); setShowParties(true); }}
            onFocus={() => setShowParties(true)}
          />
          <Text style={[styles.floatLabel, customer ? styles.floatLabelUp : styles.floatLabelCenter]}>
            Customer Name *
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

        {/* Amount fields */}
        <View style={styles.amountSection}>
          {/* Received Amount */}
          <View style={styles.amountFieldContainer}>
            <TextInput
              style={styles.input}
              placeholder=""
              value={receivedAmount}
              onChangeText={setReceivedAmount}
              keyboardType="numeric"
            />
            <Text style={[styles.floatLabel, receivedAmount ? styles.floatLabelUp : styles.floatLabelCenter]}>
              Received Amount *
            </Text>
            <Text style={styles.currencyPrefix}>Rs</Text>
          </View>

          {/* Total/Outstanding Amount */}
          <View style={styles.amountFieldContainer}>
            <TextInput
              style={styles.input}
              placeholder=""
              value={totalAmount}
              onChangeText={setTotalAmount}
              keyboardType="numeric"
            />
            <Text style={[styles.floatLabel, totalAmount ? styles.floatLabelUp : styles.floatLabelCenter]}>
              Total Outstanding Amount
            </Text>
            <Text style={styles.currencyPrefix}>Rs</Text>
          </View>
        </View>

        {/* Payment method row */}
        <View style={styles.paymentMethodSection}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethodRow}>
            <TouchableOpacity style={[styles.paymentMethodBtn, styles.paymentMethodActive]}>
              <Text style={styles.paymentMethodIcon}>💵</Text>
              <Text style={[styles.paymentMethodText, styles.paymentMethodTextActive]}>Cash</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.paymentMethodBtn}>
              <Text style={styles.paymentMethodIcon}>🏦</Text>
              <Text style={styles.paymentMethodText}>Bank</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.paymentMethodBtn}>
              <Text style={styles.paymentMethodIcon}>📱</Text>
              <Text style={styles.paymentMethodText}>UPI/QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.paymentMethodBtn}>
              <Text style={styles.paymentMethodIcon}>💳</Text>
              <Text style={styles.paymentMethodText}>Card</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Note field */}
        <View style={styles.noteFieldContainer}>
          <TextInput
            style={[styles.input, styles.noteInput]}
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.textLight}
            value={note}
            onChangeText={setNote}
            multiline
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.footerBtnGhost}>
          <Text style={styles.footerBtnGhostText}>Save &amp; New</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.footerBtnPrimary, { backgroundColor: colors.teal }]}>
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
    backgroundColor: colors.teal,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backArrow: { fontSize: 22, color: "#fff" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#fff" },
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
    marginBottom: 0,
    borderWidth: 2,
    borderColor: colors.teal,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 10,
    backgroundColor: colors.card,
    position: "relative",
  },
  input: { fontSize: 15, color: colors.text, height: 28 },
  floatLabel: {
    position: "absolute",
    left: 12,
    fontSize: 14,
    color: colors.teal,
    fontWeight: "500",
  },
  floatLabelCenter: { top: 14 },
  floatLabelUp: { top: 6, fontSize: 12 },

  partyDropdown: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 4,
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
  addNewParty: { fontSize: 14, color: colors.teal, fontWeight: "600" },
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

  amountSection: { marginTop: 16, gap: 0 },
  amountFieldContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 10,
    backgroundColor: colors.card,
    position: "relative",
  },
  currencyPrefix: {
    position: "absolute",
    right: 12,
    bottom: 10,
    fontSize: 13,
    color: colors.textMuted,
  },

  paymentMethodSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 10 },
  paymentMethodRow: { flexDirection: "row", gap: 8 },
  paymentMethodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 4,
  },
  paymentMethodActive: {
    borderColor: colors.teal,
    backgroundColor: "#f0fdfa",
  },
  paymentMethodIcon: { fontSize: 20 },
  paymentMethodText: { fontSize: 11, color: colors.textMuted, fontWeight: "500" },
  paymentMethodTextActive: { color: colors.teal },

  noteFieldContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  noteInput: { height: 72, paddingTop: 12, paddingHorizontal: 12, textAlignVertical: "top" },

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
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  footerBtnPrimaryText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  footerMore: { padding: 10 },
  footerMoreText: { fontSize: 18, color: colors.textMuted },
});

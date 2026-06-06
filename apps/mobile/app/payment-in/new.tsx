import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, Animated, Modal, Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { useParties } from "../../src/useParties";
import { api } from "../../src/auth";

function fmt4(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function OutlinedInput({
  label, value, onChangeText, onFocus, keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  onFocus?: () => void;
  keyboardType?: "default" | "numeric";
}) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  function handleFocus() {
    Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
    setFocused(true);
    onFocus?.();
  }

  function handleBlur() {
    if (!value) {
      Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    }
    setFocused(false);
  }

  const labelTop = anim.interpolate({ inputRange: [0, 1], outputRange: [14, -8] });
  const labelSize = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 11] });
  const labelColor = focused ? colors.primary : colors.textMuted;

  return (
    <View style={[outStyles.wrap, focused && outStyles.wrapFocused]}>
      <Animated.Text style={[outStyles.label, { top: labelTop, fontSize: labelSize, color: labelColor }]}>
        {label}
      </Animated.Text>
      <TextInput
        style={outStyles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const outStyles = StyleSheet.create({
  wrap: {
    borderWidth: 1.5, borderColor: "#cbd5e1", borderRadius: 8,
    paddingHorizontal: 14, paddingTop: 18, paddingBottom: 8,
    position: "relative", backgroundColor: "#fff",
  },
  wrapFocused: { borderColor: colors.primary },
  label: {
    position: "absolute", left: 14, backgroundColor: "#fff",
    paddingHorizontal: 3, color: colors.textMuted,
  },
  input: { fontSize: 14, color: colors.text, paddingVertical: 0 },
});

export default function NewPaymentInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parties } = useParties();
  const params = useLocalSearchParams<{
    prefillPartyId?: string;
    prefillPartyName?: string;
    prefillAmount?: string;
    prefillSaleId?: string;
  }>();

  const [customer, setCustomer] = useState(params.prefillPartyName ?? "");
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(params.prefillPartyId ?? null);
  const [showParties, setShowParties] = useState(false);
  const [received, setReceived] = useState(params.prefillAmount ?? "");
  const [paymentType, setPaymentType] = useState("Cash");
  const [showPaymentTypePicker, setShowPaymentTypePicker] = useState(false);
  const [receiptNo, setReceiptNo] = useState(1);
  const [showReceiptNumEdit, setShowReceiptNumEdit] = useState(false);
  const [receiptNumInput, setReceiptNumInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Date picker
  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  function dateStr() {
    return dateObj.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  }

  const PAYMENT_TYPES = ["Cash", "Card", "UPI", "Bank Transfer", "Cheque", "Online"];

  useEffect(() => {
    api.getTransactionsByType("payment_in")
      .then((txns) => setReceiptNo(txns.length + 1))
      .catch(() => {});
  }, []);

  // Auto-select party from prefill once parties load
  useEffect(() => {
    if (params.prefillPartyId && parties.length > 0 && !selectedPartyId) {
      const p = parties.find((p) => p.id === params.prefillPartyId);
      if (p) { setCustomer(p.name); setSelectedPartyId(p.id); }
    }
  }, [parties]);

  const filtered = parties.filter((p) =>
    p.name.toLowerCase().includes(customer.toLowerCase())
  );
  const selectedParty = parties.find((p) => p.id === selectedPartyId) ?? null;
  const partyBalance = selectedParty?.balance ?? 0;
  const receivedAmt = parseFloat(received.replace(/,/g, "")) || 0;

  async function handleSave(goNew: boolean) {
    if (!selectedPartyId) { Alert.alert("Select a customer"); return; }
    if (receivedAmt <= 0) { Alert.alert("Enter received amount"); return; }
    setSaving(true);
    try {
      await api.createTransaction({
        partyId: selectedPartyId,
        type: "payment_in",
        number: String(receiptNo),
        date: dateObj.toISOString(),
        total: receivedAmt,
        balance: 0,
        notes: JSON.stringify({ paymentType, linkedSaleId: params.prefillSaleId ?? null }),
      });

      // Reduce balance on linked sale invoice
      if (params.prefillSaleId) {
        try {
          const sales = await api.getTransactionsByType("sale");
          const sale = sales.find((t: any) => t.id === params.prefillSaleId);
          if (sale) {
            const newBalance = Math.max(0, sale.balance - receivedAmt);
            await api.updateTransaction(params.prefillSaleId, { balance: newBalance });
          }
        } catch { /* non-fatal */ }
      }

      if (goNew) {
        setCustomer(""); setSelectedPartyId(null); setReceived("");
        setReceiptNo((n) => n + 1);
      } else {
        router.back();
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* White app bar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{params.prefillSaleId ? "Receive Payment" : "Payment-In"}</Text>
        <TouchableOpacity hitSlop={8} onPress={() => router.push("/transaction-settings" as never)}>
          <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Receipt / Date info row */}
      <View style={styles.infoRow}>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>Receipt No.</Text>
          <TouchableOpacity style={styles.infoValueRow} onPress={() => { setReceiptNumInput(String(receiptNo)); setShowReceiptNumEdit(true); }}>
            <Text style={styles.infoValue}>PMT-IN #{receiptNo}</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>Date</Text>
          <TouchableOpacity style={styles.infoValueRow} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.infoValue}>{dateStr()}</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, date) => { setShowDatePicker(false); if (date) setDateObj(date); }}
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {/* Banner when opened from a sale invoice */}
        {params.prefillSaleId && (
          <View style={{ backgroundColor: "#eff6ff", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, borderWidth: 1, borderColor: "#bfdbfe" }}>
            <Ionicons name="link-outline" size={18} color={colors.primary} />
            <Text style={{ flex: 1, fontSize: 13, color: "#1d4ed8", fontWeight: "500" }}>
              Linked to sale invoice · Balance Rs {Number(params.prefillAmount ?? 0).toLocaleString("en-PK")}
            </Text>
          </View>
        )}

        {/* Customer card */}
        <View style={styles.card}>
          {selectedParty && (
            <View style={styles.partyBalanceRow}>
              <Text style={styles.partyBalanceTxt}>
                Party Balance: Rs {fmt4(Math.abs(partyBalance))}
              </Text>
            </View>
          )}
          <OutlinedInput
            label="Customer Name *"
            value={customer}
            onChangeText={(t) => {
              setCustomer(t);
              setShowParties(true);
              if (selectedParty && t !== selectedParty.name) setSelectedPartyId(null);
            }}
            onFocus={() => setShowParties(true)}
          />
        </View>

        {/* Party dropdown */}
        {showParties && filtered.length > 0 && (
          <View style={styles.dropdown}>
            {filtered.slice(0, 6).map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.dropdownRow}
                onPress={() => {
                  setCustomer(p.name);
                  setSelectedPartyId(p.id);
                  setShowParties(false);
                }}
              >
                <View style={styles.partyAvatar}>
                  <Text style={styles.partyAvatarTxt}>{p.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partyName}>{p.name}</Text>
                  {p.phone ? <Text style={styles.partySub}>{p.phone}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={15} color={colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Received + Total Amount card */}
        <View style={[styles.card, { marginTop: 8 }]}>
          {/* Received row */}
          <View style={styles.receivedRow}>
            <Text style={styles.receivedLabel}>Received</Text>
            <TouchableOpacity style={styles.linkBtn}>
              <Ionicons name="link" size={13} color="#1976d2" />
              <Text style={styles.linkTxt}>Link</Text>
            </TouchableOpacity>
            <Text style={styles.rsLabel}>Rs</Text>
            <TextInput
              style={styles.receivedInput}
              value={received}
              onChangeText={setReceived}
              keyboardType="numeric"
              placeholder="0.0000"
              placeholderTextColor={colors.textLight}
            />
          </View>

          <View style={styles.cardDivider} />

          {/* Total Amount row */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.rsLabelTeal}>Rs</Text>
            <Text style={styles.totalAmt}>{fmt4(receivedAmt)}</Text>
          </View>
        </View>

        {/* Payment Type card */}
        <View style={[styles.card, { marginTop: 8 }]}>
          <View style={styles.payTypeRow}>
            <Text style={styles.payTypeLabel}>Payment Type</Text>
            <TouchableOpacity style={styles.payTypeRight} onPress={() => setShowPaymentTypePicker(true)}>
              <Text style={styles.payTypeEmoji}>💵</Text>
              <Text style={styles.payTypeTxt}>{paymentType}</Text>
              <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.addPayTypeRow} onPress={() => setShowPaymentTypePicker(true)}>
            <Text style={styles.addPayTypeTxt}>+ Change Payment Type</Text>
          </TouchableOpacity>
        </View>

        {/* Description card */}
        <View style={[styles.card, { marginTop: 8 }]}>
          <View style={styles.descRow}>
            <TextInput
              style={styles.descInput}
              placeholder="Add Note"
              placeholderTextColor={colors.textLight}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity style={styles.imgUploadBtn}>
              <Ionicons name="add" size={18} color={colors.textMuted} />
              <Ionicons name="image-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.footerSaveNew} onPress={() => handleSave(true)} disabled={saving}>
          <Text style={styles.footerSaveNewTxt}>Save & New</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.footerSave, saving && { opacity: 0.6 }]}
          onPress={() => handleSave(false)}
          disabled={saving}
        >
          <Text style={styles.footerSaveTxt}>{saving ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerMore} hitSlop={8} onPress={() => setShowMore(true)}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Receipt Number Edit Modal */}
      <Modal visible={showReceiptNumEdit} transparent animationType="fade" onRequestClose={() => setShowReceiptNumEdit(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 32 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 20, width: "100%", gap: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Receipt Number</Text>
            <TextInput
              style={{ borderWidth: 1.5, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text }}
              value={receiptNumInput}
              onChangeText={setReceiptNumInput}
              keyboardType="numeric"
              autoFocus
              selectTextOnFocus
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center" }} onPress={() => setShowReceiptNumEdit(false)}>
                <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center" }} onPress={() => { const n = parseInt(receiptNumInput); if (!isNaN(n)) setReceiptNo(n); setShowReceiptNumEdit(false); }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Type Picker Modal */}
      <Modal visible={showPaymentTypePicker} transparent animationType="slide" onRequestClose={() => setShowPaymentTypePicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={() => setShowPaymentTypePicker(false)} />
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 16 }}>Select Payment Type</Text>
          {PAYMENT_TYPES.map((pt) => (
            <TouchableOpacity
              key={pt}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}
              onPress={() => { setPaymentType(pt); setShowPaymentTypePicker(false); }}
            >
              <Text style={{ fontSize: 15, color: colors.text }}>{pt}</Text>
              {paymentType === pt && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* More Options Modal */}
      <Modal visible={showMore} transparent animationType="slide" onRequestClose={() => setShowMore(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={() => setShowMore(false)} />
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 8 }}>MORE OPTIONS</Text>
          {[
            { icon: "share-outline" as const, label: "Share Receipt", action: () => { setShowMore(false); Alert.alert("Share", "Save the receipt first to share."); } },
            { icon: "print-outline" as const, label: "Print Receipt", action: () => { setShowMore(false); Alert.alert("Print", "Save the receipt first to print."); } },
          ].map((opt) => (
            <TouchableOpacity key={opt.label} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }} onPress={opt.action}>
              <Ionicons name={opt.icon} size={20} color={colors.text} />
              <Text style={{ fontSize: 15, color: colors.text }}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={{ paddingVertical: 16, alignItems: "center" }} onPress={() => setShowMore(false)}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.red }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  /* App bar */
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },

  /* Info row */
  infoRow: {
    flexDirection: "row", backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  infoCell: { flex: 1, paddingHorizontal: 16, gap: 3 },
  infoDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  infoLabel: { fontSize: 11, color: colors.textLight, fontWeight: "500" },
  infoValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoValue: { fontSize: 13, fontWeight: "600", color: colors.text },

  body: { padding: 14, paddingBottom: 130, gap: 0 },

  /* Card */
  card: {
    backgroundColor: "#fff",
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden", padding: 14,
  },

  /* Party balance */
  partyBalanceRow: { alignItems: "flex-end", marginBottom: 10 },
  partyBalanceTxt: { fontSize: 12, color: colors.primary, fontWeight: "600" },

  /* Dropdown */
  dropdown: {
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    marginTop: 4, overflow: "hidden",
  },
  dropdownRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa",
  },
  partyAvatar: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: colors.blueLight, alignItems: "center", justifyContent: "center",
  },
  partyAvatarTxt: { fontSize: 13, fontWeight: "700", color: colors.blue },
  partyName: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  partySub: { fontSize: 11, color: colors.textLight, marginTop: 1 },

  /* Received row */
  receivedRow: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 12,
  },
  receivedLabel: { fontSize: 13.5, fontWeight: "600", color: colors.text, minWidth: 72 },
  linkBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderBottomWidth: 1.5, borderBottomColor: "#1976d2", paddingBottom: 1,
  },
  linkTxt: { fontSize: 12.5, color: "#1976d2", fontWeight: "600" },
  rsLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  receivedInput: {
    flex: 1, fontSize: 14, fontWeight: "600", color: colors.text,
    borderBottomWidth: 1.5, borderBottomColor: "#1976d2",
    borderStyle: "dashed", paddingBottom: 3,
    textAlign: "right",
  },

  cardDivider: { height: 1, backgroundColor: "#f0f4f8", marginHorizontal: -14 },

  /* Total row */
  totalRow: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 12,
  },
  totalLabel: { flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.primary },
  rsLabelTeal: { fontSize: 13, color: colors.primary, fontWeight: "500" },
  totalAmt: { fontSize: 14, fontWeight: "700", color: colors.primary },

  /* Payment type */
  payTypeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingBottom: 10,
  },
  payTypeLabel: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  payTypeRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  payTypeEmoji: { fontSize: 15 },
  payTypeTxt: { fontSize: 13, fontWeight: "600", color: colors.text },
  addPayTypeRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f0f4f8" },
  addPayTypeTxt: { fontSize: 13, color: colors.primary, fontWeight: "600" },

  /* Description */
  descRow: { flexDirection: "row", gap: 10 },
  descInput: { flex: 1, fontSize: 13.5, color: colors.text, minHeight: 60 },
  imgUploadBtn: {
    width: 52, height: 52, borderRadius: 8,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 2,
  },

  /* Footer */
  footer: {
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: colors.border,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingTop: 10, gap: 8,
  },
  footerSaveNew: {
    flex: 1, paddingVertical: 13, alignItems: "center",
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
  },
  footerSaveNewTxt: { fontSize: 13.5, fontWeight: "600", color: colors.textSecondary },
  footerSave: {
    flex: 2, paddingVertical: 13, alignItems: "center",
    backgroundColor: "#1976d2", borderRadius: 8,
  },
  footerSaveTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
  footerMore: {
    width: 42, height: 42, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
  },
});

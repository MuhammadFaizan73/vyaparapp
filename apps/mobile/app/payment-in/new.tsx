import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, StyleSheet,
  Alert, Animated, Modal, Platform, BackHandler, ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { useParties } from "../../src/useParties";
import { api } from "../../src/auth";
import type { Transaction } from "@vyapar/api-client";

function fmt4(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmt2(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
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
    editId?: string;
  }>();
  const isEdit = Boolean(params.editId);

  // One key per save attempt, stable across retries of that same attempt — a slow save
  // that times out client-side while the write still lands server-side would otherwise
  // create a second identical payment on retry (see the same fix on Sale's create screen).
  const idempotencyKeyRef = useRef(generateIdempotencyKey());

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

  // Link Payment — lets this payment be allocated against one or more of the party's
  // outstanding sale invoices, reducing each linked invoice's balance on save. Each
  // invoice gets an explicit, user-editable linked amount (not just an auto-split),
  // keyed by invoice id.
  const [partyInvoices, setPartyInvoices] = useState<Transaction[]>([]);
  const [linkedAmounts, setLinkedAmounts] = useState<Record<string, number>>({});
  const [showLinkModal, setShowLinkModal] = useState(false);
  const prefillSeededRef = useRef(false);

  // Date picker
  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  function dateStr() {
    return dateObj.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  }

  const PAYMENT_TYPES = ["Cash", "Card", "UPI", "Bank Transfer", "Cheque", "Online"];

  useEffect(() => {
    if (isEdit) return;
    api.getTransactionsByType("payment_in")
      .then((txns) => setReceiptNo(txns.length + 1))
      .catch(() => {});
  }, [isEdit]);

  // Auto-select party from prefill once parties load
  useEffect(() => {
    if (params.prefillPartyId && parties.length > 0 && !selectedPartyId) {
      const p = parties.find((p) => p.id === params.prefillPartyId);
      if (p) { setCustomer(p.name); setSelectedPartyId(p.id); }
    }
  }, [parties]);

  // Load the existing entry once parties are available (need the list to resolve
  // partyId -> name, since the transaction record itself only carries the id).
  useEffect(() => {
    if (!params.editId || parties.length === 0) return;
    api.getTransaction(params.editId).then((txn) => {
      const party = parties.find((p) => p.id === txn.partyId);
      if (party) { setCustomer(party.name); setSelectedPartyId(party.id); }
      setReceived(String(txn.total));
      setDateObj(new Date(txn.date));
      setReceiptNo(txn.number ? parseInt(txn.number, 10) || 1 : 1);
      try {
        const notes = JSON.parse(txn.notes ?? "{}");
        if (notes.paymentType) setPaymentType(notes.paymentType);
      } catch { /* ignore */ }
    }).catch(() => {
      Alert.alert("Error", "Could not load this payment-in entry.");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.editId, parties.length]);

  const filtered = parties.filter((p) =>
    p.name.toLowerCase().includes(customer.toLowerCase())
  );
  const selectedParty = parties.find((p) => p.id === selectedPartyId) ?? null;
  const partyBalance = selectedParty?.balance ?? 0;
  const receivedAmt = parseFloat(received.replace(/,/g, "")) || 0;

  // Load the party's outstanding sale invoices whenever the party changes, so the Link
  // modal has something to show. When this screen was opened from a Sale row's "Receive
  // Payment" menu (prefillSaleId set), pre-link that one invoice once it shows up here.
  useEffect(() => {
    if (!selectedPartyId) { setPartyInvoices([]); setLinkedAmounts({}); return; }
    api.getPartyTransactions(selectedPartyId)
      .then((txns) => {
        const outstanding = txns.filter((t) => t.type === "sale" && t.balance > 0);
        setPartyInvoices(outstanding);
        if (!isEdit && params.prefillSaleId && !prefillSeededRef.current) {
          const inv = outstanding.find((t) => t.id === params.prefillSaleId);
          if (inv) {
            setLinkedAmounts({ [inv.id]: Math.min(inv.balance, receivedAmt) });
            prefillSeededRef.current = true;
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartyId]);

  const linkedTotal = Object.values(linkedAmounts).reduce((s, v) => s + v, 0);
  const unusedAmt = Math.max(0, receivedAmt - linkedTotal);

  // Deducts each invoice's own entered link amount from its balance (capped at that
  // invoice's balance, in case it changed since the modal was closed).
  async function applyLinkedInvoiceDeductions() {
    for (const [invId, amt] of Object.entries(linkedAmounts)) {
      if (amt <= 0) continue;
      const inv = partyInvoices.find((t) => t.id === invId);
      if (!inv) continue;
      const deduct = Math.min(inv.balance, amt);
      try {
        await api.updateTransaction(invId, { balance: Math.max(0, inv.balance - deduct) });
      } catch { /* non-fatal — other linked invoices should still get deducted */ }
    }
  }

  async function handleSave(goNew: boolean) {
    if (!selectedPartyId) { Alert.alert("Select a customer"); return; }
    if (receivedAmt <= 0) { Alert.alert("Enter received amount"); return; }
    setSaving(true);
    try {
      if (isEdit && params.editId) {
        await api.updateTransaction(params.editId, {
          partyId: selectedPartyId,
          date: dateObj.toISOString(),
          total: receivedAmt,
          balance: unusedAmt,
          notes: JSON.stringify({ paymentType }),
        });
        if (Object.keys(linkedAmounts).length > 0) await applyLinkedInvoiceDeductions();
        router.back();
        return;
      }

      const payment: any = await api.createTransaction({
        partyId: selectedPartyId,
        type: "payment_in",
        number: String(receiptNo),
        date: dateObj.toISOString(),
        total: receivedAmt,
        balance: unusedAmt,
        notes: JSON.stringify({ paymentType }),
        idempotencyKey: idempotencyKeyRef.current,
      });

      // A retry after a perceived failure reuses the same idempotencyKey and gets back
      // the ORIGINAL payment row rather than a new one (see transactions.service.ts) —
      // good, that's the point. But it means this createdAt could be from well before
      // "now" if the first attempt actually succeeded. Only reduce linked invoices when
      // this really is a fresh row; otherwise the first successful call already did it,
      // and doing it again on the replay would deduct the same amount twice.
      const isFreshlyCreated = Date.now() - new Date(payment.createdAt).getTime() < 10000;
      if (Object.keys(linkedAmounts).length > 0 && isFreshlyCreated) {
        await applyLinkedInvoiceDeductions();
      }

      if (goNew) {
        idempotencyKeyRef.current = generateIdempotencyKey();
        setCustomer(""); setSelectedPartyId(null); setReceived("");
        setLinkedAmounts({});
        prefillSeededRef.current = false;
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

  function handleBackPress() {
    if (saving) {
      Alert.alert("Please wait", "This entry is still being saved — leaving now could create a duplicate once it finishes.");
      return;
    }
    router.back();
  }

  // Same fix as Sale's create screen: neither the header back chevron nor Android's
  // hardware/gesture back button was blocked while a save was in flight, so a user
  // leaving mid-save on a slow connection could believe it failed and re-enter it,
  // while the original request kept running and landed too — two real payment rows.
  useEffect(() => {
    if (!saving) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      Alert.alert("Please wait", "This entry is still being saved — leaving now could create a duplicate once it finishes.");
      return true;
    });
    return () => sub.remove();
  }, [saving]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* White app bar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={handleBackPress} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{isEdit ? "Edit Payment-In" : params.prefillSaleId ? "Receive Payment" : "Payment-In"}</Text>
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
            <Ionicons name="calendar-outline" size={13} color={colors.primary} />
            <Text style={styles.infoValue}>{dateStr()}</Text>
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
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => {
                if (!selectedPartyId) { Alert.alert("Select a customer first"); return; }
                if (partyInvoices.length === 0) {
                  Alert.alert("No outstanding invoices", "This customer has no outstanding sale invoices to link.");
                  return;
                }
                setShowLinkModal(true);
              }}
            >
              <Ionicons name="link" size={13} color="#1976d2" />
              <Text style={styles.linkTxt}>Link{Object.keys(linkedAmounts).length > 0 ? ` (${Object.keys(linkedAmounts).length})` : ""}</Text>
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
        {!isEdit && (
          <TouchableOpacity style={styles.footerSaveNew} onPress={() => handleSave(true)} disabled={saving}>
            <Text style={styles.footerSaveNewTxt}>Save & New</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.footerSave, saving && { opacity: 0.6 }]}
          onPress={() => handleSave(false)}
          disabled={saving}
        >
          <Text style={styles.footerSaveTxt}>{saving ? "Saving…" : isEdit ? "Update" : "Save"}</Text>
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

      {/* Link Payment to Invoices Modal */}
      <LinkPaymentModal
        visible={showLinkModal}
        onChangeReceived={setReceived}
        invoices={partyInvoices}
        linkedAmounts={linkedAmounts}
        onDone={(amounts) => { setLinkedAmounts(amounts); setShowLinkModal(false); }}
        onClose={() => setShowLinkModal(false)}
      />

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

      {saving && (
        <View style={styles.savingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.savingOverlayTxt}>Saving…</Text>
        </View>
      )}
    </View>
  );
}

/* ─── Link Payment to Invoices Modal ───────────────────────────────────────
   Full-screen picker: each outstanding sale invoice is a card showing its Invoice
   Number/Total Amount/Current Balance, with an editable "Link Amount" the user can
   type directly (or auto-fill via the checkmark toggle) to allocate this payment
   against it. The header's checkmark icon auto-links everything / clears all; the
   filter icon reveals a search-by-invoice-number bar. */
function LinkPaymentModal({
  visible, onChangeReceived, invoices, linkedAmounts, onDone, onClose,
}: {
  visible: boolean;
  onChangeReceived: (text: string) => void;
  invoices: Transaction[];
  linkedAmounts: Record<string, number>;
  onDone: (amounts: Record<string, number>) => void;
  onClose: () => void;
}) {
  // `selected` (which invoices are checked) and `amounts` (what's typed in each Link
  // Amount box) are kept as separate state — they used to be the same object (keyed
  // presence = both "checked" and "has an amount"), which meant typing into the amount
  // box implicitly checked the row, and then tapping the checkbox to check it "for
  // real" actually unchecked it and deleted the typed amount. Keeping them independent
  // means unchecking a row just excludes it from the result without losing what was typed.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");

  // Reflect the currently-linked amounts each time the modal is (re)opened.
  useEffect(() => {
    if (!visible) return;
    const initAmounts: Record<string, string> = {};
    const initSelected = new Set<string>();
    for (const [id, amt] of Object.entries(linkedAmounts)) {
      initAmounts[id] = String(amt);
      initSelected.add(id);
    }
    setAmounts(initAmounts);
    setSelected(initSelected);
  }, [visible]);

  const filtered = search
    ? invoices.filter((t) => (t.number ?? "").toLowerCase().includes(search.toLowerCase()))
    : invoices;

  const allLinked = invoices.length > 0 && invoices.every((inv) => selected.has(inv.id));

  // There's no separate "total received" budget to divide anymore — the received
  // amount on the main form is now just the sum of whatever gets linked here (see
  // handleDone). So checking a box with nothing typed yet suggests paying that
  // invoice off in full; the user can lower it manually for a partial payment.
  function toggle(inv: Transaction) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(inv.id)) {
        next.delete(inv.id);
      } else {
        next.add(inv.id);
        setAmounts((prevAmounts) => (
          prevAmounts[inv.id] ? prevAmounts : { ...prevAmounts, [inv.id]: String(inv.balance) }
        ));
      }
      return next;
    });
  }

  // Typing a positive amount directly into a row also checks it, so the user doesn't
  // have to separately tap the checkbox after typing.
  function setAmount(id: string, text: string) {
    setAmounts((prev) => ({ ...prev, [id]: text }));
    const n = parseFloat(text) || 0;
    setSelected((prev) => {
      if (n > 0 && !prev.has(id)) { const next = new Set(prev); next.add(id); return next; }
      return prev;
    });
  }

  // Header checkmark — pay every invoice off in full if not all linked yet
  // (leaving already-typed amounts alone), otherwise clear all.
  function toggleAll() {
    if (allLinked) { setSelected(new Set()); return; }
    const nextAmounts: Record<string, string> = { ...amounts };
    for (const inv of invoices) {
      if (!nextAmounts[inv.id]) nextAmounts[inv.id] = String(inv.balance);
    }
    setSelected(new Set(invoices.map((inv) => inv.id)));
    setAmounts(nextAmounts);
  }

  function handleDone() {
    const result: Record<string, number> = {};
    let total = 0;
    for (const id of Array.from(selected)) {
      const n = parseFloat(amounts[id] ?? "0") || 0;
      if (n > 0) { result[id] = n; total += n; }
    }
    onChangeReceived(String(total));
    onDone(result);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={lpmStyles.screen}>
        <View style={lpmStyles.header}>
          <Text style={lpmStyles.title}>Link Payment To Txns</Text>
          <View style={lpmStyles.headerIcons}>
            <TouchableOpacity onPress={toggleAll} hitSlop={8}>
              <Ionicons name="checkmark-circle" size={22} color={allLinked ? colors.primary : "#b7c0cc"} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSearch((v) => !v)} hitSlop={8}>
              <Ionicons name="filter" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {showSearch && (
          <View style={lpmStyles.searchRow}>
            <Ionicons name="search" size={15} color={colors.textMuted} />
            <TextInput
              style={lpmStyles.searchInput}
              placeholder="Search invoice no..."
              placeholderTextColor={colors.textLight}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
        )}

        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={lpmStyles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={lpmStyles.emptyTxt}>No outstanding invoices found</Text>}
          renderItem={({ item: t }) => {
            const isSelected = selected.has(t.id);
            return (
              <View style={lpmStyles.cardWrap}>
                <TouchableOpacity style={lpmStyles.checkBtn} onPress={() => toggle(t)} hitSlop={6}>
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : "checkmark-circle-outline"}
                    size={26}
                    color={isSelected ? colors.primary : "#c7ced6"}
                  />
                </TouchableOpacity>
                <View style={[lpmStyles.card, isSelected && lpmStyles.cardSelected]}>
                  <View style={lpmStyles.cardTopRow}>
                    <Text style={lpmStyles.cardType}>Sale</Text>
                    <Text style={lpmStyles.cardDate}>
                      {new Date(t.date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </Text>
                  </View>
                  <View style={lpmStyles.cardGridRow}>
                    <View style={lpmStyles.cardCol}>
                      <Text style={lpmStyles.cardLbl}>Invoice Number</Text>
                      <Text style={lpmStyles.cardVal}>{t.number ?? "–"}</Text>
                    </View>
                    <View style={lpmStyles.cardCol}>
                      <Text style={lpmStyles.cardLbl}>Total Amount</Text>
                      <Text style={lpmStyles.cardVal}>{fmt2(t.total)}</Text>
                    </View>
                  </View>
                  <View style={lpmStyles.cardGridRow}>
                    <View style={lpmStyles.cardCol}>
                      <Text style={lpmStyles.cardLbl}>Current Balance</Text>
                      <Text style={lpmStyles.cardVal}>{fmt2(t.balance)}</Text>
                    </View>
                    <View style={lpmStyles.cardCol}>
                      <Text style={lpmStyles.cardLbl}>Link Amount</Text>
                      <TextInput
                        style={lpmStyles.linkAmtInput}
                        value={amounts[t.id] ?? ""}
                        onChangeText={(txt) => setAmount(t.id, txt)}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor={colors.textLight}
                      />
                    </View>
                  </View>
                  {isSelected && (
                    <Text style={lpmStyles.remainingTxt}>
                      Remaining Balance: <Text style={lpmStyles.remainingVal}>
                        {fmt2(Math.max(0, t.balance - (parseFloat(amounts[t.id] ?? "0") || 0)))}
                      </Text>
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
        />

        <View style={lpmStyles.footer}>
          <TouchableOpacity style={lpmStyles.cancelBtn} onPress={onClose}>
            <Text style={lpmStyles.cancelBtnTxt}>CANCEL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={lpmStyles.doneBtn} onPress={handleDone}>
            <Text style={lpmStyles.doneBtnTxt}>DONE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const lpmStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#eef1f4", paddingHorizontal: 18, paddingVertical: 16,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#374151" },
  headerIcons: { flexDirection: "row", gap: 18, alignItems: "center" },

  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 18, marginTop: 10, paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: "#f8fafc", borderRadius: 8, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text, padding: 0 },

  list: { padding: 14, gap: 14 },
  emptyTxt: { textAlign: "center", color: colors.textLight, fontSize: 13, paddingVertical: 28 },

  cardWrap: { flexDirection: "row", alignItems: "stretch" },
  checkBtn: {
    width: 24, marginLeft: -12, marginTop: 14, zIndex: 2,
    alignItems: "center", justifyContent: "flex-start",
  },
  card: {
    flex: 1, backgroundColor: "#eef2f4", borderRadius: 10,
    paddingVertical: 14, paddingLeft: 22, paddingRight: 14, gap: 10,
  },
  cardSelected: { backgroundColor: "#e3edf3" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardType: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  cardDate: { fontSize: 13, color: "#4b5563" },
  cardGridRow: { flexDirection: "row" },
  cardCol: { flex: 1 },
  cardLbl: { fontSize: 12, color: "#6b7280", marginBottom: 3 },
  cardVal: { fontSize: 14, color: colors.text },
  linkAmtInput: {
    borderWidth: 1, borderColor: "#94a3b8", borderRadius: 4, backgroundColor: "#fff",
    paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: colors.text,
    maxWidth: 130,
  },
  remainingTxt: { fontSize: 12.5, color: "#6b7280" },
  remainingVal: { fontWeight: "700", color: colors.primary },

  footer: { flexDirection: "row" },
  cancelBtn: { flex: 1, backgroundColor: "#0d4f73", paddingVertical: 16, alignItems: "center" },
  cancelBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: 0.3 },
  doneBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: 16, alignItems: "center" },
  doneBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: 0.3 },
});

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
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center", justifyContent: "center", gap: 12,
  },
  savingOverlayTxt: { fontSize: 14, fontWeight: "600", color: colors.text },
});

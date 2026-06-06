import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import { useParties } from "../../src/useParties";
import { useItems } from "../../src/useItems";

type ItemRow = { id: string; name: string; qty: number; unit: string; mrp: string; rate: number };
const UNITS = ["Pcs", "Kg", "Gm", "L", "ML", "Box", "Pack", "Bag", "Mtr", "Ft", "NONE"];
const PAYMENT_TYPES = ["Cash", "Cheque", "Bank Transfer", "UPI"];

function dateStr(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/* ══════════════════════════════════════════════════════
   ADD ITEM SUB-SCREEN
══════════════════════════════════════════════════════ */
function AddItemScreen({
  catalog, onSave, onSaveNew, onBack,
}: {
  catalog: any[];
  onSave: (item: ItemRow) => void;
  onSaveNew: (item: ItemRow) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("Pcs");
  const [mrp, setMrp] = useState("");
  const [rate, setRate] = useState("");
  const [showUnitDrop, setShowUnitDrop] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);

  const catMatches = catalog.filter((c) =>
    !name.trim() || c.name.toLowerCase().includes(name.toLowerCase())
  );

  function buildItem(): ItemRow | null {
    if (!name.trim()) { Alert.alert("Enter item name"); return null; }
    return {
      id: Date.now().toString(),
      name: name.trim(),
      qty: parseFloat(qty) || 1,
      unit,
      mrp,
      rate: parseFloat(rate) || 0,
    };
  }

  return (
    <View style={[sf.screen, { paddingTop: insets.top }]}>
      <View style={sf.appBar}>
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={sf.appBarTitle}>Add Items to Credit Note</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={sf.scroll}>
        <View style={[sf.field, nameFocused && sf.fieldFocused]}>
          <Text style={[sf.fieldLabel, nameFocused && sf.fieldLabelFocused]}>Item Name</Text>
          <TextInput
            style={sf.fieldInput}
            value={name}
            onChangeText={(t) => { setName(t); setShowCatalog(true); }}
            onFocus={() => { setNameFocused(true); setShowCatalog(true); }}
            onBlur={() => { setNameFocused(false); setTimeout(() => setShowCatalog(false), 150); }}
            placeholder="e.g. Chocolate Cake"
            placeholderTextColor={colors.textLight}
            autoFocus
          />
        </View>

        {showCatalog && catMatches.length > 0 && (
          <View style={sf.catalog}>
            {catMatches.slice(0, 6).map((c) => (
              <TouchableOpacity key={c.id} style={sf.catalogRow}
                onPress={() => { setName(c.name); setRate(String(c.salePrice ?? 0)); setMrp(String(c.mrp ?? "")); setShowCatalog(false); }}>
                <Text style={sf.catalogName}>{c.name}</Text>
                <Text style={sf.catalogPrice}>Rs {c.salePrice ?? 0}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={sf.row}>
          <View style={[sf.field, { flex: 1 }]}>
            <Text style={sf.fieldLabel}>Quantity</Text>
            <TextInput style={sf.fieldInput} value={qty} onChangeText={setQty}
              keyboardType="numeric" placeholder="Quantity" placeholderTextColor={colors.textLight} />
          </View>
          <View style={[sf.field, { flex: 1 }]}>
            <Text style={sf.fieldLabel}>Unit</Text>
            <TouchableOpacity style={sf.unitBtn} onPress={() => setShowUnitDrop((v) => !v)}>
              <Text style={sf.unitTxt}>{unit}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {showUnitDrop && (
              <View style={sf.unitDrop}>
                <ScrollView style={{ maxHeight: 180 }}>
                  {UNITS.map((u) => (
                    <TouchableOpacity key={u} style={sf.unitOption} onPress={() => { setUnit(u); setShowUnitDrop(false); }}>
                      <Text style={[sf.unitOptionTxt, u === unit && sf.unitOptionActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        <View style={sf.field}>
          <Text style={sf.fieldLabel}>MRP</Text>
          <TextInput style={sf.fieldInput} value={mrp} onChangeText={setMrp}
            keyboardType="numeric" placeholder="MRP" placeholderTextColor={colors.textLight} />
        </View>

        <View style={sf.field}>
          <Text style={sf.fieldLabel}>Rate (Price/Unit)</Text>
          <TextInput style={sf.fieldInput} value={rate} onChangeText={setRate}
            keyboardType="numeric" placeholder="Rate (Price/Unit)" placeholderTextColor={colors.textLight} />
        </View>
      </ScrollView>

      <View style={[sf.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={sf.saveNewBtn} onPress={() => { const item = buildItem(); if (item) onSaveNew(item); }}>
          <Text style={sf.saveNewTxt}>Save &amp; New</Text>
        </TouchableOpacity>
        <TouchableOpacity style={sf.saveBtn} onPress={() => { const item = buildItem(); if (item) onSave(item); }}>
          <Text style={sf.saveTxt}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN CREDIT NOTE FORM
══════════════════════════════════════════════════════ */
export default function NewCreditNoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parties } = useParties();
  const { items: catalog } = useItems();

  // Auto-generate return number
  const [returnNo, setReturnNo] = useState(1);
  useEffect(() => {
    api.getTransactionsByType("credit_note")
      .then((txns: any[]) => setReturnNo(txns.length + 1))
      .catch(() => {});
  }, []);

  // Date picker
  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Customer
  const [customer, setCustomer] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const [customerFocused, setCustomerFocused] = useState(false);

  // Original invoice ref
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invNo, setInvNo] = useState("");

  // Items
  const [items, setItems] = useState<ItemRow[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);

  // Tax & Discount
  const [discountPct, setDiscountPct] = useState("");
  const [discountRs, setDiscountRs] = useState("");
  const [roundOff, setRoundOff] = useState(true);

  // Payment
  const [paidAmt, setPaidAmt] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [showPayTypePicker, setShowPayTypePicker] = useState(false);

  // Notes & state
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Computed
  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const totalQty  = items.reduce((s, i) => s + i.qty, 0);
  const discAmt   = discountPct ? (subtotal * parseFloat(discountPct)) / 100 : parseFloat(discountRs) || 0;
  const afterDisc = subtotal - discAmt;
  const roundOffAmt = roundOff ? Math.round(afterDisc) - afterDisc : 0;
  const total     = afterDisc + roundOffAmt;
  const paidAmtVal = parseFloat(paidAmt) || 0;
  const balanceDue = Math.max(0, total - paidAmtVal);

  const filteredParties = parties.filter((p) =>
    !customer.trim() || p.name.toLowerCase().includes(customer.toLowerCase())
  );

  function handleDiscPct(v: string) {
    setDiscountPct(v);
    if (v && subtotal) setDiscountRs(((subtotal * parseFloat(v)) / 100).toFixed(2));
    else setDiscountRs("");
  }
  function handleDiscRs(v: string) {
    setDiscountRs(v);
    if (v && subtotal) setDiscountPct(((parseFloat(v) / subtotal) * 100).toFixed(2));
    else setDiscountPct("");
  }

  async function handleSave(saveAndNew = false) {
    if (!customer.trim()) { Alert.alert("Select a customer"); return; }
    const party = parties.find((p) => p.id === customerId) ?? parties.find((p) => p.name === customer);
    if (!party) { Alert.alert("Select a valid customer from the list"); return; }
    setSaving(true);
    try {
      await api.createTransaction({
        partyId: party.id,
        type: "credit_note",
        number: String(returnNo),
        date: dateObj.toISOString(),
        total,
        balance: balanceDue,
        notes: JSON.stringify({
          items: items.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, mrp: i.mrp, rate: i.rate })),
          discountPct,
          discountRs,
          roundOff: roundOffAmt,
          paidAmt: paidAmtVal,
          paymentType,
          note,
          invoiceDate,
          invNo,
        }),
      });
      if (saveAndNew) {
        router.replace("/credit-note/new");
      } else {
        router.back();
      }
    } catch {
      Alert.alert("Error", "Could not save. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  if (showAddItem) {
    return (
      <AddItemScreen
        catalog={catalog}
        onSave={(item) => { setItems((prev) => [...prev, item]); setShowAddItem(false); }}
        onSaveNew={(item) => { setItems((prev) => [...prev, item]); }}
        onBack={() => setShowAddItem(false)}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.screen, { paddingTop: insets.top }]}>

        {/* App bar */}
        <View style={s.appBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.appBarTitle}>Credit Note</Text>
          <TouchableOpacity hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Return No + Date row */}
        <View style={s.refRow}>
          <View style={s.refCell}>
            <Text style={s.refLabel}>Return No.</Text>
            <View style={s.refValRow}>
              <Text style={s.refVal}>{returnNo}</Text>
            </View>
          </View>
          <View style={s.refDivider} />
          <TouchableOpacity style={s.refCell} onPress={() => setShowDatePicker(true)}>
            <Text style={s.refLabel}>Date</Text>
            <View style={s.refValRow}>
              <Text style={s.refVal}>{dateStr(dateObj)}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* iOS date picker inline */}
        {showDatePicker && Platform.OS === "ios" && (
          <View style={s.datePickerBar}>
            <DateTimePicker
              value={dateObj}
              mode="date"
              display="spinner"
              onChange={(_, d) => { if (d) setDateObj(d); }}
            />
            <TouchableOpacity style={s.datePickerDone} onPress={() => setShowDatePicker(false)}>
              <Text style={s.datePickerDoneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Android date picker modal */}
        {showDatePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={dateObj}
            mode="date"
            display="default"
            onChange={(_, d) => { setShowDatePicker(false); if (d) setDateObj(d); }}
          />
        )}

        <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={s.scroll}>

          {/* Customer Name */}
          <View style={[s.outlinedField, customerFocused && s.outlinedFieldFocused]}>
            <Text style={[s.floatLabel, customerFocused && s.floatLabelFocused]}>Customer Name *</Text>
            <TextInput
              style={s.outlinedInput}
              value={customer}
              onChangeText={(t) => { setCustomer(t); setCustomerId(null); setShowPartyDrop(true); }}
              onFocus={() => { setCustomerFocused(true); setShowPartyDrop(true); }}
              onBlur={() => { setCustomerFocused(false); setTimeout(() => setShowPartyDrop(false), 150); }}
              placeholder=""
              placeholderTextColor={colors.textLight}
            />
          </View>

          {showPartyDrop && filteredParties.length > 0 && (
            <View style={s.partyDrop}>
              {filteredParties.slice(0, 8).map((p) => (
                <TouchableOpacity key={p.id} style={s.partyRow}
                  onPress={() => { setCustomer(p.name); setCustomerId(p.id); setShowPartyDrop(false); }}>
                  <View style={s.partyAvatar}>
                    <Text style={s.partyAvatarTxt}>{p.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.partyName}>{p.name}</Text>
                    {p.phone ? <Text style={s.partyPhone}>{p.phone}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Invoice Date + Inv No row */}
          <View style={s.invoiceRow}>
            <View style={[s.invoiceDateField, { flex: 1 }]}>
              <TextInput
                style={s.invoiceDateInput}
                value={invoiceDate}
                onChangeText={setInvoiceDate}
                placeholder="Invoice Date"
                placeholderTextColor={colors.textMuted}
              />
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
            </View>
            <View style={[s.invNoField, { flex: 1 }]}>
              <TextInput
                style={s.invNoInput}
                value={invNo}
                onChangeText={setInvNo}
                placeholder="Inv No."
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Billed Items */}
          {items.length > 0 && (
            <View style={s.billedCard}>
              <View style={s.billedHeader}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={s.billedHeaderTxt}>Billed Items</Text>
              </View>
              {items.map((item, idx) => (
                <View key={item.id} style={s.billedItem}>
                  <View style={s.billedItemTop}>
                    <View style={s.billedItemNumBadge}>
                      <Text style={s.billedItemNumTxt}>#{idx + 1}</Text>
                    </View>
                    <Text style={s.billedItemName} numberOfLines={1}>{item.name}</Text>
                    <TouchableOpacity onPress={() => setItems((prev) => prev.filter((_, i) => i !== idx))} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                    <Text style={s.billedItemAmt}>Rs {(item.qty * item.rate).toFixed(0)}</Text>
                  </View>
                  <Text style={s.billedItemSub}>Item Subtotal    {item.qty} x {item.rate} = Rs {(item.qty * item.rate).toFixed(0)}</Text>
                </View>
              ))}
              <View style={s.billedSummary}>
                <View style={s.billedSummaryRow}>
                  <Text style={s.billedSummaryTxt}>Total Disc: {discAmt.toFixed(1)}</Text>
                  <Text style={s.billedSummaryTxt}>Total Tax Amt: 0.0</Text>
                </View>
                <View style={s.billedSummaryRow}>
                  <Text style={s.billedSummaryTxt}>Total Qty: {totalQty.toFixed(1)}</Text>
                  <Text style={s.billedSummaryTxt}>Subtotal: {subtotal.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Add Items */}
          <TouchableOpacity style={s.addItemsBtn} onPress={() => setShowAddItem(true)}>
            <Ionicons name="add-circle" size={22} color={colors.primary} />
            <Text style={s.addItemsTxt}>Add Items{items.length === 0 ? " (Optional)" : ""}</Text>
          </TouchableOpacity>

          <View style={s.sectionSep} />

          {/* Tax, Discount & Charges */}
          <Text style={s.sectionHeading}>Tax, Discount &amp; Charges</Text>

          <View style={s.flatRow}>
            <Text style={s.flatLabel}>Discount</Text>
            <View style={s.discRow}>
              <View style={s.discPctBox}>
                <TextInput style={s.discInput} value={discountPct} onChangeText={handleDiscPct}
                  keyboardType="numeric" placeholder="  " placeholderTextColor={colors.textLight} />
                <View style={s.discPctBadge}><Text style={s.discPctBadgeTxt}>%</Text></View>
              </View>
              <View style={s.discRsBox}>
                <Text style={s.discRsLbl}>Rs</Text>
                <TextInput style={s.discInput} value={discountRs} onChangeText={handleDiscRs}
                  keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textLight} />
              </View>
            </View>
          </View>

          <View style={s.flatRow}>
            <Text style={s.flatLabel}>Tax</Text>
            <View style={s.taxRow}>
              <View style={s.taxSelect}>
                <Text style={s.taxSelectTxt}>None</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </View>
              <View style={s.discRsBox}>
                <Text style={s.discRsLbl}>Rs</Text>
                <Text style={s.taxAmtTxt}>0.00</Text>
              </View>
            </View>
          </View>

          <View style={s.flatRow}>
            <TouchableOpacity style={s.roundOffLeft} onPress={() => setRoundOff((v) => !v)}>
              <View style={[s.checkbox, roundOff && s.checkboxActive]}>
                {roundOff && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={s.flatLabel}>Round Off</Text>
            </TouchableOpacity>
            <Text style={s.roundOffAmt}>Rs  {roundOffAmt.toFixed(2)}</Text>
          </View>

          <View style={s.sectionSep} />

          {/* Total Amount */}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total Amount</Text>
            <Text style={s.totalVal}>Rs  {total.toFixed(2)}</Text>
          </View>

          <View style={s.sectionSep} />

          {/* Payment Details */}
          <Text style={s.sectionHeading}>Payment Details</Text>

          <View style={s.flatRow}>
            <Text style={s.flatLabel}>Received (Rs)</Text>
            <TextInput
              style={s.paidInput}
              value={paidAmt}
              onChangeText={setPaidAmt}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textLight}
            />
          </View>

          <TouchableOpacity style={s.flatRow} onPress={() => setShowPayTypePicker(true)}>
            <Text style={s.flatLabel}>Payment Type</Text>
            <View style={s.payTypeRow}>
              <Text style={s.payTypeTxt}>{paymentType}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          <View style={[s.totalRow, { backgroundColor: "#f0f9f5" }]}>
            <Text style={[s.totalLabel, { color: colors.textMuted }]}>Balance Due</Text>
            <Text style={[s.totalVal, { color: balanceDue > 0 ? "#dc2626" : "#16a34a" }]}>
              Rs  {balanceDue.toFixed(2)}
            </Text>
          </View>

          <View style={s.sectionSep} />

          {/* Notes */}
          <View style={s.noteField}>
            <TextInput
              style={s.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Description / Add Note"
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>

        </ScrollView>

        {/* Footer */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={s.saveNewBtn} onPress={() => handleSave(true)} disabled={saving}>
            <Text style={s.saveNewTxt}>Save &amp; New</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.saveBtn} onPress={() => handleSave(false)} disabled={saving}>
            <Text style={s.saveTxt}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.moreBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Payment type modal */}
      <Modal visible={showPayTypePicker} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowPayTypePicker(false)} />
        <View style={s.modalSheet}>
          <Text style={s.modalTitle}>Payment Type</Text>
          {PAYMENT_TYPES.map((pt) => (
            <TouchableOpacity key={pt} style={s.modalOption}
              onPress={() => { setPaymentType(pt); setShowPayTypePicker(false); }}>
              <Text style={[s.modalOptionTxt, pt === paymentType && s.modalOptionActive]}>{pt}</Text>
              {pt === paymentType && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ─── Add Item Screen Styles ─── */
const sf = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  scroll: { padding: 16, gap: 14, paddingBottom: 100 },
  row: { flexDirection: "row", gap: 12 },
  field: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
  },
  fieldFocused: { borderColor: "#1d4ed8", borderWidth: 1.5 },
  fieldLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: "500" },
  fieldLabelFocused: { color: "#1d4ed8" },
  fieldInput: { fontSize: 15, color: colors.text, padding: 0 },
  catalog: {
    backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden",
  },
  catalogRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  catalogName: { fontSize: 13.5, color: colors.text },
  catalogPrice: { fontSize: 13, color: colors.textMuted },
  unitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 },
  unitTxt: { fontSize: 15, color: colors.text },
  unitDrop: {
    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
    backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  unitOption: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  unitOptionTxt: { fontSize: 14, color: colors.text },
  unitOptionActive: { color: colors.primary, fontWeight: "600" },
  footer: {
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingHorizontal: 16, flexDirection: "row", gap: 10,
  },
  saveNewBtn: { flex: 1, paddingVertical: 14, borderRadius: 6, backgroundColor: "#f1f5f9", alignItems: "center" },
  saveNewTxt: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 6, backgroundColor: colors.red, alignItems: "center" },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

/* ─── Main Screen Styles ─── */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f0f2f5" },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  refRow: {
    backgroundColor: "#fff", flexDirection: "row",
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  refCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  refDivider: { width: 1, backgroundColor: colors.border, marginVertical: 6 },
  refLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  refValRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  refVal: { fontSize: 13, fontWeight: "500", color: colors.text },
  datePickerBar: {
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  datePickerDone: { alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: 8 },
  datePickerDoneTxt: { fontSize: 15, fontWeight: "600", color: colors.primary },
  scroll: { paddingBottom: 100 },
  outlinedField: {
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.textMuted,
    borderRadius: 6, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12,
    marginHorizontal: 14, marginTop: 14, marginBottom: 6,
  },
  outlinedFieldFocused: { borderColor: colors.primary },
  floatLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500", marginBottom: 4 },
  floatLabelFocused: { color: colors.primary },
  outlinedInput: { fontSize: 16, color: colors.text, padding: 0, fontWeight: "500" },
  partyDrop: {
    backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden", marginHorizontal: 14, marginBottom: 6,
  },
  partyRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  partyAvatar: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center",
  },
  partyAvatarTxt: { fontSize: 14, fontWeight: "700", color: "#1d4ed8" },
  partyName: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  partyPhone: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  invoiceRow: {
    flexDirection: "row", gap: 10,
    marginHorizontal: 14, marginBottom: 14,
  },
  invoiceDateField: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border,
    borderRadius: 6, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 13,
  },
  invoiceDateInput: { flex: 1, fontSize: 14, color: colors.textMuted, padding: 0 },
  invNoField: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border,
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 13,
  },
  invNoInput: { fontSize: 14, color: colors.textMuted, padding: 0 },
  billedCard: {
    backgroundColor: "#fff", marginHorizontal: 14, marginBottom: 14,
    borderRadius: 6, borderWidth: 1, borderColor: "#d0dce8", overflow: "hidden",
  },
  billedHeader: {
    backgroundColor: "#7ab3d4", flexDirection: "row", alignItems: "center",
    gap: 8, paddingHorizontal: 14, paddingVertical: 10,
  },
  billedHeaderTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
  billedItem: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#e8eef4",
    backgroundColor: "#f5f8fb",
  },
  billedItemTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  billedItemNumBadge: {
    backgroundColor: "#e0eaf4", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  billedItemNumTxt: { fontSize: 10.5, fontWeight: "700", color: "#4a7a9b" },
  billedItemName: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  billedItemAmt: { fontSize: 14, fontWeight: "700", color: colors.text },
  billedItemSub: { fontSize: 12, color: colors.textMuted },
  billedSummary: { paddingHorizontal: 14, paddingVertical: 10 },
  billedSummaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  billedSummaryTxt: { fontSize: 12, color: colors.textMuted },
  addItemsBtn: {
    backgroundColor: "#fff", marginHorizontal: 14, marginBottom: 14,
    borderRadius: 6, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  addItemsTxt: { fontSize: 14, fontWeight: "600", color: colors.primary },
  sectionSep: { height: 10, backgroundColor: "#e8edf2" },
  sectionHeading: {
    fontSize: 14, fontWeight: "600", color: colors.text,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    backgroundColor: "#fff",
  },
  flatRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  flatLabel: { fontSize: 14, color: colors.text, fontWeight: "500" },
  discRow: { flexDirection: "row", gap: 8 },
  discPctBox: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "#f59e0b", borderRadius: 6, overflow: "hidden",
  },
  discInput: { fontSize: 13, color: colors.text, paddingHorizontal: 8, paddingVertical: 6, minWidth: 52 },
  discPctBadge: { backgroundColor: "#f59e0b", paddingHorizontal: 8, paddingVertical: 6 },
  discPctBadgeTxt: { fontSize: 13, color: "#fff", fontWeight: "700" },
  discRsBox: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: colors.border, borderRadius: 6, overflow: "hidden",
    paddingHorizontal: 8,
  },
  discRsLbl: { fontSize: 12, color: colors.textMuted, marginRight: 4 },
  taxRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  taxSelect: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  taxSelectTxt: { fontSize: 13, color: colors.text },
  taxAmtTxt: { fontSize: 13, color: colors.textMuted, paddingVertical: 6 },
  roundOffLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roundOffAmt: { fontSize: 13.5, color: colors.text, fontWeight: "500" },
  totalRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 18,
    backgroundColor: "#fff",
  },
  totalLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
  totalVal: { fontSize: 15, fontWeight: "700", color: colors.text },
  paidInput: {
    fontSize: 14, color: colors.text, fontWeight: "500",
    borderBottomWidth: 1.5, borderBottomColor: colors.primary,
    paddingVertical: 2, paddingHorizontal: 4, minWidth: 80, textAlign: "right",
  },
  payTypeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  payTypeTxt: { fontSize: 14, color: colors.text, fontWeight: "500" },
  noteField: {
    backgroundColor: "#fff", marginHorizontal: 14, marginVertical: 14,
    borderRadius: 6, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  noteInput: { fontSize: 14, color: colors.text, minHeight: 60 },
  footer: {
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingHorizontal: 16, flexDirection: "row", gap: 8, alignItems: "center",
  },
  saveNewBtn: { flex: 1, paddingVertical: 14, borderRadius: 6, alignItems: "center" },
  saveNewTxt: { fontSize: 14, fontWeight: "500", color: colors.textSecondary },
  saveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 6,
    backgroundColor: colors.blue, alignItems: "center",
  },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  moreBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 16, paddingBottom: 40, paddingTop: 20,
  },
  modalTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 12 },
  modalOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalOptionTxt: { fontSize: 15, color: colors.text },
  modalOptionActive: { color: colors.primary, fontWeight: "600" },
});

import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import { useParties } from "../../src/useParties";
import { useItems } from "../../src/useItems";

/* ── types ── */
type ItemRow = { name: string; qty: number; unit: string; mrp: string; rate: number };
const UNITS = ["Pcs", "Kg", "Gm", "L", "ML", "Box", "Pack", "Bag", "Mtr", "Ft", "NONE"];
const PAYMENT_TYPES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card"];

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function todayIso() { return new Date().toISOString().slice(0, 10); }

/* ══════════════════════════════════════════════════════
   ADD ITEM SUB-SCREEN
══════════════════════════════════════════════════════ */
function AddItemScreen({
  title, catalog, onSave, onSaveNew, onBack,
}: {
  title: string;
  catalog: any[];
  onSave: (item: ItemRow) => void;
  onSaveNew: (item: ItemRow) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
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
    return { name: name.trim(), qty: parseFloat(qty) || 1, unit, mrp, rate: parseFloat(rate) || 0 };
  }

  return (
    <View style={[sf.screen, { paddingTop: insets.top }]}>
      <View style={sf.appBar}>
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={sf.appBarTitle}>Add Items to {title}</Text>
        <TouchableOpacity hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={colors.textLight} />
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={sf.scroll}>
        {/* Item Name */}
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

        {/* Qty + Unit row */}
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

        {/* MRP */}
        <View style={sf.field}>
          <Text style={sf.fieldLabel}>MRP</Text>
          <TextInput style={sf.fieldInput} value={mrp} onChangeText={setMrp}
            keyboardType="numeric" placeholder="MRP" placeholderTextColor={colors.textLight} />
        </View>

        {/* Rate */}
        <View style={sf.field}>
          <Text style={sf.fieldLabel}>Rate (Price/Unit)</Text>
          <TextInput style={sf.fieldInput} value={rate} onChangeText={setRate}
            keyboardType="numeric" placeholder="Rate (Price/Unit)" placeholderTextColor={colors.textLight} />
        </View>
      </ScrollView>

      <View style={[sf.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={sf.saveNewBtn} onPress={() => { const item = buildItem(); if (item) onSaveNew(item); }}>
          <Text style={sf.saveNewTxt}>Save & New</Text>
        </TouchableOpacity>
        <TouchableOpacity style={sf.saveBtn} onPress={() => { const item = buildItem(); if (item) onSave(item); }}>
          <Text style={sf.saveTxt}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN SALE ORDER FORM
══════════════════════════════════════════════════════ */
export default function NewSaleOrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parties } = useParties();
  const { items: catalog } = useItems();

  const [orderNo] = useState("1");
  const [dateDisplay] = useState(todayStr());

  /* form fields */
  const [customer, setCustomer] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const [customerFocused, setCustomerFocused] = useState(false);

  const [dueDate, setDueDate] = useState(todayStr());
  const [items, setItems] = useState<ItemRow[]>([]);
  const [discountPct, setDiscountPct] = useState("");
  const [discountRs, setDiscountRs] = useState("");
  const [advanceAmt, setAdvanceAmt] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [showPaymentDrop, setShowPaymentDrop] = useState(false);
  const [note, setNote] = useState("");
  const [roundOff, setRoundOff] = useState(true);
  const [saving, setSaving] = useState(false);

  /* add-item sub-screen */
  const [showAddItem, setShowAddItem] = useState(false);

  /* calculations */
  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const totalQty  = items.reduce((s, i) => s + i.qty, 0);
  const discAmt   = discountPct ? (subtotal * parseFloat(discountPct)) / 100 : parseFloat(discountRs) || 0;
  const afterDisc = subtotal - discAmt;
  const roundOffAmt = roundOff ? Math.round(afterDisc) - afterDisc : 0;
  const total     = afterDisc + roundOffAmt;
  const advance   = parseFloat(advanceAmt) || 0;
  const balanceDue = Math.max(0, total - advance);

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
    setSaving(true);
    try {
      const party = parties.find((p) => p.id === customerId) ?? parties.find((p) => p.name === customer);
      if (!party) { Alert.alert("Select a valid customer from the list"); setSaving(false); return; }
      await api.createTransaction({
        partyId: party.id,
        type: "sale_order",
        number: orderNo,
        date: new Date().toISOString(),
        total,
        balance: balanceDue,
        notes: JSON.stringify({ items, discountPct, discountRs, advanceAmt, paymentType, note, dueDate }),
      });
      if (saveAndNew) { router.replace("/sale-order/new"); }
      else { router.back(); }
    } catch { Alert.alert("Error", "Could not save. Check your connection."); }
    finally { setSaving(false); }
  }

  /* ── Add Item sub-screen ── */
  if (showAddItem) {
    return (
      <AddItemScreen
        title="Sale Order"
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
          <Text style={s.appBarTitle}>Sale Order</Text>
          <TouchableOpacity hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Order No + Date row */}
        <View style={s.refRow}>
          <View style={s.refCell}>
            <Text style={s.refLabel}>Order No.</Text>
            <TouchableOpacity style={s.refValRow}>
              <Text style={s.refVal}>{orderNo}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={s.refDivider} />
          <View style={s.refCell}>
            <Text style={s.refLabel}>Date</Text>
            <TouchableOpacity style={s.refValRow}>
              <Text style={s.refVal}>{dateDisplay}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

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
              placeholder="Customer Name *"
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
                  <Text style={s.partyBalance}>{p.balance ? `Rs ${Math.abs(p.balance).toLocaleString()}` : "—"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Due Date */}
          <View style={s.outlinedField}>
            <Text style={s.floatLabel}>Due Date</Text>
            <View style={s.dueDateRow}>
              <TextInput style={[s.outlinedInput, { flex: 1 }]} value={dueDate}
                onChangeText={setDueDate} placeholder="DD/MM/YYYY" placeholderTextColor={colors.textLight} />
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
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
                <View key={idx} style={s.billedItem}>
                  <View style={s.billedItemTop}>
                    <Text style={s.billedItemNum}>#{idx + 1}</Text>
                    <Text style={s.billedItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.billedItemAmt}>Rs {(item.qty * item.rate).toFixed(0)}</Text>
                  </View>
                  <Text style={s.billedItemSub}>Item Subtotal    {item.qty} × {item.rate} = Rs {(item.qty * item.rate).toFixed(0)}</Text>
                </View>
              ))}
              <View style={s.billedSummary}>
                <View style={s.billedSummaryRow}>
                  <Text style={s.billedSummaryTxt}>Total Disc: {discAmt.toFixed(1)}</Text>
                  <Text style={s.billedSummaryTxt}>Total Tax Amt: 0.0</Text>
                </View>
                <View style={s.billedSummaryRow}>
                  <Text style={s.billedSummaryTxt}>Total Qty: {totalQty.toFixed(1)}</Text>
                  <Text style={s.billedSummaryTxt}>Subtotal: {subtotal.toFixed(4)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Add Items button */}
          <TouchableOpacity style={s.addItemsBtn} onPress={() => setShowAddItem(true)}>
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            <Text style={s.addItemsTxt}>Add Items{items.length === 0 ? " (Optional)" : ""}</Text>
          </TouchableOpacity>

          {/* Tax, Discount & Charges */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Tax, Discount &amp; Charges</Text>

            {/* Discount */}
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>Discount</Text>
              <View style={s.discRow}>
                <View style={s.discPctBox}>
                  <TextInput style={s.discInput} value={discountPct} onChangeText={handleDiscPct}
                    keyboardType="numeric" placeholder="  " placeholderTextColor={colors.textLight} />
                  <View style={s.discPctBadge}><Text style={s.discPctBadgeTxt}>%</Text></View>
                </View>
                <View style={s.discRsBox}>
                  <Text style={s.discRsLbl}>Rs</Text>
                  <TextInput style={s.discInput} value={discountRs} onChangeText={handleDiscRs}
                    keyboardType="numeric" placeholder="0.0000" placeholderTextColor={colors.textLight} />
                </View>
              </View>
            </View>

            {/* Tax */}
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>Tax</Text>
              <View style={s.taxRow}>
                <View style={s.taxSelect}>
                  <Text style={s.taxSelectTxt}>None</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </View>
                <View style={s.discRsBox}>
                  <Text style={s.discRsLbl}>Rs</Text>
                  <Text style={s.taxAmt}>0.0000</Text>
                </View>
              </View>
            </View>

            {/* Round Off */}
            <View style={s.sectionRow}>
              <TouchableOpacity style={s.roundOffLeft} onPress={() => setRoundOff((v) => !v)}>
                <View style={[s.checkbox, roundOff && s.checkboxActive]}>
                  {roundOff && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={s.sectionLabel}>Round Off</Text>
              </TouchableOpacity>
              <Text style={s.roundOffAmt}>Rs  {roundOffAmt.toFixed(4)}</Text>
            </View>
          </View>

          {/* Totals */}
          <View style={s.totalsCard}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total Amount</Text>
              <Text style={s.totalVal}>Rs  {total.toFixed(4)}</Text>
            </View>
            <View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={s.totalLabel}>Advance Amt</Text>
              <View style={s.advanceRow}>
                <Text style={s.totalVal}>Rs  </Text>
                <TextInput style={s.advanceInput} value={advanceAmt} onChangeText={setAdvanceAmt}
                  keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textLight} />
              </View>
            </View>
            <View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={s.balanceLabel}>Balance Due</Text>
              <Text style={s.balanceVal}>Rs  {balanceDue.toFixed(4)}</Text>
            </View>
          </View>

          {/* Payment Type */}
          <View style={s.payCard}>
            <TouchableOpacity style={s.payRow} onPress={() => setShowPaymentDrop((v) => !v)}>
              <Text style={s.payIcon}>💳</Text>
              <Text style={s.payLabel}>Payment Type</Text>
              <View style={{ flex: 1 }} />
              <Text style={s.payVal}>{paymentType}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {showPaymentDrop && (
              <View style={s.payDrop}>
                {PAYMENT_TYPES.map((pt) => (
                  <TouchableOpacity key={pt} style={s.payOption}
                    onPress={() => { setPaymentType(pt); setShowPaymentDrop(false); }}>
                    <Text style={[s.payOptionTxt, pt === paymentType && s.payOptionActive]}>{pt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity style={s.addPayType}>
              <Text style={s.addPayTypeTxt}>+ Add Payment Type</Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View style={s.descCard}>
            <View style={s.descRow}>
              <View style={s.descLeft}>
                <Text style={s.descBorderLabel}>Description</Text>
                <TextInput
                  style={s.descInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add Note"
                  placeholderTextColor={colors.textLight}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <TouchableOpacity style={s.imgPicker}>
                <Ionicons name="add-circle" size={22} color={colors.primary} />
                <Ionicons name="image-outline" size={36} color={colors.border} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.addDocBtn}>
              <Ionicons name="document-outline" size={16} color={colors.textMuted} />
              <Text style={s.addDocTxt}>Add Document</Text>
            </TouchableOpacity>
            <Text style={s.docHint}>Internet is required to upload</Text>
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
  unitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 2,
  },
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
  saveNewBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 6,
    backgroundColor: "#f1f5f9", alignItems: "center",
  },
  saveNewTxt: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 6,
    backgroundColor: colors.red, alignItems: "center",
  },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

/* ─── Main Screen Styles ─── */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
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
  refVal: { fontSize: 13, fontWeight: "600", color: colors.text },
  scroll: { padding: 16, gap: 14, paddingBottom: 100 },

  /* Outlined fields (floating label style) */
  outlinedField: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10,
  },
  outlinedFieldFocused: { borderColor: "#1d4ed8", borderWidth: 1.5 },
  floatLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500", marginBottom: 2 },
  floatLabelFocused: { color: "#1d4ed8" },
  outlinedInput: { fontSize: 15, color: colors.text, padding: 0 },
  dueDateRow: { flexDirection: "row", alignItems: "center" },

  /* Party dropdown */
  partyDrop: {
    backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden",
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
  partyBalance: { fontSize: 12, color: colors.textMuted },

  /* Billed Items */
  billedCard: {
    backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  billedHeader: {
    backgroundColor: "#4a90d9", flexDirection: "row", alignItems: "center",
    gap: 8, paddingHorizontal: 14, paddingVertical: 10,
  },
  billedHeaderTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
  billedItem: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  billedItemTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  billedItemNum: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  billedItemName: { flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.text },
  billedItemAmt: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  billedItemSub: { fontSize: 11.5, color: colors.textMuted },
  billedSummary: {
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: "#f9fafb",
  },
  billedSummaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  billedSummaryTxt: { fontSize: 11.5, color: colors.textMuted },

  /* Add Items */
  addItemsBtn: {
    backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  addItemsTxt: { fontSize: 14, fontWeight: "600", color: colors.primary },

  /* Section (Tax/Discount) */
  section: {
    backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 13.5, fontWeight: "600", color: colors.text,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sectionLabel: { fontSize: 13.5, color: colors.text, fontWeight: "500" },
  discRow: { flexDirection: "row", gap: 8 },
  discPctBox: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "#f59e0b", borderRadius: 6, overflow: "hidden",
  },
  discInput: { fontSize: 13, color: colors.text, paddingHorizontal: 8, paddingVertical: 6, minWidth: 48 },
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
  taxAmt: { fontSize: 13, color: colors.textMuted, paddingVertical: 6 },
  roundOffLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roundOffAmt: { fontSize: 13, color: colors.text, fontWeight: "500" },

  /* Totals */
  totalsCard: {
    backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  totalRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 14,
  },
  totalLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  totalVal: { fontSize: 14, fontWeight: "700", color: colors.text },
  advanceRow: { flexDirection: "row", alignItems: "center" },
  advanceInput: { fontSize: 14, fontWeight: "700", color: colors.text, minWidth: 60, padding: 0 },
  balanceLabel: { fontSize: 14, fontWeight: "600", color: colors.green },
  balanceVal: { fontSize: 14, fontWeight: "700", color: colors.green },

  /* Payment */
  payCard: {
    backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  payRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  payIcon: { fontSize: 18 },
  payLabel: { fontSize: 13.5, fontWeight: "500", color: colors.text },
  payVal: { fontSize: 13.5, fontWeight: "600", color: colors.text, marginRight: 4 },
  payDrop: { borderTopWidth: 1, borderTopColor: colors.border },
  payOption: { paddingHorizontal: 20, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  payOptionTxt: { fontSize: 14, color: colors.text },
  payOptionActive: { color: colors.primary, fontWeight: "700" },
  addPayType: { paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border },
  addPayTypeTxt: { fontSize: 13, color: colors.primary, fontWeight: "500" },

  /* Description */
  descCard: {
    backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    padding: 14,
  },
  descRow: { flexDirection: "row", gap: 10 },
  descLeft: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: 6, padding: 10, minHeight: 80,
  },
  descBorderLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  descInput: { fontSize: 13, color: colors.text, padding: 0 },
  imgPicker: {
    width: 70, height: 80, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 2,
  },
  addDocBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 10, borderWidth: 1, borderColor: colors.border,
    borderRadius: 6, padding: 12, justifyContent: "center",
  },
  addDocTxt: { fontSize: 13, color: colors.textMuted },
  docHint: { fontSize: 10.5, color: colors.textLight, marginTop: 6, textAlign: "center" },

  /* Footer */
  footer: {
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingHorizontal: 16, flexDirection: "row", gap: 8, alignItems: "center",
  },
  saveNewBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 6,
    backgroundColor: "#f1f5f9", alignItems: "center",
  },
  saveNewTxt: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 6,
    backgroundColor: colors.primary, alignItems: "center",
  },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  moreBtn: { padding: 8 },
});

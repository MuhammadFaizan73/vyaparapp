import React, { useState } from "react";
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

type ItemRow = { name: string; qty: number; unit: string; mrp: string; rate: number };
const UNITS = ["Pcs", "Kg", "Gm", "L", "ML", "Box", "Pack", "Bag", "Mtr", "Ft", "NONE"];

function todayStr() {
  const d = new Date();
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
        <Text style={sf.appBarTitle}>Add Items to Purchase</Text>
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
                onPress={() => { setName(c.name); setRate(String(c.purchasePrice ?? c.salePrice ?? 0)); setMrp(String(c.mrp ?? "")); setShowCatalog(false); }}>
                <Text style={sf.catalogName}>{c.name}</Text>
                <Text style={sf.catalogPrice}>Rs {c.purchasePrice ?? c.salePrice ?? 0}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Qty + Unit */}
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
        <TouchableOpacity style={sf.saveNewBtn}
          onPress={() => { const item = buildItem(); if (item) onSaveNew(item); }}>
          <Text style={sf.saveNewTxt}>Save &amp; New</Text>
        </TouchableOpacity>
        <TouchableOpacity style={sf.saveBtn}
          onPress={() => { const item = buildItem(); if (item) onSave(item); }}>
          <Text style={sf.saveTxt}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PURCHASE FORM
══════════════════════════════════════════════════════ */
export default function NewPurchaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parties } = useParties();
  const { items: catalog } = useItems();

  const [billNo] = useState("1");
  const [dateDisplay] = useState(todayStr());

  const [supplier, setSupplier] = useState("");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [selectedParty, setSelectedParty] = useState<any | null>(null);
  const [showPartyDrop, setShowPartyDrop] = useState(false);
  const [supplierFocused, setSupplierFocused] = useState(false);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [discountPct, setDiscountPct] = useState("");
  const [discountRs, setDiscountRs] = useState("");
  const [roundOff, setRoundOff] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [paidAmt, setPaidAmt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const discAmt = discountPct ? (subtotal * parseFloat(discountPct)) / 100 : parseFloat(discountRs) || 0;
  const afterDisc = subtotal - discAmt;
  const roundOffAmt = roundOff ? Math.round(afterDisc) - afterDisc : 0;
  const total = afterDisc + roundOffAmt;
  const paid = isPaid ? (parseFloat(paidAmt) || total) : 0;
  const balance = Math.max(0, total - paid);

  const filteredParties = parties
    .filter((p) => p.partyType === "supplier" || p.partyType === "both" || p.isSystem)
    .filter((p) => !supplier.trim() || p.name.toLowerCase().includes(supplier.toLowerCase()));

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
    if (!supplier.trim()) { Alert.alert("Select a supplier"); return; }
    setSaving(true);
    try {
      const party = parties.find((p) => p.id === supplierId) ?? parties.find((p) => p.name === supplier);
      if (!party) { Alert.alert("Select a valid supplier from the list"); setSaving(false); return; }
      await api.createTransaction({
        partyId: party.id,
        type: "purchase",
        number: billNo,
        date: new Date().toISOString(),
        total,
        balance,
        notes: JSON.stringify({ items, discountPct, discountRs, paidAmt, note }),
      });
      if (saveAndNew) { router.replace("/purchase/new"); }
      else { router.back(); }
    } catch { Alert.alert("Error", "Could not save. Check your connection."); }
    finally { setSaving(false); }
  }

  /* Add Item sub-screen */
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
          <Text style={s.appBarTitle}>Purchase</Text>
          <TouchableOpacity hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Bill No + Date */}
        <View style={s.refRow}>
          <View style={s.refCell}>
            <Text style={s.refLabel}>Bill No.</Text>
            <TouchableOpacity style={s.refValRow}>
              <Text style={s.refVal}>{billNo}</Text>
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

          {/* Party Balance */}
          {selectedParty && (
            <View style={s.partyBalanceRow}>
              <View style={{ flex: 1 }} />
              <Text style={s.partyBalanceLbl}>Party Balance:  </Text>
              <Text style={s.partyBalanceVal}>Rs {Math.abs(selectedParty.balance ?? 0).toFixed(4)}</Text>
            </View>
          )}

          {/* Supplier Name */}
          <View style={[s.outlinedField, supplierFocused && s.outlinedFieldFocused]}>
            <Text style={[s.floatLabel, supplierFocused && s.floatLabelFocused]}>Party Name *</Text>
            <TextInput
              style={s.outlinedInput}
              value={supplier}
              onChangeText={(t) => { setSupplier(t); setSupplierId(null); setSelectedParty(null); setShowPartyDrop(true); }}
              onFocus={() => { setSupplierFocused(true); setShowPartyDrop(true); }}
              onBlur={() => { setSupplierFocused(false); setTimeout(() => setShowPartyDrop(false), 150); }}
              placeholder=""
              placeholderTextColor={colors.textLight}
            />
          </View>

          {showPartyDrop && filteredParties.length > 0 && (
            <View style={s.partyDrop}>
              {filteredParties.slice(0, 8).map((p) => (
                <TouchableOpacity key={p.id} style={s.partyRow}
                  onPress={() => { setSupplier(p.name); setSupplierId(p.id); setSelectedParty(p); setShowPartyDrop(false); }}>
                  <View style={s.partyAvatar}>
                    <Text style={s.partyAvatarTxt}>{p.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.partyName}>{p.name}</Text>
                    {p.phone ? <Text style={s.partyPhone}>{p.phone}</Text> : null}
                  </View>
                  <Text style={s.partyBalanceSmall}>{p.balance ? `Rs ${Math.abs(p.balance).toLocaleString()}` : "—"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

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
                    <View style={s.billedNumBadge}>
                      <Text style={s.billedNumTxt}>#{idx + 1}</Text>
                    </View>
                    <Text style={s.billedItemName} numberOfLines={1}>{item.name}</Text>
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
                  <Text style={s.billedSummaryTxt}>Total Qty:{totalQty.toFixed(1)}</Text>
                  <Text style={s.billedSummaryTxt}>Subtotal: {subtotal.toFixed(4)}</Text>
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
                  keyboardType="numeric" placeholder="0.0000" placeholderTextColor={colors.textLight} />
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
                <Text style={s.taxAmtTxt}>0.0000</Text>
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
            <Text style={s.roundOffAmt}>Rs  {roundOffAmt.toFixed(4)}</Text>
          </View>

          <View style={s.sectionSep} />

          {/* Total Amount */}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total Amount</Text>
            <Text style={s.totalVal}>Rs  {total.toFixed(4)}</Text>
          </View>

          <View style={s.sectionSep} />

          {/* Paid row */}
          <View style={s.paidRow}>
            <TouchableOpacity style={s.paidLeft} onPress={() => setIsPaid((v) => !v)}>
              <View style={[s.checkbox, isPaid && s.checkboxActive]}>
                {isPaid && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={s.flatLabel}>Paid</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.linkBtn}>
              <Ionicons name="link" size={14} color={colors.primary} />
              <Text style={s.linkTxt}>Link</Text>
            </TouchableOpacity>
            <View style={s.paidAmtRow}>
              <Text style={s.paidRs}>Rs</Text>
              <TextInput
                style={[s.paidInput, !isPaid && { color: colors.textLight }]}
                value={isPaid ? paidAmt : ""}
                onChangeText={setPaidAmt}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={colors.textLight}
                editable={isPaid}
              />
            </View>
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
  screen: { flex: 1, backgroundColor: "#f0f2f5" },
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
  fieldFocused: { borderColor: colors.primary, borderWidth: 1.5 },
  fieldLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: "500" },
  fieldLabelFocused: { color: colors.primary },
  fieldInput: { fontSize: 15, color: colors.text, padding: 0 },
  catalog: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
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
  refRow: { backgroundColor: "#fff", flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
  refCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  refDivider: { width: 1, backgroundColor: colors.border, marginVertical: 6 },
  refLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  refValRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  refVal: { fontSize: 13, fontWeight: "500", color: colors.text },
  scroll: { paddingBottom: 100 },

  partyBalanceRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2, backgroundColor: "#fff",
  },
  partyBalanceLbl: { fontSize: 12.5, color: colors.textMuted },
  partyBalanceVal: { fontSize: 12.5, fontWeight: "700", color: colors.green },

  outlinedField: {
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.textMuted,
    borderRadius: 6, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12,
    marginHorizontal: 14, marginBottom: 14,
  },
  outlinedFieldFocused: { borderColor: colors.primary },
  floatLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500", marginBottom: 4 },
  floatLabelFocused: { color: colors.primary },
  outlinedInput: { fontSize: 16, color: colors.text, padding: 0, fontWeight: "500" },

  partyDrop: {
    backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden", marginHorizontal: 14, marginTop: -10, marginBottom: 10,
  },
  partyRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  partyAvatar: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center" },
  partyAvatarTxt: { fontSize: 14, fontWeight: "700", color: "#1d4ed8" },
  partyName: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  partyPhone: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  partyBalanceSmall: { fontSize: 12, color: colors.textMuted },

  billedCard: {
    backgroundColor: "#fff", marginHorizontal: 14, marginBottom: 14,
    borderRadius: 6, borderWidth: 1, borderColor: "#d0dce8", overflow: "hidden",
  },
  billedHeader: {
    backgroundColor: "#7ab3d4", flexDirection: "row", alignItems: "center",
    gap: 8, paddingHorizontal: 14, paddingVertical: 10,
  },
  billedHeaderTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
  billedItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#e8eef4", backgroundColor: "#f5f8fb" },
  billedItemTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  billedNumBadge: { backgroundColor: "#e0eaf4", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  billedNumTxt: { fontSize: 10.5, fontWeight: "700", color: "#4a7a9b" },
  billedItemName: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  billedItemAmt: { fontSize: 14, fontWeight: "700", color: colors.text },
  billedItemSub: { fontSize: 12, color: colors.textMuted },
  billedSummary: { paddingHorizontal: 14, paddingVertical: 10 },
  billedSummaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  billedSummaryTxt: { fontSize: 12, color: colors.textMuted },

  addItemsBtn: {
    backgroundColor: "#fff", marginHorizontal: 14, marginBottom: 14,
    borderRadius: 6, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  addItemsTxt: { fontSize: 14, fontWeight: "600", color: colors.primary },

  sectionSep: { height: 10, backgroundColor: "#e8edf2" },
  sectionHeading: {
    fontSize: 14, fontWeight: "600", color: colors.text,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: "#fff",
  },

  flatRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  flatLabel: { fontSize: 14, color: colors.text, fontWeight: "500" },
  discRow: { flexDirection: "row", gap: 8 },
  discPctBox: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#f59e0b", borderRadius: 6, overflow: "hidden" },
  discInput: { fontSize: 13, color: colors.text, paddingHorizontal: 8, paddingVertical: 6, minWidth: 52 },
  discPctBadge: { backgroundColor: "#f59e0b", paddingHorizontal: 8, paddingVertical: 6 },
  discPctBadgeTxt: { fontSize: 13, color: "#fff", fontWeight: "700" },
  discRsBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 6, overflow: "hidden", paddingHorizontal: 8 },
  discRsLbl: { fontSize: 12, color: colors.textMuted, marginRight: 4 },
  taxRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  taxSelect: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7 },
  taxSelectTxt: { fontSize: 13, color: colors.text },
  taxAmtTxt: { fontSize: 13, color: colors.textMuted, paddingVertical: 6 },
  roundOffLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roundOffAmt: { fontSize: 13.5, color: colors.text, fontWeight: "500" },

  totalRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 18, backgroundColor: "#fff",
  },
  totalLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
  totalVal: { fontSize: 15, fontWeight: "700", color: colors.text },

  paidRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 16, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  paidLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  linkTxt: { fontSize: 12.5, color: colors.primary, fontWeight: "500" },
  paidAmtRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  paidRs: { fontSize: 14, fontWeight: "600", color: colors.text },
  paidInput: { fontSize: 14, fontWeight: "700", color: colors.text, minWidth: 80, textAlign: "right", borderBottomWidth: 1.5, borderBottomColor: colors.border, padding: 0 },

  footer: {
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingHorizontal: 16, flexDirection: "row", gap: 8, alignItems: "center",
  },
  saveNewBtn: { flex: 1, paddingVertical: 14, borderRadius: 6, alignItems: "center" },
  saveNewTxt: { fontSize: 14, fontWeight: "500", color: colors.textSecondary },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 6, backgroundColor: colors.blue, alignItems: "center" },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  moreBtn: { padding: 8 },
});

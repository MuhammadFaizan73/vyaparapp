import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import { useTransactionSettings } from "../../src/useTransactionSettings";
import type { Party, Item } from "@vyapar/api-client";

type LineItem = { id: string; name: string; qty: number; unit: string; mrp: number; rate: number };

function today() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}
function parseNotes(n: string | null | undefined) {
  try { return JSON.parse(n ?? "{}"); } catch { return {}; }
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2,"0")} ${d.toLocaleString("en",{month:"short"})}, ${String(d.getFullYear()).slice(2)}`;
}

const UNITS = ["None","Pcs","Kg","Gm","L","ML","Box","Pack","Bag","Mtr","Ft"];

export default function NewDeliveryNoteScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { settings } = useTransactionSettings();

  const [parties, setParties] = useState<Party[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* form state */
  const [noteNo, setNoteNo] = useState("1");
  const [dateStr, setDateStr] = useState(today());
  const [partyName, setPartyName] = useState("");
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [showDrop, setShowDrop] = useState(false);
  const [dueDate, setDueDate] = useState(today());
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showItems, setShowItems] = useState(false);
  const [discountPct, setDiscountPct] = useState("");
  const [discountRs, setDiscountRs] = useState("");
  const [roundOff, setRoundOff] = useState(true);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  /* link payment */
  const [showLinkPayment, setShowLinkPayment] = useState(false);
  const [partyPayments, setPartyPayments] = useState<any[]>([]);
  const [linkedPayment, setLinkedPayment] = useState<any | null>(null);

  /* add-item modal */
  const [showAddItem, setShowAddItem] = useState(false);
  const [aiName, setAiName] = useState("");
  const [aiQty, setAiQty] = useState("");
  const [aiUnit, setAiUnit] = useState("Pcs");
  const [aiMrp, setAiMrp] = useState("");
  const [aiRate, setAiRate] = useState("");
  const [aiShowCatalog, setAiShowCatalog] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const [ps, items, allTxns] = await Promise.all([
          api.getParties(),
          api.getItems(),
          api.getTransactionsByType("delivery_challan"),
        ]);
        setParties(ps);
        setCatalog(items);
        setNoteNo(String(allTxns.length + (isEdit ? 0 : 1)));
        if (isEdit && id) {
          const txn = allTxns.find((t: any) => t.id === id);
          if (txn) {
            const party = ps.find((p: Party) => p.id === txn.partyId);
            if (party) { setSelectedParty(party); setPartyName(party.name); }
            const notes = parseNotes(txn.notes);
            if (notes.dueDate) {
              const d = new Date(notes.dueDate);
              setDueDate(`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`);
            }
            if (Array.isArray(notes.items) && notes.items.length > 0) {
              setLineItems(notes.items.map((i: any, idx: number) => ({
                id: String(idx), name: i.name, qty: Number(i.qty)||0,
                unit: i.unit||"Pcs", mrp: Number(i.mrp)||0, rate: Number(i.rate)||0,
              })));
              setShowItems(true);
            }
            setDiscountPct(notes.discountPct ?? "");
            setDiscountRs(notes.discountRs ?? "");
            setDescription(notes.description ?? "");
            setNoteNo(txn.number ?? "");
          }
        }
      } catch { /* offline */ } finally { setLoading(false); }
    }
    init();
  }, [id]);

  const filteredParties = parties.filter((p) =>
    p.name.toLowerCase().includes(partyName.toLowerCase())
  );
  const filteredCatalog = catalog.filter((i) =>
    i.name.toLowerCase().includes(aiName.toLowerCase())
  );

  /* totals */
  const subtotal = lineItems.reduce((s, i) => s + i.rate * i.qty, 0);
  const discAmt = discountRs ? parseFloat(discountRs) : (discountPct ? subtotal * parseFloat(discountPct) / 100 : 0);
  const afterDisc = Math.max(0, subtotal - discAmt);
  const rounded = roundOff ? Math.round(afterDisc) - afterDisc : 0;
  const total = Math.max(0, afterDisc + rounded);
  const totalQty = lineItems.reduce((s, i) => s + i.qty, 0);

  function openAddItem(item?: LineItem) {
    if (item) {
      setEditItemId(item.id);
      setAiName(item.name); setAiQty(String(item.qty)); setAiUnit(item.unit);
      setAiMrp(item.mrp ? String(item.mrp) : ""); setAiRate(String(item.rate));
    } else {
      setEditItemId(null);
      setAiName(""); setAiQty(""); setAiUnit("Pcs"); setAiMrp(""); setAiRate("");
    }
    setAiShowCatalog(false);
    setShowAddItem(true);
  }

  function saveItem(andNew = false) {
    if (!aiName.trim()) { Alert.alert("Item name required"); return; }
    const newItem: LineItem = {
      id: editItemId ?? Date.now().toString(),
      name: aiName.trim(), qty: parseFloat(aiQty)||1,
      unit: aiUnit, mrp: parseFloat(aiMrp)||0, rate: parseFloat(aiRate)||0,
    };
    setLineItems((prev) =>
      editItemId
        ? prev.map((i) => i.id === editItemId ? newItem : i)
        : [...prev, newItem]
    );
    setShowItems(true);
    if (andNew) {
      setEditItemId(null);
      setAiName(""); setAiQty(""); setAiUnit("Pcs"); setAiMrp(""); setAiRate("");
    } else {
      setShowAddItem(false);
    }
  }

  function deleteItem(itemId: string) {
    setLineItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  async function openLinkPayment() {
    try {
      const all = await api.getTransactionsByType("payment_in");
      setPartyPayments((all as any[]).filter((p) => p.partyId === selectedParty?.id));
    } catch { setPartyPayments([]); }
    setShowLinkPayment(true);
  }

  async function handleSave() {
    setError("");
    const party = selectedParty ?? parties.find((p) => p.name.toLowerCase() === partyName.toLowerCase());
    if (!party) { setError("Select a valid party."); return; }
    setSaving(true);
    try {
      const dueParts = dueDate.split("/");
      const dueDateISO = dueParts.length === 3
        ? new Date(`${dueParts[2]}-${dueParts[1]}-${dueParts[0]}`).toISOString()
        : new Date().toISOString();
      const notesJson = JSON.stringify({
        items: lineItems.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, mrp: i.mrp, rate: i.rate })),
        dueDate: dueDateISO, discountPct, discountRs, description,
        linkedPaymentId: linkedPayment?.id ?? null,
      });
      if (isEdit && id) {
        await api.updateTransaction(id, { partyId: party.id, total, balance: total, notes: notesJson });
      } else {
        await api.createTransaction({
          partyId: party.id, type: "delivery_challan",
          number: noteNo, date: new Date().toISOString(),
          total, balance: total, notes: notesJson,
        });
      }
      router.back();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Could not save.");
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  /* ── Link Payment screen ── */
  if (showLinkPayment) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.appBar}>
          <TouchableOpacity onPress={() => setShowLinkPayment(false)} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.appBarTitle}>Link Payment to Invoice</Text>
          <View style={{ width: 28 }} />
        </View>
        {partyPayments.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Ionicons name="receipt-outline" size={52} color="#c8d6e5" />
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textMuted }}>No payments found</Text>
            <Text style={{ fontSize: 13, color: colors.textLight }}>Record a Payment-In for this party first</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
            {partyPayments.map((p) => {
              const isSelected = linkedPayment?.id === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.payCard, isSelected && s.payCardActive]}
                  onPress={() => { setLinkedPayment(isSelected ? null : p); setShowLinkPayment(false); }}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>Payment #{p.number}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{fmtDate(p.date)}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#16a34a", marginRight: 8 }}>
                    Rs {p.total.toLocaleString("en-PK", { minimumFractionDigits: 0 })}
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  /* ── Add Item modal overlay ── */
  if (showAddItem) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.appBar}>
          <TouchableOpacity onPress={() => setShowAddItem(false)} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.appBarTitle}>Add Items to Delivery Note</Text>
          <TouchableOpacity hitSlop={8} onPress={() => router.push("/transaction-settings" as never)}>
            <Ionicons name="settings-outline" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={s.scrollContent}>
          {/* Item Name */}
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Item Name</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Chocolate Cake"
              placeholderTextColor={colors.textLight}
              value={aiName}
              onChangeText={(t) => { setAiName(t); setAiShowCatalog(true); }}
              onFocus={() => setAiShowCatalog(true)}
              onBlur={() => setTimeout(() => setAiShowCatalog(false), 150)}
              autoFocus
            />
          </View>
          {aiShowCatalog && filteredCatalog.length > 0 && (
            <View style={s.catalogDrop}>
              {filteredCatalog.slice(0, 6).map((item) => (
                <TouchableOpacity key={item.id} style={s.catalogRow}
                  onPress={() => {
                    setAiName(item.name);
                    setAiMrp(item.mrp ? String(item.mrp) : "");
                    setAiRate(item.salePrice ? String(item.salePrice) : "");
                    setAiUnit(item.unit ?? "Pcs");
                    setAiShowCatalog(false);
                  }}>
                  <Text style={s.catalogName}>{item.name}</Text>
                  {item.salePrice ? <Text style={s.catalogPrice}>Rs {item.salePrice}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Qty + Unit */}
          <View style={s.row2}>
            <View style={[s.inputWrap, { flex: 1 }]}>
              <Text style={s.inputLabel}>Quantity</Text>
              <TextInput style={s.input} placeholder="Quantity" placeholderTextColor={colors.textLight}
                keyboardType="numeric" value={aiQty} onChangeText={setAiQty} />
            </View>
            <View style={[s.inputWrap, { flex: 1 }]}>
              <Text style={s.inputLabel}>Unit</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.unitScroll}>
                {UNITS.map((u) => (
                  <TouchableOpacity key={u} style={[s.unitChip, aiUnit === u && s.unitChipActive]} onPress={() => setAiUnit(u)}>
                    <Text style={[s.unitChipTxt, aiUnit === u && s.unitChipTxtActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* MRP */}
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>MRP</Text>
            <TextInput style={s.input} placeholder="MRP" placeholderTextColor={colors.textLight}
              keyboardType="numeric" value={aiMrp} onChangeText={setAiMrp} />
          </View>

          {/* Rate */}
          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Rate (Price/Unit)</Text>
            <TextInput style={s.input} placeholder="Rate (Price/Unit)" placeholderTextColor={colors.textLight}
              keyboardType="numeric" value={aiRate} onChangeText={setAiRate} />
          </View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={s.saveNewBtn} onPress={() => saveItem(true)}>
            <Text style={s.saveNewTxt}>Save &amp; New</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.saveBtn} onPress={() => saveItem(false)}>
            <Text style={s.saveTxt}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── Main form ── */
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Delivery Note</Text>
        <TouchableOpacity hitSlop={8} onPress={() => router.push("/transaction-settings" as never)}>
          <Ionicons name="settings-outline" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Note No. + Date */}
      <View style={s.refRow}>
        <View style={s.refCell}>
          <Text style={s.refLabel}>Note No.</Text>
          <View style={s.refValRow}>
            <Text style={s.refVal}>{noteNo}</Text>
            <Ionicons name="chevron-down" size={12} color={colors.textLight} />
          </View>
        </View>
        <View style={s.refDiv} />
        <View style={s.refCell}>
          <Text style={s.refLabel}>Date</Text>
          <View style={s.refValRow}>
            <Text style={s.refVal}>{dateStr}</Text>
            <Ionicons name="chevron-down" size={12} color={colors.textLight} />
          </View>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={s.scrollContent}>
        {/* Party */}
        <View style={s.fieldCard}>
          {selectedParty && (
            <Text style={s.partyBalance}>
              Party Balance: <Text style={s.partyBalanceAmt}>Rs {Math.abs(selectedParty.balance).toFixed(4)}</Text>
            </Text>
          )}
          <View style={s.outlined}>
            <Text style={[s.outlinedLabel, { color: colors.primary }]}>Customer Name *</Text>
            <TextInput
              style={s.outlinedInput}
              value={partyName}
              onChangeText={(t) => { setPartyName(t); setSelectedParty(null); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              autoFocus={false}
            />
          </View>
          {showDrop && filteredParties.length > 0 && (
            <View style={s.dropList}>
              {filteredParties.map((p) => (
                <TouchableOpacity key={p.id} style={s.dropRow}
                  onPress={() => { setPartyName(p.name); setSelectedParty(p); setShowDrop(false); }}>
                  <View style={s.dropAvatar}>
                    <Text style={s.dropAvatarTxt}>{p.name[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={s.dropName}>{p.name}</Text>
                  {p.balance !== 0 && (
                    <Text style={[s.dropBal, { color: p.balance > 0 ? colors.red : colors.green }]}>
                      Rs {Math.abs(p.balance).toLocaleString()}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Due Date */}
        <View style={s.outlined}>
          <Text style={s.outlinedLabel}>Due Date</Text>
          <View style={s.dueDateRow}>
            <TextInput
              style={[s.outlinedInput, { flex: 1 }]}
              value={dueDate}
              onChangeText={setDueDate}
              keyboardType="numeric"
            />
            <Ionicons name="calendar-outline" size={20} color={colors.textLight} />
          </View>
        </View>

        {/* Billed Items */}
        {lineItems.length > 0 && (
          <View style={s.billedCard}>
            <TouchableOpacity style={s.billedHeader} onPress={() => setShowItems(!showItems)}>
              <Ionicons name={showItems ? "chevron-down-circle" : "chevron-forward-circle"} size={20} color={colors.primary} />
              <Text style={s.billedTitle}>Billed Items</Text>
            </TouchableOpacity>
            {showItems && lineItems.map((item, i) => (
              <TouchableOpacity key={item.id} style={s.billedItem} onPress={() => openAddItem(item)}>
                <View style={s.billedBadge}><Text style={s.billedBadgeTxt}>#{i + 1}</Text></View>
                <View style={s.billedMid}>
                  <Text style={s.billedName}>{item.name}</Text>
                  <Text style={s.billedSub}>Item Subtotal   {item.qty} x {item.rate} = Rs {(item.qty * item.rate).toFixed(0)}</Text>
                </View>
                <Text style={s.billedAmt}>Rs {item.rate * item.qty}</Text>
              </TouchableOpacity>
            ))}
            {showItems && (
              <View style={s.billedSummary}>
                <Text style={s.billedSumTxt}>Total Disc: {discAmt.toFixed(1)}</Text>
                <Text style={s.billedSumTxt}>Total Tax Amt: 0.0</Text>
                <Text style={s.billedSumTxt}>Total Qty: {totalQty.toFixed(1)}</Text>
                <Text style={s.billedSumTxt}>Subtotal: {subtotal.toFixed(4)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Add Items button */}
        <TouchableOpacity style={s.addItemsBtn} onPress={() => openAddItem()}>
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text style={s.addItemsTxt}>
            {lineItems.length > 0 ? "Add Items" : "Add Items"}{" "}
            {lineItems.length === 0 && <Text style={s.addItemsOpt}>(Optional)</Text>}
          </Text>
        </TouchableOpacity>

        {/* Tax, Discount & Charges */}
        <View style={s.taxCard}>
          <Text style={s.taxTitle}>Tax, Discount &amp; Charges</Text>
          <View style={s.taxRow}>
            <Text style={s.taxLabel}>Discount</Text>
            <View style={s.discRow}>
              <TextInput style={s.discInput} placeholder="" keyboardType="numeric"
                value={discountPct}
                onChangeText={(v) => {
                  setDiscountPct(v);
                  if (v && subtotal) setDiscountRs(((parseFloat(v)/100)*subtotal).toFixed(4));
                }} />
              <View style={s.discPct}><Text style={s.discPctTxt}>%</Text></View>
            </View>
            <View style={s.discRsRow}>
              <Text style={s.discRsLabel}>Rs</Text>
              <TextInput style={s.discInput} placeholder="0.0000" keyboardType="numeric"
                value={discountRs}
                onChangeText={(v) => {
                  setDiscountRs(v);
                  if (v && subtotal) setDiscountPct(((parseFloat(v)/subtotal)*100).toFixed(2));
                }} />
            </View>
          </View>
          <View style={s.taxRow}>
            <Text style={s.taxLabel}>Tax</Text>
            <View style={s.taxSelect}><Text style={s.taxSelectTxt}>None</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textLight} />
            </View>
            <Text style={s.taxAmt}>Rs   0.0000</Text>
          </View>
          <View style={s.taxRow}>
            <Switch
              value={roundOff}
              onValueChange={setRoundOff}
              trackColor={{ false: "#d1d5db", true: colors.primary + "80" }}
              thumbColor={roundOff ? colors.primary : "#9ca3af"}
            />
            <Text style={s.taxLabel}>Round Off</Text>
            <Text style={s.taxAmt}>Rs   {rounded.toFixed(4)}</Text>
          </View>
        </View>

        {/* Total */}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total Amount</Text>
          <Text style={s.totalAmt}>Rs   {total.toFixed(4)}</Text>
        </View>

        {/* Description */}
        <View style={s.descCard}>
          <View style={s.outlined}>
            <Text style={s.outlinedLabel}>Description</Text>
            <TextInput
              style={[s.outlinedInput, { minHeight: 60 }]}
              placeholder="Add Note"
              placeholderTextColor={colors.textLight}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>
        </View>

        {error ? <Text style={s.errorTxt}>{error}</Text> : null}
      </ScrollView>

      {settings.linkPaymentsToInvoices && selectedParty && (
        <>
          {linkedPayment && (
            <View style={s.linkedBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
              <Text style={s.linkedBannerTxt}>
                Linked: Payment #{linkedPayment.number} · Rs {linkedPayment.total.toLocaleString()}
              </Text>
              <TouchableOpacity onPress={() => setLinkedPayment(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#dc2626" />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={s.linkPaymentBar} onPress={openLinkPayment}>
            <Ionicons name="link-outline" size={18} color={colors.primary} />
            <Text style={s.linkPaymentTxt}>
              {linkedPayment ? "Change Linked Payment" : "Link Payment to Invoice"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </>
      )}

      <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={s.saveNewBtn} onPress={() => router.back()}>
          <Text style={s.saveNewTxt}>Save &amp; New</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Save</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.menuDot}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textLight} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f0f2f5" },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },

  refRow: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border },
  refCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  refDiv: { width: 1, backgroundColor: colors.border, marginVertical: 8 },
  refLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500", marginBottom: 4 },
  refValRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  refVal: { fontSize: 14, fontWeight: "600", color: colors.text },

  scrollContent: { padding: 14, gap: 12, paddingBottom: 100 },

  fieldCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border },
  partyBalance: { fontSize: 12, color: colors.textMuted, textAlign: "right" },
  partyBalanceAmt: { color: "#e53935", fontWeight: "600" },

  outlined: {
    backgroundColor: "#fff", borderRadius: 8, borderWidth: 1.5, borderColor: "#d1d5db",
    paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10,
  },
  outlinedLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: "500", marginBottom: 2 },
  outlinedInput: { fontSize: 15, color: colors.text, paddingVertical: 2 },
  dueDateRow: { flexDirection: "row", alignItems: "center" },

  dropList: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    marginTop: 4, overflow: "hidden",
  },
  dropRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f4f6fa" },
  dropAvatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center" },
  dropAvatarTxt: { fontSize: 13, fontWeight: "700", color: "#1d4ed8" },
  dropName: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  dropBal: { fontSize: 12.5, fontWeight: "600" },

  billedCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  billedHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: "#c8dcf0" },
  billedTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  billedItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#f0f2f5" },
  billedBadge: { backgroundColor: "#e5e7eb", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  billedBadgeTxt: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  billedMid: { flex: 1 },
  billedName: { fontSize: 14, fontWeight: "600", color: colors.text },
  billedSub: { fontSize: 11.5, color: colors.textLight, marginTop: 2 },
  billedAmt: { fontSize: 14, fontWeight: "600", color: colors.text },
  billedSummary: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f0f2f5" },
  billedSumTxt: { fontSize: 12, color: colors.textMuted },

  addItemsBtn: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8,
  },
  addItemsTxt: { fontSize: 14.5, fontWeight: "600", color: colors.primary },
  addItemsOpt: { fontSize: 13, fontWeight: "400", color: colors.textMuted },

  taxCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 14 },
  taxTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 4 },
  taxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  taxLabel: { flex: 1, fontSize: 13.5, color: colors.text },
  taxSelect: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  taxSelectTxt: { fontSize: 13, color: colors.text },
  taxAmt: { fontSize: 13, color: colors.textMuted, minWidth: 80, textAlign: "right" },
  discRow: { flexDirection: "row", borderWidth: 1, borderColor: "#f59e0b", borderRadius: 6, overflow: "hidden" },
  discInput: { width: 60, paddingHorizontal: 8, paddingVertical: 7, fontSize: 13, color: colors.text },
  discPct: { backgroundColor: "#f59e0b20", paddingHorizontal: 8, justifyContent: "center" },
  discPctTxt: { fontSize: 13, color: "#f59e0b", fontWeight: "700" },
  discRsRow: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 6, paddingHorizontal: 8 },
  discRsLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },

  totalRow: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  totalLabel: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  totalAmt: { fontSize: 16, fontWeight: "700", color: colors.text },

  descCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14 },
  errorTxt: { fontSize: 13, color: "#dc2626", textAlign: "center" },

  linkPaymentBar: {
    backgroundColor: "#eff6ff", borderTopWidth: 1, borderTopColor: "#bfdbfe",
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  linkPaymentTxt: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.primary },
  linkedBanner: {
    backgroundColor: "#f0fdf4", borderTopWidth: 1, borderTopColor: "#bbf7d0",
    paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  linkedBannerTxt: { flex: 1, fontSize: 13, fontWeight: "500", color: "#15803d" },
  payCard: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#d1d5db",
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center",
  },
  payCardActive: { borderColor: colors.primary, backgroundColor: "#eff6ff" },
  footer: {
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8,
  },
  saveNewBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 8,
    borderWidth: 0, alignItems: "center",
  },
  saveNewTxt: { fontSize: 13.5, fontWeight: "500", color: colors.textMuted },
  saveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 8,
    backgroundColor: colors.primary, alignItems: "center",
  },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  menuDot: { padding: 8 },

  /* Add item screen */
  inputWrap: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10,
  },
  inputLabel: { fontSize: 11.5, color: colors.primary, fontWeight: "500", marginBottom: 4 },
  input: { fontSize: 15, color: colors.text, paddingVertical: 2 },
  row2: { flexDirection: "row", gap: 10 },
  unitScroll: { maxHeight: 40 },
  unitChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, marginRight: 6,
    borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff",
  },
  unitChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitChipTxt: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  unitChipTxtActive: { color: "#fff" },
  catalogDrop: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  catalogRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f4f6fa" },
  catalogName: { fontSize: 14, color: colors.text, fontWeight: "500" },
  catalogPrice: { fontSize: 13, color: colors.primary, fontWeight: "600" },
});

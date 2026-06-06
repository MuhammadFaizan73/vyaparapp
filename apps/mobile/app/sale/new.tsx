import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { useParties } from "../../src/useParties";
import { api } from "../../src/auth";
import { getItems, loadItems, subscribeItems, type Item } from "../../src/itemsStore";

type LineItem = {
  id: string;
  name: string;
  mrp: number;
  qty: number;
  unit: string;
  rate: number;
};

type CompanyOption = { id: string; name: string };

const UNITS = ["NONE", "PCS", "KG", "LTR", "MTR", "BOX", "BAG", "DOZ"];

function fmt4(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function todayString() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function NewSaleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parties } = useParties();
  const params = useLocalSearchParams<{
    fromDeliveryNoteId?: string;
    prefillPartyName?: string;
    prefillPartyId?: string;
    prefillItems?: string;
    prefillNotes?: string;
  }>();

  const [catalog, setCatalog] = useState<Item[]>(getItems());
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyFilters, setSelectedCompanyFilters] = useState<string[]>([]);

  useEffect(() => {
    loadItems();
    api.getTenant().then((tenant) => {
      const mainName = tenant.companyName || tenant.phone || "My Company";
      const extras = Array.isArray(tenant.extraCompanies) ? tenant.extraCompanies : [];
      setCompanies([{ id: "__main__", name: mainName }, ...extras.map((e) => ({ id: e.id, name: e.name }))]);
    }).catch(() => {});
    return subscribeItems(() => setCatalog(getItems()));
  }, []);

  // Invoice number
  const [invoiceNum, setInvoiceNum] = useState(1);
  const [showInvoiceNumEdit, setShowInvoiceNumEdit] = useState(false);
  const [invoiceNumInput, setInvoiceNumInput] = useState("");
  useEffect(() => {
    api.getTransactionsByType("sale").then((txns) => setInvoiceNum(txns.length + 1)).catch(() => {});
  }, []);

  // Date picker
  const [invoiceDateObj, setInvoiceDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  function invoiceDateStr() {
    const d = invoiceDateObj;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  // Shipping address
  const [showShipping, setShowShipping] = useState(false);
  const [shippingExpanded, setShippingExpanded] = useState(false);
  const [shippingAddr, setShippingAddr] = useState("");
  const [shippingCity, setShippingCity] = useState("");

  // More menu
  const [showMore, setShowMore] = useState(false);

  // Attached documents
  const [attachedDocs, setAttachedDocs] = useState<string[]>([]);

  // Form state
  const [mode, setMode] = useState<"credit" | "cash">("credit");
  const [customer, setCustomer] = useState(params.prefillPartyName ?? "");
  const [showParties, setShowParties] = useState(false);
  const invoiceDate = invoiceDateStr();

  const prefillItems: LineItem[] = (() => {
    try {
      const arr = JSON.parse(params.prefillItems ?? "[]");
      return arr.map((i: any, idx: number) => ({
        id: String(idx),
        name: i.name ?? "",
        mrp: Number(i.mrp) || 0,
        qty: Number(i.qty) || 1,
        unit: i.unit ?? "NONE",
        rate: Number(i.rate) || 0,
      }));
    } catch { return []; }
  })();

  const [items, setItems] = useState<LineItem[]>(prefillItems);
  const [billedExpanded, setBilledExpanded] = useState(true);

  // Add Item modal state
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("NONE");
  const [newItemMrp, setNewItemMrp] = useState("");
  const [newItemRate, setNewItemRate] = useState("");
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);

  // Summary state
  const [discountPct, setDiscountPct] = useState("");
  const [discountRs, setDiscountRs] = useState("");
  const [roundOff, setRoundOff] = useState(true);
  const [received, setReceived] = useState(false);
  const [receivedAmt, setReceivedAmt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Computed values
  const selectedParty = parties.find((p) => p.name === customer);
  const filteredParties = parties
    .filter((p) => p.partyType === "customer" || p.partyType === "both" || p.isSystem)
    .filter((p) =>
      p.name.toLowerCase().includes(customer.toLowerCase()) ||
      (p.phone && p.phone.includes(customer))
    );
  const filteredCatalog = catalog.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (c.sku ?? "").toLowerCase().includes(itemSearch.toLowerCase());
    const matchesCompany =
      selectedCompanyFilters.length === 0 ||
      selectedCompanyFilters.some((name) => c.companyTag === name);
    return matchesSearch && matchesCompany;
  });

  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const discountPctVal = parseFloat(discountPct) || 0;
  const discountRsVal = discountPct
    ? (subtotal * discountPctVal) / 100
    : parseFloat(discountRs) || 0;
  const afterDiscount = subtotal - discountRsVal;
  const roundOffAmt = roundOff ? Math.round(afterDiscount) - afterDiscount : 0;
  const total = afterDiscount + roundOffAmt;
  const receivedAmtVal = parseFloat(receivedAmt) || 0;
  const balanceDue = received ? Math.max(0, total - receivedAmtVal) : total;

  function openAddItem() {
    setEditItemId(null);
    setNewItemName(""); setNewItemQty("1"); setNewItemUnit("NONE");
    setNewItemMrp(""); setNewItemRate("");
    setItemSearch(""); setShowCatalog(false);
    setShowAddItem(true);
  }

  function editItem(item: LineItem) {
    setEditItemId(item.id);
    setNewItemName(item.name); setNewItemQty(String(item.qty));
    setNewItemUnit(item.unit);
    setNewItemMrp(item.mrp ? String(item.mrp) : "");
    setNewItemRate(item.rate ? String(item.rate) : "");
    setItemSearch(item.name); setShowCatalog(false);
    setShowAddItem(true);
  }

  function saveItem(andNew: boolean) {
    if (!newItemName.trim()) { Alert.alert("Item Name", "Please enter an item name."); return; }
    const id = editItemId ?? Date.now().toString();
    const item: LineItem = {
      id,
      name: newItemName.trim(),
      mrp: parseFloat(newItemMrp) || 0,
      qty: parseFloat(newItemQty) || 1,
      unit: newItemUnit,
      rate: parseFloat(newItemRate) || 0,
    };
    if (editItemId) {
      setItems((prev) => prev.map((it) => (it.id === editItemId ? item : it)));
    } else {
      setItems((prev) => [...prev, item]);
    }
    if (andNew) {
      setNewItemName(""); setNewItemQty("1"); setNewItemUnit("NONE");
      setNewItemMrp(""); setNewItemRate(""); setItemSearch("");
      setEditItemId(null);
    } else {
      setShowAddItem(false);
    }
  }

  async function handleSave(andNew = false) {
    if (!customer.trim()) { Alert.alert("Missing customer", "Please select a customer."); return; }
    if (!selectedParty) { Alert.alert("Unknown customer", "Select a customer from the list."); return; }
    setSaving(true);
    try {
      const sale: any = await api.createTransaction({
        partyId: selectedParty.id,
        type: "sale",
        date: invoiceDateObj.toISOString(),
        total,
        balance: balanceDue,
        notes: JSON.stringify({
          items: items.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, mrp: i.mrp, rate: i.rate })),
          discount: discountRsVal,
          roundOff: roundOffAmt,
          notes,
        }),
      });

      if (params.fromDeliveryNoteId) {
        try {
          const existing = (() => { try { return JSON.parse(params.prefillNotes ?? "{}"); } catch { return {}; } })();
          await api.updateTransaction(params.fromDeliveryNoteId, {
            balance: 0,
            notes: JSON.stringify({ ...existing, linkedSaleId: sale.id }),
          });
        } catch { /* non-fatal */ }
      }

      if (andNew) {
        setCustomer(""); setItems([]); setDiscountPct(""); setDiscountRs("");
        setRoundOff(true); setReceived(false); setReceivedAmt(""); setNotes("");
      } else {
        router.replace((params.fromDeliveryNoteId ? "/delivery-note" : "/sale") as never);
      }
    } catch (e: any) {
      Alert.alert("Save failed", e?.response?.data?.message || "Could not save invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── App bar ── */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Sale</Text>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "credit" && styles.modeBtnCredit]}
            onPress={() => setMode("credit")}
          >
            <Text style={[styles.modeTxt, mode === "credit" && styles.modeTxtActive]}>Credit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "cash" && styles.modeBtnCash]}
            onPress={() => setMode("cash")}
          >
            <Text style={[styles.modeTxt, mode === "cash" && styles.modeTxtActive]}>Cash</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity hitSlop={8} onPress={() => router.push("/transaction-settings" as never)}>
          <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ── Invoice No + Date row ── */}
      <View style={styles.invoiceInfoRow}>
        <View style={styles.invoiceInfoCell}>
          <Text style={styles.invoiceInfoLabel}>Invoice No.</Text>
          <TouchableOpacity style={styles.invoiceInfoValue} onPress={() => { setInvoiceNumInput(String(invoiceNum)); setShowInvoiceNumEdit(true); }}>
            <Text style={styles.invoiceInfoNum}>{invoiceNum}</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <View style={styles.invoiceInfoDivider} />
        <View style={styles.invoiceInfoCell}>
          <Text style={styles.invoiceInfoLabel}>Date</Text>
          <TouchableOpacity style={styles.invoiceInfoValue} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.invoiceInfoNum}>{invoiceDate}</Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date picker */}
      {showDatePicker && (
        <DateTimePicker
          value={invoiceDateObj}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, date) => { setShowDatePicker(false); if (date) setInvoiceDateObj(date); }}
        />
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Customer ── */}
          <View style={styles.card}>
            {selectedParty != null && (
              <Text style={styles.partyBalance}>
                Party Balance:{" "}
                <Text style={{ color: colors.primary }}>Rs {fmt4(selectedParty.balance)}</Text>
              </Text>
            )}
            <View style={styles.outlinedField}>
              <Text style={styles.outlinedLabel}>Customer *</Text>
              <TextInput
                style={styles.outlinedInput}
                value={customer}
                onChangeText={(t) => { setCustomer(t); setShowParties(true); }}
                onFocus={() => setShowParties(true)}
                placeholder=""
                placeholderTextColor={colors.textLight}
              />
            </View>
            {showParties && (
              <View style={styles.partyDropdown}>
                <TouchableOpacity
                  style={styles.pdRow}
                  onPress={() => { setShowParties(false); router.push("/party/new" as never); }}
                >
                  <View style={styles.pdAddIcon}>
                    <Ionicons name="add" size={14} color={colors.primary} />
                  </View>
                  <Text style={[styles.pdName, { color: colors.primary }]}>Add Party</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pdRow}
                  onPress={() => { setCustomer("Cash Sale"); setShowParties(false); }}
                >
                  <Text style={[styles.pdName, { flex: 1 }]}>Cash Sale</Text>
                  <Text style={styles.pdBalance}>0</Text>
                </TouchableOpacity>
                {filteredParties.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.pdRow}
                    onPress={() => { setCustomer(p.name); setShowParties(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pdName}>{p.name}</Text>
                      {p.phone ? <Text style={styles.pdPhone}>{p.phone}</Text> : null}
                    </View>
                    <Text style={[styles.pdBalance, { color: p.balance > 0 ? colors.red : colors.green }]}>
                      Rs {Math.abs(p.balance).toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── Billed Items ── */}
          {items.length > 0 && (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.billedHeader}
                onPress={() => setBilledExpanded(!billedExpanded)}
              >
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.billedHeaderTxt}>Billed Items</Text>
                <Ionicons
                  name={billedExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#fff"
                  style={{ marginLeft: "auto" as any }}
                />
              </TouchableOpacity>

              {billedExpanded && (
                <View style={styles.billedBody}>
                  {items.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.billedRow}
                      onPress={() => editItem(item)}
                    >
                      <View style={styles.billedRowTop}>
                        <Text style={styles.billedItemName}>
                          #{idx + 1} {item.name}
                        </Text>
                        <Text style={styles.billedItemAmt}>Rs {fmt4(item.qty * item.rate)}</Text>
                      </View>
                      <Text style={styles.billedItemSub}>
                        Item Subtotal &nbsp; {item.qty} × {item.rate} = Rs {fmt4(item.qty * item.rate)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.billedStatRow}>
                    <Text style={styles.billedStat}>Total Disc:{discountRsVal.toFixed(1)}</Text>
                    <Text style={styles.billedStat}>Total Tax Amt:0.0</Text>
                  </View>
                  <View style={styles.billedStatRow}>
                    <Text style={styles.billedStat}>Total Qty:{totalQty.toFixed(1)}</Text>
                    <Text style={styles.billedStat}>Subtotal:{subtotal.toFixed(4)}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── Add Items button ── */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.addItemsBtn} onPress={openAddItem}>
              <View style={styles.addItemsIcon}>
                <Ionicons name="add" size={16} color={colors.primary} />
              </View>
              <Text style={styles.addItemsBtnTxt}>
                + Add Items {items.length === 0 ? "(Optional)" : ""}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Tax, Discount & Charges ── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tax, Discount & Charges</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <View style={styles.discountGroup}>
                <View style={styles.discountBox}>
                  <TextInput
                    style={styles.discountInput}
                    value={discountPct}
                    onChangeText={(v) => {
                      setDiscountPct(v);
                      const pct = parseFloat(v) || 0;
                      setDiscountRs(pct ? ((subtotal * pct) / 100).toFixed(4) : "");
                    }}
                    keyboardType="numeric"
                    placeholder=""
                  />
                  <Text style={styles.discountUnit}>%</Text>
                </View>
                <View style={[styles.discountBox, { borderColor: colors.border }]}>
                  <Text style={styles.discountRs}>Rs</Text>
                  <TextInput
                    style={[styles.discountInput, { flex: 1 }]}
                    value={discountRs}
                    onChangeText={setDiscountRs}
                    keyboardType="numeric"
                    placeholder="0.0000"
                    placeholderTextColor={colors.textLight}
                    editable={!discountPct}
                  />
                </View>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <TouchableOpacity style={styles.taxDropdown}>
                <Text style={styles.taxTxt}>None</Text>
                <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={[styles.taxAmtBox, { opacity: 0.5 }]}>
                <Text style={styles.taxRs}>Rs</Text>
                <Text style={styles.taxAmt}>0.0000</Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <TouchableOpacity style={styles.checkRow} onPress={() => setRoundOff(!roundOff)}>
                <View style={[styles.checkbox, roundOff && styles.checkboxOn]}>
                  {roundOff && <Ionicons name="checkmark" size={10} color="#fff" />}
                </View>
                <Text style={styles.summaryLabel}>Round Off</Text>
              </TouchableOpacity>
              <View style={styles.underlineValue}>
                <Text style={styles.rsLabel}>Rs</Text>
                <Text style={styles.underlineNum}>{roundOffAmt.toFixed(4)}</Text>
              </View>
            </View>
          </View>

          {/* ── Total Amount ── */}
          <View style={[styles.card, styles.totalAmtCard]}>
            <Text style={styles.totalAmtLabel}>Total Amount</Text>
            <View style={styles.totalAmtRight}>
              <Text style={styles.rsLabel}>Rs</Text>
              <Text style={styles.totalAmtVal}>{total ? fmt4(total) : ""}</Text>
            </View>
          </View>

          {/* ── Received + Balance Due ── */}
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <TouchableOpacity style={styles.checkRow} onPress={() => setReceived(!received)}>
                <View style={[styles.checkbox, received && styles.checkboxOn]}>
                  {received && <Ionicons name="checkmark" size={10} color="#fff" />}
                </View>
                <Text style={styles.summaryLabel}>Received</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn}>
                <Ionicons name="link-outline" size={14} color={colors.primary} />
                <Text style={styles.linkTxt}>Link</Text>
              </TouchableOpacity>
              <View style={styles.underlineValue}>
                <Text style={styles.rsLabel}>Rs</Text>
                <TextInput
                  style={styles.underlineInput}
                  value={receivedAmt}
                  onChangeText={setReceivedAmt}
                  keyboardType="numeric"
                  placeholder=""
                  editable={received}
                />
              </View>
            </View>
            <View style={styles.balanceDueRow}>
              <Text style={styles.balanceDueLabel}>Balance Due</Text>
              <View style={styles.underlineValue}>
                <Text style={styles.balanceDueRs}>Rs</Text>
                <Text style={styles.balanceDueVal}>{fmt4(balanceDue)}</Text>
              </View>
            </View>
          </View>

          {/* ── Payment Type ── */}
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment Type</Text>
              <TouchableOpacity style={styles.payTypeBtn}>
                <Ionicons name="cash-outline" size={16} color={colors.green} />
                <Text style={styles.payTypeTxt}>Cash</Text>
                <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.addPayTypeBtn}>
              <Ionicons name="add" size={14} color={colors.primary} />
              <Text style={styles.addPayTypeTxt}>Add Payment Type</Text>
            </TouchableOpacity>
          </View>

          {/* ── Description ── */}
          <View style={styles.card}>
            <View style={styles.notesRow}>
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Description</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add Note"
                  placeholderTextColor={colors.textLight}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <TouchableOpacity style={styles.imageBox}>
                <Ionicons name="add-circle-outline" size={26} color={colors.textMuted} />
                <Ionicons name="image-outline" size={26} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Add Document ── */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.docBtn} onPress={async () => {
              try {
                const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
                if (!result.canceled && result.assets[0]) {
                  setAttachedDocs((prev) => [...prev, result.assets[0].name]);
                }
              } catch { Alert.alert("Error", "Could not open document picker."); }
            }}>
              <Ionicons name="document-outline" size={16} color={colors.textMuted} />
              <Text style={styles.docBtnTxt}>Add Document</Text>
            </TouchableOpacity>
            {attachedDocs.length > 0 && (
              <View style={{ marginTop: 8, gap: 4 }}>
                {attachedDocs.map((doc, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="document-attach-outline" size={14} color={colors.primary} />
                    <Text style={{ flex: 1, fontSize: 12, color: colors.text }}>{doc}</Text>
                    <TouchableOpacity onPress={() => setAttachedDocs((prev) => prev.filter((_, j) => j !== i))}>
                      <Ionicons name="close-circle-outline" size={16} color={colors.red} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.docNote}>Attach PDF, images, or any file</Text>
          </View>

          {/* ── Add Shipping Address ── */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.shippingBtn}
              onPress={() => setShippingExpanded(!shippingExpanded)}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.shippingTxt}>Add Shipping Address</Text>
              <Ionicons name={shippingExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} style={{ marginLeft: "auto" as any }} />
            </TouchableOpacity>
            {shippingExpanded && (
              <View style={{ gap: 10, marginTop: 10 }}>
                <TextInput
                  style={styles.shippingInput}
                  placeholder="Shipping Address"
                  placeholderTextColor={colors.textLight}
                  value={shippingAddr}
                  onChangeText={setShippingAddr}
                  multiline
                />
                <TextInput
                  style={styles.shippingInput}
                  placeholder="City"
                  placeholderTextColor={colors.textLight}
                  value={shippingCity}
                  onChangeText={setShippingCity}
                />
              </View>
            )}
          </View>
        </ScrollView>

        {/* ── Footer ── */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={[styles.saveNewBtn, saving && { opacity: 0.6 }]}
            onPress={() => handleSave(true)}
            disabled={saving}
          >
            <Text style={styles.saveNewTxt}>Save & New</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={() => handleSave(false)}
            disabled={saving}
          >
            <Text style={styles.saveBtnTxt}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreBtn} hitSlop={8} onPress={() => setShowMore(true)}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Invoice Number Edit Modal ── */}
      <Modal visible={showInvoiceNumEdit} transparent animationType="fade" onRequestClose={() => setShowInvoiceNumEdit(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 32 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 20, width: "100%", gap: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Invoice Number</Text>
            <TextInput
              style={{ borderWidth: 1.5, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text }}
              value={invoiceNumInput}
              onChangeText={setInvoiceNumInput}
              keyboardType="numeric"
              autoFocus
              selectTextOnFocus
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center" }} onPress={() => setShowInvoiceNumEdit(false)}>
                <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center" }} onPress={() => { const n = parseInt(invoiceNumInput); if (!isNaN(n)) setInvoiceNum(n); setShowInvoiceNumEdit(false); }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── More Options Modal ── */}
      <Modal visible={showMore} transparent animationType="slide" onRequestClose={() => setShowMore(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={() => setShowMore(false)} />
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 8 }}>MORE OPTIONS</Text>
          {[
            { icon: "copy-outline" as const, label: "Duplicate Invoice", action: () => { setShowMore(false); Alert.alert("Duplicate", "Save this invoice first, then duplicate from the list."); } },
            { icon: "share-outline" as const, label: "Share as WhatsApp", action: () => { setShowMore(false); Alert.alert("Share", "Save the invoice first to share."); } },
            { icon: "print-outline" as const, label: "Print Invoice", action: () => { setShowMore(false); Alert.alert("Print", "Save the invoice first to print."); } },
            { icon: "close-circle-outline" as const, label: "Cancel Invoice", action: () => { setShowMore(false); router.back(); } },
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

      {/* ── Add Items to Sale Modal ── */}
      <Modal
        visible={showAddItem}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowAddItem(false)}
      >
        <View style={[styles.screen, { paddingTop: insets.top }]}>
          <View style={styles.appBar}>
            <TouchableOpacity onPress={() => setShowAddItem(false)} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.appBarTitle}>Add Items to Sale</Text>
            <TouchableOpacity hitSlop={8}>
              <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Company filter chips */}
              {companies.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.companyChip, selectedCompanyFilters.length === 0 && styles.companyChipActive]}
                    onPress={() => setSelectedCompanyFilters([])}
                  >
                    <Text style={[styles.companyChipTxt, selectedCompanyFilters.length === 0 && styles.companyChipTxtActive]}>All</Text>
                  </TouchableOpacity>
                  {companies.map((c) => {
                    const isActive = selectedCompanyFilters.includes(c.name);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.companyChip, isActive && styles.companyChipActive]}
                        onPress={() => setSelectedCompanyFilters((prev) =>
                          isActive ? prev.filter((n) => n !== c.name) : [...prev, c.name]
                        )}
                      >
                        <Text style={[styles.companyChipTxt, isActive && styles.companyChipTxtActive]}>{c.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Item Name */}
              <View style={styles.outlinedField}>
                <Text style={styles.outlinedLabel}>Item Name</Text>
                <TextInput
                  style={styles.outlinedInput}
                  value={newItemName}
                  onChangeText={(t) => {
                    setNewItemName(t);
                    setItemSearch(t);
                    setShowCatalog(t.length > 0);
                  }}
                  placeholder="e.g. Chocolate Cake"
                  placeholderTextColor={colors.textLight}
                  autoFocus
                />
              </View>

              {/* Catalog suggestions */}
              {showCatalog && filteredCatalog.length > 0 && (
                <View style={styles.catalogBox}>
                  {filteredCatalog.slice(0, 6).map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.catalogRow}
                      onPress={() => {
                        setNewItemName(c.name);
                        setNewItemMrp(c.mrp ? String(c.mrp) : "");
                        setNewItemRate(c.salePrice ? String(c.salePrice) : "");
                        setNewItemUnit(c.unit || "NONE");
                        setItemSearch(c.name);
                        setShowCatalog(false);
                      }}
                    >
                      <Text style={styles.catalogName}>{c.name}</Text>
                      {c.salePrice != null && (
                        <Text style={styles.catalogPrice}>Rs {c.salePrice}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Qty + Unit row */}
              <View style={styles.qtyUnitRow}>
                <View style={[styles.outlinedField, { flex: 1 }]}>
                  <Text style={styles.outlinedLabel}>Quantity</Text>
                  <TextInput
                    style={styles.outlinedInput}
                    value={newItemQty}
                    onChangeText={setNewItemQty}
                    keyboardType="numeric"
                    placeholder=""
                  />
                </View>
                <TouchableOpacity
                  style={[styles.outlinedField, { flex: 1 }]}
                  onPress={() => setShowUnitPicker(!showUnitPicker)}
                >
                  <Text style={styles.outlinedLabel}>Unit</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={styles.outlinedInput}>{newItemUnit}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              </View>

              {showUnitPicker && (
                <View style={styles.unitPicker}>
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={styles.unitPickerRow}
                      onPress={() => { setNewItemUnit(u); setShowUnitPicker(false); }}
                    >
                      <Text style={[styles.unitPickerTxt, u === newItemUnit && { color: colors.primary, fontWeight: "700" }]}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* MRP */}
              <View style={styles.outlinedField}>
                <Text style={styles.outlinedLabel}>MRP</Text>
                <TextInput
                  style={styles.outlinedInput}
                  value={newItemMrp}
                  onChangeText={setNewItemMrp}
                  keyboardType="numeric"
                  placeholder=""
                />
              </View>

              {/* Rate */}
              <View style={styles.outlinedField}>
                <Text style={styles.outlinedLabel}>Rate (Price/Unit)</Text>
                <TextInput
                  style={styles.outlinedInput}
                  value={newItemRate}
                  onChangeText={setNewItemRate}
                  keyboardType="numeric"
                  placeholder=""
                />
              </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
              <TouchableOpacity style={styles.saveNewBtn} onPress={() => saveItem(true)}>
                <Text style={styles.saveNewTxt}>Save & New</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtnRed} onPress={() => saveItem(false)}>
                <Text style={styles.saveBtnTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  appBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },

  modeToggle: { flexDirection: "row", borderRadius: 100, overflow: "hidden" },
  modeBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100 },
  modeBtnCredit: { backgroundColor: "#4caf50" },
  modeBtnCash: { backgroundColor: colors.textLight },
  modeTxt: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  modeTxtActive: { color: "#fff" },

  invoiceInfoRow: {
    flexDirection: "row", backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  invoiceInfoCell: { flex: 1, gap: 3 },
  invoiceInfoDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 14, marginVertical: 2 },
  invoiceInfoLabel: { fontSize: 11, color: colors.textMuted },
  invoiceInfoValue: { flexDirection: "row", alignItems: "center", gap: 6 },
  invoiceInfoNum: { fontSize: 15, fontWeight: "600", color: colors.text },

  card: {
    backgroundColor: "#fff", marginTop: 8,
    paddingHorizontal: 16, paddingVertical: 14,
  },

  partyBalance: { fontSize: 12, color: colors.textMuted, textAlign: "right", marginBottom: 8 },

  outlinedField: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 6,
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10,
    backgroundColor: "#fff",
  },
  outlinedLabel: { fontSize: 11, color: colors.primary, fontWeight: "600", marginBottom: 3 },
  outlinedInput: { fontSize: 15, color: colors.text, padding: 0 },

  partyDropdown: {
    marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: "#fff", maxHeight: 240, overflow: "hidden",
    elevation: 3, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6,
  },
  pdRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  pdAddIcon: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  pdName: { fontSize: 13.5, fontWeight: "500", color: colors.text },
  pdPhone: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  pdBalance: { fontSize: 12.5, fontWeight: "600", color: colors.text },

  billedHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#a8d1e7",
    marginHorizontal: -16, marginTop: -14,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  billedHeaderTxt: { fontSize: 13, fontWeight: "600", color: "#fff" },
  billedBody: { marginTop: 12, gap: 6 },
  billedRow: {
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  billedRowTop: { flexDirection: "row", justifyContent: "space-between" },
  billedItemName: { fontSize: 14, fontWeight: "600", color: colors.text },
  billedItemAmt: { fontSize: 14, fontWeight: "600", color: colors.text },
  billedItemSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  billedStatRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  billedStat: { fontSize: 12, color: colors.textMuted },

  addItemsBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    paddingVertical: 14, paddingHorizontal: 16, backgroundColor: "#f8faff",
    justifyContent: "center",
  },
  addItemsIcon: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  addItemsBtnTxt: { fontSize: 15, color: colors.primary, fontWeight: "500" },

  sectionTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 10 },
  summaryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  summaryLabel: { fontSize: 14, color: colors.text, minWidth: 80 },

  discountGroup: { flexDirection: "row", gap: 8, flex: 1, justifyContent: "flex-end" },
  discountBox: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "#f59e0b", borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  discountInput: { fontSize: 13, color: colors.text, minWidth: 44, padding: 0 },
  discountUnit: { fontSize: 12, color: "#f59e0b", fontWeight: "700" },
  discountRs: { fontSize: 12, color: colors.textMuted },

  taxDropdown: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 4,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  taxTxt: { fontSize: 13, color: colors.text },
  taxAmtBox: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 6, marginLeft: "auto" as any,
  },
  taxRs: { fontSize: 12, color: colors.textMuted },
  taxAmt: { fontSize: 13, color: colors.textMuted, minWidth: 48 },

  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 3,
    borderWidth: 1.5, borderColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary },
  rsLabel: { fontSize: 13, color: colors.textMuted },
  underlineValue: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderBottomWidth: 1, borderBottomColor: colors.textLight,
    paddingBottom: 2, marginLeft: "auto" as any, minWidth: 80,
  },
  underlineNum: { fontSize: 13, color: colors.text, textAlign: "right", flex: 1 },
  underlineInput: { fontSize: 13, color: colors.text, textAlign: "right", flex: 1, padding: 0 },

  totalAmtCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 16,
  },
  totalAmtLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  totalAmtRight: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderBottomWidth: 1.5, borderBottomColor: colors.textLight, paddingBottom: 3,
  },
  totalAmtVal: { fontSize: 16, fontWeight: "700", color: colors.text, minWidth: 100, textAlign: "right" },

  linkBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  linkTxt: { fontSize: 12, color: colors.primary, fontWeight: "500" },

  balanceDueRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: 4,
  },
  balanceDueLabel: { fontSize: 15, fontWeight: "700", color: colors.primary },
  balanceDueRs: { fontSize: 14, fontWeight: "600", color: colors.primary },
  balanceDueVal: { fontSize: 15, fontWeight: "700", color: colors.primary },

  payTypeBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto" as any },
  payTypeTxt: { fontSize: 14, color: colors.text, fontWeight: "500" },
  addPayTypeBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 6 },
  addPayTypeTxt: { fontSize: 13, color: colors.primary, fontWeight: "500" },

  notesRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  notesBox: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: 6, padding: 12,
  },
  notesLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  notesInput: { fontSize: 14, color: colors.text, minHeight: 56 },
  imageBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 14, alignItems: "center", justifyContent: "center", gap: 4,
  },

  docBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    paddingVertical: 12, paddingHorizontal: 16, justifyContent: "center",
  },
  docBtnTxt: { fontSize: 13, color: colors.textMuted },
  docNote: { fontSize: 11, color: colors.textLight, marginTop: 6, textAlign: "center" },

  shippingBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  shippingTxt: { fontSize: 14, color: colors.primary, fontWeight: "500", flex: 1 },
  shippingInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text,
  },

  footer: {
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border,
    flexDirection: "row", paddingHorizontal: 16, paddingTop: 12,
    gap: 8, alignItems: "center",
  },
  saveNewBtn: { flex: 1, paddingVertical: 13, alignItems: "center" },
  saveNewTxt: { fontSize: 14, fontWeight: "600", color: colors.text },
  saveBtn: {
    flex: 2, paddingVertical: 13, backgroundColor: colors.primary,
    borderRadius: 4, alignItems: "center",
  },
  saveBtnRed: {
    flex: 2, paddingVertical: 13, backgroundColor: colors.red,
    borderRadius: 4, alignItems: "center",
  },
  saveBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  moreBtn: { paddingHorizontal: 8, paddingVertical: 12 },

  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  companyChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff",
  },
  companyChipActive: { borderColor: colors.primary, backgroundColor: "#e8f4f8" },
  companyChipTxt: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  companyChipTxtActive: { color: colors.primary, fontWeight: "600" },

  catalogBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    backgroundColor: "#fff", overflow: "hidden",
  },
  catalogRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  catalogName: { fontSize: 14, color: colors.text, fontWeight: "500" },
  catalogPrice: { fontSize: 13, color: colors.textMuted },

  qtyUnitRow: { flexDirection: "row", gap: 12 },
  unitPicker: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 6, backgroundColor: "#fff", overflow: "hidden",
  },
  unitPickerRow: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  unitPickerTxt: { fontSize: 14, color: colors.text },
});

import { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Modal,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { addItem, consumePendingUnit, pendingUnit } from "../../src/itemsStore";
import { api } from "../../src/auth";

type TabId = "pricing" | "stock";
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type CompanyOption = { id: string; name: string };

export default function NewItemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isService, setIsService] = useState(false);
  const [tab, setTab] = useState<TabId>("pricing");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [secondaryUnit, setSecondaryUnit] = useState("");
  const [conversionRate, setConversionRate] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [mrp, setMrp] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [openingStock, setOpeningStock] = useState("");
  const [openingStockPrice, setOpeningStockPrice] = useState("");
  const [minStock, setMinStock] = useState("");
  const [saving, setSaving] = useState(false);

  // Company selection
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);

  useFocusEffect(useCallback(() => {
    // Pick up unit data when returning from the unit screen
    if (pendingUnit.ready) {
      const u = consumePendingUnit();
      setUnit(u.primary);
      setSecondaryUnit(u.secondary);
      setConversionRate(u.rate);
    }

    // Load company list
    async function loadCompanies() {
      try {
        const tenant = await api.getTenant();
        const mainName = tenant.companyName || tenant.phone || "My Company";
        const main: CompanyOption = { id: "__main__", name: mainName };
        const extras = Array.isArray(tenant.extraCompanies) ? tenant.extraCompanies : [];
        const all = [main, ...extras.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }))];
        setCompanies(all);
        if (!selectedCompany) setSelectedCompany(main);
      } catch {
        // Offline — keep current selection
      }
    }
    loadCompanies();
  }, []));

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Required", "Item name is required.");
      return;
    }
    setSaving(true);
    try {
      await addItem({
        name: name.trim(),
        sku: itemCode.trim(),
        unit,
        secondaryUnit,
        conversionRate,
        mrp,
        salePrice,
        purchasePrice,
        openingStock,
        minStock,
        companyTag: selectedCompany?.name,
      });
      router.back();
    } catch {
      Alert.alert("Error", "Could not save item. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  const hasUnit = !!unit;
  const hasConversion = hasUnit && !!secondaryUnit && !!conversionRate;
  const unitShort = unit || "Unit";
  const secShort = secondaryUnit || "";

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Add Item</Text>
        <View style={s.appBarRight}>
          <TouchableOpacity hitSlop={10}>
            <Ionicons name="camera-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={10}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Product / Service toggle */}
      <View style={s.typeRow}>
        <TouchableOpacity
          style={[s.typeBtn, !isService && s.typeBtnActive]}
          onPress={() => setIsService(false)}
        >
          <MaterialCommunityIcons
            name={"package-variant-closed" as MCIName}
            size={15}
            color={!isService ? "#fff" : colors.textMuted}
          />
          <Text style={[s.typeBtnTxt, !isService && s.typeBtnTxtActive]}>Product</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.typeBtn, isService && s.typeBtnActive]}
          onPress={() => setIsService(true)}
        >
          <Ionicons name="construct-outline" size={15} color={isService ? "#fff" : colors.textMuted} />
          <Text style={[s.typeBtnTxt, isService && s.typeBtnTxtActive]}>Service</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Company Picker */}
        <TouchableOpacity style={s.companyRow} onPress={() => setShowCompanyPicker(true)} activeOpacity={0.8}>
          <View style={s.companyIcon}>
            <Ionicons name="business-outline" size={16} color={colors.primary} />
          </View>
          <View style={s.companyMid}>
            <Text style={s.companyLabel}>Company</Text>
            <Text style={s.companyValue} numberOfLines={1}>
              {selectedCompany?.name ?? "Select Company"}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Item Name */}
        <View style={s.fieldWrap}>
          <Text style={s.fieldLabel}>Item Name *</Text>
          <View style={s.fieldRow}>
            <TextInput
              style={s.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Panadol Extra 500mg"
              placeholderTextColor={colors.textLight}
              autoFocus
            />
            <TouchableOpacity
              style={s.unitPill}
              onPress={() => router.push({ pathname: "/items/unit", params: { unit, secondaryUnit, conversionRate } } as never)}
            >
              <Text style={s.unitPillTxt} numberOfLines={1}>
                {hasUnit ? unit : "Select Unit"}
              </Text>
              <Ionicons name="chevron-down" size={11} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {hasConversion && (
            <Text style={s.conversionHint}>1 {unitShort} = {conversionRate} {secShort}</Text>
          )}
        </View>

        {/* Item Code */}
        <View style={[s.fieldWrap, { marginTop: 10 }]}>
          <Text style={s.fieldLabel}>Item Code / Barcode</Text>
          <View style={s.fieldRow}>
            <TextInput
              style={s.fieldInput}
              value={itemCode}
              onChangeText={setItemCode}
              placeholder="e.g. PNL-500"
              placeholderTextColor={colors.textLight}
            />
            <TouchableOpacity style={[s.unitPill, { borderColor: colors.textLight }]} onPress={() => setItemCode("ITM-" + Math.random().toString(36).slice(2, 8).toUpperCase())}>
              <Ionicons name="barcode-outline" size={14} color={colors.textMuted} />
              <Text style={[s.unitPillTxt, { color: colors.textMuted }]}>Assign Code</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabBar}>
          <TabBtn label="Pricing" active={tab === "pricing"} onPress={() => setTab("pricing")} />
          <TabBtn label="Stock" active={tab === "stock"} onPress={() => setTab("stock")} />
        </View>

        {tab === "pricing" && (
          <>
            <View style={s.section}>
              <View style={s.sectionHeaderRow}>
                <Text style={s.sectionTitle}>MRP</Text>
                <TouchableOpacity hitSlop={8}>
                  <Ionicons name="information-circle-outline" size={17} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={s.priceRow}>
                <Text style={s.pricePrefix}>₨</Text>
                <TextInput
                  style={s.priceInput}
                  value={mrp}
                  onChangeText={setMrp}
                  placeholder="0.00"
                  placeholderTextColor={colors.textLight}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={[s.section, { marginTop: 10 }]}>
              <Text style={s.sectionTitle}>Sale Price</Text>
              <View style={s.priceRow}>
                <Text style={s.pricePrefix}>₨</Text>
                <TextInput
                  style={s.priceInput}
                  value={salePrice}
                  onChangeText={setSalePrice}
                  placeholder="0.00"
                  placeholderTextColor={colors.textLight}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity style={s.wholesaleRow}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={s.wholesaleTxt}>Add Wholesale Price</Text>
              <View style={s.crownBadge}>
                <MaterialCommunityIcons name={"crown" as MCIName} size={11} color={colors.amber} />
              </View>
            </TouchableOpacity>

            <View style={[s.section, { marginTop: 0 }]}>
              <Text style={s.sectionTitle}>Purchase Price</Text>
              <View style={s.priceRow}>
                <Text style={s.pricePrefix}>₨</Text>
                <TextInput
                  style={s.priceInput}
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  placeholder="0.00"
                  placeholderTextColor={colors.textLight}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </>
        )}

        {tab === "stock" && (
          <>
            <View style={s.section}>
              <Text style={s.sectionTitle}>Opening Stock</Text>
              <View style={s.stockDualRow}>
                <View style={s.stockDualField}>
                  <Text style={s.stockFieldLabel}>Qty ({unitShort})</Text>
                  <TextInput
                    style={s.stockInput}
                    value={openingStock}
                    onChangeText={setOpeningStock}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                </View>
                <View style={s.stockDualDivider} />
                <View style={s.stockDualField}>
                  <Text style={s.stockFieldLabel}>At Price (₨)</Text>
                  <TextInput
                    style={s.stockInput}
                    value={openingStockPrice}
                    onChangeText={setOpeningStockPrice}
                    placeholder="0.00"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            <View style={[s.section, { marginTop: 10 }]}>
              <Text style={s.sectionTitle}>Minimum Stock to Maintain</Text>
              <View style={s.priceRow}>
                <TextInput
                  style={[s.priceInput, { paddingLeft: 16 }]}
                  value={minStock}
                  onChangeText={setMinStock}
                  placeholder={`Min qty in ${unitShort}`}
                  placeholderTextColor={colors.textLight}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.saveBtn, (!name.trim() || saving) && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || !name.trim()}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveBtnTxt}>Save</Text>}
        </TouchableOpacity>
      </View>

      {/* Company Picker Modal */}
      <Modal visible={showCompanyPicker} animationType="slide" transparent onRequestClose={() => setShowCompanyPicker(false)}>
        <View style={s.pickerOverlay}>
          <TouchableOpacity style={s.pickerBackdrop} onPress={() => setShowCompanyPicker(false)} />
          <View style={[s.pickerSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Select Company</Text>

            {companies.map((c) => {
              const isSelected = selectedCompany?.id === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.pickerRow, isSelected && s.pickerRowSelected]}
                  onPress={() => { setSelectedCompany(c); setShowCompanyPicker(false); }}
                  activeOpacity={0.75}
                >
                  <View style={[s.pickerAvatar, isSelected && s.pickerAvatarSelected]}>
                    <Text style={[s.pickerAvatarTxt, isSelected && { color: "#fff" }]}>
                      {c.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[s.pickerName, isSelected && s.pickerNameSelected]}>{c.name}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={s.pickerAddBtn}
              onPress={() => { setShowCompanyPicker(false); router.push("/create-company" as never); }}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={s.pickerAddTxt}>Add Another Company</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[tb.btn, active && tb.btnActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[tb.txt, active && tb.txtActive]}>{label}</Text>
      {active && <View style={tb.underline} />}
    </TouchableOpacity>
  );
}

const tb = StyleSheet.create({
  btn: { flex: 1, alignItems: "center", paddingVertical: 13, position: "relative" },
  btnActive: {},
  txt: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  txtActive: { color: colors.primary },
  underline: { position: "absolute", bottom: 0, left: 16, right: 16, height: 2.5, backgroundColor: colors.primary, borderRadius: 2 },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  appBar: {
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: "#fff" },
  appBarRight: { flexDirection: "row", alignItems: "center", gap: 18 },

  typeRow: {
    backgroundColor: "#fff", flexDirection: "row",
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  typeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 9, borderRadius: 8,
    backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border,
  },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeBtnTxt: { fontSize: 13.5, fontWeight: "600", color: colors.textMuted },
  typeBtnTxtActive: { color: "#fff" },

  body: { padding: 14, paddingBottom: 110, gap: 0 },

  // Company row
  companyRow: {
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.primary + "55",
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", gap: 12,
    marginBottom: 10,
  },
  companyIcon: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: colors.primary + "18",
    alignItems: "center", justifyContent: "center",
  },
  companyMid: { flex: 1 },
  companyLabel: { fontSize: 10, fontWeight: "600", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  companyValue: { fontSize: 14, fontWeight: "600", color: colors.text },

  // Field
  fieldWrap: {
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.border, overflow: "hidden",
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12,
  },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: colors.primaryLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },

  unitPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
    maxWidth: 130,
  },
  unitPillTxt: { fontSize: 12, fontWeight: "600", color: colors.primary, flexShrink: 1 },

  conversionHint: {
    fontSize: 11.5, color: colors.textMuted, marginTop: 8,
    borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 8,
  },

  // Tabs
  tabBar: {
    flexDirection: "row", backgroundColor: "#fff",
    marginTop: 14, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },

  // Sections
  section: {
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: colors.textMuted,
    textTransform: "uppercase", letterSpacing: 0.4,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },
  priceRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingBottom: 12, gap: 4,
  },
  pricePrefix: { fontSize: 16, color: colors.textMuted, fontWeight: "500" },
  priceInput: { flex: 1, fontSize: 16, color: colors.text, padding: 0 },

  wholesaleRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff",
    paddingVertical: 13, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: colors.border,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  wholesaleTxt: { fontSize: 13.5, fontWeight: "600", color: colors.primary },
  crownBadge: {
    backgroundColor: colors.amberLight, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },

  // Stock
  stockDualRow: { flexDirection: "row" },
  stockDualField: { flex: 1, paddingHorizontal: 14, paddingBottom: 12 },
  stockDualDivider: { width: 1, backgroundColor: colors.border, marginVertical: 8 },
  stockFieldLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500", marginBottom: 6 },
  stockInput: { fontSize: 16, color: colors.text, padding: 0 },

  // Footer
  footer: {
    flexDirection: "row", backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingHorizontal: 18, gap: 12,
  },
  cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13 },
  cancelTxt: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  saveBtn: {
    flex: 2, backgroundColor: colors.primary, borderRadius: 8,
    paddingVertical: 14, alignItems: "center",
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: "#cbd5e1", shadowOpacity: 0 },
  saveBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Company picker modal
  pickerOverlay: { flex: 1, justifyContent: "flex-end" },
  pickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  pickerSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 14,
  },
  pickerHandle: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: "#dde0e7",
    alignSelf: "center", marginBottom: 18,
  },
  pickerTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
  pickerRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#f0f2f5",
  },
  pickerRowSelected: { backgroundColor: colors.primary + "08" },
  pickerAvatar: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  pickerAvatarSelected: { backgroundColor: colors.primary },
  pickerAvatarTxt: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
  pickerName: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.text },
  pickerNameSelected: { fontWeight: "700", color: colors.primary },
  pickerAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4,
  },
  pickerAddTxt: { fontSize: 14, fontWeight: "600", color: colors.primary },
});

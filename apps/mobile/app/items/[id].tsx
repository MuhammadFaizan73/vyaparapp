import { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { getItem, updateItem, deleteItem, consumePendingUnit, pendingUnit } from "../../src/itemsStore";

type TabId = "pricing" | "stock";
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export default function ItemDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const item = getItem(id ?? "");

  const [tab, setTab] = useState<TabId>("pricing");
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [secondaryUnit, setSecondaryUnit] = useState(item?.secondaryUnit ?? "");
  const [conversionRate, setConversionRate] = useState(item?.conversionRate ?? "");
  const [itemCode, setItemCode] = useState(item?.sku ?? "");
  const [mrp, setMrp] = useState(item?.mrp != null ? String(item.mrp) : "");
  const [salePrice, setSalePrice] = useState(item?.salePrice != null ? String(item.salePrice) : "");
  const [purchasePrice, setPurchasePrice] = useState(item?.purchasePrice != null ? String(item.purchasePrice) : "");
  const [openingStock, setOpeningStock] = useState(item?.openingStock != null ? String(item.openingStock) : "");
  const [openingStockPrice, setOpeningStockPrice] = useState("");
  const [minStock, setMinStock] = useState(item?.minStock != null ? String(item.minStock) : "");
  const [saving, setSaving] = useState(false);

  // Pick up unit data when returning from the unit screen
  useFocusEffect(
    useCallback(() => {
      if (pendingUnit.ready) {
        const u = consumePendingUnit();
        setUnit(u.primary);
        setSecondaryUnit(u.secondary);
        setConversionRate(u.rate);
      }
    }, [])
  );

  if (!item) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.appBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.appBarTitle}>Edit Item</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.notFound}>
          <Ionicons name="cube-outline" size={48} color={colors.textLight} />
          <Text style={s.notFoundTxt}>Item not found</Text>
        </View>
      </View>
    );
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert("Required", "Item name is required."); return; }
    setSaving(true);
    try {
      await updateItem(id!, { name: name.trim(), sku: itemCode, unit, secondaryUnit, conversionRate, mrp, salePrice, purchasePrice, openingStock, minStock });
      router.back();
    } catch {
      Alert.alert("Error", "Could not save item. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert("Delete Item", `Remove "${item.name}" from catalog?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try { await deleteItem(id!); } catch { /* ignore */ }
          router.back();
        }
      },
    ]);
  }

  const hasUnit = !!unit;
  const hasConversion = hasUnit && !!secondaryUnit && !!conversionRate;
  const unitShort = unit || "Unit";

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Edit Item</Text>
        <View style={s.appBarRight}>
          <TouchableOpacity onPress={handleDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={20} color="#ffcdd2" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
            <Text style={s.conversionHint}>1 {unit} = {conversionRate} {secondaryUnit}</Text>
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
            {/* MRP */}
            <View style={s.section}>
              <View style={s.sectionHeaderRow}>
                <Text style={s.sectionTitle}>MRP</Text>
                <TouchableOpacity hitSlop={8}>
                  <Ionicons name="information-circle-outline" size={17} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={s.priceRow}>
                <Text style={s.pricePrefix}>₨</Text>
                <TextInput style={s.priceInput} value={mrp} onChangeText={setMrp} placeholder="0.00" placeholderTextColor={colors.textLight} keyboardType="numeric" />
              </View>
            </View>

            {/* Sale Price */}
            <View style={[s.section, { marginTop: 10 }]}>
              <Text style={s.sectionTitle}>Sale Price</Text>
              <View style={s.priceRow}>
                <Text style={s.pricePrefix}>₨</Text>
                <TextInput style={s.priceInput} value={salePrice} onChangeText={setSalePrice} placeholder="0.00" placeholderTextColor={colors.textLight} keyboardType="numeric" />
              </View>
            </View>

            {/* Wholesale */}
            <TouchableOpacity style={s.wholesaleRow}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={s.wholesaleTxt}>Add Wholesale Price</Text>
              <View style={s.crownBadge}>
                <MaterialCommunityIcons name={"crown" as MCIName} size={11} color={colors.amber} />
              </View>
            </TouchableOpacity>

            {/* Purchase Price */}
            <View style={[s.section, { marginTop: 0 }]}>
              <Text style={s.sectionTitle}>Purchase Price</Text>
              <View style={s.priceRow}>
                <Text style={s.pricePrefix}>₨</Text>
                <TextInput style={s.priceInput} value={purchasePrice} onChangeText={setPurchasePrice} placeholder="0.00" placeholderTextColor={colors.textLight} keyboardType="numeric" />
              </View>
            </View>
          </>
        )}

        {tab === "stock" && (
          <>
            {/* Current Stock */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Current Stock</Text>
              <View style={s.stockDualRow}>
                <View style={s.stockDualField}>
                  <Text style={s.stockFieldLabel}>Qty ({unitShort})</Text>
                  <TextInput style={s.stockInput} value={openingStock} onChangeText={setOpeningStock} placeholder="0" placeholderTextColor={colors.textLight} keyboardType="numeric" />
                </View>
                <View style={s.stockDualDivider} />
                <View style={s.stockDualField}>
                  <Text style={s.stockFieldLabel}>At Price (₨)</Text>
                  <TextInput style={s.stockInput} value={openingStockPrice} onChangeText={setOpeningStockPrice} placeholder="0.00" placeholderTextColor={colors.textLight} keyboardType="numeric" />
                </View>
              </View>
            </View>

            {/* Min Stock */}
            <View style={[s.section, { marginTop: 10 }]}>
              <Text style={s.sectionTitle}>Minimum Stock to Maintain</Text>
              <View style={s.priceRow}>
                <TextInput style={[s.priceInput, { paddingLeft: 0 }]} value={minStock} onChangeText={setMinStock} placeholder={`Min qty in ${unitShort}`} placeholderTextColor={colors.textLight} keyboardType="numeric" />
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
            : <Text style={s.saveBtnTxt}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
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

  body: { padding: 14, paddingBottom: 110 },

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

  tabBar: {
    flexDirection: "row", backgroundColor: "#fff",
    marginTop: 14, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },

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

  stockDualRow: { flexDirection: "row" },
  stockDualField: { flex: 1, paddingHorizontal: 14, paddingBottom: 12 },
  stockDualDivider: { width: 1, backgroundColor: colors.border, marginVertical: 8 },
  stockFieldLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "500", marginBottom: 6 },
  stockInput: { fontSize: 16, color: colors.text, padding: 0 },

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

  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  notFoundTxt: { fontSize: 15, color: colors.textMuted },
});

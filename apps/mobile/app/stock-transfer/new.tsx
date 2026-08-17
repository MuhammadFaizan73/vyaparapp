import { useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import { useSelectedCompany } from "../../src/useSelectedCompany";
import { useStores } from "../../src/useStores";
import { getItems, loadItems, type Item } from "../../src/itemsStore";

type PendingLine = { itemId: string; itemName: string; unit: string; quantity: number };

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function NewStockTransferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedCompanyId } = useSelectedCompany();
  const { stores } = useStores(selectedCompanyId);

  const [items, setItems] = useState<Item[]>(getItems());
  useEffect(() => { loadItems().then(() => setItems(getItems())); }, []);

  const [date] = useState(todayISO());
  const [fromStoreId, setFromStoreId] = useState("");
  const [toStoreId, setToStoreId] = useState("");
  const [lines, setLines] = useState<PendingLine[]>([]);
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (stores.length === 0) return;
    setFromStoreId((prev) => (stores.some((s) => s.id === prev) ? prev : (stores.find((s) => s.isMain)?.id ?? stores[0].id)));
    setToStoreId((prev) => (stores.some((s) => s.id === prev) ? prev : (stores.find((s) => !s.isMain)?.id ?? stores[0].id)));
  }, [stores]);

  useEffect(() => {
    if (fromStoreId && toStoreId && fromStoreId === toStoreId) {
      const other = stores.find((s) => s.id !== fromStoreId);
      if (other) setToStoreId(other.id);
    }
  }, [fromStoreId, toStoreId, stores]);

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [items, search]);

  function availableAt(itemId: string, storeId: string): number {
    const item = items.find((i) => i.id === itemId);
    if (!item) return 0;
    const entry = item.stocks.find((s) => s.storeId === storeId);
    return entry ? entry.quantity : 0;
  }

  function pendingQtyFor(itemId: string): number {
    return lines.filter((l) => l.itemId === itemId).reduce((sum, l) => sum + l.quantity, 0);
  }

  function addItem(item: Item) {
    setSearch("");
    setShowResults(false);
    setLines((prev) => {
      if (prev.some((l) => l.itemId === item.id)) return prev;
      return [...prev, { itemId: item.id, itemName: item.name, unit: item.unit ?? "", quantity: 1 }];
    });
  }

  function setQty(itemId: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, quantity: qty } : l)));
  }

  function removeLine(itemId: string) {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  const hasInsufficientLine = lines.some((l) => l.quantity > availableAt(l.itemId, fromStoreId));
  const canSave = !!fromStoreId && !!toStoreId && fromStoreId !== toStoreId && lines.length > 0 && !hasInsufficientLine && !saving;

  async function handleSave() {
    if (!canSave || !selectedCompanyId) return;
    setSaving(true);
    try {
      await api.createStockTransfer({
        companyId: selectedCompanyId,
        fromStoreId,
        toStoreId,
        date,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unit: l.unit || undefined })),
      });
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Could not save transfer.");
    } finally {
      setSaving(false);
    }
  }

  if (stores.length < 2) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.appBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Transfer Stock</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyTxt}>You need at least two stores to transfer stock.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Transfer Stock</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.storeRow}>
          <View style={styles.storeField}>
            <Text style={styles.fieldLabel}>From</Text>
            <View style={styles.chipRow}>
              {stores.map((s) => (
                <TouchableOpacity key={s.id} style={[styles.chip, fromStoreId === s.id && styles.chipActive]} onPress={() => setFromStoreId(s.id)}>
                  <Text style={[styles.chipTxt, fromStoreId === s.id && styles.chipTxtActive]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        <View style={styles.storeRow}>
          <View style={styles.storeField}>
            <Text style={styles.fieldLabel}>To</Text>
            <View style={styles.chipRow}>
              {stores.filter((s) => s.id !== fromStoreId).map((s) => (
                <TouchableOpacity key={s.id} style={[styles.chip, toStoreId === s.id && styles.chipActive]} onPress={() => setToStoreId(s.id)}>
                  <Text style={[styles.chipTxt, toStoreId === s.id && styles.chipTxtActive]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={styles.fieldLabel}>Add Item</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={(t) => { setSearch(t); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              placeholder="Search item…"
              placeholderTextColor={colors.textLight}
            />
          </View>
          {showResults && matches.length > 0 && (
            <View style={styles.resultsBox}>
              {matches.map((it) => (
                <TouchableOpacity key={it.id} style={styles.resultRow} onPress={() => addItem(it)}>
                  <Text style={styles.resultName}>{it.name}</Text>
                  <Text style={styles.resultStock}>Avail: {availableAt(it.id, fromStoreId) - pendingQtyFor(it.id)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {lines.map((l) => {
          const insufficient = l.quantity > availableAt(l.itemId, fromStoreId);
          return (
            <View key={l.itemId} style={styles.lineCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{l.itemName}</Text>
                {insufficient && <Text style={styles.lineWarn}>Not enough stock (available {availableAt(l.itemId, fromStoreId)})</Text>}
              </View>
              <TextInput
                style={styles.qtyInput}
                keyboardType="numeric"
                value={String(l.quantity)}
                onChangeText={(t) => setQty(l.itemId, parseFloat(t) || 0)}
              />
              <TouchableOpacity onPress={() => removeLine(l.itemId)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]} onPress={handleSave} disabled={!canSave}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Save Transfer</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  body: { padding: 16, paddingBottom: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTxt: { fontSize: 13.5, color: colors.textMuted, textAlign: "center" },

  storeRow: { marginBottom: 4 },
  storeField: { marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
  chipTxtActive: { color: "#fff" },

  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  resultsBox: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 6, overflow: "hidden" },
  resultRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f4f6fa" },
  resultName: { fontSize: 13, color: colors.text },
  resultStock: { fontSize: 11.5, color: colors.textLight },

  lineCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 12, padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  lineName: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  lineWarn: { fontSize: 11, color: colors.red, marginTop: 3 },
  qtyInput: {
    width: 56, textAlign: "center", fontSize: 14, color: colors.text,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6,
  },

  saveBar: { padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 14, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnTxt: { fontSize: 14, fontWeight: "600", color: "#fff" },
});

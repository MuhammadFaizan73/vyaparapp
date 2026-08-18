import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { getItems, loadItems, subscribeItems, type Item } from "../../src/itemsStore";
import { useSelectedCompany } from "../../src/useSelectedCompany";
import { useStores } from "../../src/useStores";

const STORE_FILTER_KEY = "vyapar_items_store_filter";

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const PALETTES = [
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#ede9fe", fg: "#6d28d9" },
];

function hue(name: string) { return PALETTES[name.length % PALETTES.length]; }
function fmtRs(n: number) { return "₨ " + n.toLocaleString("en-IN"); }

type TabId = "all" | "low" | "cat";

export default function ItemsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [items, setItems] = useState<Item[]>(getItems());
  const { companyFilter, selectedCompanyId } = useSelectedCompany();
  const { stores } = useStores(selectedCompanyId);

  // Store filter — only meaningful once a single company is selected, since a Store
  // belongs to exactly one Company. Persisted like the app's other filter chips.
  const [storeFilter, setStoreFilterState] = useState<string | null>(null);
  useEffect(() => {
    SecureStore.getItemAsync(STORE_FILTER_KEY).then((v) => { if (v) setStoreFilterState(v); });
  }, []);
  function setStoreFilter(id: string | null) {
    setStoreFilterState(id);
    if (id) void SecureStore.setItemAsync(STORE_FILTER_KEY, id);
    else void SecureStore.deleteItemAsync(STORE_FILTER_KEY);
  }
  useEffect(() => {
    if (storeFilter && !stores.some((s) => s.id === storeFilter)) setStoreFilter(null);
  }, [stores, storeFilter]);

  // Live quantity to display — the store-scoped subtotal when a store filter is
  // active, otherwise the true cross-store total.
  function qtyFor(item: Item): number {
    if (storeFilter) {
      const entry = item.stocks.find((s) => s.storeId === storeFilter);
      return entry ? entry.quantity : 0;
    }
    return item.totalStock ?? item.openingStock ?? 0;
  }

  // Load from disk once on first mount
  useEffect(() => {
    loadItems();
  }, []);

  // Refresh from store whenever screen comes into focus (after adding/editing)
  useFocusEffect(
    useCallback(() => {
      setItems(getItems());
    }, [])
  );

  // Subscribe to store changes for real-time updates
  useEffect(() => {
    return subscribeItems(() => setItems(getItems()));
  }, []);

  const companyItems = companyFilter
    ? items.filter((i) => {
        const ids = companyFilter.split(",");
        return (i as any).companyId && ids.includes((i as any).companyId);
      })
    : items;

  const lowItems = companyItems.filter((i) => {
    const qty = qtyFor(i);
    const min = i.minStock ?? 0;
    return min > 0 && qty < min;
  });

  const filtered = companyItems.filter((it) => {
    if (tab === "low") {
      const qty = qtyFor(it);
      const min = it.minStock ?? 0;
      if (!(min > 0 && qty < min)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return it.name.toLowerCase().includes(q) || (it.sku ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const stockValue = companyItems.reduce((acc, it) => acc + qtyFor(it) * (it.salePrice ?? 0), 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={styles.appBar}>
        {showSearch ? (
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search items..."
              placeholderTextColor={colors.textLight}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearch(""); }}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.appBarTitle}>Items</Text>
            <TouchableOpacity onPress={() => setShowSearch(true)} hitSlop={8}>
              <Ionicons name="search-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* Stock value card */}
        <View style={styles.stockCard}>
          <View style={styles.stockLeft}>
            <Text style={styles.stockLabel}>Stock Value</Text>
            <Text style={styles.stockAmount}>{fmtRs(stockValue)}</Text>
            <Text style={styles.stockSub}>{items.length} items  ·  {lowItems.length} low stock</Text>
          </View>
          <View style={[styles.stockIcon, { backgroundColor: colors.primaryLight + "22" }]}>
            <MaterialCommunityIcons name={"package-variant-closed" as MCIName} size={28} color={colors.primary} />
          </View>
        </View>

        {/* Pill tabs */}
        <View style={styles.tabRow}>
          <PillTab label="All" count={items.length} active={tab === "all"} onPress={() => setTab("all")} />
          <PillTab label="Low Stock" count={lowItems.length} active={tab === "low"} onPress={() => setTab("low")} />
          <PillTab label="Categories" active={tab === "cat"} onPress={() => setTab("cat")} />
        </View>

        {/* Store filter — only shown once there's more than one store to pick from. A
            plain height-constrained View wraps the ScrollView because a bare `height`
            on a ScrollView's own style prop isn't reliably honored as a hard cap on Android. */}
        {stores.length > 1 && (
          <View style={styles.storeFilterRowWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storeFilterRowContent}
            >
              <TouchableOpacity style={[styles.storeChip, !storeFilter && styles.storeChipActive]} onPress={() => setStoreFilter(null)}>
                <Text style={[styles.storeChipTxt, !storeFilter && styles.storeChipTxtActive]}>All Stores</Text>
              </TouchableOpacity>
              {stores.map((s) => (
                <TouchableOpacity key={s.id} style={[styles.storeChip, storeFilter === s.id && styles.storeChipActive]} onPress={() => setStoreFilter(s.id)}>
                  <Text style={[styles.storeChipTxt, storeFilter === s.id && styles.storeChipTxtActive]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Items list */}
        {filtered.map((it) => {
          const p = hue(it.name);
          const qty = qtyFor(it);
          const min = it.minStock ?? 0;
          const isLow = min > 0 && qty < min;
          return (
            <TouchableOpacity
              key={it.id}
              style={styles.itemCard}
              activeOpacity={0.75}
              onPress={() => router.push(`/items/${it.id}` as never)}
            >
              <View style={[styles.itemAvatar, { backgroundColor: p.bg }]}>
                <Text style={[styles.itemAvatarTxt, { color: p.fg }]}>{it.name.charAt(0)}</Text>
              </View>
              <View style={styles.itemMid}>
                <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                <Text style={styles.itemMeta}>
                  {it.sku || "—"}
                  {"  ·  "}
                  {it.salePrice != null ? fmtRs(it.salePrice) : "—"} {it.unit ? `/ ${it.unit}` : ""}
                </Text>
                {(it as any).companyTag && (
                  <View style={styles.companyChip}>
                    <Text style={styles.companyChipTxt} numberOfLines={1}>{(it as any).companyTag}</Text>
                  </View>
                )}
              </View>
              <View style={styles.itemRight}>
                <Text style={[styles.itemQty, isLow && styles.itemQtyLow]}>{qty}</Text>
                <Text style={[styles.itemUnit, isLow && styles.itemUnitLow]}>
                  {isLow ? "Low" : (it.unit || "unit")}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name={"package-variant-closed" as MCIName} size={52} color={colors.textLight} />
            <Text style={styles.emptyTxt}>
              {tab === "low" ? "No low stock items" : "No items found"}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <View style={[styles.fabWrap, { bottom: 24 + (insets.bottom || 8) }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/items/new" as never)}
          activeOpacity={0.85}
        >
          <View style={styles.fabPlus}>
            <Text style={styles.fabPlusTxt}>+</Text>
          </View>
          <Text style={styles.fabLabel}>Add Item</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PillTab({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.pillTxt, active && styles.pillTxtActive]}>{label}</Text>
      {count !== undefined && (
        <View style={[styles.pillBadge, active && styles.pillBadgeActive]}>
          <Text style={[styles.pillBadgeTxt, active && styles.pillBadgeTxtActive]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  appBar: {
    backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    minHeight: 56,
  },
  appBarTitle: { fontSize: 17, fontWeight: "600", color: "#fff" },

  searchBar: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#fff" },

  body: { padding: 16, paddingBottom: 130 },

  stockCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  stockLeft: {},
  stockLabel: { fontSize: 11, color: colors.textLight, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  stockAmount: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 5, letterSpacing: -0.3 },
  stockSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 4 },
  stockIcon: { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  tabRow: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 4 },
  // Explicit height — a horizontal ScrollView with no bounded height stretches to
  // fill whatever flexible vertical space its parent offers.
  storeFilterRowWrap: { height: 44, overflow: "hidden", marginTop: 10 },
  storeFilterRowContent: { alignItems: "center", height: 44 },
  storeChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, marginRight: 8,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0",
  },
  storeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  storeChipTxt: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  storeChipTxtActive: { color: "#fff" },
  pill: {
    flex: 1, paddingVertical: 10, borderRadius: 100,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0",
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  pillTxt: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
  pillTxtActive: { color: "#fff" },
  pillBadge: { backgroundColor: "#f1f5f9", borderRadius: 100, paddingHorizontal: 7, paddingVertical: 1.5 },
  pillBadgeActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  pillBadgeTxt: { fontSize: 10.5, fontWeight: "700", color: colors.textMuted },
  pillBadgeTxtActive: { color: "#fff" },

  itemCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginTop: 10,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  itemAvatar: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  itemAvatarTxt: { fontSize: 16, fontWeight: "700" },
  itemMid: { flex: 1 },
  itemName: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  itemMeta: { fontSize: 11, color: colors.textLight, marginTop: 3 },
  companyChip: {
    alignSelf: "flex-start", marginTop: 4,
    backgroundColor: colors.primary + "15", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  companyChipTxt: { fontSize: 10, fontWeight: "600", color: colors.primary },
  itemRight: { alignItems: "flex-end" },
  itemQty: { fontSize: 15, fontWeight: "700", color: colors.text },
  itemQtyLow: { color: colors.red },
  itemUnit: { fontSize: 10, color: colors.textLight, fontWeight: "600", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
  itemUnitLow: { color: colors.red },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: 14, color: colors.textMuted },

  fabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  fab: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: colors.primary, borderRadius: 100,
    paddingHorizontal: 24, paddingVertical: 13,
    shadowColor: colors.primary, shadowOpacity: 0.32, shadowRadius: 20, elevation: 8,
  },
  fabPlus: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  fabPlusTxt: { fontSize: 18, fontWeight: "700", color: "#fff", lineHeight: 20 },
  fabLabel: { fontSize: 14, fontWeight: "600", color: "#fff" },
});

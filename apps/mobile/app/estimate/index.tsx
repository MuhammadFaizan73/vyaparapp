import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import type { Transaction, Party } from "@vyapar/api-client";

type TxnRow = Transaction & { partyName: string };

const CHIPS = ["All", "Open Estimate", "Closed Estimate"];

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function EstimateListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeChip, setActiveChip] = useState(0);
  const [search, setSearch] = useState("");
  const [converting, setConverting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [txns, parties]: [Transaction[], Party[]] = await Promise.all([
        api.getTransactionsByType("estimate"),
        api.getParties(),
      ]);
      const map: Record<string, string> = {};
      parties.forEach((p) => { map[p.id] = p.name; });
      setRows(
        txns
          .map((t) => ({ ...t, partyName: map[t.partyId] ?? "Unknown" }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
    } catch { /* offline */ }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function doConvert(row: TxnRow, targetType: "sale" | "sale_order") {
    setConverting(row.id);
    try {
      await api.createTransaction({
        partyId: row.partyId,
        type: targetType,
        number: row.number ?? undefined,
        date: new Date().toISOString(),
        total: row.total,
        balance: row.balance,
        notes: row.notes ?? undefined,
      });
      await api.updateTransaction(row.id, { balance: 0 });
      await load();
    } catch {
      Alert.alert("Error", "Could not convert. Check your connection.");
    } finally {
      setConverting(null);
    }
  }

  function handleConvert(row: TxnRow) {
    Alert.alert(
      "Convert Estimate",
      `Convert estimate for ${row.partyName} to:`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sale Order", onPress: () => doConvert(row, "sale_order") },
        { text: "Sale", onPress: () => doConvert(row, "sale") },
      ]
    );
  }

  /* filter */
  const chipKey = CHIPS[activeChip].toLowerCase();
  const filtered = rows.filter((r) => {
    const matchChip =
      chipKey === "all" ||
      (chipKey.startsWith("open") && r.balance > 0) ||
      (chipKey.startsWith("closed") && r.balance === 0);
    const matchSearch =
      !search.trim() ||
      r.partyName.toLowerCase().includes(search.toLowerCase()) ||
      (r.number ?? "").toString().includes(search);
    return matchChip && matchSearch;
  });

  function renderItem({ item: row }: { item: TxnRow }) {
    const isOpen = row.balance > 0;
    const isConverting = converting === row.id;

    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={s.cardLeft}>
            <View style={s.cardNameRow}>
              <Text style={s.cardParty} numberOfLines={1}>{row.partyName}</Text>
              <View style={[s.badge, isOpen ? s.badgeOpen : s.badgeClosed]}>
                <Text style={[s.badgeTxt, isOpen ? s.badgeTxtOpen : s.badgeTxtClosed]}>
                  {isOpen ? "OPEN" : "CLOSED"}
                </Text>
              </View>
            </View>
            <Text style={s.cardAmt}>Rs {fmt(row.total)}</Text>
          </View>
          <View style={s.cardRight}>
            <Text style={s.cardNum}>#{row.number ?? "–"}</Text>
            <Text style={s.cardDate}>{fmtDate(row.date)}</Text>
          </View>
        </View>

        <View style={s.cardBottom}>
          <View>
            <Text style={s.balanceLbl}>Balance</Text>
            <Text style={s.balanceVal}>Rs {fmt(row.balance)}</Text>
          </View>
          {isOpen ? (
            <TouchableOpacity
              style={[s.convertBtn, isConverting && { opacity: 0.5 }]}
              onPress={() => handleConvert(row)}
              disabled={isConverting}
            >
              <Text style={s.convertTxt}>{isConverting ? "Converting…" : "Convert"}</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.convertedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.green} />
              <Text style={s.convertedTxt}>Converted</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Estimate Details</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter chips */}
      <View style={s.chipsBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CHIPS}
          keyExtractor={(c) => c}
          contentContainerStyle={s.chipsContent}
          renderItem={({ item: chip, index: i }) => (
            <TouchableOpacity
              style={[s.chip, i === activeChip && s.chipActive]}
              onPress={() => setActiveChip(i)}
            >
              <Text style={[s.chipTxt, i === activeChip && s.chipTxtActive]}>{chip}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Search bar */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color={colors.primary} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search Estimate/Quotations"
          placeholderTextColor={colors.textLight}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[s.list, filtered.length === 0 && s.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <View style={s.docIllustration}>
                <View style={s.docPage}>
                  <View style={s.docLine} />
                  <View style={s.docLine} />
                  <View style={[s.docLine, { width: "55%" }]} />
                </View>
                <View style={s.docAccent} />
              </View>
              <Text style={s.emptyTxt}>
                {search.trim() ? "No results found." : "No estimates yet.\nTap below to create one."}
              </Text>
            </View>
          }
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* Red FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/estimate/new" as never)}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={s.fabTxt}>Add Estimate</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#e8edf2" },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  chipsBar: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border },
  chipsContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.red, borderColor: colors.red },
  chipTxt: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
  chipTxtActive: { color: "#fff", fontWeight: "600" },

  searchBar: {
    backgroundColor: "#dce6f0", flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },

  list: { padding: 10, paddingBottom: 100 },
  listEmpty: { flex: 1 },

  card: {
    backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1, borderColor: "#e0e8f0",
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
  },
  cardLeft: { flex: 1 },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardParty: { fontSize: 14, fontWeight: "700", color: colors.text },
  cardAmt: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 2 },
  cardRight: { alignItems: "flex-end" },
  cardNum: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  cardDate: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeOpen: { backgroundColor: "#fff3e0" },
  badgeClosed: { backgroundColor: "#e8f5e9" },
  badgeTxt: { fontSize: 10.5, fontWeight: "700" },
  badgeTxtOpen: { color: "#e65100" },
  badgeTxtClosed: { color: colors.green },

  cardBottom: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
  },
  balanceLbl: { fontSize: 12, color: colors.textMuted },
  balanceVal: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 2 },

  convertBtn: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 6,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  convertTxt: { fontSize: 13, fontWeight: "700", color: colors.primary },
  convertedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  convertedTxt: { fontSize: 12.5, color: colors.green, fontWeight: "600" },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24, marginTop: 60 },
  docIllustration: { width: 110, height: 110, position: "relative", marginBottom: 8 },
  docPage: {
    width: 78, height: 88, backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 7,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  docLine: { height: 5, backgroundColor: "#dde6f0", borderRadius: 3, width: "82%" },
  docAccent: {
    position: "absolute", right: 0, top: 14,
    width: 28, height: 78, backgroundColor: colors.red, borderRadius: 8, opacity: 0.7,
  },
  emptyTxt: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 21 },

  fab: {
    position: "absolute", alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.red, borderRadius: 100,
    paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  fabTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { api } from "../auth";
import type { Transaction, Party } from "@vyapar/api-client";

type TxnRow = Transaction & { partyName: string };

interface Props {
  title: string;
  txnType: string;
  chips?: string[];
  emptyMessage: string;
  fabLabel: string;
  fabRoute: string;
  headerRight?: React.ReactNode;
}

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" });
}

export function TxnList({ title, txnType, chips, emptyMessage, fabLabel, fabRoute, headerRight }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeChip, setActiveChip] = useState(0);
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [txns, parties]: [Transaction[], Party[]] = await Promise.all([
        api.getTransactionsByType(txnType),
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
  }, [txnType]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  /* filter by chip */
  const chipLabel = chips?.[activeChip]?.toLowerCase() ?? "all";
  const filtered = rows.filter((r) => {
    if (chipLabel === "all") return true;
    if (chipLabel === "open") return r.balance > 0;
    if (chipLabel === "closed" || chipLabel === "converted") return r.balance === 0;
    return true;
  });

  const totalAmt = filtered.reduce((s, r) => s + r.total, 0);

  function getStatus(row: TxnRow) {
    if (row.balance === 0) return { label: "Closed", color: colors.green };
    return { label: "Open", color: colors.amber };
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>{title}</Text>
        {headerRight ?? <View style={{ width: 24 }} />}
      </View>

      {/* Filter chips */}
      {chips && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={s.chipsBar} contentContainerStyle={s.chipsContent}>
          {chips.map((chip, i) => (
            <TouchableOpacity key={chip} style={[s.chip, i === activeChip && s.chipActive]}
              onPress={() => setActiveChip(i)}>
              <Text style={[s.chipTxt, i === activeChip && s.chipTxtActive]}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.docIllustration}>
            <View style={s.docPage}>
              <View style={s.docLine} />
              <View style={s.docLine} />
              <View style={[s.docLine, { width: "55%" }]} />
            </View>
            <View style={s.docAccent} />
          </View>
          <Text style={s.emptyTxt}>{emptyMessage}</Text>
          <TouchableOpacity style={s.fab} onPress={() => router.push(fabRoute as never)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.fabTxt}>{fabLabel}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Summary */}
          <View style={s.summary}>
            <Text style={s.summaryLabel}>Total: <Text style={s.summaryAmt}>Rs {fmt(totalAmt)}</Text></Text>
            <Text style={s.summaryCount}>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</Text>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(r) => r.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            contentContainerStyle={s.listContent}
            renderItem={({ item: row }) => {
              const status = getStatus(row);
              return (
                <TouchableOpacity style={s.row} activeOpacity={0.7}>
                  <View style={s.rowLeft}>
                    <View style={s.avatar}>
                      <Text style={s.avatarTxt}>{row.partyName[0]?.toUpperCase() ?? "?"}</Text>
                    </View>
                  </View>
                  <View style={s.rowMid}>
                    <Text style={s.rowParty} numberOfLines={1}>{row.partyName}</Text>
                    <Text style={s.rowSub}>#{row.number ?? "–"}  ·  {fmtDate(row.date)}</Text>
                  </View>
                  <View style={s.rowRight}>
                    <Text style={s.rowAmt}>Rs {fmt(row.total)}</Text>
                    <View style={[s.statusBadge, { backgroundColor: status.color + "20" }]}>
                      <Text style={[s.statusTxt, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={s.sep} />}
          />

          {/* Add FAB */}
          <TouchableOpacity style={[s.floatFab, { bottom: insets.bottom + 20 }]}
            onPress={() => router.push(fabRoute as never)}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  chipsBar: { flexGrow: 0, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border },
  chipsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100,
    borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
  chipTxtActive: { color: "#fff", fontWeight: "600" },

  summary: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryAmt: { fontWeight: "700", color: colors.text },
  summaryCount: { fontSize: 12, color: colors.textMuted },

  listContent: { padding: 12, gap: 0, paddingBottom: 100 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 13,
    borderRadius: 0,
  },
  sep: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  rowLeft: {},
  avatar: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center",
  },
  avatarTxt: { fontSize: 15, fontWeight: "700", color: colors.primary },
  rowMid: { flex: 1 },
  rowParty: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 3 },
  rowRight: { alignItems: "flex-end", gap: 5 },
  rowAmt: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusTxt: { fontSize: 11, fontWeight: "700" },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  docIllustration: { width: 110, height: 110, position: "relative", marginBottom: 8 },
  docPage: {
    width: 78, height: 88, backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 7,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  docLine: { height: 5, backgroundColor: "#dde6f0", borderRadius: 3, width: "82%" },
  docAccent: {
    position: "absolute", right: 0, top: 14,
    width: 28, height: 78, backgroundColor: colors.primary, borderRadius: 8, opacity: 0.7,
  },
  emptyTxt: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 21 },
  fab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.primary, borderRadius: 100,
    paddingHorizontal: 24, paddingVertical: 13,
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  fabTxt: { fontSize: 14, fontWeight: "600", color: "#fff" },
  floatFab: {
    position: "absolute", right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
});

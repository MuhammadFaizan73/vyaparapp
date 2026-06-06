import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, RefreshControl, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import type { Transaction, Party } from "@vyapar/api-client";

type TxnRow = Transaction & {
  partyName: string;
  dueDateStr?: string;
  linkedSaleNumber?: string;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")} ${d.toLocaleString("en", { month: "short" })}, ${String(d.getFullYear()).slice(2)}`;
}
function parseNotes(n: string | null | undefined) {
  try { return JSON.parse(n ?? "{}"); } catch { return {}; }
}

type Tab = "All" | "Open Note" | "Closed Note";

export default function DeliveryNoteListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("All");

  /* convert-to-sale inline screen */
  const [convertRow, setConvertRow] = useState<TxnRow | null>(null);
  const [returnedQtys, setReturnedQtys] = useState<Record<number, string>>({});

  async function load() {
    try {
      const [txns, parties] = await Promise.all([
        api.getTransactionsByType("delivery_challan"),
        api.getParties(),
      ]);
      const map: Record<string, Party> = Object.fromEntries(parties.map((p: Party) => [p.id, p]));
      const mapped: TxnRow[] = (txns as Transaction[]).map((t) => {
        const notes = parseNotes(t.notes);
        return {
          ...t,
          partyName: map[t.partyId]?.name ?? "Unknown",
          dueDateStr: notes.dueDate ? fmtDate(new Date(notes.dueDate).toISOString()) : undefined,
          linkedSaleNumber: notes.linkedSaleNumber ?? undefined,
        };
      });
      setRows([...mapped].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch { /* offline */ } finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openConvert(row: TxnRow) {
    setReturnedQtys({});
    setConvertRow(row);
  }

  function doConvert() {
    if (!convertRow) return;
    const notes = parseNotes(convertRow.notes);
    const items: any[] = (notes.items ?? []).map((item: any, i: number) => {
      const entered = returnedQtys[i];
      const qty = entered !== undefined && entered.trim() !== ""
        ? parseFloat(entered) || item.qty
        : item.qty;
      return { ...item, qty };
    });
    setConvertRow(null);
    router.push({
      pathname: "/sale/new",
      params: {
        fromDeliveryNoteId: convertRow.id,
        prefillPartyName: convertRow.partyName,
        prefillPartyId: convertRow.partyId,
        prefillItems: JSON.stringify(items),
        prefillNotes: convertRow.notes ?? "{}",
      },
    } as never);
  }

  const filtered = rows.filter((r) => {
    const matchTab =
      tab === "All" ||
      (tab === "Open Note" && r.balance > 0) ||
      (tab === "Closed Note" && r.balance === 0);
    const matchSearch = !search || r.partyName.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  /* ── Convert to Sale screen ── */
  if (convertRow) {
    const notes = parseNotes(convertRow.notes);
    const items: any[] = notes.items ?? [];
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.appBar}>
          <TouchableOpacity onPress={() => setConvertRow(null)} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.appBarTitle}>Delivery Note Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={s.cvtTableHeader}>
          <Text style={s.cvtTableTitle}>List of Items on Note</Text>
          <Text style={s.cvtReturnedLabel}>Returned Qty</Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={s.cvtList}>
          {items.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 40 }}>
              No items on this delivery note
            </Text>
          ) : items.map((item: any, i: number) => (
            <View key={i} style={s.cvtRow}>
              <Text style={s.cvtRowNum}>{i + 1}</Text>
              <Text style={s.cvtRowName}>{item.name}</Text>
              <Text style={s.cvtRowQty}>{item.qty}</Text>
              <TextInput
                style={[s.cvtReturnInput, parseFloat(returnedQtys[i] ?? "0") > item.qty && s.cvtReturnInputError]}
                value={returnedQtys[i] ?? ""}
                onChangeText={(v) => {
                  const num = parseFloat(v);
                  if (!isNaN(num) && num > item.qty) return;
                  setReturnedQtys((prev) => ({ ...prev, [i]: v }));
                }}
                keyboardType="numeric"
                placeholder="Returned Qty"
                placeholderTextColor={colors.primary}
              />
            </View>
          ))}
        </ScrollView>

        <View style={[s.cvtFooter, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={s.cvtDontShow}>
            <View style={s.cvtCheckbox} />
            <Text style={s.cvtDontShowTxt}>Don't show this again</Text>
          </TouchableOpacity>
          <View style={s.cvtBtns}>
            <TouchableOpacity style={s.cvtCancelBtn} onPress={() => setConvertRow(null)}>
              <Text style={s.cvtCancelTxt}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cvtNextBtn} onPress={doConvert}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={s.cvtNextTxt}>NEXT</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  /* ── List screen ── */
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Delivery Note Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.chipBar} contentContainerStyle={s.chipContent}>
        {(["All", "Open Note", "Closed Note"] as Tab[]).map((c) => (
          <TouchableOpacity key={c} style={[s.chip, tab === c && s.chipActive]} onPress={() => setTab(c)}>
            <Text style={[s.chipTxt, tab === c && s.chipTxtActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.primary} />
        <TextInput
          style={s.searchInput}
          placeholder="Search Delivery Note"
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="document-text-outline" size={52} color="#c8d6e5" />
          <Text style={s.emptyTxt}>No delivery notes yet</Text>
          <Text style={s.emptySub}>Tap below to create one</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        >
          {filtered.map((row) => (
            <TouchableOpacity key={row.id} style={s.card} activeOpacity={0.85}
              onPress={() => router.push({ pathname: "/delivery-note/new", params: { id: row.id } } as never)}>
              <View style={s.cardTop}>
                <View style={s.cardLeft}>
                  <View style={s.nameRow}>
                    <Text style={s.cardName}>{row.partyName}</Text>
                    <View style={[s.badge, row.balance === 0 && s.badgeDone]}>
                      <Text style={[s.badgeTxt, row.balance === 0 && s.badgeDoneTxt]}>
                        {row.balance === 0 ? "CLOSED" : "OPEN"}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.cardAmt}>Rs {row.total.toLocaleString("en-PK", { minimumFractionDigits: 4 })}</Text>
                </View>
                <View style={s.cardRight}>
                  <Text style={s.cardNum}>#{row.number}</Text>
                  <Text style={s.cardDate}>{fmtDate(row.date)}</Text>
                </View>
              </View>
              <View style={s.cardBottom}>
                <Text style={s.cardDue}>{row.dueDateStr ? `Due Date: ${row.dueDateStr}` : " "}</Text>
                {row.balance === 0 ? (
                  <TouchableOpacity style={s.seeInvoiceBtn}
                    onPress={() => Alert.alert("Sale Invoice", `Linked to Sale Invoice #${row.linkedSaleNumber ?? "—"}`)}>
                    <Text style={s.seeInvoiceTxt}>See Invoice #{row.linkedSaleNumber ?? "—"}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={s.convertBtn}
                    onPress={(e) => { e.stopPropagation?.(); openConvert(row); }}>
                    <Text style={s.convertTxt}>Convert to Sale</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/delivery-note/new" as never)}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={s.fabTxt}>Add Delivery Note</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#dce8f5" },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },

  chipBar: { flexGrow: 0, backgroundColor: "#fff" },
  chipContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 7, borderRadius: 100,
    borderWidth: 1.5, borderColor: "#d1d5db", backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#e53935", borderColor: "#e53935" },
  chipTxt: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
  chipTxtActive: { color: "#fff", fontWeight: "600" },

  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", marginHorizontal: 14, marginTop: 12, marginBottom: 4,
    borderRadius: 10, borderWidth: 1, borderColor: "#d1d5db",
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  list: { padding: 14, gap: 10, paddingBottom: 110 },
  card: {
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#d8e3ef", padding: 14, gap: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardLeft: { flex: 1, gap: 5 },
  cardRight: { alignItems: "flex-end", gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardName: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  cardAmt: { fontSize: 14, fontWeight: "600", color: colors.text },
  cardNum: { fontSize: 12, color: colors.textMuted },
  cardDate: { fontSize: 12, color: colors.textMuted },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardDue: { fontSize: 12.5, color: colors.textMuted },

  badge: { backgroundColor: "#fef3c7", borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  badgeDone: { backgroundColor: "#dcfce7" },
  badgeTxt: { fontSize: 10, fontWeight: "700", color: "#d97706" },
  badgeDoneTxt: { color: "#15803d" },

  convertBtn: { backgroundColor: "#dbeafe", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  convertTxt: { fontSize: 13, fontWeight: "600", color: colors.primary },

  seeInvoiceBtn: { backgroundColor: "#e0f2fe", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  seeInvoiceTxt: { fontSize: 13, fontWeight: "600", color: "#0369a1" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTxt: { fontSize: 16, fontWeight: "600", color: colors.textMuted },
  emptySub: { fontSize: 13, color: colors.textLight },

  fab: {
    position: "absolute", alignSelf: "center",
    backgroundColor: "#e53935", borderRadius: 100,
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 15,
    shadowColor: "#e53935", shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  fabTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },

  /* Convert screen */
  cvtTableHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cvtTableTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  cvtReturnedLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  cvtList: { padding: 16, gap: 12 },
  cvtRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  cvtRowNum: { fontSize: 13, color: colors.textMuted, width: 18, textAlign: "center" },
  cvtRowName: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  cvtRowQty: { fontSize: 14, color: colors.text, width: 36, textAlign: "center" },
  cvtReturnInput: {
    borderBottomWidth: 1.5, borderBottomColor: colors.primary,
    width: 90, fontSize: 14, color: colors.text,
    paddingVertical: 4, paddingHorizontal: 6, textAlign: "center",
  },
  cvtReturnInputError: { borderBottomColor: "#dc2626" },
  cvtFooter: {
    backgroundColor: "#f5f5f5", borderTopWidth: 1, borderTopColor: "#e0e0e0",
  },
  cvtDontShow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#e0e0e0",
  },
  cvtCheckbox: {
    width: 20, height: 20, borderRadius: 3,
    borderWidth: 1.5, borderColor: "#9ca3af", backgroundColor: "#fff",
  },
  cvtDontShowTxt: { fontSize: 14, color: colors.textMuted },
  cvtBtns: { flexDirection: "row" },
  cvtCancelBtn: {
    flex: 1, paddingVertical: 18, alignItems: "center", justifyContent: "center",
    borderRightWidth: 1, borderRightColor: "#e0e0e0",
  },
  cvtCancelTxt: { fontSize: 14, fontWeight: "600", color: colors.textMuted, letterSpacing: 0.5 },
  cvtNextBtn: {
    flex: 2, paddingVertical: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primary,
  },
  cvtNextTxt: { fontSize: 14, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },
});

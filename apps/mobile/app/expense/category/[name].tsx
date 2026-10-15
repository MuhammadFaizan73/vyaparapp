import { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../src/theme";
import { api } from "../../../src/auth";
import { setHandoffTxn, type TxnWithParty } from "../../../src/txnHandoff";
import { parseExpenseCategory, parseExpenseNotes, styleForCategory } from "../../../src/expenseCategory";
import type { Transaction } from "@vyapar/api-client";

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "2-digit" });
}

// Expense transactions are all recorded against a single shared "Business Expenses"
// placeholder party (see expense/new.tsx) — there's no real per-transaction party name
// worth showing here, but setHandoffTxn still needs *a* partyName to satisfy TxnWithParty.
const EXPENSE_PARTY_NAME = "Business Expenses";

export default function ExpenseCategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ name: string }>();
  const categoryName = decodeURIComponent(params.name ?? "");

  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const txns = await api.getTransactionsByType("expense");
      const matching = txns
        .filter((t) => parseExpenseCategory(t.notes).toLowerCase() === categoryName.toLowerCase())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRows(matching);
    } catch {
      /* offline — keep showing whatever already loaded */
    }
  }, [categoryName]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  const style = styleForCategory(categoryName);
  const total = rows.reduce((s, r) => s + r.total, 0);

  function handleEdit(row: Transaction) {
    setHandoffTxn({ ...row, partyName: EXPENSE_PARTY_NAME } as TxnWithParty);
    router.push({ pathname: "/expense/new", params: { editId: row.id } } as never);
  }

  function handleDelete(row: Transaction) {
    Alert.alert(
      "Delete expense?",
      `This will permanently delete this Rs ${fmt(row.total)} expense.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive", onPress: async () => {
            try {
              await api.deleteTransaction(row.id);
              await load();
            } catch {
              Alert.alert("Error", "Could not delete this expense.");
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={[s.appBarIcon, { backgroundColor: style.tint }]}>
          <Text style={{ fontSize: 15 }}>{style.icon}</Text>
        </View>
        <Text style={s.appBarTitle} numberOfLines={1}>{categoryName}</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : rows.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="receipt-outline" size={40} color={colors.border} />
          <Text style={s.emptyTxt}>No expenses in this category</Text>
        </View>
      ) : (
        <>
          <View style={s.summary}>
            <Text style={s.summaryLabel}>Total: <Text style={s.summaryAmt}>Rs {fmt(total)}</Text></Text>
            <Text style={s.summaryCount}>{rows.length} record{rows.length !== 1 ? "s" : ""}</Text>
          </View>

          <FlatList
            data={rows}
            keyExtractor={(r) => r.id}
            contentContainerStyle={s.listContent}
            renderItem={({ item: row }) => {
              const note = parseExpenseNotes(row.notes).note;
              return (
                <TouchableOpacity style={s.row} activeOpacity={0.7}
                  onPress={() => handleEdit(row)}
                  onLongPress={() => handleDelete(row)}>
                  <View style={[s.avatar, { backgroundColor: style.tint }]}>
                    <Text style={{ fontSize: 15 }}>{style.icon}</Text>
                  </View>
                  <View style={s.rowMid}>
                    <Text style={s.rowDate}>{fmtDate(row.date)}</Text>
                    {note ? <Text style={s.rowNote} numberOfLines={1}>{note}</Text> : null}
                  </View>
                  <Text style={s.rowAmt}>Rs {fmt(row.total)}</Text>
                  <TouchableOpacity hitSlop={10} style={s.rowDelete} onPress={() => handleDelete(row)}>
                    <Ionicons name="trash-outline" size={16} color={colors.textLight} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={s.sep} />}
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTxt: { fontSize: 14, color: colors.textMuted },

  summary: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryAmt: { fontWeight: "700", color: colors.text },
  summaryCount: { fontSize: 12, color: colors.textMuted },

  listContent: { padding: 12, gap: 0, paddingBottom: 40 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 13,
  },
  sep: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  avatar: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowMid: { flex: 1 },
  rowDate: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  rowNote: { fontSize: 11.5, color: colors.textMuted, marginTop: 3 },
  rowAmt: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  rowDelete: { paddingLeft: 8 },
});

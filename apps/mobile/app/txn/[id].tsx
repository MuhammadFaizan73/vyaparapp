import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors } from "../../src/theme";
import { api, getPermissions, getMemberId } from "../../src/auth";
import { setHandoffTxn, takeHandoffTxn, type TxnWithParty } from "../../src/txnHandoff";
import { buildInvoiceHtml, fmt, formatDate, parseNoteItems } from "../../src/invoiceHtml";
import { canEditSale } from "../../src/permissions";
import { useInvoiceHtmlOptions } from "../../src/useSettings";

type BadgeCfg = { label: string; bg: string; fg: string };

function getBadge(type: string, balance: number): BadgeCfg {
  switch (type) {
    case "sale":             return balance > 0 ? { label: "SALE: UNPAID", bg: "#fef3c7", fg: "#b45309" } : { label: "SALE: PAID", bg: "#dcfce7", fg: "#15803d" };
    case "purchase":         return balance > 0 ? { label: "PURCHASE: DUE", bg: "#fef3c7", fg: "#b45309" } : { label: "PURCHASE: PAID", bg: "#dcfce7", fg: "#15803d" };
    case "expense":          return { label: "EXPENSE", bg: "#ede9fe", fg: "#6d28d9" };
    case "delivery_challan": return balance > 0 ? { label: "DN: UNPAID", bg: "#fef3c7", fg: "#b45309" } : { label: "DN: PAID", bg: "#dcfce7", fg: "#15803d" };
    case "purchase_order":   return balance > 0 ? { label: "PO: OPEN", bg: "#fef3c7", fg: "#b45309" } : { label: "PO: CLOSED", bg: "#dcfce7", fg: "#15803d" };
    case "credit_note":      return { label: "CREDIT NOTE", bg: "#fee2e2", fg: "#dc2626" };
    case "payment_in":       return { label: "PAYMENT IN", bg: "#dcfce7", fg: "#15803d" };
    case "payment_out":      return { label: "PAYMENT OUT", bg: "#fee2e2", fg: "#dc2626" };
    case "estimate":         return { label: "ESTIMATE", bg: "#dbeafe", fg: "#1d4ed8" };
    default:                 return { label: type.replace(/_/g, " ").toUpperCase(), bg: "#f3f4f6", fg: "#374151" };
  }
}

// Sale and Payment-In have mobile creation/edit screens — other types (purchase,
// expense, etc.) can still be viewed and exported here, but editing them stays a
// desktop-only action until those screens exist on mobile too.
const EDITABLE_TYPES = new Set(["sale", "payment_in"]);
const EDIT_ROUTES: Record<string, string> = {
  sale: "/sale/new",
  payment_in: "/payment-in/new",
};

export default function TransactionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [txn, setTxn] = useState<TxnWithParty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [canDelete, setCanDelete] = useState(true);
  const [busy, setBusy] = useState<"download" | "share" | "delete" | null>(null);
  const invoiceHtmlOpts = useInvoiceHtmlOptions();

  useEffect(() => {
    Promise.all([getPermissions(), getMemberId()]).then(([perms, mid]) => {
      setPermissions(perms);
      setMemberId(mid);
      setCanDelete(perms === null || perms.includes("sale_delete"));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    const handed = takeHandoffTxn(id);
    if (handed) { setTxn(handed); setLoading(false); return; }
    // Deep link / app restart — the in-memory handoff is gone, fall back to a full fetch.
    api.getAllTransactions()
      .then((all) => {
        const found = all.find((t) => t.id === id) as TxnWithParty | undefined;
        if (found) setTxn(found);
        else setError("Transaction not found.");
      })
      .catch(() => setError("Could not load this transaction."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownload() {
    if (!txn) return;
    setBusy("download");
    try {
      await Print.printAsync({ html: buildInvoiceHtml(txn, txn.number ?? txn.id.slice(0, 8), invoiceHtmlOpts) });
    } catch {
      Alert.alert("Error", "Could not open printer.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    if (!txn) return;
    setBusy("share");
    try {
      const { uri } = await Print.printToFileAsync({ html: buildInvoiceHtml(txn, txn.number ?? txn.id.slice(0, 8), invoiceHtmlOpts) });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Invoice" });
    } catch {
      Alert.alert("Error", "Could not generate PDF.");
    } finally {
      setBusy(null);
    }
  }

  function handleEdit() {
    if (!txn) return;
    setHandoffTxn(txn);
    const pathname = EDIT_ROUTES[txn.type] ?? "/sale/new";
    router.push({ pathname, params: { editId: txn.id } } as never);
  }

  function handleDelete() {
    if (!txn) return;
    Alert.alert(
      "Delete transaction?",
      `This will permanently delete this ${txn.type.replace(/_/g, " ")} for ${txn.partyName}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive", onPress: async () => {
            setBusy("delete");
            try {
              await api.deleteTransaction(txn.id);
              router.back();
            } catch {
              Alert.alert("Error", "Could not delete this transaction.");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={[st.screen, st.centered]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !txn) {
    return (
      <View style={[st.screen, st.centered]}>
        <Ionicons name="alert-circle-outline" size={32} color="#dc2626" />
        <Text style={st.errorTxt}>{error || "Transaction not found."}</Text>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Text style={st.backBtnTxt}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const badge = getBadge(txn.type, txn.balance);
  const items = parseNoteItems(txn.notes);
  const received = txn.total - txn.balance;

  return (
    <View style={[st.screen, { paddingTop: insets.top }]}>
      <View style={st.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={st.appBarTitle} numberOfLines={1}>{txn.partyName}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        <View style={st.card}>
          <View style={st.topRow}>
            <View style={[st.badge, { backgroundColor: badge.bg }]}>
              <Text style={[st.badgeTxt, { color: badge.fg }]}>{badge.label}</Text>
            </View>
            {txn.number ? <Text style={st.num}>#{txn.number}</Text> : null}
          </View>
          <Text style={st.date}>{formatDate(txn.date)}</Text>

          <View style={st.amtRow}>
            <View style={st.amtCol}>
              <Text style={st.amtLbl}>Total</Text>
              <Text style={st.amtVal}>Rs {fmt(txn.total)}</Text>
            </View>
            <View style={st.amtCol}>
              <Text style={st.amtLbl}>Received</Text>
              <Text style={st.amtVal}>Rs {fmt(received)}</Text>
            </View>
            <View style={st.amtCol}>
              <Text style={st.amtLbl}>Balance</Text>
              <Text style={[st.amtVal, txn.balance > 0 && { color: "#dc2626" }]}>Rs {fmt(txn.balance)}</Text>
            </View>
          </View>
        </View>

        {items.length > 0 && (
          <View style={st.card}>
            <Text style={st.sectionTitle}>Items</Text>
            {items.map((it, i) => (
              <View key={i} style={st.itemRow}>
                <Text style={st.itemName} numberOfLines={1}>{it.name}</Text>
                <Text style={st.itemQty}>{it.qty ?? 0} {it.unit ?? ""}</Text>
                <Text style={st.itemAmt}>Rs {fmt((it.qty ?? 0) * (it.rate ?? 0))}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={st.actionsRow}>
          <TouchableOpacity style={st.actionBtn} onPress={handleDownload} disabled={busy !== null}>
            {busy === "download" ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="print-outline" size={20} color={colors.primary} />}
            <Text style={st.actionLbl}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.actionBtn} onPress={handleShare} disabled={busy !== null}>
            {busy === "share" ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="share-outline" size={20} color={colors.primary} />}
            <Text style={st.actionLbl}>Share</Text>
          </TouchableOpacity>
          {canEditSale(txn, permissions, memberId) && EDITABLE_TYPES.has(txn.type) && (
            <TouchableOpacity style={st.actionBtn} onPress={handleEdit} disabled={busy !== null}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
              <Text style={st.actionLbl}>Edit</Text>
            </TouchableOpacity>
          )}
          {canDelete && (
            <TouchableOpacity style={st.actionBtn} onPress={handleDelete} disabled={busy !== null}>
              {busy === "delete" ? <ActivityIndicator size="small" color="#dc2626" /> : <Ionicons name="trash-outline" size={20} color="#dc2626" />}
              <Text style={[st.actionLbl, { color: "#dc2626" }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>

        {!EDITABLE_TYPES.has(txn.type) && (
          <Text style={st.editHint}>Editing {txn.type.replace(/_/g, " ")} entries isn't supported on mobile yet — use the desktop app.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  errorTxt: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  backBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 100 },
  backBtnTxt: { color: "#fff", fontWeight: "600", fontSize: 13 },

  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },

  card: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 14,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeTxt: { fontSize: 11, fontWeight: "700" },
  num: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  date: { fontSize: 12.5, color: colors.textMuted, marginTop: 8 },

  amtRow: { flexDirection: "row", marginTop: 16, gap: 8 },
  amtCol: { flex: 1 },
  amtLbl: { fontSize: 11, color: colors.textMuted, fontWeight: "500", marginBottom: 3 },
  amtVal: { fontSize: 15, fontWeight: "700", color: colors.text },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight, gap: 8 },
  itemName: { flex: 1, fontSize: 13, color: colors.text },
  itemQty: { fontSize: 12, color: colors.textMuted, minWidth: 60, textAlign: "right" },
  itemAmt: { fontSize: 13, fontWeight: "600", color: colors.text, minWidth: 80, textAlign: "right" },

  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, alignItems: "center", gap: 4, backgroundColor: "#fff",
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12,
  },
  actionLbl: { fontSize: 11.5, fontWeight: "600", color: colors.primary },
  editHint: { fontSize: 11.5, color: colors.textMuted, textAlign: "center", marginTop: 14, lineHeight: 16 },
});

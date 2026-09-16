import { useState, useMemo, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { useParties } from "../../src/useParties";
import { api } from "../../src/auth";
import type { Transaction } from "@vyapar/api-client";

const TXN_TYPE_LABEL: Record<string, string> = {
  sale: "Sale Invoice",
  purchase: "Purchase Bill",
  payment_in: "Payment-In",
  payment_out: "Payment-Out",
  credit_note: "Sale Return",
  debit_note: "Purchase Return",
  expense: "Expense",
  opening_balance: "Opening Balance",
  estimate: "Estimate",
  proforma_invoice: "Proforma Invoice",
  sale_order: "Sale Order",
  purchase_order: "Purchase Order",
  delivery_challan: "Delivery Challan",
};

// "Total"/second-amount labels + a status badge — mirrors how the desktop and Vyapar's own
// app describe a payment's unallocated portion ("Unused") vs an invoice's outstanding
// portion ("Unpaid") using the exact same underlying balance field, just worded per type.
function statusFor(t: Transaction): { label: string; tone: "warn" | "ok" | "neutral" } | null {
  if (t.type === "sale" || t.type === "purchase") {
    if (t.balance === 0) return { label: "PAID", tone: "ok" };
    if (t.balance === t.total) return { label: "UNPAID", tone: "warn" };
    return { label: "PARTIAL", tone: "warn" };
  }
  if (t.type === "payment_in" || t.type === "payment_out") {
    if (t.balance === 0) return { label: "USED", tone: "ok" };
    if (t.balance === t.total) return { label: "UNUSED", tone: "warn" };
    return { label: "PARTIALLY USED", tone: "warn" };
  }
  return null;
}

function secondAmountLabel(t: Transaction): string {
  if (t.type === "payment_in" || t.type === "payment_out") return "Unused";
  return "Balance";
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours(), h12 = h % 12 || 12, ampm = h < 12 ? "AM" : "PM";
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]}, ${String(d.getFullYear()).slice(-2)} · ${h12}:${mm} ${ampm}`;
}

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function PartyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parties } = useParties();
  const party = parties.find((p) => p.id === id);

  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Capped — a party can have years of history (found via Safal Traders: hundreds of rows
  // for one supplier), and fetching everything made this screen hang on a loading spinner
  // before rendering a single row. This is a recent-activity view, not a full ledger — use
  // Send Statement for a complete, date-ranged export of everything.
  const RECENT_TAKE = 200;

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let alive = true;
      setLoading(true);
      api.getPartyTransactions(id, { take: RECENT_TAKE })
        .then((data) => { if (alive) setTxns(data); })
        .catch(() => { if (alive) setTxns([]); })
        .finally(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }, [id])
  );

  const filtered = useMemo(() => {
    const sorted = [...txns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) =>
      (t.number ?? "").toLowerCase().includes(q) || (TXN_TYPE_LABEL[t.type] ?? t.type).toLowerCase().includes(q)
    );
  }, [txns, search]);

  function sendReminder() {
    if (!party) return;
    if (!party.phone) { Alert.alert("No phone number", "Add a phone number for this party first."); return; }
    const balance = party.balance ?? 0;
    const msg = balance > 0
      ? `Dear ${party.name}, a gentle reminder that Rs ${fmtAmt(balance)} is outstanding against your account. Please arrange payment at your earliest convenience.`
      : `Dear ${party.name}, thank you for your business.`;
    const digits = party.phone.replace(/[^0-9]/g, "");
    Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`).catch(() => {
      Alert.alert("Couldn't open WhatsApp", "Make sure WhatsApp is installed.");
    });
  }

  if (!party) {
    return (
      <View style={[s.screen, { paddingTop: insets.top, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isReceivable = (party.balance ?? 0) >= 0;

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Party Details</Text>
      </View>

      {/* Balance card */}
      <View style={s.balanceCard}>
        <View style={s.balanceCardTop}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{party.name[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.partyName}>{party.name}</Text>
            {party.phone && <Text style={s.partyPhone}>{party.phone}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={s.balanceRow}>
              <Ionicons name={isReceivable ? "arrow-down" : "arrow-up"} size={13} color={isReceivable ? colors.green : colors.red} />
              <Text style={[s.balanceTxt, { color: isReceivable ? colors.green : colors.red }]}>
                {isReceivable ? "Receivable" : "Payable"}: Rs {fmtAmt(party.balance ?? 0)}
              </Text>
            </View>
            <Text style={s.creditLimit}>
              {party.creditLimit ? `Credit Limit: Rs ${fmtAmt(party.creditLimit)}` : "No Credit Limit Set"}
            </Text>
          </View>
        </View>

        <View style={s.actionsRow}>
          <TouchableOpacity style={s.actionBtn} onPress={sendReminder}>
            <Ionicons name="notifications-outline" size={16} color={colors.primary} />
            <Text style={s.actionTxt}>Send Reminder</Text>
          </TouchableOpacity>
          <View style={s.actionsDivider} />
          <TouchableOpacity style={s.actionBtn} onPress={() => router.push(`/party/statement?partyId=${id}` as never)}>
            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
            <Text style={s.actionTxt}>Send Statement</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={16} color={colors.textLight} />
        <TextInput
          style={s.searchInput}
          placeholder="Search Transactions"
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Transaction list */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="document-text-outline" size={40} color={colors.textLight} />
          <Text style={s.emptyTitle}>{search ? "No matching transactions" : "No transactions yet"}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 90, gap: 10 }}
          ListFooterComponent={
            txns.length >= RECENT_TAKE && !search ? (
              <TouchableOpacity style={s.moreHint} onPress={() => router.push(`/party/statement?partyId=${id}` as never)}>
                <Text style={s.moreHintTxt}>Showing the {RECENT_TAKE} most recent — see full history in Send Statement</Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => {
            const status = statusFor(item);
            return (
              <TouchableOpacity style={s.txnCard} activeOpacity={0.7} onPress={() => router.push(`/txn/${item.id}` as never)}>
                <View style={s.txnTop}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    <Text style={s.txnType}>{TXN_TYPE_LABEL[item.type] ?? item.type}</Text>
                    {status && (
                      <View style={[s.badge, status.tone === "ok" ? s.badgeOk : s.badgeWarn]}>
                        <Text style={[s.badgeTxt, status.tone === "ok" ? s.badgeTxtOk : s.badgeTxtWarn]}>{status.label}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.txnDate}>{fmtDateTime(item.date)}</Text>
                </View>
                <View style={s.txnBottom}>
                  <View>
                    <Text style={s.amtLabel}>Total</Text>
                    <Text style={s.amtVal}>Rs {fmtAmt(item.total)}</Text>
                  </View>
                  <View>
                    <Text style={s.amtLabel}>{secondAmountLabel(item)}</Text>
                    <Text style={[s.amtVal, item.balance > 0 && s.amtValRed]}>Rs {fmtAmt(item.balance)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Bottom actions */}
      <View style={[s.fabBar, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={s.takePaymentBtn}
          onPress={() => router.push(`/payment-in/new?prefillPartyId=${id}&prefillPartyName=${encodeURIComponent(party.name)}` as never)}
        >
          <Text style={s.takePaymentTxt}>Take Payment</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.addSaleBtn}
          onPress={() => router.push(`/sale/new?prefillPartyName=${encodeURIComponent(party.name)}` as never)}
        >
          <Text style={s.addSaleTxt}>Add Sale</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text },

  balanceCard: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border },
  balanceCardTop: { flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight + "22",
    alignItems: "center", justifyContent: "center",
  },
  avatarTxt: { fontSize: 18, fontWeight: "700", color: colors.primary },
  partyName: { fontSize: 16, fontWeight: "700", color: colors.text },
  partyPhone: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  balanceTxt: { fontSize: 14, fontWeight: "700" },
  creditLimit: { fontSize: 11.5, color: colors.textLight, marginTop: 3 },

  actionsRow: {
    flexDirection: "row", alignItems: "center",
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12,
  },
  actionTxt: { fontSize: 13, fontWeight: "600", color: colors.primary },
  actionsDivider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginVertical: 8 },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", margin: 12, marginBottom: 0,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  emptyTitle: { fontSize: 14, color: colors.textMuted },
  moreHint: { paddingVertical: 14, alignItems: "center" },
  moreHintTxt: { fontSize: 12, color: colors.primary, fontWeight: "600", textAlign: "center" },

  txnCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border, gap: 10,
  },
  txnTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  txnType: { fontSize: 14, fontWeight: "700", color: colors.text },
  txnDate: { fontSize: 11.5, color: colors.textLight },
  badge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOk: { backgroundColor: colors.greenLight },
  badgeWarn: { backgroundColor: "#fef3c7" },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
  badgeTxtOk: { color: colors.green },
  badgeTxtWarn: { color: "#b45309" },
  txnBottom: { flexDirection: "row", alignItems: "center", gap: 20 },
  amtLabel: { fontSize: 11, color: colors.textLight },
  amtVal: { fontSize: 13.5, fontWeight: "700", color: colors.text, marginTop: 1 },
  amtValRed: { color: colors.red },

  fabBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 10, padding: 12,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border,
  },
  takePaymentBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 100,
    paddingVertical: 13, alignItems: "center",
  },
  takePaymentTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  addSaleBtn: {
    flex: 1, backgroundColor: colors.red, borderRadius: 100,
    paddingVertical: 13, alignItems: "center",
  },
  addSaleTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

import { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Modal, Pressable, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import type { BankAccount } from "@vyapar/api-client";

type TransferOption = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

const TRANSFER_OPTIONS: TransferOption[] = [
  { label: "Bank to Cash Transfer", icon: "business-outline" },
  { label: "Cash to Bank Transfer", icon: "cash-outline" },
  { label: "Bank to Bank Transfer", icon: "swap-horizontal-outline" },
  { label: "Adjust Bank Balance",   icon: "create-outline" },
];

function fmtAmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export default function BankAccountsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BankAccount | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getBankAccounts();
      setAccounts(data);
    } catch { /* offline */ }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  function handleDelete(id: string) {
    Alert.alert("Delete Account", "Remove this bank account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.deleteBankAccount(id);
            setAccounts(prev => prev.filter(a => a.id !== id));
          } catch {
            Alert.alert("Error", "Could not delete account.");
          }
        },
      },
    ]);
  }

  function handleTransferOption(option: TransferOption) {
    setSelected(null);
    Alert.alert(option.label, "Coming soon.");
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Bank Accounts List</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={a => a.id}
          contentContainerStyle={[s.list, accounts.length === 0 && s.listEmpty]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.8}
              onPress={() => setSelected(item)}
              onLongPress={() => handleDelete(item.id)}
            >
              <Text style={s.cardName}>{item.name}</Text>
              <Text style={s.cardBal}>Rs {fmtAmt(item.openingBalance)}</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="business-outline" size={52} color={colors.border} />
              <Text style={s.emptyTxt}>No bank accounts yet.</Text>
              <Text style={s.emptySub}>Tap Add Bank to create one.</Text>
            </View>
          }
        />
      )}

      {/* Bottom buttons */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={s.addBankBtn}
          onPress={() => router.push("/cash-bank/add" as never)}
        >
          <Text style={s.addBankTxt}>Add Bank</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.depositBtn}>
          <Text style={s.depositTxt}>Deposit / Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Transfer options bottom sheet */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.modalBg}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSelected(null)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetGrid}>
              {TRANSFER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={s.transferItem}
                  onPress={() => handleTransferOption(opt)}
                  activeOpacity={0.75}
                >
                  <View style={s.transferIcon}>
                    <Ionicons name={opt.icon} size={28} color="#1e3a5f" />
                  </View>
                  <Text style={s.transferLabel}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#dde8f5" },

  appBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#e8ecf0",
  },
  appBarTitle: { fontSize: 17, fontWeight: "600", color: colors.text },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16 },
  listEmpty: { flex: 1 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardName: { fontSize: 15, fontWeight: "500", color: colors.text },
  cardBal:  { fontSize: 15, fontWeight: "600", color: "#16a34a" },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, marginTop: 80 },
  emptyTxt:  { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  emptySub:  { fontSize: 12, color: colors.textLight },

  bottomBar: {
    flexDirection: "row", gap: 12,
    backgroundColor: "#dde8f5", paddingHorizontal: 16, paddingTop: 12,
  },
  addBankBtn: {
    flex: 1, borderRadius: 100, borderWidth: 1.5, borderColor: colors.red,
    paddingVertical: 14, alignItems: "center",
    backgroundColor: "#fff",
  },
  addBankTxt: { fontSize: 14, fontWeight: "700", color: colors.red },
  depositBtn: {
    flex: 1, borderRadius: 100, backgroundColor: colors.red,
    paddingVertical: 14, alignItems: "center",
  },
  depositTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  /* ── Sheet ── */
  modalBg: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 10,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#d1d5db", alignSelf: "center", marginBottom: 20,
  },
  sheetGrid: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-evenly", paddingBottom: 8,
  },
  transferItem: {
    width: "45%", alignItems: "center", gap: 12, paddingVertical: 20,
  },
  transferIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#e8f1fa",
    alignItems: "center", justifyContent: "center",
  },
  transferLabel: {
    fontSize: 13, fontWeight: "500", color: colors.text,
    textAlign: "center", lineHeight: 18,
  },
});

import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import { useSelectedCompany } from "../../src/useSelectedCompany";
import type { StockTransfer } from "@vyapar/api-client";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function StockTransferHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedCompanyId } = useSelectedCompany();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!selectedCompanyId) { setTransfers([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await api.getStockTransfers({ companyId: selectedCompanyId, take: 50 });
      setTransfers(rows);
    } catch {
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Stock Transfer</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {transfers.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="swap-horizontal-outline" size={44} color={colors.textLight} />
              <Text style={styles.emptyTxt}>No transfers yet.</Text>
            </View>
          )}
          {transfers.map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardRoute}>{t.fromStoreName} → {t.toStoreName}</Text>
                <Text style={styles.cardDate}>{fmtDate(t.date)}</Text>
              </View>
              <Text style={styles.cardItems} numberOfLines={2}>
                {t.lines.map((l) => `${l.itemName} (${l.quantity})`).join(", ")}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={[styles.fabWrap, { bottom: 24 + (insets.bottom || 8) }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/stock-transfer/new" as never)}
          activeOpacity={0.85}
        >
          <View style={styles.fabPlus}><Text style={styles.fabPlusTxt}>+</Text></View>
          <Text style={styles.fabLabel}>New Transfer</Text>
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
  body: { padding: 16, paddingBottom: 110 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  emptyTxt: { fontSize: 13.5, color: colors.textMuted },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardRoute: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  cardDate: { fontSize: 11.5, color: colors.textLight },
  cardItems: { fontSize: 12, color: colors.textMuted, marginTop: 6 },

  fabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  fab: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: colors.primary, borderRadius: 100,
    paddingHorizontal: 24, paddingVertical: 13,
    shadowColor: colors.primary, shadowOpacity: 0.32, shadowRadius: 20, elevation: 8,
  },
  fabPlus: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  fabPlusTxt: { fontSize: 18, fontWeight: "700", color: "#fff", lineHeight: 20 },
  fabLabel: { fontSize: 14, fontWeight: "600", color: "#fff" },
});

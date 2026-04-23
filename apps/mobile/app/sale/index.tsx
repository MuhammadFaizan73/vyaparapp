import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

type Sale = {
  id: string;
  party: string;
  status: "UNPAID" | "PAID";
  number: string;
  type: "Sale" | "PoS Sale";
  amount: number;
  balance: number;
  date: string;
};

const MOCK_SALES: Sale[] = [
  { id: "5", party: "Noor Medical store", status: "UNPAID", number: "Sale #5", type: "Sale", amount: 40000, balance: 40000, date: "25 Mar, 26" },
  { id: "4", party: "Noor Medical store", status: "PAID", number: "PoS Sale #4", type: "PoS Sale", amount: 40000, balance: 0, date: "19 Mar, 26" },
  { id: "3", party: "Cash Sale", status: "PAID", number: "PoS Sale #3", type: "PoS Sale", amount: 40000, balance: 0, date: "19 Mar, 26" },
  { id: "2", party: "Noor Medical store", status: "UNPAID", number: "Sale #2", type: "Sale", amount: 40000, balance: 40000, date: "19 Mar, 26" },
  { id: "1", party: "Noor Medical store", status: "UNPAID", number: "Sale #1", type: "Sale", amount: 1000, balance: 1000, date: "19 Mar, 26" },
];

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2 });
}

export default function SaleListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const total = MOCK_SALES.reduce((s, i) => s + i.amount, 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sale list</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pdfBtn}>
            <Text style={styles.pdfText}>Pdf</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Total card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Sale</Text>
          <Text style={styles.totalAmount}>Rs {fmt(total)}</Text>
        </View>

        {/* Sale items */}
        {MOCK_SALES.map((sale) => (
          <View key={sale.id} style={styles.saleCard}>
            <View style={styles.saleTop}>
              <View style={styles.saleTopLeft}>
                <Text style={styles.saleParty}>{sale.party}</Text>
                <View style={[styles.statusBadge, sale.status === "PAID" ? styles.statusPaid : styles.statusUnpaid]}>
                  <Text style={[styles.statusText, sale.status === "PAID" ? styles.statusTextPaid : styles.statusTextUnpaid]}>
                    {sale.status}
                  </Text>
                </View>
              </View>
              <View style={styles.saleTopRight}>
                <Text style={styles.saleNumber}>{sale.number}</Text>
                <Text style={styles.saleDate}>{sale.date}</Text>
              </View>
            </View>

            <Text style={styles.saleAmount}>Rs {fmt(sale.amount)}</Text>

            <View style={styles.saleBottom}>
              <Text style={styles.saleBalance}>Balance: Rs {fmt(sale.balance)}</Text>
              <View style={styles.saleActions}>
                <TouchableOpacity style={styles.actionBtn}>
                  <Text style={styles.actionIcon}>🖨️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                  <Text style={styles.actionIcon}>↗</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                  <Text style={styles.actionIcon}>⋮</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Floating Add Sale button */}
      <View style={[styles.fabContainer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.fab} onPress={() => router.push("/sale/new")}>
          <Text style={styles.fabText}>+ Add Sale</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { marginRight: 8 },
  backArrow: { fontSize: 22, color: colors.text },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconBtn: { padding: 4 },
  headerIcon: { fontSize: 18 },
  pdfBtn: {
    backgroundColor: colors.red,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pdfText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  scroll: { flex: 1 },

  totalCard: {
    backgroundColor: colors.card,
    margin: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  totalAmount: { fontSize: 20, fontWeight: "700", color: colors.text },

  saleCard: {
    backgroundColor: colors.card,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saleTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  saleTopLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  saleTopRight: { alignItems: "flex-end" },
  saleParty: { fontSize: 14, fontWeight: "600", color: colors.text },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPaid: { backgroundColor: colors.greenLight },
  statusUnpaid: { backgroundColor: "#fff7ed" },
  statusText: { fontSize: 11, fontWeight: "700" },
  statusTextPaid: { color: colors.green },
  statusTextUnpaid: { color: colors.orange },
  saleNumber: { fontSize: 12, color: colors.textMuted },
  saleDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  saleAmount: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 10 },
  saleBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  saleBalance: { fontSize: 13, color: colors.textMuted },
  saleActions: { flexDirection: "row", gap: 14, alignItems: "center" },
  actionBtn: { padding: 2 },
  actionIcon: { fontSize: 16, color: colors.textMuted },

  fabContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  fab: {
    backgroundColor: colors.red,
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});

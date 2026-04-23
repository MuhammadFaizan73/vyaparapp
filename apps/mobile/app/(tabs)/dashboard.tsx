import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

function StatCard({ label, value, valueColor = colors.text }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoIcon}>⊡</Text>
        </View>
        <Text style={styles.headerTitle}>Rootocloud</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIconText}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIconText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Sale & Purchase summary */}
        <View style={styles.row}>
          <StatCard label="Total Sale (Apr)" value="Rs 0.00" valueColor={colors.green} />
          <StatCard label="Total Purchase (Apr)" value="Rs 0.00" valueColor={colors.red} />
        </View>

        {/* Profit */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profit (Apr)</Text>
          <Text style={[styles.cardBigValue, { color: colors.green }]}>Rs 0.00</Text>
        </View>

        {/* Expenses */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Expenses (Apr)</Text>
          <Text style={[styles.cardBigValue, { color: colors.text }]}>Rs 0.00</Text>
        </View>

        {/* Cash & Bank */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cash &amp; Bank</Text>
          <View style={styles.cashRow}>
            <Text style={styles.cashLabel}>Cash In-Hand</Text>
            <Text style={[styles.cashValue, { color: colors.green }]}>Rs 1,30,000.00</Text>
          </View>
        </View>

        {/* Inventory */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Inventory</Text>
          <View style={styles.inventoryGrid}>
            <View style={styles.inventoryCell}>
              <Text style={styles.inventoryCellLabel}>Stock Value</Text>
              <Text style={[styles.inventoryCellValue, { color: colors.green }]}>Rs 0.00</Text>
            </View>
            <View style={[styles.inventoryCell, styles.inventoryCellRight]}>
              <Text style={styles.inventoryCellLabel}>No. of Items</Text>
              <Text style={styles.inventoryCellValue}>2</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.lowStockRow}>
            <Text style={styles.lowStockText}>Low Stock Items (2)</Text>
            <Text style={styles.lowStockChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.lowStockItem}>
            <Text style={styles.lowStockItemName}>Sample Item</Text>
            <Text style={styles.lowStockItemQty}>-10.0</Text>
          </View>
          <View style={[styles.lowStockItem, { borderBottomWidth: 0 }]}>
            <Text style={styles.lowStockItemName}>Infinix NOte 50</Text>
            <Text style={styles.lowStockItemQty}>-4.0</Text>
          </View>
        </View>

        {/* Expenses breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Expenses</Text>
          <View style={[styles.lowStockItem, { borderBottomWidth: 0 }]}>
            <Text style={styles.lowStockItemName}>Manufacturing Expense</Text>
            <Text style={[styles.lowStockItemQty, { color: colors.red }]}>Rs 0.00</Text>
          </View>
        </View>
      </ScrollView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#bae6fd",
  },
  logoIcon: { fontSize: 18 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text },
  headerIcons: { flexDirection: "row", gap: 8 },
  headerIconBtn: { padding: 6 },
  headerIconText: { fontSize: 18 },

  scroll: { flex: 1 },

  row: { flexDirection: "row", gap: 10, margin: 12, marginBottom: 0 },

  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: "700" },

  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    margin: 12,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 10 },
  cardBigValue: { fontSize: 20, fontWeight: "700" },

  cashRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cashLabel: { fontSize: 14, color: colors.textMuted },
  cashValue: { fontSize: 16, fontWeight: "700" },

  inventoryGrid: {
    flexDirection: "row",
    marginBottom: 12,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  inventoryCell: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 12,
  },
  inventoryCellRight: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  inventoryCellLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  inventoryCellValue: { fontSize: 16, fontWeight: "700", color: colors.text },

  lowStockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  lowStockText: { fontSize: 13, color: colors.primary },
  lowStockChevron: { fontSize: 16, color: colors.primary },
  lowStockItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  lowStockItemName: { fontSize: 13, color: colors.text },
  lowStockItemQty: { fontSize: 13, color: colors.textMuted },
});

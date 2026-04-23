import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors } from "../../src/theme";

const QUICK_ACTIONS = [
  { label: "Sale Invoice", icon: "🧾", route: "/sale" },
  { label: "Payment-In", icon: "💰", route: "/payment-in" },
  { label: "Purchase", icon: "🛒", route: "/purchase" },
  { label: "Expense", icon: "📋", route: "/expense" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
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

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.quickCard}
              onPress={() => router.push(a.route as never)}
            >
              <Text style={styles.quickIcon}>{a.icon}</Text>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Sale (Today)</Text>
          <Text style={[styles.cardValue, { color: colors.green }]}>Rs 0.00</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Purchase (Today)</Text>
          <Text style={[styles.cardValue, { color: colors.red }]}>Rs 0.00</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cash In-Hand</Text>
          <Text style={[styles.cardValue, { color: colors.green }]}>Rs 1,30,000.00</Text>
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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#e0f2fe", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#bae6fd",
  },
  logoIcon: { fontSize: 18 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text },
  headerIcons: { flexDirection: "row", gap: 8 },
  headerIconBtn: { padding: 6 },
  headerIconText: { fontSize: 18 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: {
    width: "47%",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIcon: { fontSize: 26 },
  quickLabel: { fontSize: 13, fontWeight: "600", color: colors.text, textAlign: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  cardValue: { fontSize: 20, fontWeight: "700" },
});

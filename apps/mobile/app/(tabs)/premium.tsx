import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Get Premium</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.icon}>💎</Text>
        <Text style={styles.title}>Unlock Vyapar Premium</Text>
        <Text style={styles.sub}>Access all features with a license key.</Text>
        <TouchableOpacity style={styles.btn}>
          <Text style={styles.btnText}>Activate License</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  icon: { fontSize: 56 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center" },
  sub: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  btn: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  btnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});

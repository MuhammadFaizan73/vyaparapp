import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";

const PLANS = [
  {
    name: "Free", price: 0, period: "", current: true,
    features: ["Up to 5 invoices", "Basic reports", "1 user"],
    cta: "Current plan",
  },
  {
    name: "Saver", price: 199, period: "/month", highlight: true,
    features: ["Unlimited invoices", "GST reports", "2 users", "Online backup"],
    cta: "Choose Saver",
  },
  {
    name: "Premium", price: 399, period: "/month",
    features: ["Everything in Saver", "Multi-device sync", "5 users", "Priority support", "Custom branding"],
    cta: "Choose Premium",
  },
];

export default function PlansPricingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Plans & Pricing</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* Promo hero */}
        <LinearGradient
          colors={[colors.primaryLight, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promoCard}
        >
          <Text style={styles.promoEyebrow}>Upgrade</Text>
          <Text style={styles.promoTitle}>Run your business without limits</Text>
          <Text style={styles.promoSub}>Unlock GST filing, multi-device sync, and unlimited invoicing.</Text>
        </LinearGradient>

        {/* Plan cards */}
        {PLANS.map((p) => (
          <View key={p.name} style={[styles.planCard, p.highlight && styles.planCardHighlight]}>
            {p.highlight && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeTxt}>POPULAR</Text>
              </View>
            )}
            <View style={styles.planTop}>
              <Text style={styles.planName}>{p.name}</Text>
              <View style={styles.planPriceRow}>
                <Text style={styles.planPrice}>₨ {p.price}</Text>
                {p.period ? <Text style={styles.planPeriod}>{p.period}</Text> : null}
              </View>
            </View>
            <View style={styles.planFeatures}>
              {p.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <View style={[styles.checkCircle, p.highlight ? styles.checkFilled : styles.checkLight]}>
                    <Ionicons name="checkmark" size={10} color={p.highlight ? "#fff" : colors.green} />
                  </View>
                  <Text style={styles.featureTxt}>{f}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.planBtn,
                p.current ? styles.planBtnDisabled : p.highlight ? styles.planBtnPrimary : styles.planBtnOutline,
              ]}
              disabled={p.current}
            >
              <Text style={[
                styles.planBtnTxt,
                p.current ? styles.planBtnTxtGray : p.highlight ? styles.planBtnTxtWhite : styles.planBtnTxtPrimary,
              ]}>{p.cta}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
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
  body: { padding: 18, paddingBottom: 60, gap: 12 },

  promoCard: { borderRadius: 16, padding: 22 },
  promoEyebrow: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  promoTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginTop: 6 },
  promoSub: { fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 6, lineHeight: 19 },

  planCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: colors.border, position: "relative",
  },
  planCardHighlight: { borderWidth: 2, borderColor: colors.primary },
  popularBadge: {
    position: "absolute", top: -10, right: 16,
    backgroundColor: "#f59e0b", borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  popularBadgeTxt: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.4 },
  planTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  planName: { fontSize: 16, fontWeight: "700", color: colors.text },
  planPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  planPrice: { fontSize: 22, fontWeight: "700", color: colors.text },
  planPeriod: { fontSize: 11.5, color: colors.textLight },
  planFeatures: { marginTop: 14, gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  checkCircle: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkFilled: { backgroundColor: colors.primary },
  checkLight: { backgroundColor: colors.greenLight },
  featureTxt: { fontSize: 12.5, color: "#334155" },
  planBtn: { width: "100%", marginTop: 16, paddingVertical: 12, borderRadius: 100, alignItems: "center" },
  planBtnDisabled: { backgroundColor: "#f1f5f9" },
  planBtnPrimary: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  planBtnOutline: { borderWidth: 1.5, borderColor: colors.primary },
  planBtnTxt: { fontSize: 13, fontWeight: "600" },
  planBtnTxtGray: { color: colors.textLight },
  planBtnTxtWhite: { color: "#fff" },
  planBtnTxtPrimary: { color: colors.primary },
});

import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import { LicenseActivationForm } from "../../src/LicenseActivationForm";
import type { LicenseStatus } from "@vyapar/api-client";

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

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.getLicenseStatus("mobile")
      .then(setLicenseStatus)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  async function handleActivated(status: LicenseStatus) {
    setLicenseStatus(status);
  }

  const isLicensed = licenseStatus?.state === "licensed";
  const isExpired = licenseStatus?.state === "trial_expired" || licenseStatus?.state === "license_expired";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Plans & Pricing</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* Status banner */}
        {!checking && licenseStatus && (
          <View style={[
            styles.statusCard,
            isLicensed ? styles.statusGreen : isExpired ? styles.statusRed : styles.statusBlue,
          ]}>
            <Text style={styles.statusIcon}>
              {isLicensed ? "✅" : isExpired ? "🔒" : "⏳"}
            </Text>
            <View>
              <Text style={styles.statusTitle}>
                {isLicensed ? "Mobile Licensed" : isExpired ? "Access Expired" : `Trial Active — ${licenseStatus.daysRemaining} days left`}
              </Text>
              {isLicensed && licenseStatus.license && (
                <Text style={styles.statusSub}>Key: {licenseStatus.license.key}</Text>
              )}
            </View>
          </View>
        )}

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
                <Text style={styles.planPeriod}>{p.period}</Text>
              </View>
            </View>
            <View style={styles.planFeatures}>
              {p.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <View style={[styles.checkCircle, p.highlight ? styles.checkCircleFilled : styles.checkCircleLight]}>
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
                p.current ? styles.planBtnTxtDisabled : p.highlight ? styles.planBtnTxtWhite : styles.planBtnTxtPrimary,
              ]}>{p.cta}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* License activation */}
        {!isLicensed && (
          <View style={styles.keySection}>
            <Text style={styles.keySectionTitle}>Activate a license</Text>
            <LicenseActivationForm onActivated={handleActivated} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  body: { padding: 18, paddingBottom: 110, gap: 12 },

  // Status
  statusCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, padding: 14, borderWidth: 1,
  },
  statusGreen: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  statusRed: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  statusBlue: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  statusIcon: { fontSize: 24 },
  statusTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  statusSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Promo
  promoCard: { borderRadius: 16, padding: 22 },
  promoEyebrow: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  promoTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginTop: 6, letterSpacing: -0.2 },
  promoSub: { fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 6, lineHeight: 19 },

  // Plan cards
  planCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: colors.border,
    position: "relative",
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
  planPrice: { fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  planPeriod: { fontSize: 11.5, color: colors.textLight, marginLeft: 2 },
  planFeatures: { marginTop: 14, gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  checkCircle: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkCircleFilled: { backgroundColor: colors.primary },
  checkCircleLight: { backgroundColor: colors.greenLight },
  featureTxt: { fontSize: 12.5, color: "#334155" },
  planBtn: { width: "100%", marginTop: 16, paddingVertical: 12, borderRadius: 100, alignItems: "center" },
  planBtnDisabled: { backgroundColor: "#f1f5f9" },
  planBtnPrimary: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  planBtnOutline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#fff" },
  planBtnTxt: { fontSize: 13, fontWeight: "600" },
  planBtnTxtDisabled: { color: colors.textLight },
  planBtnTxtWhite: { color: "#fff" },
  planBtnTxtPrimary: { color: colors.primary },

  // Key section
  keySection: { gap: 12 },
  keySectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, paddingTop: 8 },
});

import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import type { LicenseStatus } from "@vyapar/api-client";

const DEMO_KEYS = ["MOBI-VYPR-2026-0001", "MOBI-VYPR-2026-0002", "MOBI-VYPR-2026-0003"];

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.getLicenseStatus("mobile")
      .then(setLicenseStatus)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  async function handleActivate() {
    const trimmed = key.trim().toUpperCase();
    if (trimmed.length < 8) { setError("Enter a valid license key"); return; }
    setError(""); setSuccess("");
    setLoading(true);
    try {
      const status = await api.activateLicense(trimmed, "mobile");
      setLicenseStatus(status);
      setKey("");
      setSuccess("License activated successfully! You now have full access.");
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      if (!msg) {
        setError("Cannot connect to server. Check your Wi-Fi connection.");
      } else if (msg.includes("desktop")) {
        setError("This is a Desktop key. Use a MOBI-... key for mobile.");
      } else if (msg.includes("another account")) {
        setError("This key is already used by another account.");
      } else if (msg.includes("expired")) {
        setError("This license key has expired.");
      } else if (msg.includes("not found")) {
        setError("Key not found. Check the key and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const isLicensed = licenseStatus?.state === "licensed";
  const isExpired = licenseStatus?.state === "trial_expired" || licenseStatus?.state === "license_expired";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Get Premium</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Status badge */}
        {!checking && licenseStatus && (
          <View style={[styles.statusBadge, isLicensed ? styles.statusGreen : isExpired ? styles.statusRed : styles.statusBlue]}>
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

        <Text style={styles.icon}>💎</Text>
        <Text style={styles.title}>
          {isLicensed ? "Mobile Premium Active" : "Unlock Vyapar Mobile"}
        </Text>
        <Text style={styles.sub}>
          {isLicensed
            ? "You have full access to all mobile features."
            : "Enter a Mobile license key (MOBI-...) to get full access. Mobile and Desktop require separate keys."}
        </Text>

        {/* Key input */}
        {!isLicensed && (
          <View style={styles.inputSection}>
            <TextInput
              style={styles.input}
              placeholder="MOBI-XXXX-XXXX-XXXX"
              placeholderTextColor={colors.textLight}
              value={key}
              onChangeText={(t) => { setKey(t.toUpperCase()); setError(""); setSuccess(""); }}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.7 }]}
              onPress={handleActivate}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Activate License</Text>
              }
            </TouchableOpacity>

            {/* Demo keys */}
            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>Demo Keys (tap to fill)</Text>
              {DEMO_KEYS.map((k) => (
                <TouchableOpacity key={k} onPress={() => { setKey(k); setError(""); setSuccess(""); }}>
                  <Text style={styles.demoKey}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                📱 Mobile keys (MOBI-...) work only on mobile{"\n"}
                🖥️ Desktop keys (DESK-...) work only on desktop{"\n"}
                Each platform needs its own license key
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
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
  body: { alignItems: "center", padding: 24, gap: 14 },

  statusBadge: {
    width: "100%", flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 12, padding: 14, borderWidth: 1,
  },
  statusGreen: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  statusRed: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  statusBlue: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  statusIcon: { fontSize: 24 },
  statusTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  statusSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  icon: { fontSize: 56 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center" },
  sub: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },

  inputSection: { width: "100%", gap: 12 },
  input: {
    borderWidth: 2, borderColor: colors.gold, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: colors.text, backgroundColor: colors.card,
    letterSpacing: 1, textAlign: "center",
  },
  error: { fontSize: 13, color: colors.red, textAlign: "center" },
  successText: { fontSize: 13, color: colors.green, textAlign: "center", fontWeight: "600" },
  btn: {
    backgroundColor: colors.gold, borderRadius: 10,
    paddingVertical: 14, alignItems: "center",
  },
  btnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  demoBox: {
    backgroundColor: "#f0fdf4", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "#bbf7d0", gap: 8,
  },
  demoTitle: { fontSize: 12, fontWeight: "700", color: colors.green },
  demoKey: { fontSize: 13, color: colors.primary, textDecorationLine: "underline" },

  infoBox: {
    backgroundColor: "#eff6ff", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "#bfdbfe",
  },
  infoText: { fontSize: 12, color: colors.textMuted, lineHeight: 20 },
});

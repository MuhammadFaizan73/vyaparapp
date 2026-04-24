import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../src/theme";
import { api, saveToken } from "../src/auth";

const COUNTRIES = [
  { code: "PK", name: "Pakistan", dial: "+92" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "AE", name: "UAE", dial: "+971" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [showCountries, setShowCountries] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      setError("Enter a valid phone number");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const fullPhone = country.dial + cleaned;
      const res = await api.register({ phone: fullPhone, country: country.code });
      await saveToken(res.token);
      router.replace("/(tabs)" as never);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not connect. Check your Wi-Fi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.screen, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>⊡</Text>
          </View>
          <Text style={styles.appName}>Vyapar Pakistan</Text>
          <Text style={styles.tagline}>Business management made simple</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Get Started</Text>
          <Text style={styles.cardSub}>Enter your business phone number to continue.</Text>

          {/* Country selector */}
          <Text style={styles.label}>Country</Text>
          <TouchableOpacity
            style={styles.countryBtn}
            onPress={() => setShowCountries(!showCountries)}
          >
            <Text style={styles.countryBtnText}>{country.name} ({country.dial})</Text>
            <Text style={styles.chevron}>∨</Text>
          </TouchableOpacity>
          {showCountries && (
            <View style={styles.countryDropdown}>
              {COUNTRIES.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={styles.countryItem}
                  onPress={() => { setCountry(c); setShowCountries(false); }}
                >
                  <Text style={[styles.countryItemText, c.code === country.code && styles.countryItemActive]}>
                    {c.name} ({c.dial})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Phone input */}
          <Text style={[styles.label, { marginTop: 16 }]}>Phone Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.dialPrefix}>
              <Text style={styles.dialPrefixText}>{country.dial}</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="3001234567"
              placeholderTextColor={colors.textLight}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={12}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Continue →</Text>
            }
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By continuing you agree to our Terms of Service. Your data is securely synced across all your devices.
          </Text>
        </View>

        {/* Sync badge */}
        <View style={styles.syncBadge}>
          <Text style={styles.syncIcon}>🔄</Text>
          <Text style={styles.syncText}>Same phone number = same data on Desktop, Mobile & Web</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 24,
  },

  logoWrap: { alignItems: "center", gap: 10 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#e0f2fe",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#bae6fd",
  },
  logoIcon: { fontSize: 32 },
  appName: { fontSize: 22, fontWeight: "800", color: colors.text },
  tagline: { fontSize: 13, color: colors.textMuted },

  card: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
  cardSub: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },

  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 6 },

  countryBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },
  countryBtnText: { fontSize: 14, color: colors.text },
  chevron: { fontSize: 12, color: colors.textMuted },
  countryDropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    marginTop: 4,
    overflow: "hidden",
  },
  countryItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  countryItemText: { fontSize: 14, color: colors.text },
  countryItemActive: { color: colors.primary, fontWeight: "600" },

  phoneRow: { flexDirection: "row", gap: 8 },
  dialPrefix: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
  },
  dialPrefixText: { fontSize: 14, color: colors.text, fontWeight: "600" },
  phoneInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },

  error: { fontSize: 12, color: colors.red, marginTop: 4 },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  btnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  disclaimer: {
    fontSize: 11,
    color: colors.textLight,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 8,
  },

  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    width: "100%",
  },
  syncIcon: { fontSize: 18 },
  syncText: { flex: 1, fontSize: 12, color: colors.green, fontWeight: "500" },
});

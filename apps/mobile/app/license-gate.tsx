import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../src/theme";
import { api, clearToken } from "../src/auth";

export default function LicenseGateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleActivate() {
    const trimmed = key.trim().toUpperCase();
    if (trimmed.length < 8) {
      setError("Enter a valid license key");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.activateLicense(trimmed, "mobile");
      router.replace("/(tabs)" as never);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      if (msg?.includes("desktop")) {
        setError("This is a Desktop key. Mobile requires a separate Mobile license key.");
      } else {
        setError(msg || "Invalid or expired license key.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive", onPress: async () => {
          await clearToken();
          router.replace("/onboarding" as never);
        },
      },
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Icon */}
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🔒</Text>
      </View>

      <Text style={styles.title}>Mobile License Required</Text>
      <Text style={styles.sub}>
        Your free trial has ended. Activate a Mobile license key to continue using Vyapar Pakistan on this device.
      </Text>

      {/* Key input */}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="MOBI-XXXX-XXXX-XXXX"
          placeholderTextColor={colors.textLight}
          value={key}
          onChangeText={(t) => { setKey(t.toUpperCase()); setError(""); }}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

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

      {/* Info box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Mobile vs Desktop keys</Text>
        <Text style={styles.infoText}>
          Mobile keys (MOBI-...) work only on mobile devices.{"\n"}
          Desktop keys (DESK-...) work only on the desktop app.{"\n"}
          Each platform requires its own license.
        </Text>
      </View>

      {/* Demo keys hint */}
      <View style={styles.demoBox}>
        <Text style={styles.demoTitle}>Demo Keys (for testing)</Text>
        {["MOBI-VYPR-2026-0001", "MOBI-VYPR-2026-0002", "MOBI-VYPR-2026-0003"].map((k) => (
          <TouchableOpacity key={k} onPress={() => setKey(k)}>
            <Text style={styles.demoKey}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 16,
  },

  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#fef3c7",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fde68a",
  },
  icon: { fontSize: 36 },

  title: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center" },
  sub: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },

  inputWrap: { width: "100%" },
  input: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
    letterSpacing: 1,
    textAlign: "center",
  },

  error: { fontSize: 13, color: colors.red, textAlign: "center" },

  btn: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  infoBox: {
    width: "100%",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    gap: 6,
  },
  infoTitle: { fontSize: 13, fontWeight: "700", color: colors.primary },
  infoText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  demoBox: {
    width: "100%",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    gap: 8,
  },
  demoTitle: { fontSize: 13, fontWeight: "700", color: colors.green },
  demoKey: { fontSize: 13, color: colors.primary, fontFamily: "monospace", textDecorationLine: "underline" },

  logoutBtn: { paddingVertical: 8 },
  logoutText: { fontSize: 13, color: colors.textMuted, textDecorationLine: "underline" },
});

import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../src/theme";
import { clearToken } from "../src/auth";
import { LicenseActivationForm } from "../src/LicenseActivationForm";
import type { LicenseStatus } from "@vyapar/api-client";

export default function LicenseGateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function handleActivated(_status: LicenseStatus) {
    router.replace("/(tabs)" as never);
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
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🔒</Text>
      </View>

      <Text style={styles.title}>Mobile License Required</Text>
      <Text style={styles.sub}>
        Your free trial has ended. Enter the email your Godigi license was purchased under to continue.
      </Text>

      <View style={styles.formWrap}>
        <LicenseActivationForm onActivated={handleActivated} />
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

  formWrap: { width: "100%" },

  logoutBtn: { paddingVertical: 8 },
  logoutText: { fontSize: 13, color: colors.textMuted, textDecorationLine: "underline" },
});

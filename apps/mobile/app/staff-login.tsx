import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";
import { api, saveToken } from "../src/auth";

const ROLE_LABELS: Record<string, string> = {
  secondary_admin: "Secondary Admin",
  salesman: "Salesman",
  biller: "Biller",
  biller_salesman: "Biller and Salesman",
  ca_accountant: "CA / Accountant",
  stock_keeper: "Stock Keeper",
  ca_accountant_edit: "CA / Accountant (Edit)",
};

export default function StaffLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  async function handleLogin() {
    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed) { setError("Please enter your email."); return; }
    if (!password) { setError("Please enter your password."); return; }
    setError("");
    setLoading(true);
    try {
      const result = await api.staffLogin(emailTrimmed, password);
      await saveToken(result.token);
      router.replace("/(tabs)/dashboard" as never);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Invalid email or password.";
      setError(Array.isArray(msg) ? msg.join("\n") : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[s.screen, { paddingTop: insets.top }]}>
        {/* App bar */}
        <View style={s.appBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Icon */}
          <View style={s.iconWrap}>
            <Ionicons name="person-circle-outline" size={56} color={colors.primary} />
          </View>

          <Text style={s.heading}>Staff Login</Text>
          <Text style={s.sub}>
            Login with the email and password your employer set for your account.
          </Text>

          {/* Email */}
          <View style={[s.inputCard, emailFocused && s.inputCardFocused]}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={emailFocused ? colors.primary : colors.textLight}
              style={s.inputIcon}
            />
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          {/* Password */}
          <View style={[s.inputCard, passFocused && s.inputCardFocused]}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={passFocused ? colors.primary : colors.textLight}
              style={s.inputIcon}
            />
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.textLight}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setPassFocused(true)}
              onBlur={() => setPassFocused(false)}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.textLight}
              />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
              <Text style={s.errorTxt}>{error}</Text>
            </View>
          ) : null}

          {/* Login button */}
          <TouchableOpacity
            style={[s.btn, (!email.trim() || !password || loading) && s.btnDisabled]}
            onPress={handleLogin}
            disabled={!email.trim() || !password || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#fff" />
                <Text style={s.btnTxt}>Login</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Info cards */}
          <View style={s.infoRow}>
            <View style={s.infoCard}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
              <Text style={s.infoTxt}>Role-based access control</Text>
            </View>
            <View style={s.infoCard}>
              <Ionicons name="sync-outline" size={22} color={colors.primary} />
              <Text style={s.infoTxt}>Data syncs automatically</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  appBar: { paddingHorizontal: 8, paddingVertical: 8 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },

  body: {
    flexGrow: 1, paddingHorizontal: 24,
    paddingTop: 12, paddingBottom: 40,
    alignItems: "center",
  },

  iconWrap: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: colors.primary + "15",
    alignItems: "center", justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1.5, borderColor: colors.primary + "30",
  },

  heading: {
    fontSize: 24, fontWeight: "800", color: colors.text,
    textAlign: "center", letterSpacing: -0.5,
  },
  sub: {
    fontSize: 14, color: colors.textMuted, textAlign: "center",
    lineHeight: 21, marginTop: 10, marginBottom: 28,
    paddingHorizontal: 8,
  },

  inputCard: {
    width: "100%", flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 4,
    gap: 10, marginBottom: 12,
  },
  inputCardFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.12,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  inputIcon: { flexShrink: 0 },
  input: {
    flex: 1, fontSize: 15, color: colors.text,
    paddingVertical: 14,
  },

  errorBox: {
    width: "100%", flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#fef2f2", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#fca5a5", marginBottom: 16,
  },
  errorTxt: { flex: 1, fontSize: 13, color: colors.red, lineHeight: 18 },

  btn: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14, paddingVertical: 16,
    shadowColor: colors.primary, shadowOpacity: 0.3,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    marginTop: 4,
  },
  btnDisabled: { backgroundColor: "#94a3b8", shadowOpacity: 0, elevation: 0 },
  btnTxt: { fontSize: 16, fontWeight: "700", color: "#fff" },

  infoRow: { flexDirection: "row", gap: 12, marginTop: 32, width: "100%" },
  infoCard: {
    flex: 1, backgroundColor: "#fff",
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    padding: 14, alignItems: "center", gap: 8,
  },
  infoTxt: {
    fontSize: 11.5, color: colors.textMuted,
    textAlign: "center", lineHeight: 16,
  },
});

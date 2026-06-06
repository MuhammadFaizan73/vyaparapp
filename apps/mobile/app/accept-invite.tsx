import { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
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

export default function AcceptInviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  async function handleAccept() {
    const code = token.trim();
    if (!code) {
      Alert.alert("Required", "Please enter your invite code.");
      return;
    }
    setLoading(true);
    try {
      const result = await api.acceptInvite(code);
      await saveToken(result.token);
      Alert.alert(
        "Welcome aboard!",
        `You've joined as ${ROLE_LABELS[result.member.role] ?? result.member.role}. You now have access to the company data.`,
        [{ text: "Get Started", onPress: () => router.replace("/(tabs)/dashboard") }],
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Invalid invite code. Please check and try again.";
      Alert.alert("Invalid Code", Array.isArray(msg) ? msg.join("\n") : msg);
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
            <Ionicons name="people-circle" size={56} color={colors.primary} />
          </View>

          <Text style={s.heading}>Join Your Team</Text>
          <Text style={s.sub}>
            Enter the invite code your employer shared with you to access their company data.
          </Text>

          {/* Code input */}
          <TouchableOpacity
            style={[s.inputCard, focused && s.inputCardFocused]}
            onPress={() => inputRef.current?.focus()}
            activeOpacity={1}
          >
            <Ionicons
              name="key-outline"
              size={20}
              color={focused ? colors.primary : colors.textLight}
              style={s.inputIcon}
            />
            <TextInput
              ref={inputRef}
              style={s.input}
              value={token}
              onChangeText={setToken}
              placeholder="Paste your invite code here"
              placeholderTextColor={colors.textLight}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            {token.length > 0 && (
              <TouchableOpacity onPress={() => setToken("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textLight} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <Text style={s.hint}>
            Your employer sees this code after adding you as a user in their account.
          </Text>

          {/* Join button */}
          <TouchableOpacity
            style={[s.btn, (!token.trim() || loading) && s.btnDisabled]}
            onPress={handleAccept}
            disabled={!token.trim() || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={s.btnTxt}>Join Company</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Info cards */}
          <View style={s.infoRow}>
            <View style={s.infoCard}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#0f5a72" />
              <Text style={s.infoTxt}>Secure access with role permissions</Text>
            </View>
            <View style={s.infoCard}>
              <Ionicons name="sync-outline" size={22} color="#0f5a72" />
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

  appBar: {
    paddingHorizontal: 8, paddingVertical: 8,
  },
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
    lineHeight: 21, marginTop: 10, marginBottom: 32,
    paddingHorizontal: 8,
  },

  inputCard: {
    width: "100%", flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 4,
    gap: 10,
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
    paddingVertical: 14, letterSpacing: 0.3,
  },

  hint: {
    fontSize: 12, color: colors.textLight,
    textAlign: "center", marginTop: 10, marginBottom: 32,
    lineHeight: 18,
  },

  btn: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14, paddingVertical: 16,
    shadowColor: colors.primary, shadowOpacity: 0.3,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  btnDisabled: { backgroundColor: "#94a3b8", shadowOpacity: 0, elevation: 0 },
  btnTxt: { fontSize: 16, fontWeight: "700", color: "#fff" },

  infoRow: {
    flexDirection: "row", gap: 12, marginTop: 32, width: "100%",
  },
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

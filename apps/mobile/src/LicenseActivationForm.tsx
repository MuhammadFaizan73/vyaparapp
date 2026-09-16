import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { colors } from "./theme";
import { api } from "./auth";
import type { LicenseStatus, LicenseListingEntry } from "@vyapar/api-client";

type Stage = "email" | "list" | "key";
type Props = { onActivated: (status: LicenseStatus) => void | Promise<void> };

function extractError(e: any, fallback: string): string {
  const msg = e?.response?.data?.message;
  if (!msg) return fallback;
  return Array.isArray(msg) ? msg.join(", ") : String(msg);
}

const STATUS_LABEL: Record<LicenseListingEntry["status"], string> = {
  available: "Ready",
  taken: "Already in use",
  expired: "Expired",
};

// Shared by license-gate.tsx (forced gate on trial/license expiry) and the Premium tab's
// own "have a key?" section — the email → pick-a-license → activate flow lives here once.
// Every license is now bought against a customer email rather than handed out as a bare
// key, and one email can hold several (bought in bulk, or one per device) — so activation
// starts with an email lookup instead of a key field. A key is still accepted directly for
// a license bought through a reseller, who hands the customer the exact key.
export function LicenseActivationForm({ onActivated }: Props) {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [licenses, setLicenses] = useState<LicenseListingEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function lookupEmail() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) { setError("Enter a valid email address"); return; }
    setError("");
    setBusy(true);
    try {
      const all = await api.lookupLicenses(trimmed);
      const usable = all.filter((l) => l.platform === "mobile" || l.platform === "both");
      if (usable.length === 0) {
        setError("No mobile licenses found for this email. If you already have a license key, enter it below.");
        setStage("key");
      } else {
        setLicenses(usable);
        setStage("list");
      }
    } catch (e) {
      setError(extractError(e, "Cannot connect to server. Check your connection."));
    } finally {
      setBusy(false);
    }
  }

  async function activateByLicenseId(licenseId: string) {
    setError("");
    setBusy(true);
    setActivatingId(licenseId);
    try {
      const status = await api.activateLicense({ email: email.trim(), platform: "mobile", licenseId });
      await onActivated(status);
    } catch (e) {
      setError(extractError(e, "Could not activate."));
    } finally {
      setBusy(false);
      setActivatingId(null);
    }
  }

  async function activateByKey() {
    const trimmed = key.trim().toUpperCase();
    if (trimmed.length < 8) { setError("Enter a valid license key"); return; }
    if (!email.trim() || !email.includes("@")) { setError("Enter the email this license was registered to"); return; }
    setError("");
    setBusy(true);
    try {
      const status = await api.activateLicense({ email: email.trim(), platform: "mobile", key: trimmed });
      await onActivated(status);
    } catch (e) {
      setError(extractError(e, "Could not activate. Check the key and your connection."));
    } finally {
      setBusy(false);
    }
  }

  if (stage === "list") {
    return (
      <View>
        <Text style={s.hint}>Licenses for <Text style={s.hintStrong}>{email}</Text></Text>
        <View style={s.list}>
          {licenses.map((l) => (
            <View key={l.id} style={s.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={s.rowKey}>{l.maskedKey}</Text>
                <Text style={s.rowMeta} numberOfLines={1}>
                  {l.customerName ? `${l.customerName} · ` : ""}{l.plan} · {l.durationType} · expires {new Date(l.expiresAt).toLocaleDateString()}
                </Text>
              </View>
              {l.status === "available" ? (
                <TouchableOpacity
                  style={[s.rowBtn, busy && { opacity: 0.6 }]}
                  onPress={() => void activateByLicenseId(l.id)}
                  disabled={busy}
                >
                  {busy && activatingId === l.id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.rowBtnTxt}>Activate</Text>}
                </TouchableOpacity>
              ) : (
                <View style={[s.badge, l.status === "expired" && s.badgeExpired]}>
                  <Text style={[s.badgeTxt, l.status === "expired" && s.badgeTxtExpired]}>{STATUS_LABEL[l.status]}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity onPress={() => { setStage("email"); setError(""); }}>
          <Text style={s.link}>← Search a different email</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setStage("key"); setError(""); }}>
          <Text style={s.link}>Have a license key instead?</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (stage === "key") {
    return (
      <View>
        <Text style={s.label}>Email this license was registered to</Text>
        <TextInput
          style={s.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.textLight}
          value={email}
          onChangeText={(t) => { setEmail(t); setError(""); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <Text style={[s.label, { marginTop: 12 }]}>License key</Text>
        <TextInput
          style={s.input}
          placeholder="VYPR-XXXX-XXXX-XXXX"
          placeholderTextColor={colors.textLight}
          value={key}
          onChangeText={(t) => { setKey(t.toUpperCase()); setError(""); }}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={[s.btn, busy && { opacity: 0.7 }]} onPress={() => void activateByKey()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Activate License</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setStage("email"); setError(""); }}>
          <Text style={s.link}>← Look up licenses by email instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <Text style={s.label}>Email</Text>
      <TextInput
        style={s.input}
        placeholder="you@example.com"
        placeholderTextColor={colors.textLight}
        value={email}
        onChangeText={(t) => { setEmail(t); setError(""); }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <Text style={s.hint}>The email your license was purchased under — every license bought there will show up to activate.</Text>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity style={[s.btn, busy && { opacity: 0.7 }]} onPress={() => void lookupEmail()} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Find my licenses</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 8, marginBottom: 4, lineHeight: 17 },
  hintStrong: { fontWeight: "700", color: colors.text },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, backgroundColor: colors.card,
  },
  error: { fontSize: 12.5, color: colors.red, marginTop: 8, marginBottom: 4 },
  btn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  btnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  link: { fontSize: 12.5, fontWeight: "600", color: colors.primary, marginTop: 12 },
  list: { gap: 8, marginTop: 4 },
  row: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 10, backgroundColor: colors.card,
  },
  rowKey: { fontSize: 13, fontWeight: "700", color: colors.text, fontFamily: "monospace" },
  rowMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  rowBtn: { backgroundColor: colors.primary, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  rowBtnTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  badge: { backgroundColor: "#f1f5f9", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 },
  badgeExpired: { backgroundColor: "#fee2e2" },
  badgeTxt: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  badgeTxtExpired: { color: colors.red },
});

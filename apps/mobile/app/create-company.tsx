import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";
import { api } from "../src/auth";
import type { ExtraCompany } from "@vyapar/api-client";

export type { ExtraCompany };

export default function CreateCompanyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [type, setType] = useState("Retail");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a business name.");
      return;
    }
    setSaving(true);
    try {
      const tenant = await api.getTenant();
      const existing: ExtraCompany[] = Array.isArray(tenant.extraCompanies) ? tenant.extraCompanies : [];
      const newCompany: ExtraCompany = {
        id: Date.now().toString(),
        name: name.trim(),
        businessType: type.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim(),
      };
      await api.updateTenant({
        extraCompanies: JSON.stringify([...existing, newCompany]),
      });
      router.back();
    } catch {
      Alert.alert("Error", "Could not save company. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Create Company</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconTxt}>+</Text>
          </View>
          <Text style={styles.heroTitle}>Set up your business</Text>
          <Text style={styles.heroSub}>Just a few details to get started.</Text>
        </View>

        <View style={styles.card}>
          <FormField label="Business Name *" value={name} onChange={setName} placeholder="Enter name" />
          <FormField label="Business Type" value={type} onChange={setType} placeholder="Retail" />
          <FormField label="Phone" value={phone} onChange={setPhone} placeholder="+92 ..." keyboardType="phone-pad" />
          <FormField label="Email" value={email} onChange={setEmail} placeholder="—" keyboardType="email-address" />
          <FormField label="NTN / GSTIN" value={gstin} onChange={setGstin} placeholder="—" last />
        </View>
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Create Company</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FormField({ label, value, onChange, placeholder, last, keyboardType }: {
  label: string; value: string; onChange: (t: string) => void;
  placeholder?: string; last?: boolean; keyboardType?: any;
}) {
  return (
    <View style={[styles.formRow, last && styles.formRowLast]}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        keyboardType={keyboardType}
      />
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
  body: { padding: 18, paddingBottom: 110 },
  heroSection: { alignItems: "center", marginBottom: 20 },
  heroIcon: {
    width: 76, height: 76, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 20, elevation: 6,
  },
  heroIconTxt: { fontSize: 32, fontWeight: "800", color: "#fff" },
  heroTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 14 },
  heroSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 6 },
  card: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  formRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa", gap: 12,
  },
  formRowLast: { borderBottomWidth: 0 },
  formLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: "500", flexShrink: 0 },
  formInput: { flex: 1, fontSize: 13, color: colors.text, textAlign: "right" },
  saveBar: {
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingHorizontal: 18,
  },
  saveBtn: {
    paddingVertical: 14, borderRadius: 100, backgroundColor: colors.primary,
    alignItems: "center",
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  saveBtnTxt: { fontSize: 13.5, fontWeight: "600", color: "#fff" },
});

import { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";
import { api } from "../src/auth";
import type { ExtraCompany } from "./create-company";

type ActiveCompany = {
  id: string;
  phone: string;
  companyName: string | null;
  businessType: string | null;
  companyEmail: string | null;
};

const TINTS = ["#dbeafe", "#dcfce7", "#fef3c7", "#ede9fe", "#fee2e2", "#ffedd5"];
const FGS   = ["#1d4ed8", "#15803d", "#b45309", "#6d28d9", "#dc2626", "#c2410c"];

function tintFor(idx: number) {
  return { tint: TINTS[idx % TINTS.length], fg: FGS[idx % FGS.length] };
}
function initial(name: string) {
  return (name || "?").charAt(0).toUpperCase();
}

export default function ManageCompaniesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [active, setActive] = useState<ActiveCompany | null>(null);
  const [extras, setExtras] = useState<ExtraCompany[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit-active bottom sheet
  const [editActive, setEditActive] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit-extra bottom sheet
  const [editExtra, setEditExtra] = useState<ExtraCompany | null>(null);
  const [exName, setExName] = useState("");
  const [exType, setExType] = useState("");
  const [exPhone, setExPhone] = useState("");
  const [exEmail, setExEmail] = useState("");
  const [exGstin, setExGstin] = useState("");
  const [savingExtra, setSavingExtra] = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const tenant = await api.getTenant();
        if (!cancelled) {
          setActive(tenant);
          setExtras(Array.isArray(tenant.extraCompanies) ? tenant.extraCompanies : []);
        }
      } catch {
        // silently fail — show empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []));

  function openEditActive() {
    if (!active) return;
    setEditName(active.companyName ?? "");
    setEditType(active.businessType ?? "");
    setEditEmail(active.companyEmail ?? "");
    setEditActive(true);
  }

  async function saveActive() {
    setSaving(true);
    try {
      const updated = await api.updateTenant({
        companyName: editName.trim() || undefined,
        businessType: editType.trim() || undefined,
        companyEmail: editEmail.trim() || undefined,
      });
      setActive(prev => prev ? { ...prev, ...updated } : prev);
      setEditActive(false);
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function openEditExtra(c: ExtraCompany) {
    setEditExtra(c);
    setExName(c.name);
    setExType(c.businessType);
    setExPhone(c.phone);
    setExEmail(c.email);
    setExGstin(c.gstin);
  }

  async function saveExtra() {
    if (!editExtra) return;
    if (!exName.trim()) { Alert.alert("Required", "Business name is required."); return; }
    setSavingExtra(true);
    try {
      const updated: ExtraCompany = {
        ...editExtra,
        name: exName.trim(),
        businessType: exType.trim(),
        phone: exPhone.trim(),
        email: exEmail.trim(),
        gstin: exGstin.trim(),
      };
      const newList = extras.map(e => e.id === editExtra.id ? updated : e);
      await api.updateTenant({ extraCompanies: JSON.stringify(newList) });
      setExtras(newList);
      setEditExtra(null);
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setSavingExtra(false);
    }
  }

  function confirmDelete(c: ExtraCompany) {
    Alert.alert(
      "Delete Company",
      `Remove "${c.name}" from your list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            const newList = extras.filter(e => e.id !== c.id);
            await api.updateTenant({ extraCompanies: JSON.stringify(newList) });
            setExtras(newList);
          },
        },
      ]
    );
  }

  const displayName = active?.companyName || active?.phone || "My Company";
  const { tint: activeTint, fg: activeFg } = tintFor(0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Manage Companies</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <View style={styles.card}>
            {/* Active (current tenant) company */}
            {active && (
              <View style={[styles.row, extras.length === 0 && styles.rowLast]}>
                <View style={[styles.avatar, { backgroundColor: activeTint }]}>
                  <Text style={[styles.avatarTxt, { color: activeFg }]}>{initial(displayName)}</Text>
                </View>
                <View style={styles.rowMid}>
                  <Text style={styles.rowName}>{displayName}</Text>
                  <Text style={styles.rowSub}>
                    {active.businessType ? `${active.businessType} · ` : ""}Owner · Active
                  </Text>
                </View>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeTxt}>ACTIVE</Text>
                </View>
                <TouchableOpacity onPress={openEditActive} hitSlop={8} style={styles.editBtn}>
                  <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Extra companies from AsyncStorage */}
            {extras.map((c, i) => {
              const { tint, fg } = tintFor(i + 1);
              return (
                <View key={c.id} style={[styles.row, i === extras.length - 1 && styles.rowLast]}>
                  <View style={[styles.avatar, { backgroundColor: tint }]}>
                    <Text style={[styles.avatarTxt, { color: fg }]}>{initial(c.name)}</Text>
                  </View>
                  <View style={styles.rowMid}>
                    <Text style={styles.rowName}>{c.name}</Text>
                    <Text style={styles.rowSub}>{c.businessType || "Business"}</Text>
                  </View>
                  <TouchableOpacity onPress={() => openEditExtra(c)} hitSlop={8} style={styles.editBtn}>
                    <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(c)} hitSlop={8} style={styles.editBtn}>
                    <Ionicons name="trash-outline" size={15} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* FAB */}
      <View style={[styles.fabWrap, { bottom: 24 + (insets.bottom || 8) }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/create-company" as never)}
        >
          <View style={styles.fabPlus}><Text style={styles.fabPlusTxt}>+</Text></View>
          <Text style={styles.fabLabel}>Add Company</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Active company sheet */}
      <Modal visible={editActive} animationType="slide" transparent onRequestClose={() => setEditActive(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setEditActive(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Edit Company</Text>

            <SheetField label="Business Name" value={editName} onChange={setEditName} placeholder="Your company name" />
            <SheetField label="Business Type" value={editType} onChange={setEditType} placeholder="Retail, Wholesale…" />
            <SheetField label="Email" value={editEmail} onChange={setEditEmail} placeholder="—" keyboardType="email-address" />

            <TouchableOpacity style={styles.sheetBtn} onPress={saveActive} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.sheetBtnTxt}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Extra company sheet */}
      <Modal visible={!!editExtra} animationType="slide" transparent onRequestClose={() => setEditExtra(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setEditExtra(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Edit Company</Text>

            <SheetField label="Business Name" value={exName} onChange={setExName} placeholder="Company name" />
            <SheetField label="Business Type" value={exType} onChange={setExType} placeholder="Retail, Wholesale…" />
            <SheetField label="Phone" value={exPhone} onChange={setExPhone} placeholder="+92 ..." keyboardType="phone-pad" />
            <SheetField label="Email" value={exEmail} onChange={setExEmail} placeholder="—" keyboardType="email-address" />
            <SheetField label="NTN / GSTIN" value={exGstin} onChange={setExGstin} placeholder="—" />

            <TouchableOpacity style={styles.sheetBtn} onPress={saveExtra} disabled={savingExtra}>
              {savingExtra ? <ActivityIndicator color="#fff" /> : <Text style={styles.sheetBtnTxt}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SheetField({ label, value, onChange, placeholder, keyboardType }: {
  label: string; value: string; onChange: (t: string) => void;
  placeholder?: string; keyboardType?: any;
}) {
  return (
    <View style={styles.sheetField}>
      <Text style={styles.sheetFieldLabel}>{label}</Text>
      <TextInput
        style={styles.sheetFieldInput}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa",
  },
  rowLast: { borderBottomWidth: 0 },
  avatar: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 16, fontWeight: "700" },
  rowMid: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowSub: { fontSize: 11.5, color: colors.textLight, marginTop: 2 },
  activeBadge: {
    backgroundColor: colors.greenLight, borderRadius: 100,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  activeBadgeTxt: { fontSize: 10, fontWeight: "700", color: colors.green, letterSpacing: 0.4 },
  editBtn: { padding: 4 },

  fabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  fab: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: colors.primary, borderRadius: 100,
    paddingHorizontal: 24, paddingVertical: 13,
    shadowColor: colors.primary, shadowOpacity: 0.32, shadowRadius: 20, elevation: 8,
  },
  fabPlus: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  fabPlusTxt: { fontSize: 18, fontWeight: "700", color: "#fff", lineHeight: 20 },
  fabLabel: { fontSize: 14, fontWeight: "600", color: "#fff" },

  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 14,
  },
  sheetHandle: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: "#dde0e7",
    alignSelf: "center", marginBottom: 18,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 16 },
  sheetField: {
    borderBottomWidth: 1, borderBottomColor: "#f0f2f5",
    paddingVertical: 13,
  },
  sheetFieldLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  sheetFieldInput: { fontSize: 14, color: colors.text },
  sheetBtn: {
    backgroundColor: colors.primary, borderRadius: 100,
    paddingVertical: 14, alignItems: "center", marginTop: 20,
  },
  sheetBtnTxt: { fontSize: 13.5, fontWeight: "600", color: "#fff" },
});

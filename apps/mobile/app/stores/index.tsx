import { useCallback, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import { useSelectedCompany } from "../../src/useSelectedCompany";
import { useStores } from "../../src/useStores";
import type { Store } from "@vyapar/api-client";

const STORE_TYPES = ["Store", "Godown", "Warehouse"];

export default function StoresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedCompanyId } = useSelectedCompany();
  const { stores, loading, refresh } = useStores(selectedCompanyId);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const [editing, setEditing] = useState<Store | null | undefined>(undefined); // undefined = closed, null = new
  const [name, setName] = useState("");
  const [storeType, setStoreType] = useState("Store");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setName("");
    setStoreType("Store");
    setPhone("");
    setEditing(null);
  }

  function openEdit(store: Store) {
    setName(store.name);
    setStoreType(store.storeType ?? "Store");
    setPhone(store.phone ?? "");
    setEditing(store);
  }

  async function save() {
    if (!name.trim()) { Alert.alert("Required", "Store name is required."); return; }
    if (!selectedCompanyId) return;
    setSaving(true);
    try {
      if (editing) {
        await api.updateStore(editing.id, { name: name.trim(), storeType, phone: phone.trim() || undefined });
      } else {
        await api.createStore({ companyId: selectedCompanyId, name: name.trim(), storeType, phone: phone.trim() || undefined });
      }
      setEditing(undefined);
      await refresh();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Could not save store.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(store: Store) {
    Alert.alert("Delete Store", `Remove "${store.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.deleteStore(store.id);
            setEditing(undefined);
            await refresh();
          } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.message ?? "Could not delete store.");
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Manage Stores</Text>
        <View style={{ width: 24 }} />
      </View>

      {!selectedCompanyId ? (
        <View style={styles.center}>
          <Text style={styles.emptyTxt}>Select a company from the switcher first.</Text>
        </View>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <TouchableOpacity style={styles.transferBtn} onPress={() => router.push("/stock-transfer" as never)}>
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />
            <Text style={styles.transferBtnTxt}>Transfer Stock</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            {stores.map((s, i) => (
              <View key={s.id} style={[styles.row, i === stores.length - 1 && styles.rowLast]}>
                <View style={styles.rowMid}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.rowName}>{s.name}</Text>
                    {s.isMain && (
                      <View style={styles.mainPill}><Text style={styles.mainPillTxt}>MAIN</Text></View>
                    )}
                  </View>
                  <Text style={styles.rowSub}>{s.storeType || "Store"}</Text>
                </View>
                <TouchableOpacity onPress={() => openEdit(s)} hitSlop={8} style={styles.editBtn}>
                  <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
                {!s.isMain && (
                  <TouchableOpacity onPress={() => confirmDelete(s)} hitSlop={8} style={styles.editBtn}>
                    <Ionicons name="trash-outline" size={15} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {stores.length === 0 && (
              <Text style={[styles.emptyTxt, { padding: 16 }]}>No stores yet.</Text>
            )}
          </View>
        </ScrollView>
      )}

      {selectedCompanyId && (
        <View style={[styles.fabWrap, { bottom: 24 + (insets.bottom || 8) }]}>
          <TouchableOpacity style={styles.fab} onPress={openAdd}>
            <View style={styles.fabPlus}><Text style={styles.fabPlusTxt}>+</Text></View>
            <Text style={styles.fabLabel}>Add Store</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={editing !== undefined} animationType="slide" transparent onRequestClose={() => setEditing(undefined)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setEditing(undefined)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{editing ? "Edit Store" : "Add Store"}</Text>

            <View style={styles.sheetField}>
              <Text style={styles.sheetFieldLabel}>Store Type</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                {STORE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, storeType === t && styles.typeChipActive]}
                    onPress={() => setStoreType(t)}
                  >
                    <Text style={[styles.typeChipTxt, storeType === t && styles.typeChipTxtActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.sheetField}>
              <Text style={styles.sheetFieldLabel}>Store Name</Text>
              <TextInput style={styles.sheetFieldInput} value={name} onChangeText={setName} placeholder="e.g. TTC Road Godown" placeholderTextColor={colors.textLight} />
            </View>

            <View style={styles.sheetField}>
              <Text style={styles.sheetFieldLabel}>Phone</Text>
              <TextInput style={styles.sheetFieldInput} value={phone} onChangeText={setPhone} placeholder="Optional" placeholderTextColor={colors.textLight} keyboardType="phone-pad" />
            </View>

            <TouchableOpacity style={styles.sheetBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.sheetBtnTxt}>Save</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  transferBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.primary + "15", borderRadius: 10, paddingVertical: 12, marginBottom: 16,
  },
  transferBtnTxt: { fontSize: 13.5, fontWeight: "600", color: colors.primary },

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
  rowMid: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowSub: { fontSize: 11.5, color: colors.textLight, marginTop: 2 },
  mainPill: { backgroundColor: colors.greenLight, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  mainPillTxt: { fontSize: 9.5, fontWeight: "700", color: colors.green, letterSpacing: 0.4 },
  editBtn: { padding: 4 },
  emptyTxt: { fontSize: 13.5, color: colors.textMuted, textAlign: "center" },

  fabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  fab: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: colors.primary, borderRadius: 100,
    paddingHorizontal: 24, paddingVertical: 13,
    shadowColor: colors.primary, shadowOpacity: 0.32, shadowRadius: 20, elevation: 8,
  },
  fabPlus: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  fabPlusTxt: { fontSize: 18, fontWeight: "700", color: "#fff", lineHeight: 20 },
  fabLabel: { fontSize: 14, fontWeight: "600", color: "#fff" },

  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 14,
  },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "#dde0e7", alignSelf: "center", marginBottom: 18 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 16 },
  sheetField: { borderBottomWidth: 1, borderBottomColor: "#f0f2f5", paddingVertical: 13 },
  sheetFieldLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  sheetFieldInput: { fontSize: 14, color: colors.text },
  sheetBtn: { backgroundColor: colors.primary, borderRadius: 100, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  sheetBtnTxt: { fontSize: 13.5, fontWeight: "600", color: "#fff" },

  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipTxt: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  typeChipTxtActive: { color: "#fff" },
});

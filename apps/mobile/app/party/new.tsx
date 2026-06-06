import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";
import { api } from "../../src/auth";
import { usePartySettings } from "../../src/usePartySettings";
import type { PartyGroup } from "@vyapar/api-client";

export default function NewPartyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = usePartySettings();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [tin, setTin] = useState("");
  const [ntn, setNtn] = useState("");
  const [cnic, setCnic] = useState("");
  const [strn, setStrn] = useState("");
  const [partyType, setPartyType] = useState<"customer" | "supplier" | "both">("both");
  const [saving, setSaving] = useState(false);

  // Party Group
  const [groups, setGroups] = useState<PartyGroup[]>([]);
  const [groupId, setGroupId] = useState("");
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    api.listPartyGroups().then(setGroups).catch(() => {});
  }, []);

  const selectedGroup = groups.find((g) => g.id === groupId);

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const g = await api.createPartyGroup(newGroupName.trim());
      setGroups((prev) => [...prev, g]);
      setGroupId(g.id);
      setNewGroupName("");
      setGroupPickerOpen(false);
    } catch (err: any) {
      Alert.alert("Error", "Could not create group.");
    } finally {
      setCreatingGroup(false);
    }
  }

  function reset() {
    setName(""); setPhone(""); setEmail(""); setOpeningBalance("");
    setBillingAddress(""); setShippingAddress(""); setTin("");
    setNtn(""); setCnic(""); setStrn("");
    setPartyType("both"); setGroupId("");
  }

  async function handleSave(andNew = false) {
    if (!name.trim()) {
      Alert.alert("Required", "Party name is required.");
      return;
    }
    setSaving(true);
    try {
      await api.createParty({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        openingBalance: openingBalance ? parseFloat(openingBalance) : undefined,
        billingAddress: billingAddress.trim() || undefined,
        shippingAddress: settings.shippingAddress ? shippingAddress.trim() || undefined : undefined,
        gstin: settings.tinNumber ? tin.trim() || undefined : undefined,
        ntn: ntn.trim() || undefined,
        cnic: cnic.trim() || undefined,
        strn: strn.trim() || undefined,
        partyType,
        groupId: groupId || undefined,
      });
      if (andNew) { reset(); } else { router.back(); }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Could not save party. Please try again.";
      Alert.alert("Error", Array.isArray(msg) ? msg.join("\n") : msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Add New Party</Text>
        <TouchableOpacity onPress={() => router.push("/party/settings" as never)} hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={colors.textLight} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Party Type selector */}
        <View style={s.typeRow}>
          {(["customer", "supplier", "both"] as const).map((t) => {
            const active = partyType === t;
            const bg = t === "customer" ? "#3b82f6" : t === "supplier" ? "#f59e0b" : "#6d28d9";
            return (
              <TouchableOpacity
                key={t}
                style={[s.typeBtn, active && { backgroundColor: bg, borderColor: bg }]}
                onPress={() => setPartyType(t)}
                activeOpacity={0.8}
              >
                <Text style={[s.typeTxt, active && { color: "#fff" }]}>
                  {t === "customer" ? "Customer" : t === "supplier" ? "Supplier" : "Both"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Invite banner — shown only when setting is ON */}
        {settings.inviteParties && (
          <TouchableOpacity style={s.inviteBanner} activeOpacity={0.8}>
            <View style={s.inviteIcon}>
              <Ionicons name="share-social-outline" size={18} color={colors.primary} />
            </View>
            <View style={s.inviteText}>
              <Text style={s.inviteTitle}>Invite Parties</Text>
              <Text style={s.inviteSub}>to fill their details</Text>
            </View>
            <View style={s.newBadge}><Text style={s.newBadgeTxt}>NEW</Text></View>
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </TouchableOpacity>
        )}

        {/* Main form card */}
        <View style={s.card}>
          <FormRow label="Party Name *" value={name} onChangeText={setName} placeholder="Enter name" autoFocus />
          <FormRow label="Contact Number" value={phone} onChangeText={setPhone} placeholder="+92 ..." keyboardType="phone-pad" />
          <FormRow label="Email Address" value={email} onChangeText={setEmail} placeholder="—" keyboardType="email-address" autoCapitalize="none" />
          <FormRow label="Opening Balance" value={openingBalance} onChangeText={setOpeningBalance} placeholder="0.00" keyboardType="numeric" />
          <FormRow label="Billing Address" value={billingAddress} onChangeText={setBillingAddress} placeholder="—" />

          {/* Shipping Address — conditional */}
          {settings.shippingAddress && (
            <FormRow
              label="Shipping Address"
              value={shippingAddress}
              onChangeText={setShippingAddress}
              placeholder="—"
            />
          )}

          {/* TIN / NTN — conditional */}
          {settings.tinNumber && (
            <FormRow
              label="TIN / NTN"
              value={tin}
              onChangeText={setTin}
              placeholder="Tax Number"
            />
          )}

          <FormRow label="NTN" value={ntn} onChangeText={setNtn} placeholder="e.g. 1234567-8" />
          <FormRow label="CNIC" value={cnic} onChangeText={setCnic} placeholder="e.g. 42101-1234567-1" keyboardType="numeric" />
          <FormRow label="STRN" value={strn} onChangeText={setStrn} placeholder="e.g. 03-00-9999-001-03" />

          {/* Group picker */}
          <View style={[fr.row, fr.rowLast]}>
            <Text style={fr.label}>Party Group</Text>
            <TouchableOpacity style={fr.dropdownBtn} onPress={() => setGroupPickerOpen(true)} activeOpacity={0.7}>
              <Text style={selectedGroup ? fr.dropdownValue : fr.dropdownPlaceholder}>
                {selectedGroup ? selectedGroup.name : "Select Group"}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>


      </ScrollView>

      {/* Group Picker Modal */}
      <Modal visible={groupPickerOpen} transparent animationType="slide" onRequestClose={() => setGroupPickerOpen(false)}>
        <TouchableOpacity style={gp.backdrop} activeOpacity={1} onPress={() => setGroupPickerOpen(false)} />
        <View style={gp.sheet}>
          <View style={gp.sheetHeader}>
            <Text style={gp.sheetTitle}>Select Group</Text>
            <TouchableOpacity onPress={() => setGroupPickerOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* New group input */}
          <View style={gp.newRow}>
            <TextInput
              style={gp.newInput}
              placeholder="+ Create new group"
              placeholderTextColor={colors.primary}
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            {newGroupName.trim().length > 0 && (
              <TouchableOpacity
                style={gp.newBtn}
                onPress={handleCreateGroup}
                disabled={creatingGroup}
                activeOpacity={0.8}
              >
                {creatingGroup
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={gp.newBtnTxt}>Add</Text>}
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={{ maxHeight: 280 }}>
            {groupId !== "" && (
              <TouchableOpacity style={gp.option} onPress={() => { setGroupId(""); setGroupPickerOpen(false); }}>
                <Text style={gp.optionClear}>— No Group</Text>
              </TouchableOpacity>
            )}
            {groups.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[gp.option, g.id === groupId && gp.optionActive]}
                onPress={() => { setGroupId(g.id); setGroupPickerOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[gp.optionTxt, g.id === groupId && gp.optionTxtActive]}>{g.name}</Text>
                {g.id === groupId && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            {groups.length === 0 && (
              <Text style={gp.empty}>No groups yet. Type a name above to create one.</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={s.saveNewBtn} onPress={() => handleSave(true)} disabled={saving}>
          <Text style={s.saveNewTxt}>Save &amp; New</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.saveBtn, (!name.trim() || saving) && s.saveBtnDisabled]}
          onPress={() => handleSave(false)}
          disabled={saving || !name.trim()}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveBtnTxt}>Save Party</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FormRow({ label, value, onChangeText, placeholder, last, ...rest }: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; last?: boolean;
  autoFocus?: boolean; keyboardType?: any; autoCapitalize?: any;
}) {
  return (
    <View style={[fr.row, last && fr.rowLast]}>
      <Text style={fr.label}>{label}</Text>
      <TextInput
        style={fr.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        {...rest}
      />
    </View>
  );
}

const fr = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa", gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { fontSize: 12.5, color: colors.textMuted, fontWeight: "500", flexShrink: 0, minWidth: 110 },
  input: { flex: 1, fontSize: 13, color: colors.text, textAlign: "right" },
  dropdownBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  dropdownPlaceholder: { fontSize: 13, color: colors.textLight },
  dropdownValue: { fontSize: 13, color: colors.text },
});

const gp = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  newRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  newInput: {
    flex: 1, fontSize: 13.5, color: colors.primary, fontWeight: "600",
    paddingVertical: 0,
  },
  newBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 14,
  },
  newBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  option: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f9fafb",
  },
  optionActive: { backgroundColor: "#f0f9ff" },
  optionTxt: { fontSize: 13.5, color: colors.text },
  optionTxtActive: { color: colors.primary, fontWeight: "600" },
  optionClear: { fontSize: 13.5, color: colors.textLight },
  empty: { fontSize: 13, color: colors.textLight, textAlign: "center", padding: 24 },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },

  scrollContent: { padding: 18, gap: 14, paddingBottom: 100 },

  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#d1d5db",
    backgroundColor: "#f9fafb", alignItems: "center",
  },
  typeTxt: { fontSize: 13, fontWeight: "600", color: "#374151" },

  inviteBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff0f3", borderRadius: 14,
    borderWidth: 1, borderColor: "#fecdd3", padding: 14,
  },
  inviteIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#ffe4e6", alignItems: "center", justifyContent: "center",
  },
  inviteText: { flex: 1 },
  inviteTitle: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  inviteSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  newBadge: {
    backgroundColor: "#ef4444", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  newBadgeTxt: { fontSize: 9, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },

  card: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },

  footer: {
    flexDirection: "row", backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingHorizontal: 18, gap: 10,
  },
  saveNewBtn: { flex: 1, alignItems: "center", paddingVertical: 14 },
  saveNewTxt: { fontSize: 13.5, fontWeight: "600", color: colors.textMuted },
  saveBtn: {
    flex: 2, backgroundColor: colors.primary, borderRadius: 100,
    paddingVertical: 14, alignItems: "center",
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: "#94a3b8", shadowOpacity: 0 },
  saveBtnTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
});

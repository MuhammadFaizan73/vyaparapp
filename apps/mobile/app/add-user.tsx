import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";
import { api } from "../src/auth";

// ── Permission definitions ────────────────────────────────────────────────────

export type Permission = {
  id: string;
  label: string;
  group: string;
};

export const ALL_PERMISSIONS: Permission[] = [
  // Sales — each maps to a specific sub-menu item
  { id: "sale_view",          label: "View Sale Invoices",        group: "Sales" },
  { id: "sale_create",        label: "Create Sale Invoice",       group: "Sales" },
  { id: "payment_in_view",    label: "Payment-In",                group: "Sales" },
  { id: "sale_return_view",   label: "Sale Return / Credit Note", group: "Sales" },
  { id: "estimate_view",      label: "Estimate / Quotation",      group: "Sales" },
  { id: "proforma_view",      label: "Proforma Invoice",          group: "Sales" },
  { id: "sale_order_view",    label: "Sale Order",                group: "Sales" },
  { id: "delivery_note_view", label: "Delivery Note",             group: "Sales" },
  { id: "sale_edit_own",      label: "Edit Own Sales",            group: "Sales" },
  { id: "sale_edit_all",      label: "Edit All Sales",            group: "Sales" },
  { id: "sale_delete",        label: "Delete Sales",              group: "Sales" },
  // Purchase — each maps to a specific sub-menu item
  { id: "purchase_view",        label: "View Purchase Bills",   group: "Purchase" },
  { id: "purchase_create",      label: "Create Purchase Bill",  group: "Purchase" },
  { id: "purchase_order_view",  label: "Purchase Order",        group: "Purchase" },
  { id: "purchase_return_view", label: "Purchase Return",       group: "Purchase" },
  { id: "payment_out_view",     label: "Payment-Out",           group: "Purchase" },
  { id: "purchase_edit_own",    label: "Edit Own Purchases",    group: "Purchase" },
  { id: "purchase_edit_all",    label: "Edit All Purchases",    group: "Purchase" },
  { id: "purchase_delete",      label: "Delete Purchases",      group: "Purchase" },
  // Parties
  { id: "parties_view",    label: "View Parties",        group: "Parties" },
  { id: "parties_create",  label: "Add Parties",         group: "Parties" },
  { id: "parties_edit",    label: "Edit Parties",         group: "Parties" },
  { id: "parties_balance", label: "View Party Balance",  group: "Parties" },
  // Items
  { id: "items_view",   label: "View Items",   group: "Items" },
  { id: "items_create", label: "Add Items",    group: "Items" },
  { id: "items_edit",   label: "Edit Items",   group: "Items" },
  { id: "items_delete", label: "Delete Items", group: "Items" },
  // Reports
  { id: "reports_view",   label: "View Reports",              group: "Reports" },
  { id: "reports_export", label: "Export / Download Reports", group: "Reports" },
  // Cash & Bank
  { id: "cash_view",   label: "View Cash & Bank",    group: "Cash & Bank" },
  { id: "cash_create", label: "Add Cash/Bank Entry", group: "Cash & Bank" },
  // Expenses
  { id: "expense_view",   label: "View Expenses",   group: "Expenses" },
  { id: "expense_create", label: "Create Expenses", group: "Expenses" },
  // Team
  { id: "team_view",   label: "View Team Members",        group: "Team" },
  { id: "team_manage", label: "Add / Remove Team Members", group: "Team" },
];

// Default permissions per role
const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  secondary_admin: [
    "sale_view", "sale_create", "payment_in_view", "sale_return_view", "estimate_view",
    "proforma_view", "sale_order_view", "delivery_note_view",
    "sale_edit_own", "sale_edit_all", "sale_delete",
    "purchase_view", "purchase_create", "purchase_order_view", "purchase_return_view",
    "payment_out_view", "purchase_edit_own", "purchase_edit_all", "purchase_delete",
    "parties_view", "parties_create", "parties_edit", "parties_balance",
    "items_view", "items_create", "items_edit", "items_delete",
    "reports_view", "reports_export",
    "cash_view", "cash_create",
    "expense_view", "expense_create",
    "team_view",
  ],
  salesman: [
    "sale_view", "sale_create", "payment_in_view", "sale_edit_own",
    "parties_view",
    "items_view",
    "expense_view", "expense_create",
  ],
  biller: [
    "sale_view", "sale_create", "payment_in_view", "sale_edit_own",
    "parties_view", "parties_balance",
  ],
  biller_salesman: [
    "sale_view", "sale_create", "payment_in_view", "sale_edit_own",
    "parties_view", "parties_balance",
    "items_view",
    "expense_view", "expense_create",
  ],
  ca_accountant: [
    "sale_view",
    "purchase_view",
    "parties_view", "parties_balance",
    "items_view",
    "reports_view", "reports_export",
    "cash_view",
  ],
  ca_accountant_edit: [
    "sale_view", "sale_create", "payment_in_view", "sale_return_view",
    "sale_edit_own", "sale_edit_all", "sale_delete",
    "purchase_view", "purchase_create", "purchase_order_view", "purchase_return_view",
    "purchase_edit_own", "purchase_edit_all",
    "parties_view", "parties_create", "parties_edit", "parties_balance",
    "items_view", "items_create", "items_edit",
    "reports_view", "reports_export",
    "cash_view",
    "expense_view", "expense_create",
  ],
  stock_keeper: [
    "purchase_view", "purchase_create", "purchase_order_view", "purchase_return_view",
    "purchase_edit_own",
    "items_view", "items_create", "items_edit",
    "expense_view", "expense_create",
  ],
};

const ROLES = [
  { id: "secondary_admin", label: "Secondary Admin" },
  { id: "salesman", label: "Salesman" },
  { id: "biller", label: "Biller" },
  { id: "biller_salesman", label: "Biller & Salesman" },
  { id: "ca_accountant", label: "CA / Accountant" },
  { id: "stock_keeper", label: "Stock Keeper" },
  { id: "ca_accountant_edit", label: "CA / Accountant (Edit)" },
];

const PERM_GROUPS = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)));

const GROUP_ICONS: Record<string, string> = {
  Sales: "receipt-outline",
  Purchase: "cart-outline",
  Parties: "people-outline",
  Items: "cube-outline",
  Reports: "bar-chart-outline",
  "Cash & Bank": "cash-outline",
  Expenses: "wallet-outline",
  Team: "person-add-outline",
};

export default function AddUserScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("salesman");
  const [permissions, setPermissions] = useState<string[]>(
    ROLE_DEFAULT_PERMISSIONS["salesman"] ?? []
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedRole = ROLES.find((r) => r.id === role) ?? ROLES[1];

  function selectRole(roleId: string) {
    setRole(roleId);
    setPermissions(ROLE_DEFAULT_PERMISSIONS[roleId] ?? []);
    setModalVisible(false);
  }

  function togglePermission(permId: string) {
    setPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  }

  function toggleGroup(group: string) {
    const groupPerms = ALL_PERMISSIONS.filter((p) => p.group === group).map((p) => p.id);
    const allOn = groupPerms.every((id) => permissions.includes(id));
    if (allOn) {
      setPermissions((prev) => prev.filter((id) => !groupPerms.includes(id)));
    } else {
      setPermissions((prev) => Array.from(new Set([...prev, ...groupPerms])));
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      Alert.alert("Validation", "Please enter full name.");
      return;
    }
    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      Alert.alert("Validation", "Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Validation", "Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      await api.createTeamMember({
        name: name.trim(),
        email: emailTrimmed,
        password,
        role,
        permissions,
      });
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Something went wrong.";
      Alert.alert("Error", Array.isArray(msg) ? msg.join("\n") : msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Add User</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        {/* Name + Email + Password card */}
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Enter Full Name *"
              placeholderTextColor={colors.textLight}
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Email Address *"
              placeholderTextColor={colors.textLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.inputSub}>Staff member will use this email to log in.</Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.inputRow, { flexDirection: "row", alignItems: "center" }]}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password *  (min 6 characters)"
              placeholderTextColor={colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8} style={{ marginLeft: 8 }}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Role picker */}
        <TouchableOpacity
          style={styles.rolePickerBtn}
          activeOpacity={0.7}
          onPress={() => setModalVisible(true)}
        >
          <View>
            <Text style={styles.rolePickerLabel}>Role</Text>
            <Text style={styles.rolePickerValue}>{selectedRole.label}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.primary} />
        </TouchableOpacity>

        <Text style={styles.sectionHeader}>Permissions</Text>
        <Text style={styles.sectionSub}>
          These are pre-filled based on the role. Customize individual permissions below.
        </Text>

        {/* Permission groups */}
        {PERM_GROUPS.map((group) => {
          const groupPerms = ALL_PERMISSIONS.filter((p) => p.group === group);
          const enabledCount = groupPerms.filter((p) => permissions.includes(p.id)).length;
          const allOn = enabledCount === groupPerms.length;
          const someOn = enabledCount > 0 && !allOn;

          return (
            <View key={group} style={styles.permGroup}>
              {/* Group header */}
              <TouchableOpacity style={styles.permGroupHeader} onPress={() => toggleGroup(group)} activeOpacity={0.7}>
                <View style={styles.permGroupLeft}>
                  <Ionicons
                    name={(GROUP_ICONS[group] ?? "ellipse-outline") as any}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.permGroupTitle}>{group}</Text>
                  <View style={[styles.countBadge, enabledCount > 0 && styles.countBadgeOn]}>
                    <Text style={[styles.countBadgeTxt, enabledCount > 0 && styles.countBadgeTxtOn]}>
                      {enabledCount}/{groupPerms.length}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={allOn}
                  onValueChange={() => toggleGroup(group)}
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                  thumbColor="#fff"
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </TouchableOpacity>

              {/* Individual permissions */}
              {groupPerms.map((perm, idx) => (
                <TouchableOpacity
                  key={perm.id}
                  style={[styles.permRow, idx === groupPerms.length - 1 && styles.permRowLast]}
                  onPress={() => togglePermission(perm.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.permRowLabel}>{perm.label}</Text>
                  <View style={[styles.checkbox, permissions.includes(perm.id) && styles.checkboxOn]}>
                    {permissions.includes(perm.id) && (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        <View style={styles.permSummary}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
          <Text style={styles.permSummaryTxt}>
            {permissions.length} of {ALL_PERMISSIONS.length} permissions enabled
          </Text>
        </View>
      </ScrollView>

      {/* Add User footer button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={[styles.addBtn, saving && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>Add User</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Success modal ── */}
      <Modal
        visible={success}
        transparent
        animationType="fade"
        onRequestClose={() => { setSuccess(false); router.back(); }}
      >
        <View style={styles.inviteOverlay}>
          <View style={styles.inviteCard}>
            <View style={styles.inviteIconWrap}>
              <Ionicons name="checkmark-circle" size={52} color="#16a34a" />
            </View>
            <Text style={styles.inviteTitle}>User Added!</Text>
            <Text style={styles.inviteSub}>
              <Text style={{ fontWeight: "700" }}>{name}</Text> can now log in using their email and password in the Staff Login screen.
            </Text>
            <View style={styles.codeBox}>
              <Ionicons name="mail-outline" size={16} color="#166534" />
              <Text style={[styles.codeText, { flex: 1 }]} selectable>{email}</Text>
            </View>
            <Text style={styles.codeTap}>They log in at: Login → Staff / Salesman Login</Text>
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={() => { setSuccess(false); router.back(); }}
            >
              <Text style={styles.inviteBtnTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Role bottom sheet modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Choose User Role</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.sheetSub}>Selecting a role auto-fills default permissions. You can customize after.</Text>
          <FlatList
            data={ROLES}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.sheetDivider} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.sheetRow}
                onPress={() => selectRole(item.id)}
              >
                <View>
                  <Text style={[styles.sheetRowText, item.id === role && styles.sheetRowTextActive]}>
                    {item.label}
                  </Text>
                  <Text style={styles.sheetRowCount}>
                    {ROLE_DEFAULT_PERMISSIONS[item.id]?.length ?? 0} default permissions
                  </Text>
                </View>
                {item.id === role && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  appBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  appBarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },

  body: { padding: 16, paddingBottom: 120, gap: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  inputRow: { paddingHorizontal: 14, paddingVertical: 12 },
  input: { fontSize: 14, color: colors.text },
  inputSub: { fontSize: 11, color: colors.textLight, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginHorizontal: 14 },

  rolePickerBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rolePickerLabel: { fontSize: 11, color: colors.textLight, marginBottom: 2 },
  rolePickerValue: { fontSize: 14, fontWeight: "600", color: colors.text },

  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 4,
    marginBottom: 2,
  },
  sectionSub: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },

  // Permission groups
  permGroup: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  permGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  permGroupLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  permGroupTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  countBadge: {
    backgroundColor: colors.borderLight,
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeOn: { backgroundColor: `${colors.primary}22` },
  countBadgeTxt: { fontSize: 10, fontWeight: "600", color: colors.textLight },
  countBadgeTxtOn: { color: colors.primary },

  permRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f6fa",
  },
  permRowLast: { borderBottomWidth: 0 },
  permRowLabel: { fontSize: 13, color: colors.text, flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  permSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: `${colors.primary}11`,
    borderRadius: 10,
    padding: 12,
  },
  permSummaryTxt: { fontSize: 12, color: colors.primary, fontWeight: "600" },

  footer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Invite success modal
  inviteOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  inviteCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    alignItems: "center",
  },
  inviteIconWrap: { marginBottom: 12 },
  inviteTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 8 },
  inviteSub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  codeBox: {
    width: "100%",
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: "#86efac",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  codeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "monospace",
    color: "#166534",
    letterSpacing: 0.5,
  },
  codeTap: { fontSize: 11, color: colors.textLight, marginTop: 6, marginBottom: 20 },
  inviteBtn: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: "center",
  },
  inviteBtnTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Bottom sheet
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "65%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  sheetSub: { fontSize: 11.5, color: colors.textMuted, paddingHorizontal: 18, paddingVertical: 10 },
  sheetDivider: { height: 1, backgroundColor: colors.borderLight, marginHorizontal: 18 },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  sheetRowText: { fontSize: 14, color: colors.text, fontWeight: "500" },
  sheetRowTextActive: { color: colors.primary, fontWeight: "700" },
  sheetRowCount: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});

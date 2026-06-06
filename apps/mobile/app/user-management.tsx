import { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Modal, Alert, ActivityIndicator, FlatList, Switch,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";
import { api } from "../src/auth";
import type { TeamMember } from "@vyapar/api-client";
import { ALL_PERMISSIONS, type Permission } from "./add-user";

const ROLES = [
  { id: "all",              label: "All",              icon: "people-outline" as const,       tint: "#f1f5f9", fg: colors.text },
  { id: "secondary_admin",  label: "Admin",            icon: "shield-checkmark-outline" as const, tint: "#dbeafe", fg: "#1d4ed8" },
  { id: "salesman",         label: "Salesman",         icon: "bicycle-outline" as const,      tint: "#dcfce7", fg: "#15803d" },
  { id: "biller",           label: "Biller",           icon: "receipt-outline" as const,      tint: "#fef3c7", fg: "#b45309" },
  { id: "biller_salesman",  label: "Biller+Sales",     icon: "swap-horizontal-outline" as const, tint: "#ede9fe", fg: "#6d28d9" },
  { id: "ca_accountant",    label: "Accountant",       icon: "calculator-outline" as const,   tint: "#fff1e6", fg: "#c2410c" },
  { id: "stock_keeper",     label: "Stock",            icon: "cube-outline" as const,         tint: "#fce7f3", fg: "#be185d" },
  { id: "ca_accountant_edit", label: "CA Edit",        icon: "create-outline" as const,       tint: "#e0e7ff", fg: "#4338ca" },
];

const CHANGE_ROLES = ROLES.filter((r) => r.id !== "all");

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

function getRoleInfo(roleId: string) {
  return ROLES.find((r) => r.id === roleId) ?? { label: roleId, tint: "#f1f5f9", fg: colors.text, icon: "person-outline" as const };
}

function parseMemberPermissions(member: TeamMember): string[] {
  try {
    const raw = (member as any).permissions;
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default function UserManagementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [activeRole, setActiveRole] = useState("all");

  // Change role sheet
  const [changeRoleTarget, setChangeRoleTarget] = useState<TeamMember | null>(null);
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [changingRole, setChangingRole] = useState(false);

  // Edit permissions sheet
  const [permTarget, setPermTarget] = useState<TeamMember | null>(null);
  const [permSheetVisible, setPermSheetVisible] = useState(false);
  const [editingPerms, setEditingPerms] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  async function fetchMembers() {
    try {
      setLoading(true);
      setFetchError("");
      const data = await api.listTeamMembers();
      setMembers(data);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Could not load users.";
      setFetchError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { void fetchMembers(); }, []));

  async function handleDelete(member: TeamMember) {
    Alert.alert("Remove User", `Remove ${member.name} from this company?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          try {
            await api.deleteTeamMember(member.id);
            setMembers((prev) => prev.filter((m) => m.id !== member.id));
          } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.message ?? "Failed to remove user.");
          }
        },
      },
    ]);
  }

  async function handleRoleChange(newRole: string) {
    if (!changeRoleTarget) return;
    setChangingRole(true);
    try {
      const updated = await api.updateTeamMemberRole(changeRoleTarget.id, newRole);
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setRoleSheetVisible(false);
      setChangeRoleTarget(null);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to update role.");
    } finally {
      setChangingRole(false);
    }
  }

  function openPermSheet(member: TeamMember) {
    setPermTarget(member);
    setEditingPerms(parseMemberPermissions(member));
    setPermSheetVisible(true);
  }

  function togglePerm(permId: string) {
    setEditingPerms((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  }

  function togglePermGroup(group: string) {
    const groupPerms = ALL_PERMISSIONS.filter((p) => p.group === group).map((p) => p.id);
    const allOn = groupPerms.every((id) => editingPerms.includes(id));
    if (allOn) {
      setEditingPerms((prev) => prev.filter((id) => !groupPerms.includes(id)));
    } else {
      setEditingPerms((prev) => Array.from(new Set([...prev, ...groupPerms])));
    }
  }

  async function handleSavePermissions() {
    if (!permTarget) return;
    setSavingPerms(true);
    try {
      const updated = await api.updateTeamMemberPermissions(permTarget.id, editingPerms);
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setPermSheetVisible(false);
      setPermTarget(null);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to update permissions.");
    } finally {
      setSavingPerms(false);
    }
  }

  const displayed = activeRole === "all"
    ? members
    : members.filter((m) => m.role === activeRole);

  function countFor(roleId: string) {
    if (roleId === "all") return members.length;
    return members.filter((m) => m.role === roleId).length;
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* App bar */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.appBarTitle}>User Management</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => router.push("/add-user" as never)}
        >
          <Ionicons name="person-add-outline" size={15} color="#fff" />
          <Text style={s.addBtnTxt}>Add User</Text>
        </TouchableOpacity>
      </View>

      {/* Role filter tabs */}
      <View style={s.tabWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {ROLES.map((r) => {
            const count = countFor(r.id);
            const active = activeRole === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                style={[s.tab, active && { backgroundColor: r.tint, borderColor: r.fg }]}
                onPress={() => setActiveRole(r.id)}
                activeOpacity={0.75}
              >
                <Ionicons name={r.icon} size={14} color={active ? r.fg : colors.textMuted} />
                <Text style={[s.tabTxt, active && { color: r.fg, fontWeight: "700" }]}>{r.label}</Text>
                {count > 0 && (
                  <View style={[s.tabBadge, { backgroundColor: active ? r.fg : colors.border }]}>
                    <Text style={[s.tabBadgeTxt, { color: active ? "#fff" : colors.textMuted }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : fetchError ? (
        <View style={s.center}>
          <Ionicons name="wifi-outline" size={44} color={colors.border} />
          <Text style={s.errorTxt}>{fetchError}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchMembers}>
            <Text style={s.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : displayed.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="person-outline" size={52} color={colors.border} />
          <Text style={s.emptyTitle}>
            {activeRole === "all" ? "No team members yet" : `No ${getRoleInfo(activeRole).label} users`}
          </Text>
          <Text style={s.emptySub}>
            {activeRole === "all"
              ? 'Tap "Add User" to invite your first team member'
              : `Tap "Add User" and select ${getRoleInfo(activeRole).label} role`}
          </Text>
          <TouchableOpacity style={s.emptyAddBtn} onPress={() => router.push("/add-user" as never)}>
            <Ionicons name="person-add-outline" size={15} color="#fff" />
            <Text style={s.emptyAddTxt}>Add User</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {displayed.map((member) => {
            const roleInfo = getRoleInfo(member.role);
            const perms = parseMemberPermissions(member);
            return (
              <View key={member.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.avatar, { backgroundColor: roleInfo.tint }]}>
                    <Text style={[s.avatarTxt, { color: roleInfo.fg }]}>
                      {member.name[0]?.toUpperCase()}
                    </Text>
                  </View>

                  <View style={s.cardInfo}>
                    <Text style={s.memberName}>{member.name}</Text>
                    <Text style={s.memberContact}>{member.contact}</Text>
                  </View>

                  <View style={s.cardActions}>
                    <View style={[s.statusPill, { backgroundColor: member.status === "active" ? "#dcfce7" : "#fff3e0" }]}>
                      <View style={[s.statusDot, { backgroundColor: member.status === "active" ? colors.green : colors.amber }]} />
                      <Text style={[s.statusTxt, { color: member.status === "active" ? colors.green : "#e65100" }]}>
                        {member.status === "active" ? "Active" : "Pending"}
                      </Text>
                    </View>
                    <TouchableOpacity hitSlop={8} onPress={() => handleDelete(member)}>
                      <Ionicons name="trash-outline" size={17} color={colors.red} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Role + Change Role */}
                <View style={s.cardBottom}>
                  <View style={[s.rolePill, { backgroundColor: roleInfo.tint }]}>
                    <Ionicons name={getRoleInfo(member.role).icon as any} size={11} color={roleInfo.fg} />
                    <Text style={[s.rolePillTxt, { color: roleInfo.fg }]}>{getRoleInfo(member.role).label}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.changeRoleBtn}
                    onPress={() => { setChangeRoleTarget(member); setRoleSheetVisible(true); }}
                  >
                    <Ionicons name="swap-vertical-outline" size={13} color={colors.primary} />
                    <Text style={s.changeRoleTxt}>Change Role</Text>
                  </TouchableOpacity>
                </View>

                {/* Permissions row */}
                <TouchableOpacity style={s.permRow} onPress={() => openPermSheet(member)} activeOpacity={0.7}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
                  <Text style={s.permRowTxt}>
                    {perms.length} of {ALL_PERMISSIONS.length} permissions
                  </Text>
                  <Text style={s.permEditTxt}>Edit Permissions</Text>
                  <Ionicons name="chevron-forward" size={13} color={colors.textLight} />
                </TouchableOpacity>

                {/* Invite code — always visible so admin can resend anytime */}
                {member.inviteToken && (
                  <TouchableOpacity
                    style={s.inviteRow}
                    onPress={() => {
                      import("expo-clipboard").then((Clipboard) => {
                        Clipboard.setStringAsync(member.inviteToken);
                        Alert.alert("Copied!", "Share this code with the member. They can use it anytime to log in on a new device.");
                      }).catch(() => Alert.alert("Invite Code", member.inviteToken));
                    }}
                  >
                    <Ionicons name="copy-outline" size={13} color={colors.primary} />
                    <Text style={s.inviteTxt}>
                      {member.status === "pending" ? "Copy invite code" : "Copy login code"}
                    </Text>
                    <Text style={s.inviteCode} numberOfLines={1}>{member.inviteToken}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Change Role bottom sheet ── */}
      <Modal visible={roleSheetVisible} transparent animationType="slide" onRequestClose={() => setRoleSheetVisible(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => !changingRole && setRoleSheetVisible(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle}>Change Role</Text>
              <Text style={s.sheetSub}>{changeRoleTarget?.name}</Text>
            </View>
            <TouchableOpacity onPress={() => !changingRole && setRoleSheetVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          {changingRole ? (
            <View style={s.sheetLoading}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <FlatList
              data={CHANGE_ROLES}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={s.sheetDivider} />}
              renderItem={({ item }) => {
                const active = changeRoleTarget?.role === item.id;
                return (
                  <TouchableOpacity style={s.sheetRow} onPress={() => handleRoleChange(item.id)}>
                    <View style={[s.sheetRoleIcon, { backgroundColor: item.tint }]}>
                      <Ionicons name={item.icon} size={16} color={item.fg} />
                    </View>
                    <Text style={[s.sheetRowTxt, active && { color: item.fg, fontWeight: "700" }]}>{item.label}</Text>
                    {active && <Ionicons name="checkmark-circle" size={20} color={item.fg} />}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* ── Edit Permissions bottom sheet ── */}
      <Modal visible={permSheetVisible} transparent animationType="slide" onRequestClose={() => setPermSheetVisible(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => !savingPerms && setPermSheetVisible(false)} />
        <View style={[s.permSheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Sheet header */}
          <View style={s.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle}>Edit Permissions</Text>
              <Text style={s.sheetSub}>
                {permTarget?.name} · {editingPerms.length}/{ALL_PERMISSIONS.length} enabled
              </Text>
            </View>
            <TouchableOpacity onPress={() => !savingPerms && setPermSheetVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Scrollable permissions */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {PERM_GROUPS.map((group) => {
              const groupPerms = ALL_PERMISSIONS.filter((p: Permission) => p.group === group);
              const enabledCount = groupPerms.filter((p: Permission) => editingPerms.includes(p.id)).length;
              const allOn = enabledCount === groupPerms.length;

              return (
                <View key={group}>
                  {/* Group header */}
                  <TouchableOpacity
                    style={s.permGroupHeader}
                    onPress={() => togglePermGroup(group)}
                    activeOpacity={0.7}
                  >
                    <View style={s.permGroupLeft}>
                      <Ionicons
                        name={(GROUP_ICONS[group] ?? "ellipse-outline") as any}
                        size={14}
                        color={colors.primary}
                      />
                      <Text style={s.permGroupTitle}>{group}</Text>
                      <View style={[s.countBadge, enabledCount > 0 && s.countBadgeOn]}>
                        <Text style={[s.countBadgeTxt, enabledCount > 0 && s.countBadgeTxtOn]}>
                          {enabledCount}/{groupPerms.length}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={allOn}
                      onValueChange={() => togglePermGroup(group)}
                      trackColor={{ false: colors.borderLight, true: colors.primary }}
                      thumbColor="#fff"
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </TouchableOpacity>

                  {/* Individual permissions */}
                  {groupPerms.map((perm: Permission, idx: number) => (
                    <TouchableOpacity
                      key={perm.id}
                      style={[s.permItem, idx === groupPerms.length - 1 && s.permItemLast]}
                      onPress={() => togglePerm(perm.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.permItemLabel}>{perm.label}</Text>
                      <View style={[s.checkbox, editingPerms.includes(perm.id) && s.checkboxOn]}>
                        {editingPerms.includes(perm.id) && (
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Save button */}
          <View style={[s.permSaveWrap, { paddingBottom: 4 }]}>
            <TouchableOpacity
              style={[s.permSaveBtn, savingPerms && { opacity: 0.7 }]}
              onPress={handleSavePermissions}
              disabled={savingPerms}
            >
              {savingPerms ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.permSaveTxt}>Save Permissions</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  appBar: { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  appBarTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },

  tabWrap: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border },
  tabRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff" },
  tabTxt: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeTxt: { fontSize: 10, fontWeight: "700" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  errorTxt: { fontSize: 13, color: colors.red, textAlign: "center" },
  retryBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt: { fontSize: 13, fontWeight: "700", color: colors.primary },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 19 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 6 },
  emptyAddTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  list: { padding: 16, gap: 12, paddingBottom: 60 },

  card: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarTxt: { fontSize: 18, fontWeight: "800" },
  cardInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: "700", color: colors.text },
  memberContact: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardActions: { alignItems: "flex-end", gap: 8 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 10, fontWeight: "700" },

  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  rolePillTxt: { fontSize: 11, fontWeight: "700" },
  changeRoleBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  changeRoleTxt: { fontSize: 12, fontWeight: "600", color: colors.primary },

  permRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: "#f8fafc" },
  permRowTxt: { flex: 1, fontSize: 12, color: colors.textMuted },
  permEditTxt: { fontSize: 12, fontWeight: "600", color: colors.primary },

  inviteRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: "#f8fafc" },
  inviteTxt: { fontSize: 11, color: colors.primary, fontWeight: "500" },
  inviteCode: { flex: 1, fontSize: 10, color: colors.textMuted, fontFamily: "monospace", textAlign: "right" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "65%" },
  permSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "85%", flexDirection: "column" },

  sheetHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  sheetSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sheetLoading: { paddingVertical: 40, alignItems: "center" },
  sheetDivider: { height: 1, backgroundColor: colors.borderLight, marginHorizontal: 18 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  sheetRoleIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sheetRowTxt: { flex: 1, fontSize: 14, color: colors.text },

  // Permissions sheet internals
  permGroupHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 11,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    borderTopWidth: 1, borderTopColor: colors.border,
    marginTop: 4,
  },
  permGroupLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  permGroupTitle: { fontSize: 12, fontWeight: "700", color: colors.text },
  countBadge: { backgroundColor: colors.borderLight, borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2 },
  countBadgeOn: { backgroundColor: `${colors.primary}22` },
  countBadgeTxt: { fontSize: 10, fontWeight: "600", color: colors.textLight },
  countBadgeTxtOn: { color: colors.primary },

  permItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: "#f4f6fa",
    backgroundColor: "#fff",
  },
  permItemLast: { borderBottomWidth: 0 },
  permItemLabel: { fontSize: 13, color: colors.text, flex: 1 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: "#fff",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },

  permSaveWrap: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  permSaveBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  permSaveTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
});

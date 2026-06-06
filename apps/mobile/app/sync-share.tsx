import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/theme";
import { api } from "../src/auth";
import type { TeamMember } from "@vyapar/api-client";

const ROLES = [
  {
    id: "secondary_admin",
    label: "Secondary Admin",
    permissions: [
      "Can see user activity",
      "Can view and modify all transactions",
      "Can view and generate all reports",
      "Cannot enable or disable Sync&Share",
      "Cannot add or remove users",
      "Cannot take backup of the company",
    ],
  },
  {
    id: "salesman",
    label: "Salesman",
    permissions: [
      "Can create sales entries",
      "Can only modify and view their own sale entries",
      "Can create and modify items",
      "Can create expenses",
      "Cannot see full party balance",
      "Cannot create purchase entries",
    ],
  },
  {
    id: "biller",
    label: "Biller",
    permissions: [
      "Can create sales transactions",
      "Can view all sale transactions",
      "Can only modify their own sale transactions",
      "Can see full party balance",
      "Can create expenses",
      "Cannot create or modify items (including sale form)",
      "Cannot view or create purchase transactions",
    ],
  },
  {
    id: "biller_salesman",
    label: "Biller and Salesman",
    permissions: [
      "Can create sales transactions",
      "Can view all sale transactions",
      "Can only modify their own sale transactions",
      "Can see full party balance",
      "Can create expenses",
      "Can create and modify items",
      "Cannot create purchase transactions",
    ],
  },
  {
    id: "ca_accountant",
    label: "CA/Accountant",
    permissions: [
      "Can view all transactions",
      "Can view all items and parties",
      "Can view all bank data",
      "Can view and generate all reports",
      "Cannot modify any data",
      "Cannot see user activity",
      "Cannot change any company setting",
    ],
  },
  {
    id: "stock_keeper",
    label: "Stock Keeper",
    permissions: [
      "Can create and modify items",
      "Can create purchase entries",
      "Can only modify and view their own purchase transaction",
      "Can create stock transfer transactions",
      "Can only modify and view their own stock transfer transactions",
      "Can create expenses",
      "Cannot view or create sale transactions",
    ],
  },
  {
    id: "ca_accountant_edit",
    label: "CA/Accountant(Edit Access)",
    permissions: [
      "Can view and modify all transactions",
      "Can view and generate all reports",
      "Cannot enable or disable Sync&Share",
      "Cannot add or remove users",
      "Cannot take backup of the company",
      "Cannot share transaction SMS",
    ],
  },
];

function getRoleLabel(roleId: string): string {
  return ROLES.find((r) => r.id === roleId)?.label ?? roleId;
}

export default function SyncShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // Change-role sheet state
  const [changeRoleTarget, setChangeRoleTarget] = useState<TeamMember | null>(null);
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [changingRole, setChangingRole] = useState(false);

  async function fetchMembers() {
    try {
      setLoading(true);
      setFetchError("");
      const data = await api.listTeamMembers();
      setMembers(data);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Could not load users. Check connection.";
      setFetchError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
    }, [])
  );

  async function handleDelete(member: TeamMember) {
    Alert.alert(
      "Remove User",
      `Remove ${member.name} from this company?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteTeamMember(member.id);
              setMembers((prev) => prev.filter((m) => m.id !== member.id));
            } catch (err: any) {
              const msg = err?.response?.data?.message ?? "Failed to remove user.";
              Alert.alert("Error", msg);
            }
          },
        },
      ]
    );
  }

  function openChangeRole(member: TeamMember) {
    setChangeRoleTarget(member);
    setRoleSheetVisible(true);
  }

  async function handleRoleChange(newRole: string) {
    if (!changeRoleTarget) return;
    setChangingRole(true);
    try {
      const updated = await api.updateTeamMemberRole(changeRoleTarget.id, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
      setRoleSheetVisible(false);
      setChangeRoleTarget(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Failed to update role.";
      Alert.alert("Error", msg);
    } finally {
      setChangingRole(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Sync &amp; Share</Text>
        <View style={styles.appBarActions}>
          <TouchableOpacity style={styles.appBarIconBtn} hitSlop={8}>
            <Ionicons name="person-add-outline" size={18} color={colors.pink} />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={8}>
            <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={8}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Logged in card */}
        <View style={styles.loginCard}>
          <Text style={styles.loginLabel}>Logged in with</Text>
          <View style={styles.loginRow}>
            <Text style={styles.loginPhone}>+92 — your account</Text>
            <Ionicons name="sync-circle" size={22} color={colors.green} />
          </View>
        </View>

        {/* User Roles section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>User Roles</Text>
          <TouchableOpacity hitSlop={6}>
            <Text style={styles.sectionLink}>See User Activity &gt;</Text>
          </TouchableOpacity>
        </View>

        {/* Team member list */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : fetchError ? (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: "#ef4444" }]}>{fetchError}</Text>
          </View>
        ) : members.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No team members yet. Tap "+ Add User" to invite someone.</Text>
          </View>
        ) : (
          members.map((member) => (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberTop}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberContact}>{member.contact}</Text>
                </View>
                <View style={styles.memberTopRight}>
                  <View
                    style={[
                      styles.statusBadge,
                      member.status === "active"
                        ? styles.statusBadgeActive
                        : styles.statusBadgePending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        member.status === "active"
                          ? styles.statusBadgeTextActive
                          : styles.statusBadgeTextPending,
                      ]}
                    >
                      {member.status === "active" ? "Active" : "Pending"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    hitSlop={8}
                    onPress={() => handleDelete(member)}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.red} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.memberDivider} />
              <View style={styles.memberBottom}>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>
                    {member.role.toUpperCase().replace(/_/g, " ")}
                  </Text>
                </View>
                <TouchableOpacity hitSlop={6} onPress={() => openChangeRole(member)}>
                  <Text style={styles.changeRoleLink}>Change Role &gt;</Text>
                </TouchableOpacity>
              </View>
              {member.status === "pending" && member.inviteToken && (
                <TouchableOpacity
                  style={styles.inviteCodeRow}
                  onPress={() => {
                    // Copy invite token to clipboard
                    import("expo-clipboard").then(Clipboard => {
                      Clipboard.setStringAsync(member.inviteToken);
                      Alert.alert("Copied!", "Invite code copied to clipboard. Share it with the team member.");
                    }).catch(() => {
                      Alert.alert("Invite Code", member.inviteToken);
                    });
                  }}
                >
                  <Ionicons name="copy-outline" size={13} color={colors.primary} />
                  <Text style={styles.inviteCodeText}>Tap to copy invite code</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/add-user")}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.fabText}>Add User</Text>
      </TouchableOpacity>

      {/* Change Role bottom sheet */}
      <Modal
        visible={roleSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRoleSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !changingRole && setRoleSheetVisible(false)}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Choose User Role</Text>
            <TouchableOpacity
              onPress={() => !changingRole && setRoleSheetVisible(false)}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          {changingRole ? (
            <View style={styles.sheetLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={ROLES}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.sheetDivider} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() => handleRoleChange(item.id)}
                >
                  <Text
                    style={[
                      styles.sheetRowText,
                      changeRoleTarget?.role === item.id && styles.sheetRowTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {changeRoleTarget?.role === item.id && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
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
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  appBarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 10,
  },
  appBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appBarIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.pinkLight,
    alignItems: "center",
    justifyContent: "center",
  },

  body: {
    padding: 14,
    gap: 10,
  },

  loginCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loginLabel: {
    fontSize: 11,
    color: colors.textLight,
    marginBottom: 4,
  },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  loginPhone: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  sectionLink: {
    fontSize: 12,
    color: colors.blue,
    fontWeight: "500",
  },

  loadingBox: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textLight,
    textAlign: "center",
    lineHeight: 20,
  },

  memberCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  memberTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  memberInfo: { flex: 1 },
  memberName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  memberContact: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  memberTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusBadge: {
    borderRadius: 100,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusBadgeActive: { backgroundColor: colors.greenLight },
  statusBadgePending: { backgroundColor: "#fff3e0" },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
  statusBadgeTextActive: { color: colors.green },
  statusBadgeTextPending: { color: "#e65100" },

  memberDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: 14,
  },
  memberBottom: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  rolePill: {
    backgroundColor: colors.text,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  changeRoleLink: {
    fontSize: 12,
    color: colors.blue,
    fontWeight: "500",
  },

  inviteCodeRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: "#f1f5f9",
  },
  inviteCodeText: {
    fontSize: 11, color: colors.primary, fontWeight: "500",
  },

  fab: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.red,
    borderRadius: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Bottom sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  sheetLoading: {
    paddingVertical: 40,
    alignItems: "center",
  },
  sheetDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: 18,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  sheetRowText: {
    fontSize: 14,
    color: colors.text,
  },
  sheetRowTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
});

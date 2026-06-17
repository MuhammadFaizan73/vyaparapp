import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/auth";
import type { PartyAssignment } from "@vyapar/api-client";
import type { TeamMember } from "@vyapar/api-client";
import { colors } from "../../src/theme";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof DAYS)[number];

type Props = {
  visible: boolean;
  partyId: string;
  partyName: string;
  onClose: () => void;
  onSaved: () => void;
};

type MemberRow = {
  member: TeamMember;
  assignment: PartyAssignment | null;
  // local edit state
  pendingDays: Set<Day>;
  expanded: boolean; // day-picker open for un-assigned member
  dirty: boolean;
};

export function AssignModal({ visible, partyId, partyName, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // memberId being saved
  const [rows, setRows] = useState<MemberRow[]>([]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    Promise.all([
      api.listTeamMembers(),
      api.getPartyAssignments().catch(() => [] as import("@vyapar/api-client").PartyAssignment[]),
    ])
      .then(([members, allAssignments]) => {
        const salesmen = members.filter(
          (m) =>
            m.role === "salesman" ||
            m.role === "biller_salesman" ||
            m.role === "secondary_admin",
        );
        const forParty = allAssignments.filter((a) => a.partyId === partyId);
        const built: MemberRow[] = salesmen.map((m) => {
          const assignment = forParty.find((a) => a.memberId === m.id) ?? null;
          const pendingDays = assignment
            ? new Set(assignment.visitDays.split(",") as Day[])
            : new Set<Day>();
          return { member: m, assignment, pendingDays, expanded: false, dirty: false };
        });
        setRows(built);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [visible, partyId]);

  function toggleDay(memberId: string, day: Day) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.member.id !== memberId) return r;
        const next = new Set(r.pendingDays);
        if (next.has(day)) next.delete(day);
        else next.add(day);
        return { ...r, pendingDays: next, dirty: true };
      }),
    );
  }

  function toggleExpand(memberId: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.member.id === memberId ? { ...r, expanded: !r.expanded } : r,
      ),
    );
  }

  async function handleSave(row: MemberRow) {
    if (row.pendingDays.size === 0) {
      // treat as remove
      if (row.assignment) await handleRemove(row);
      return;
    }
    setSaving(row.member.id);
    try {
      const days = DAYS.filter((d) => row.pendingDays.has(d)); // keep canonical order
      if (row.assignment) {
        await api.updateAssignment(row.assignment.id, days);
      } else {
        await api.createAssignment(partyId, row.member.id, days);
      }
      // Refresh local state: mark as saved
      setRows((prev) =>
        prev.map((r) =>
          r.member.id === row.member.id
            ? { ...r, dirty: false, expanded: false, assignment: { ...(r.assignment ?? { id: "", partyId, memberId: r.member.id, createdAt: "" }), visitDays: days.join(",") } as PartyAssignment }
            : r,
        ),
      );
      onSaved();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Could not save assignment. Try again.";
      Alert.alert("Error", Array.isArray(msg) ? msg.join("\n") : msg);
    } finally {
      setSaving(null);
    }
  }

  async function handleRemove(row: MemberRow) {
    if (!row.assignment) return;
    setSaving(row.member.id);
    try {
      await api.deleteAssignment(row.assignment.id);
      setRows((prev) =>
        prev.map((r) =>
          r.member.id === row.member.id
            ? { ...r, assignment: null, pendingDays: new Set(), dirty: false, expanded: false }
            : r,
        ),
      );
      onSaved();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Could not remove assignment. Try again.";
      Alert.alert("Error", Array.isArray(msg) ? msg.join("\n") : msg);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        {/* Header */}
        <View style={s.handle} />
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Assign Party</Text>
            <Text style={s.subtitle} numberOfLines={1}>{partyName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : rows.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="people-outline" size={40} color={colors.border} />
            <Text style={s.emptyTxt}>No salesmen in your team yet.</Text>
            <Text style={s.emptySub}>Add team members from the Menu screen first.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.list}>
            {rows.map((row) => {
              const isAssigned = !!row.assignment;
              const isSaving = saving === row.member.id;
              return (
                <View key={row.member.id} style={s.memberCard}>
                  {/* Member info row */}
                  <View style={s.memberRow}>
                    <View style={s.memberAvatar}>
                      <Text style={s.memberAvatarTxt}>
                        {row.member.name[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName}>{row.member.name}</Text>
                      <Text style={s.memberContact}>{row.member.contact}</Text>
                    </View>

                    {isAssigned ? (
                      /* Assigned — show remove button */
                      <TouchableOpacity
                        style={s.removeBtn}
                        onPress={() => handleRemove(row)}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <ActivityIndicator size={12} color={colors.red} />
                        ) : (
                          <Ionicons name="trash-outline" size={14} color={colors.red} />
                        )}
                      </TouchableOpacity>
                    ) : (
                      /* Not assigned — show Assign button */
                      <TouchableOpacity
                        style={[s.assignBtn, row.expanded && s.assignBtnActive]}
                        onPress={() => toggleExpand(row.member.id)}
                      >
                        <Text style={[s.assignBtnTxt, row.expanded && s.assignBtnTxtActive]}>
                          {row.expanded ? "Cancel" : "Assign"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Day chips (shown when assigned OR expanded for new assignment) */}
                  {(isAssigned || row.expanded) && (
                    <View style={s.daysSection}>
                      <Text style={s.daysLabel}>Visit Days</Text>
                      <View style={s.daysRow}>
                        {DAYS.map((day) => {
                          const active = row.pendingDays.has(day);
                          return (
                            <TouchableOpacity
                              key={day}
                              style={[s.dayChip, active && s.dayChipActive]}
                              onPress={() => toggleDay(row.member.id, day)}
                            >
                              <Text style={[s.dayChipTxt, active && s.dayChipTxtActive]}>
                                {day}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {/* Save button — only show when there's something to save */}
                      {(row.dirty || row.expanded) && row.pendingDays.size > 0 && (
                        <TouchableOpacity
                          style={s.saveBtn}
                          onPress={() => handleSave(row)}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <ActivityIndicator size={14} color="#fff" />
                          ) : (
                            <Text style={s.saveBtnTxt}>
                              {row.assignment ? "Update" : "Save Assignment"}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Assigned check indicator */}
                  {isAssigned && !row.expanded && (
                    <View style={s.assignedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                      <Text style={s.assignedBadgeTxt}>Assigned</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  center: {
    padding: 40,
    alignItems: "center",
    gap: 10,
  },
  emptyTxt: { fontSize: 15, fontWeight: "600", color: colors.text },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: "center" },

  list: { padding: 16, gap: 12, paddingBottom: 24 },

  memberCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e6f3f7",
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarTxt: { fontSize: 16, fontWeight: "700", color: colors.primary },
  memberName: { fontSize: 14, fontWeight: "600", color: colors.text },
  memberContact: { fontSize: 12, color: colors.textLight, marginTop: 1 },

  removeBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fee2e2",
    backgroundColor: "#fff5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  assignBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "#fff",
  },
  assignBtnActive: { backgroundColor: "#e6f3f7" },
  assignBtnTxt: { fontSize: 13, fontWeight: "600", color: colors.primary },
  assignBtnTxtActive: { color: colors.primary },

  daysSection: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#f8fcfd",
    gap: 10,
    paddingTop: 12,
  },
  daysLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipTxt: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  dayChipTxtActive: { color: "#fff" },

  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  assignedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  assignedBadgeTxt: { fontSize: 11, fontWeight: "600", color: colors.primary },
});

export default AssignModal;

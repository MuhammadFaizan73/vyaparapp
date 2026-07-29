import { useEffect, useState } from "react";
import type { TeamMember } from "@vyapar/api-client";
import { ALL_PERMISSIONS, TEAM_ROLES, TEAM_ROLE_LABELS, type TeamRole } from "@vyapar/shared-types";
import { api } from "../lib/api";
import { AddUserModal } from "./AddUserModal";
import { EditPermissionsModal } from "./EditPermissionsModal";

const ROLE_TINTS: Record<TeamRole, { bg: string; fg: string }> = {
  secondary_admin:    { bg: "#dbeafe", fg: "#1d4ed8" },
  salesman:           { bg: "#dcfce7", fg: "#15803d" },
  biller:             { bg: "#fef3c7", fg: "#b45309" },
  biller_salesman:    { bg: "#ede9fe", fg: "#6d28d9" },
  ca_accountant:      { bg: "#fff1e6", fg: "#c2410c" },
  stock_keeper:       { bg: "#fce7f3", fg: "#be185d" },
  ca_accountant_edit: { bg: "#e0e7ff", fg: "#4338ca" },
};

function parseMemberPermissions(member: TeamMember): string[] {
  try {
    const raw = (member as any).permissions;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function TeamScreen() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRole, setActiveRole] = useState<TeamRole | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [permTarget, setPermTarget] = useState<TeamMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setMembers(await api.listTeamMembers());
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Could not load team members.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleDelete(member: TeamMember) {
    try {
      await api.deleteTeamMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setDeleteTarget(null);
    } catch {
      setError("Failed to remove user.");
    }
  }

  async function handleRoleChange(member: TeamMember, role: TeamRole) {
    try {
      const updated = await api.updateTeamMemberRole(member.id, role);
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch {
      setError("Failed to update role.");
    }
  }

  function copyInviteCode(member: TeamMember) {
    navigator.clipboard.writeText(member.inviteToken).then(() => {
      setCopiedId(member.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const displayed = activeRole === "all" ? members : members.filter((m) => m.role === activeRole);
  const countFor = (role: TeamRole | "all") => (role === "all" ? members.length : members.filter((m) => m.role === role).length);

  return (
    <div className="team-screen">
      <div className="team-screen__header">
        <h2 className="team-screen__title">Team</h2>
        <button type="button" className="team-add-btn" onClick={() => setShowAdd(true)}>+ Add User</button>
      </div>

      <div className="team-tabs">
        <button type="button" className={`team-tab${activeRole === "all" ? " team-tab--active" : ""}`} onClick={() => setActiveRole("all")}>
          All <span className="team-tab__count">{countFor("all")}</span>
        </button>
        {TEAM_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            className={`team-tab${activeRole === r ? " team-tab--active" : ""}`}
            style={activeRole === r ? { background: ROLE_TINTS[r].bg, borderColor: ROLE_TINTS[r].fg, color: ROLE_TINTS[r].fg } : undefined}
            onClick={() => setActiveRole(r)}
          >
            {TEAM_ROLE_LABELS[r]} <span className="team-tab__count">{countFor(r)}</span>
          </button>
        ))}
      </div>

      {error && <div className="form-error" style={{ margin: "12px 0" }}>{error}</div>}

      {loading ? (
        <div className="team-empty">Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="team-empty">
          <p>{activeRole === "all" ? "No team members yet." : `No ${TEAM_ROLE_LABELS[activeRole as TeamRole]} users.`}</p>
          <button type="button" className="team-add-btn" onClick={() => setShowAdd(true)}>+ Add User</button>
        </div>
      ) : (
        <div className="team-list">
          {displayed.map((member) => {
            const tint = ROLE_TINTS[member.role as TeamRole] ?? { bg: "#f1f5f9", fg: "#374151" };
            const perms = parseMemberPermissions(member);
            return (
              <div key={member.id} className="team-card">
                <div className="team-card__top">
                  <div className="team-card__avatar" style={{ background: tint.bg, color: tint.fg }}>
                    {member.name[0]?.toUpperCase()}
                  </div>
                  <div className="team-card__info">
                    <span className="team-card__name">{member.name}</span>
                    <span className="team-card__contact">{member.contact || "—"}</span>
                  </div>
                  <span className={`team-status-pill${member.status === "active" ? " team-status-pill--active" : ""}`}>
                    {member.status === "active" ? "Active" : "Pending"}
                  </span>
                  <button type="button" className="team-icon-btn" title="Remove user" onClick={() => setDeleteTarget(member)}>🗑</button>
                </div>

                <div className="team-card__row">
                  <span className="team-role-pill" style={{ background: tint.bg, color: tint.fg }}>{TEAM_ROLE_LABELS[member.role as TeamRole] ?? member.role}</span>
                  <select
                    className="team-role-select"
                    value={member.role}
                    onChange={(e) => void handleRoleChange(member, e.target.value as TeamRole)}
                  >
                    {TEAM_ROLES.map((r) => <option key={r} value={r}>{TEAM_ROLE_LABELS[r]}</option>)}
                  </select>
                </div>

                <button type="button" className="team-card__perm-row" onClick={() => setPermTarget(member)}>
                  <span>{perms.length} of {ALL_PERMISSIONS.length} permissions</span>
                  <span className="team-card__perm-edit">Edit Permissions →</span>
                </button>

                {member.inviteToken && (
                  <button type="button" className="team-card__invite-row" onClick={() => copyInviteCode(member)}>
                    <span>{member.status === "pending" ? "Copy invite code" : "Copy login code"}</span>
                    <span className="team-card__invite-code">{copiedId === member.id ? "Copied!" : member.inviteToken}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddUserModal onClose={() => setShowAdd(false)} onSaved={() => void load()} />
      )}
      {permTarget && (
        <EditPermissionsModal
          member={permTarget}
          onClose={() => setPermTarget(null)}
          onSaved={(updated) => setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))}
        />
      )}
      {deleteTarget && (
        <div className="party-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="party-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="party-modal__body" style={{ padding: 24 }}>
              <p>Remove <strong>{deleteTarget.name}</strong> from this company?</p>
            </div>
            <div className="party-modal__footer">
              <button type="button" className="party-modal__btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <div className="party-modal__footer-right">
                <button type="button" className="party-modal__btn-primary" style={{ background: "#dc2626" }} onClick={() => void handleDelete(deleteTarget)}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

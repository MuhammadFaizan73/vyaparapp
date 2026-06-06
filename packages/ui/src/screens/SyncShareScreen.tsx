import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { TeamMember } from "@vyapar/api-client";

const ROLES = [
  {
    id: "secondary_admin",
    label: "Secondary Admin",
    permissions: [
      "Can see user activity",
      "Can view and modify all transactions",
      "Can view and generate all reports",
      "Cannot enable or disable Sync & Share",
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
    label: "CA/Accountant (Edit Access)",
    permissions: [
      "Can view and modify all transactions",
      "Can view and generate all reports",
      "Cannot enable or disable Sync & Share",
      "Cannot add or remove users",
      "Cannot take backup of the company",
      "Cannot share transaction SMS",
    ],
  },
];

function getRoleMeta(roleId: string) {
  return ROLES.find((r) => r.id === roleId) ?? { id: roleId, label: roleId, permissions: [] };
}

/** Colored dot accent by role index for visual variety */
const ROLE_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#f97316",
];

function getRoleColor(roleId: string) {
  const idx = ROLES.findIndex((r) => r.id === roleId);
  return ROLE_COLORS[idx >= 0 ? idx % ROLE_COLORS.length : 0];
}

type AddUserForm = {
  name: string;
  contact: string;
  role: string;
};

const EMPTY_FORM: AddUserForm = { name: "", contact: "", role: "salesman" };

export function SyncShareScreen() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<AddUserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listTeamMembers();
      setMembers(data);
    } catch {
      setError("Failed to load team members. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (!form.contact.trim()) { setFormError("Contact (phone or email) is required."); return; }
    setFormError(null);
    setSaving(true);
    try {
      const created = await api.createTeamMember({
        name: form.name.trim(),
        contact: form.contact.trim(),
        role: form.role,
      });
      setMembers((prev) => [...prev, created]);
      setShowAddModal(false);
      setForm(EMPTY_FORM);
    } catch {
      setFormError("Failed to add user. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(member: TeamMember, newRole: string) {
    setUpdatingRoleId(member.id);
    try {
      const updated = await api.updateTeamMemberRole(member.id, newRole);
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch {
      // silently revert — the select will re-render with original value
    } finally {
      setUpdatingRoleId(null);
    }
  }

  async function handleDelete(member: TeamMember) {
    if (!window.confirm(`Remove ${member.name} from the team? This cannot be undone.`)) return;
    try {
      await api.deleteTeamMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch {
      alert("Failed to remove team member. Please try again.");
    }
  }

  const selectedRoleMeta = getRoleMeta(form.role);

  return (
    <div className="ss-screen">
      {/* ── Page header ── */}
      <div className="ss-header">
        <div className="ss-header__left">
          <h1 className="ss-header__title">Sync, Share &amp; Backup</h1>
          <p className="ss-header__sub">Manage your team members and their access levels</p>
        </div>
        <button
          type="button"
          className="ss-btn-primary"
          onClick={() => { setForm(EMPTY_FORM); setFormError(null); setShowAddModal(true); }}
        >
          <PlusIcon />
          Add User
        </button>
      </div>

      {/* ── Team Members card ── */}
      <div className="ss-card">
        <div className="ss-card__label">Team Members</div>

        {loading && (
          <div className="ss-empty">Loading team members…</div>
        )}

        {!loading && error && (
          <div className="ss-error">
            {error}
            <button type="button" className="ss-error__retry" onClick={fetchMembers}>Retry</button>
          </div>
        )}

        {!loading && !error && members.length === 0 && (
          <div className="ss-empty">
            <div className="ss-empty__icon">
              <TeamIcon />
            </div>
            <p className="ss-empty__title">No team members yet</p>
            <p className="ss-empty__sub">Click &ldquo;Add User&rdquo; to invite your first team member.</p>
          </div>
        )}

        {!loading && !error && members.length > 0 && (
          <div className="ss-table-wrap">
            <table className="ss-table">
              <thead>
                <tr className="ss-thead-row">
                  <th className="ss-th">Name</th>
                  <th className="ss-th">Contact</th>
                  <th className="ss-th">Role</th>
                  <th className="ss-th">Status</th>
                  <th className="ss-th ss-th--right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const roleMeta = getRoleMeta(m.role);
                  const roleColor = getRoleColor(m.role);
                  const isUpdating = updatingRoleId === m.id;
                  const isActive = m.status === "active";

                  return (
                    <tr key={m.id} className="ss-row">
                      <td className="ss-td ss-td--name">
                        <span
                          className="ss-avatar"
                          style={{ background: roleColor + "22", color: roleColor }}
                        >
                          {m.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="ss-td__name-text">{m.name}</span>
                      </td>
                      <td className="ss-td ss-td--contact">{m.contact}</td>
                      <td className="ss-td ss-td--role">
                        <select
                          className="ss-role-select"
                          value={m.role}
                          disabled={isUpdating}
                          style={{ borderColor: roleColor + "66", color: roleColor }}
                          onChange={(e) => handleRoleChange(m, e.target.value)}
                        >
                          {ROLES.map((r) => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                          ))}
                        </select>
                        {isUpdating && <span className="ss-updating">Saving…</span>}
                      </td>
                      <td className="ss-td ss-td--status">
                        <span className={`ss-status-badge ss-status-badge--${isActive ? "active" : "pending"}`}>
                          {isActive ? "Active" : "Pending"}
                        </span>
                      </td>
                      <td className="ss-td ss-td--actions">
                        {!isActive && m.inviteToken && (
                          <button
                            type="button"
                            className="ss-invite-btn"
                            title="Copy invite code to share with this team member"
                            onClick={() => {
                              navigator.clipboard.writeText(m.inviteToken).then(() => {
                                alert("Invite code copied!\n\nShare this code with " + m.name + " so they can join using the mobile app → Menu → \"Join with Invite Code\".\n\nCode: " + m.inviteToken);
                              });
                            }}
                          >
                            📋 Copy Invite Code
                          </button>
                        )}
                        <button
                          type="button"
                          className="ss-delete-btn"
                          title={`Remove ${m.name}`}
                          onClick={() => handleDelete(m)}
                        >
                          <TrashIcon />
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add User Modal ── */}
      {showAddModal && (
        <div className="ss-overlay" onClick={() => setShowAddModal(false)}>
          <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ss-modal__header">
              <h2 className="ss-modal__title">Add Team Member</h2>
              <button
                type="button"
                className="ss-modal__close"
                onClick={() => setShowAddModal(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleAddUser} noValidate>
              <div className="ss-modal__body">
                {formError && <div className="ss-form-error">{formError}</div>}

                <div className="ss-field">
                  <label className="ss-label" htmlFor="ss-name">Full Name</label>
                  <input
                    id="ss-name"
                    type="text"
                    className="ss-input"
                    placeholder="e.g. Ahmed Khan"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    autoFocus
                  />
                </div>

                <div className="ss-field">
                  <label className="ss-label" htmlFor="ss-contact">Contact (Phone or Email)</label>
                  <input
                    id="ss-contact"
                    type="text"
                    className="ss-input"
                    placeholder="e.g. 03001234567 or ahmed@example.com"
                    value={form.contact}
                    onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                  />
                </div>

                <div className="ss-field">
                  <label className="ss-label" htmlFor="ss-role">Role</label>
                  <select
                    id="ss-role"
                    className="ss-input ss-select"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  >
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {/* Role permissions preview */}
                <div className="ss-permissions-box">
                  <div className="ss-permissions-box__title">
                    <span
                      className="ss-permissions-box__dot"
                      style={{ background: getRoleColor(form.role) }}
                    />
                    {selectedRoleMeta.label} permissions
                  </div>
                  <ul className="ss-permissions-list">
                    {selectedRoleMeta.permissions.map((perm) => {
                      const isCannot = perm.toLowerCase().startsWith("cannot");
                      return (
                        <li
                          key={perm}
                          className={`ss-permissions-list__item ss-permissions-list__item--${isCannot ? "deny" : "allow"}`}
                        >
                          {isCannot ? <DenyIcon /> : <AllowIcon />}
                          {perm}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="ss-modal__footer">
                <button
                  type="button"
                  className="ss-btn-cancel"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="ss-btn-primary" disabled={saving}>
                  {saving ? "Adding…" : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Inline SVG icons ── */

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AllowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" style={{ flexShrink: 0 }}>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DenyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13" style={{ flexShrink: 0 }}>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

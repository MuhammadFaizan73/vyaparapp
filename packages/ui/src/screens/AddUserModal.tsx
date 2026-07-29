import { useState } from "react";
import { createPortal } from "react-dom";
import { ROLE_DEFAULT_PERMISSIONS, TEAM_ROLE_LABELS, TEAM_ROLES, type TeamRole } from "@vyapar/shared-types";
import { api } from "../lib/api";
import { PermissionChecklist } from "./PermissionChecklist";

type Props = {
  onClose: () => void;
  onSaved: () => void;
};

export function AddUserModal({ onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<TeamRole>("salesman");
  const [permissions, setPermissions] = useState<string[]>(ROLE_DEFAULT_PERMISSIONS.salesman);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function selectRole(r: TeamRole) {
    setRole(r);
    setPermissions(ROLE_DEFAULT_PERMISSIONS[r]);
  }

  async function save() {
    if (!name.trim()) { setError("Please enter full name."); return; }
    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError(null);
    setBusy(true);
    try {
      await api.createTeamMember({ name: name.trim(), email: emailTrimmed, password, role, permissions });
      setSuccess(true);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ?? "Could not save user.";
      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return createPortal(
      <div className="party-modal-backdrop" onClick={() => { onSaved(); onClose(); }}>
        <div className="party-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
          <div className="party-modal__body" style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <h3 style={{ margin: "0 0 8px" }}>User Added!</h3>
            <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
              <strong>{name}</strong> can now log in with this email and password from Staff Login.
            </p>
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: 12, fontFamily: "monospace", fontSize: 13, color: "#166534" }}>
              {email}
            </div>
          </div>
          <div className="party-modal__footer">
            <div className="party-modal__footer-right" style={{ width: "100%" }}>
              <button type="button" className="party-modal__btn-primary" style={{ width: "100%" }} onClick={() => { onSaved(); onClose(); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="party-modal-backdrop" onClick={onClose}>
      <div className="party-modal team-modal" onClick={(e) => e.stopPropagation()}>
        <div className="party-modal__header">
          <span className="party-modal__title">Add User</span>
          <button type="button" className="party-modal__icon-btn" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <div className="party-modal__body team-modal__body">
          {error && <div className="form-error">{error}</div>}

          <div className="party-modal__row">
            <div className="party-modal__field">
              <input className="party-modal__input party-modal__input--focus" placeholder="Full Name *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="party-modal__field">
              <input className="party-modal__input" placeholder="Email Address *" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <div className="party-modal__row">
            <div className="party-modal__field" style={{ position: "relative" }}>
              <input
                className="party-modal__input"
                placeholder="Password * (min 6 characters)"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "#9ca3af" }}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <div className="party-modal__field">
              <select className="party-modal__input" value={role} onChange={(e) => selectRole(e.target.value as TeamRole)} style={{ cursor: "pointer" }}>
                {TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>{TEAM_ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 4px" }}>
            Permissions are pre-filled based on the role. Customize individually below.
          </p>

          <PermissionChecklist permissions={permissions} onChange={setPermissions} />
        </div>

        <div className="party-modal__footer">
          <button type="button" className="party-modal__btn-ghost" onClick={onClose}>Cancel</button>
          <div className="party-modal__footer-right">
            <button type="button" className="party-modal__btn-primary" disabled={busy || !name.trim()} onClick={() => void save()}>
              {busy ? "Saving…" : "Add User"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

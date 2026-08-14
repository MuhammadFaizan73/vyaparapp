import { useState } from "react";
import { createPortal } from "react-dom";
import type { TeamMember } from "@vyapar/api-client";
import { api } from "../lib/api";
import { PermissionChecklist } from "./PermissionChecklist";

function parseMemberJsonArray(member: TeamMember, field: "permissions" | "allowedReports"): string[] {
  try {
    const raw = (member as any)[field];
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

type Props = {
  member: TeamMember;
  onClose: () => void;
  onSaved: (updated: TeamMember) => void;
};

export function EditPermissionsModal({ member, onClose, onSaved }: Props) {
  const [permissions, setPermissions] = useState<string[]>(parseMemberJsonArray(member, "permissions"));
  const [allowedReports, setAllowedReports] = useState<string[]>(parseMemberJsonArray(member, "allowedReports"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateTeamMemberPermissions(member.id, permissions, allowedReports);
      onSaved(updated);
      onClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Could not update permissions.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="party-modal-backdrop" onClick={onClose}>
      <div className="party-modal team-modal" onClick={(e) => e.stopPropagation()}>
        <div className="party-modal__header">
          <span className="party-modal__title">Edit Permissions — {member.name}</span>
          <button type="button" className="party-modal__icon-btn" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="party-modal__body team-modal__body">
          {error && <div className="form-error">{error}</div>}
          <PermissionChecklist
            permissions={permissions}
            onChange={setPermissions}
            allowedReports={allowedReports}
            onAllowedReportsChange={setAllowedReports}
          />
        </div>
        <div className="party-modal__footer">
          <button type="button" className="party-modal__btn-ghost" onClick={onClose}>Cancel</button>
          <div className="party-modal__footer-right">
            <button type="button" className="party-modal__btn-primary" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save Permissions"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useState } from "react";
import { createPortal } from "react-dom";
import type { TeamMember } from "@vyapar/api-client";
import { api } from "../lib/api";
import { PermissionChecklist } from "./PermissionChecklist";
import { CompanyChecklist } from "./CompanyChecklist";

function parseMemberJsonArray(member: TeamMember, field: "permissions" | "allowedReports"): string[] {
  try {
    const raw = (member as any)[field];
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// null = unrestricted, same convention as the JWT/backend.
function parseMemberCompanyIds(member: TeamMember): string[] | null {
  const raw = (member as any).companyIds;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
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
  const [companyIds, setCompanyIds] = useState<string[] | null>(parseMemberCompanyIds(member));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (companyIds !== null && companyIds.length === 0) { setError("Select at least one company, or turn on All Companies."); return; }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateTeamMemberPermissions(member.id, permissions, allowedReports, companyIds);
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

          <p style={{ fontSize: 12, color: "#6b7280", margin: "12px 0 4px" }}>
            Which companies can this user see?
          </p>
          <CompanyChecklist companyIds={companyIds} onChange={setCompanyIds} />
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

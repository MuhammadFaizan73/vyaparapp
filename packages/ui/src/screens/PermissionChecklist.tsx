import { ALL_PERMISSIONS } from "@vyapar/shared-types";

const PERM_GROUPS = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)));

type Props = {
  permissions: string[];
  onChange: (permissions: string[]) => void;
};

// Same 34 permissions / 8 groups as the mobile app's Add User / Edit Permissions screens
// (packages/shared-types ALL_PERMISSIONS is the shared source of truth) — used by both
// AddUserModal (create) and EditPermissionsModal (edit) so the two never drift apart.
export function PermissionChecklist({ permissions, onChange }: Props) {
  function togglePermission(id: string) {
    onChange(permissions.includes(id) ? permissions.filter((p) => p !== id) : [...permissions, id]);
  }

  function toggleGroup(group: string) {
    const groupPerms = ALL_PERMISSIONS.filter((p) => p.group === group).map((p) => p.id);
    const allOn = groupPerms.every((id) => permissions.includes(id));
    onChange(
      allOn
        ? permissions.filter((id) => !groupPerms.includes(id))
        : Array.from(new Set([...permissions, ...groupPerms]))
    );
  }

  return (
    <div className="team-perm-list">
      {PERM_GROUPS.map((group) => {
        const groupPerms = ALL_PERMISSIONS.filter((p) => p.group === group);
        const enabledCount = groupPerms.filter((p) => permissions.includes(p.id)).length;
        const allOn = enabledCount === groupPerms.length;

        return (
          <div key={group} className="team-perm-group">
            <button type="button" className="team-perm-group__header" onClick={() => toggleGroup(group)}>
              <span className="team-perm-group__title">{group}</span>
              <span className={`team-perm-group__count${enabledCount > 0 ? " team-perm-group__count--on" : ""}`}>
                {enabledCount}/{groupPerms.length}
              </span>
              <span className={`team-perm-toggle${allOn ? " team-perm-toggle--on" : ""}`}>
                <span className="team-perm-toggle__dot" />
              </span>
            </button>
            {groupPerms.map((perm) => (
              <label key={perm.id} className="team-perm-row">
                <span className="team-perm-row__label">{perm.label}</span>
                <input
                  type="checkbox"
                  checked={permissions.includes(perm.id)}
                  onChange={() => togglePermission(perm.id)}
                />
              </label>
            ))}
          </div>
        );
      })}
      <div className="team-perm-summary">
        {permissions.length} of {ALL_PERMISSIONS.length} permissions enabled
      </div>
    </div>
  );
}

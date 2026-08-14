import { ALL_PERMISSIONS, ALL_REPORTS } from "@vyapar/shared-types";

const PERM_GROUPS = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)));
const REPORT_GROUPS = Array.from(new Set(ALL_REPORTS.map((r) => r.group)));

type Props = {
  permissions: string[];
  onChange: (permissions: string[]) => void;
  allowedReports: string[];
  onAllowedReportsChange: (reports: string[]) => void;
};

// Same 34 permissions / 8 groups as the mobile app's Add User / Edit Permissions screens
// (packages/shared-types ALL_PERMISSIONS is the shared source of truth) — used by both
// AddUserModal (create) and EditPermissionsModal (edit) so the two never drift apart.
export function PermissionChecklist({ permissions, onChange, allowedReports, onAllowedReportsChange }: Props) {
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

  function toggleReport(key: string) {
    onAllowedReportsChange(
      allowedReports.includes(key) ? allowedReports.filter((r) => r !== key) : [...allowedReports, key]
    );
  }

  function toggleReportGroup(group: string) {
    const groupKeys = ALL_REPORTS.filter((r) => r.group === group).map((r) => r.key);
    const allOn = groupKeys.every((k) => allowedReports.includes(k));
    onAllowedReportsChange(
      allOn
        ? allowedReports.filter((k) => !groupKeys.includes(k))
        : Array.from(new Set([...allowedReports, ...groupKeys]))
    );
  }

  const reportsViewOn = permissions.includes("reports_view");

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

            {/* Which specific reports this person can open — only meaningful once View
                Reports itself is on. An empty selection means "no extra restriction,
                show every report", so leaving this untouched changes nothing. */}
            {group === "Reports" && reportsViewOn && (
              <div className="team-perm-subgroup">
                <div className="team-perm-subgroup__hint">
                  {allowedReports.length === 0
                    ? "No restriction — every report is visible. Check specific reports below to limit access."
                    : `Limited to ${allowedReports.length} of ${ALL_REPORTS.length} reports.`}
                </div>
                {REPORT_GROUPS.map((rGroup) => {
                  const groupReports = ALL_REPORTS.filter((r) => r.group === rGroup);
                  const enabled = groupReports.filter((r) => allowedReports.includes(r.key)).length;
                  const groupAllOn = enabled === groupReports.length;
                  return (
                    <div key={rGroup} className="team-perm-report-group">
                      <button type="button" className="team-perm-report-group__header" onClick={() => toggleReportGroup(rGroup)}>
                        <span>{rGroup}</span>
                        <span className={`team-perm-toggle${groupAllOn ? " team-perm-toggle--on" : ""}`}>
                          <span className="team-perm-toggle__dot" />
                        </span>
                      </button>
                      {groupReports.map((r) => (
                        <label key={r.key} className="team-perm-row team-perm-row--nested">
                          <span className="team-perm-row__label">{r.label}</span>
                          <input
                            type="checkbox"
                            checked={allowedReports.includes(r.key)}
                            onChange={() => toggleReport(r.key)}
                          />
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div className="team-perm-summary">
        {permissions.length} of {ALL_PERMISSIONS.length} permissions enabled
      </div>
    </div>
  );
}

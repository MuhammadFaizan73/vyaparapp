import { useEffect, useState } from "react";
import type { Company } from "@vyapar/api-client";
import { api } from "../lib/api";

type Props = {
  // null = unrestricted (every company, including ones created later).
  companyIds: string[] | null;
  onChange: (companyIds: string[] | null) => void;
};

// Mirrors PermissionChecklist's group/toggle visual pattern, but simpler: one "All
// Companies" master toggle (on by default, matching today's unrestricted behavior with
// zero clicks) that reveals a flat per-company checklist when turned off.
export function CompanyChecklist({ companyIds, onChange }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    api.getCompanies().then(setCompanies).catch(() => {});
  }, []);

  const allCompanies = companyIds === null;

  function toggleAll() {
    onChange(allCompanies ? [] : null);
  }

  function toggleCompany(id: string) {
    const current = companyIds ?? [];
    onChange(current.includes(id) ? current.filter((c) => c !== id) : [...current, id]);
  }

  return (
    <div className="team-perm-list">
      <div className="team-perm-group">
        <button type="button" className="team-perm-group__header" onClick={toggleAll}>
          <span className="team-perm-group__title">All Companies</span>
          <span className={`team-perm-toggle${allCompanies ? " team-perm-toggle--on" : ""}`}>
            <span className="team-perm-toggle__dot" />
          </span>
        </button>

        {!allCompanies && (
          <>
            {companies.length === 0 && (
              <div className="team-perm-subgroup__hint">No companies found.</div>
            )}
            {companies.length > 0 && (companyIds ?? []).length === 0 && (
              <div className="team-perm-subgroup__hint">Select at least one company below.</div>
            )}
            {companies.map((c) => (
              <label key={c.id} className="team-perm-row">
                <span className="team-perm-row__label">{c.name}</span>
                <input
                  type="checkbox"
                  checked={(companyIds ?? []).includes(c.id)}
                  onChange={() => toggleCompany(c.id)}
                />
              </label>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

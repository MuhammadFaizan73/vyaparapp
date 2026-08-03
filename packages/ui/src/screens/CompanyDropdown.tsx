import { useEffect, useRef, useState } from "react";
import type { Company, Distributor, Branch } from "@vyapar/api-client";
import { useCompany } from "../lib/CompanyContext";
import { CompanyFormModal } from "./CompanyFormModal";
import { DistributorFormModal } from "./DistributorFormModal";
import { BranchFormModal } from "./BranchFormModal";

// Three-level drill-down: root (Distributors + any unassigned Companies) ->
// a Distributor's Branches -> a Branch's Companies. Picking "All of X" at any level
// selects that whole rollup; picking a leaf Company selects just that one.
type View =
  | { level: "root" }
  | { level: "distributor"; distributor: Distributor }
  | { level: "branch"; distributor: Distributor; branch: Branch };

export function CompanyDropdown() {
  const {
    distributors,
    branches,
    companies,
    selectedDistributorId,
    selectedBranchId,
    selectedCompanyId,
    filterLabel,
    setSelectedDistributorId,
    setSelectedBranchId,
    setSelectedCompanyId,
    refreshCompanies,
  } = useCompany();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ level: "root" });
  const ref = useRef<HTMLDivElement>(null);

  const [editingCompany, setEditingCompany] = useState<Company | null | undefined>(undefined);
  const [editingDistributor, setEditingDistributor] = useState<Distributor | null | undefined>(undefined);
  const [editingBranch, setEditingBranch] = useState<{ branch: Branch | null; distributorId: string } | undefined>(undefined);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setView({ level: "root" });
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(fn: () => void) {
    fn();
    setOpen(false);
    setView({ level: "root" });
  }

  const unassignedCompanies = companies.filter((c) => !c.branchId);
  const branchesOf = (distributorId: string) => branches.filter((b) => b.distributorId === distributorId);
  const companiesOf = (branchId: string) => companies.filter((c) => c.branchId === branchId);

  return (
    <div className="company-dropdown" ref={ref}>
      <button type="button" className="company-dropdown__btn" onClick={() => setOpen((v) => !v)}>
        <span className="company-dropdown__label">{filterLabel}</span>
        <span className="company-dropdown__caret">▾</span>
      </button>

      {open && (
        <div className="company-dropdown__menu">
          <button
            type="button"
            className={`company-dropdown__item${!selectedDistributorId && !selectedBranchId && !selectedCompanyId ? " company-dropdown__item--active" : ""}`}
            onClick={() => pick(() => setSelectedDistributorId(null))}
          >
            All Companies
          </button>
          <div className="company-dropdown__divider" />

          {view.level === "root" && (
            <>
              {distributors.length > 0 && <div className="company-dropdown__eyebrow">Distributors</div>}
              {distributors.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`company-dropdown__item${selectedDistributorId === d.id && !selectedBranchId && !selectedCompanyId ? " company-dropdown__item--active" : ""}`}
                  onClick={() => setView({ level: "distributor", distributor: d })}
                >
                  <span>{d.name}</span>
                  <span className="company-dropdown__chevron">›</span>
                </button>
              ))}

              {unassignedCompanies.length > 0 && <div className="company-dropdown__eyebrow">Companies</div>}
              {unassignedCompanies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`company-dropdown__item${selectedCompanyId === c.id ? " company-dropdown__item--active" : ""}`}
                  onClick={() => pick(() => setSelectedCompanyId(c.id))}
                >
                  <span>{c.name}</span>
                  <span className="company-dropdown__edit" onClick={(e) => { e.stopPropagation(); setEditingCompany(c); }}>Edit</span>
                </button>
              ))}

              <div className="company-dropdown__divider" />
              <button type="button" className="company-dropdown__add" onClick={() => { setOpen(false); setEditingDistributor(null); }}>
                + Add Distributor
              </button>
              <button type="button" className="company-dropdown__add" onClick={() => { setOpen(false); setEditingCompany(null); }}>
                + Add Company
              </button>
            </>
          )}

          {view.level === "distributor" && (
            <>
              <button type="button" className="company-dropdown__back" onClick={() => setView({ level: "root" })}>
                ‹ All Distributors
              </button>
              <button
                type="button"
                className={`company-dropdown__item${selectedDistributorId === view.distributor.id && !selectedBranchId && !selectedCompanyId ? " company-dropdown__item--active" : ""}`}
                onClick={() => pick(() => setSelectedDistributorId(view.distributor.id))}
              >
                All of {view.distributor.name}
              </button>
              <div className="company-dropdown__divider" />

              {branchesOf(view.distributor.id).length === 0 && (
                <div className="company-dropdown__empty">No branches yet.</div>
              )}
              {branchesOf(view.distributor.id).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`company-dropdown__item${selectedBranchId === b.id && !selectedCompanyId ? " company-dropdown__item--active" : ""}`}
                  onClick={() => setView({ level: "branch", distributor: view.distributor, branch: b })}
                >
                  <span>{b.name}</span>
                  <span className="company-dropdown__chevron">›</span>
                </button>
              ))}

              <div className="company-dropdown__divider" />
              <button
                type="button"
                className="company-dropdown__add"
                onClick={() => { setOpen(false); setEditingBranch({ branch: null, distributorId: view.distributor.id }); }}
              >
                + Add Branch
              </button>
              <button
                type="button"
                className="company-dropdown__edit"
                style={{ padding: "6px 10px" }}
                onClick={() => { setOpen(false); setEditingDistributor(view.distributor); }}
              >
                Edit {view.distributor.name}
              </button>
            </>
          )}

          {view.level === "branch" && (
            <>
              <button type="button" className="company-dropdown__back" onClick={() => setView({ level: "distributor", distributor: view.distributor })}>
                ‹ {view.distributor.name}
              </button>
              <button
                type="button"
                className={`company-dropdown__item${selectedBranchId === view.branch.id && !selectedCompanyId ? " company-dropdown__item--active" : ""}`}
                onClick={() => pick(() => setSelectedBranchId(view.branch.id))}
              >
                All of {view.branch.name}
              </button>
              <div className="company-dropdown__divider" />

              {companiesOf(view.branch.id).length === 0 && (
                <div className="company-dropdown__empty">No companies yet.</div>
              )}
              {companiesOf(view.branch.id).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`company-dropdown__item${selectedCompanyId === c.id ? " company-dropdown__item--active" : ""}`}
                  onClick={() => pick(() => setSelectedCompanyId(c.id))}
                >
                  <span>{c.name}</span>
                  <span className="company-dropdown__edit" onClick={(e) => { e.stopPropagation(); setEditingCompany(c); }}>Edit</span>
                </button>
              ))}

              <div className="company-dropdown__divider" />
              <button
                type="button"
                className="company-dropdown__add"
                onClick={() => { setOpen(false); setEditingCompany(null); }}
              >
                + Add Company
              </button>
              <button
                type="button"
                className="company-dropdown__edit"
                style={{ padding: "6px 10px" }}
                onClick={() => { setOpen(false); setEditingBranch({ branch: view.branch, distributorId: view.distributor.id }); }}
              >
                Edit {view.branch.name}
              </button>
            </>
          )}
        </div>
      )}

      {editingCompany !== undefined && (
        <CompanyFormModal
          company={editingCompany}
          branches={branches}
          defaultBranchId={view.level === "branch" ? view.branch.id : null}
          onClose={() => setEditingCompany(undefined)}
          onSaved={() => { setEditingCompany(undefined); void refreshCompanies(); }}
          onDeleted={(id) => {
            setEditingCompany(undefined);
            if (selectedCompanyId === id) setSelectedDistributorId(null);
            void refreshCompanies();
          }}
        />
      )}

      {editingDistributor !== undefined && (
        <DistributorFormModal
          distributor={editingDistributor}
          onClose={() => setEditingDistributor(undefined)}
          onSaved={() => { setEditingDistributor(undefined); void refreshCompanies(); }}
          onDeleted={(id) => {
            setEditingDistributor(undefined);
            if (selectedDistributorId === id) setSelectedDistributorId(null);
            void refreshCompanies();
          }}
        />
      )}

      {editingBranch !== undefined && (
        <BranchFormModal
          branch={editingBranch.branch}
          distributorId={editingBranch.distributorId}
          onClose={() => setEditingBranch(undefined)}
          onSaved={() => { setEditingBranch(undefined); void refreshCompanies(); }}
          onDeleted={(id) => {
            setEditingBranch(undefined);
            if (selectedBranchId === id) setSelectedDistributorId(null);
            void refreshCompanies();
          }}
        />
      )}
    </div>
  );
}

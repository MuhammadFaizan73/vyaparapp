import { useEffect, useRef, useState } from "react";
import type { Company } from "@vyapar/api-client";
import { useCompany } from "../lib/CompanyContext";
import { CompanyFormModal } from "./CompanyFormModal";

export function CompanyDropdown() {
  const { companies, selectedCompanyId, selectedCompany, setSelectedCompanyId, refreshCompanies } = useCompany();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [showForm, setShowForm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function openAdd() {
    setEditing(null);
    setShowForm(true);
    setOpen(false);
  }

  function openEdit(c: Company, e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(c);
    setShowForm(true);
    setOpen(false);
  }

  return (
    <div className="company-dropdown" ref={ref}>
      <button type="button" className="company-dropdown__btn" onClick={() => setOpen((v) => !v)}>
        <span className="company-dropdown__label">{selectedCompany?.name ?? "All Companies"}</span>
        <span className="company-dropdown__caret">▾</span>
      </button>

      {open && (
        <div className="company-dropdown__menu">
          <button
            type="button"
            className={`company-dropdown__item${!selectedCompanyId ? " company-dropdown__item--active" : ""}`}
            onClick={() => { setSelectedCompanyId(null); setOpen(false); }}
          >
            All Companies
          </button>
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`company-dropdown__item${selectedCompanyId === c.id ? " company-dropdown__item--active" : ""}`}
              onClick={() => { setSelectedCompanyId(c.id); setOpen(false); }}
            >
              <span>{c.name}</span>
              <span className="company-dropdown__edit" onClick={(e) => openEdit(c, e)}>Edit</span>
            </button>
          ))}
          <div className="company-dropdown__divider" />
          <button type="button" className="company-dropdown__add" onClick={openAdd}>
            + Add Company
          </button>
        </div>
      )}

      {showForm && (
        <CompanyFormModal
          company={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void refreshCompanies(); }}
          onDeleted={(id) => {
            setShowForm(false);
            if (selectedCompanyId === id) setSelectedCompanyId(null);
            void refreshCompanies();
          }}
        />
      )}
    </div>
  );
}

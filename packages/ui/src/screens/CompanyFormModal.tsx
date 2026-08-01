import { useState } from "react";
import type { Company } from "@vyapar/api-client";
import { api } from "../lib/api";

type Props = {
  company: Company | null;
  onClose: () => void;
  onSaved: (company: Company) => void;
  onDeleted: (id: string) => void;
};

export function CompanyFormModal({ company, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(company?.name ?? "");
  const [businessType, setBusinessType] = useState(company?.businessType ?? "");
  const [email, setEmail] = useState(company?.email ?? "");
  const [phone, setPhone] = useState(company?.phone ?? "");
  const [gstin, setGstin] = useState(company?.gstin ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Please enter a company name.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        businessType: businessType.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        gstin: gstin.trim() || undefined,
      };
      const saved = company
        ? await api.updateCompany(company.id, body)
        : await api.createCompany(body);
      onSaved(saved);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ?? "Could not save company.";
      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!company) return;
    if (!confirm(`Delete "${company.name}"? Items/invoices already tagged to it will become uncategorized.`)) return;
    setBusy(true);
    try {
      await api.deleteCompany(company.id);
      onDeleted(company.id);
    } catch {
      setError("Could not delete company.");
      setBusy(false);
    }
  }

  return (
    <div className="party-modal-backdrop" onClick={onClose}>
      <div className="company-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="company-form-modal__title">{company ? "Edit Company" : "Add Company"}</h2>

        <label className="company-form-modal__label">Company Name</label>
        <input
          className="company-form-modal__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Shan Foods"
          autoFocus
        />

        <label className="company-form-modal__label">Business Type</label>
        <input
          className="company-form-modal__input"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          placeholder="Optional"
        />

        <div className="company-form-modal__row">
          <div>
            <label className="company-form-modal__label">Phone</label>
            <input
              className="company-form-modal__input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="company-form-modal__label">Email</label>
            <input
              className="company-form-modal__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <label className="company-form-modal__label">GSTIN</label>
        <input
          className="company-form-modal__input"
          value={gstin}
          onChange={(e) => setGstin(e.target.value)}
          placeholder="Optional"
        />

        {error && <div className="company-form-modal__error">{error}</div>}

        <div className="company-form-modal__actions">
          {company && (
            <button type="button" className="company-form-modal__delete" onClick={remove} disabled={busy}>
              Delete
            </button>
          )}
          <div className="company-form-modal__spacer" />
          <button type="button" className="company-form-modal__cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="company-form-modal__save" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import type { Distributor } from "@vyapar/api-client";
import { api } from "../lib/api";

type Props = {
  distributor: Distributor | null;
  onClose: () => void;
  onSaved: (distributor: Distributor) => void;
  onDeleted: (id: string) => void;
};

export function DistributorFormModal({ distributor, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(distributor?.name ?? "");
  const [businessType, setBusinessType] = useState(distributor?.businessType ?? "");
  const [email, setEmail] = useState(distributor?.email ?? "");
  const [phone, setPhone] = useState(distributor?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Please enter a distributor name.");
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
      };
      const saved = distributor
        ? await api.updateDistributor(distributor.id, body)
        : await api.createDistributor(body);
      onSaved(saved);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ?? "Could not save distributor.";
      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!distributor) return;
    if (!confirm(`Delete "${distributor.name}"? Its branches must be empty or reassigned first.`)) return;
    setBusy(true);
    try {
      await api.deleteDistributor(distributor.id);
      onDeleted(distributor.id);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Could not delete distributor.";
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <div className="party-modal-backdrop" onClick={onClose}>
      <div className="company-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="company-form-modal__title">{distributor ? "Edit Distributor" : "Add Distributor"}</h2>

        <label className="company-form-modal__label">Distributor Name</label>
        <input
          className="company-form-modal__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Al-Fateh Distribution"
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

        {error && <div className="company-form-modal__error">{error}</div>}

        <div className="company-form-modal__actions">
          {distributor && (
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

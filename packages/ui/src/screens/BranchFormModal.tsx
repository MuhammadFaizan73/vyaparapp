import { useState } from "react";
import type { Branch } from "@vyapar/api-client";
import { api } from "../lib/api";

type Props = {
  branch: Branch | null;
  distributorId: string;
  onClose: () => void;
  onSaved: (branch: Branch) => void;
  onDeleted: (id: string) => void;
};

export function BranchFormModal({ branch, distributorId, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(branch?.name ?? "");
  const [city, setCity] = useState(branch?.city ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Please enter a branch name.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body = { distributorId, name: name.trim(), city: city.trim() || undefined };
      const saved = branch
        ? await api.updateBranch(branch.id, body)
        : await api.createBranch(body);
      onSaved(saved);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ?? "Could not save branch.";
      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!branch) return;
    if (!confirm(`Delete "${branch.name}"? Its companies must be empty or reassigned first.`)) return;
    setBusy(true);
    try {
      await api.deleteBranch(branch.id);
      onDeleted(branch.id);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Could not delete branch.";
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <div className="party-modal-backdrop" onClick={onClose}>
      <div className="company-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="company-form-modal__title">{branch ? "Edit Branch" : "Add Branch"}</h2>

        <label className="company-form-modal__label">Branch Name</label>
        <input
          className="company-form-modal__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Karachi"
          autoFocus
        />

        <label className="company-form-modal__label">City</label>
        <input
          className="company-form-modal__input"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Optional"
        />

        {error && <div className="company-form-modal__error">{error}</div>}

        <div className="company-form-modal__actions">
          {branch && (
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

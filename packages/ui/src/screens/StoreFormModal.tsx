import { useState } from "react";
import type { Store } from "@vyapar/api-client";
import { api } from "../lib/api";

const STORE_TYPES = ["Store", "Godown", "Warehouse"];

type Props = {
  store: Store | null;
  companyId: string;
  onClose: () => void;
  onSaved: (store: Store) => void;
  onDeleted: (id: string) => void;
};

export function StoreFormModal({ store, companyId, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(store?.name ?? "");
  const [storeType, setStoreType] = useState(store?.storeType ?? "Store");
  const [phone, setPhone] = useState(store?.phone ?? "");
  const [email, setEmail] = useState(store?.email ?? "");
  const [pincode, setPincode] = useState(store?.pincode ?? "");
  const [address, setAddress] = useState(store?.address ?? "");
  const [showMore, setShowMore] = useState(Boolean(store?.pincode || store?.address));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Please enter a store name.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body = {
        companyId,
        name: name.trim(),
        storeType: storeType || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        pincode: pincode.trim() || undefined,
        address: address.trim() || undefined,
      };
      const saved = store
        ? await api.updateStore(store.id, body)
        : await api.createStore(body);
      onSaved(saved);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ?? "Could not save store.";
      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!store) return;
    if (!confirm(`Delete "${store.name}"?`)) return;
    setBusy(true);
    try {
      await api.deleteStore(store.id);
      onDeleted(store.id);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Could not delete store.";
      setError(String(msg));
      setBusy(false);
    }
  }

  return (
    <div className="party-modal-backdrop" onClick={onClose}>
      <div className="company-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="company-form-modal__title">{store ? "Edit Store" : "Add Store"}</h2>

        <label className="company-form-modal__label">Store Type</label>
        <select
          className="company-form-modal__input"
          value={storeType}
          onChange={(e) => setStoreType(e.target.value)}
          style={{ cursor: "pointer" }}
        >
          {STORE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <label className="company-form-modal__label">Store Name</label>
        <input
          className="company-form-modal__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. TTC Road Godown"
          autoFocus
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

        <button
          type="button"
          className="company-form-modal__cancel"
          style={{ marginTop: 4, marginBottom: 4 }}
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "Hide" : "More Information"} {showMore ? "▲" : "▼"}
        </button>

        {showMore && (
          <>
            <label className="company-form-modal__label">Pincode</label>
            <input
              className="company-form-modal__input"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="Optional"
            />

            <label className="company-form-modal__label">Address</label>
            <input
              className="company-form-modal__input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Optional"
            />
          </>
        )}

        {error && <div className="company-form-modal__error">{error}</div>}

        <div className="company-form-modal__actions">
          {store && !store.isMain && (
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

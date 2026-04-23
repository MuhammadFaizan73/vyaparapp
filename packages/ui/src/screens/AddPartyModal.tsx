import { useState } from "react";
import type { Party } from "@vyapar/api-client";
import { api } from "../lib/api";

type Props = {
  onClose: () => void;
  onSaved: (party: Party) => void;
};

export function AddPartyModal({ onClose, onSaved }: Props) {
  const [tab, setTab] = useState<"address" | "credit" | "fields">("address");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(andNew = false) {
    if (!name.trim()) { setError("Party name is required"); return; }
    setError(null);
    setBusy(true);
    try {
      const party = await api.createParty({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        billingAddress: billingAddress.trim() || undefined,
      });
      if (andNew) {
        setName(""); setPhone(""); setEmail(""); setBillingAddress("");
      } else {
        onSaved(party);
      }
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ??
        "Could not save party.";
      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="party-modal-backdrop" onClick={onClose}>
      <div className="party-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="party-modal__header">
          <span className="party-modal__title">Add Party</span>
          <div className="party-modal__header-actions">
            <button type="button" className="party-modal__icon-btn" aria-label="Settings">
              <GearIcon />
            </button>
            <button type="button" className="party-modal__icon-btn" onClick={onClose} aria-label="Close">
              <XIcon />
            </button>
          </div>
        </div>

        {/* Main form */}
        <div className="party-modal__body">
          {error && <div className="form-error">{error}</div>}

          <div className="party-modal__row">
            <div className="party-modal__field">
              <input
                className="party-modal__input party-modal__input--focus"
                placeholder="Party Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="party-modal__field">
              <input
                className="party-modal__input"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="party-modal__tabs">
            <button
              type="button"
              className={`party-modal__tab ${tab === "address" ? "party-modal__tab--active" : ""}`}
              onClick={() => setTab("address")}
            >
              Address
            </button>
            <button
              type="button"
              className={`party-modal__tab ${tab === "credit" ? "party-modal__tab--active" : ""}`}
              onClick={() => setTab("credit")}
            >
              Credit &amp; Balance
              <span className="party-modal__tab-badge">New</span>
            </button>
            <button
              type="button"
              className={`party-modal__tab ${tab === "fields" ? "party-modal__tab--active" : ""}`}
              onClick={() => setTab("fields")}
            >
              Additional Fields
            </button>
          </div>

          {/* Address tab */}
          {tab === "address" && (
            <div className="party-modal__address">
              <div className="party-modal__address-left">
                <input
                  className="party-modal__input"
                  placeholder="Email ID"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="party-modal__address-center">
                <textarea
                  className="party-modal__textarea"
                  placeholder="Billing Address"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  rows={4}
                />
                <button type="button" className="party-modal__link">
                  <EyeIcon /> Show Detailed Address
                </button>
              </div>
              <div className="party-modal__address-right">
                <span className="party-modal__shipping-label">Shipping Address</span>
                <button type="button" className="party-modal__link party-modal__link--blue">
                  + Enable Shipping Address
                </button>
              </div>
            </div>
          )}

          {tab === "credit" && (
            <div className="party-modal__empty-tab">Credit &amp; Balance fields coming soon.</div>
          )}
          {tab === "fields" && (
            <div className="party-modal__empty-tab">Additional fields coming soon.</div>
          )}
        </div>

        {/* Footer */}
        <div className="party-modal__footer">
          <button type="button" className="party-modal__btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <div className="party-modal__footer-right">
            <button
              type="button"
              className="party-modal__btn-outline"
              disabled={busy || !name.trim()}
              onClick={() => void save(true)}
            >
              Save &amp; New
            </button>
            <button
              type="button"
              className="party-modal__btn-primary"
              disabled={busy || !name.trim()}
              onClick={() => void save(false)}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
      <circle cx="12" cy="12" r="3" />
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
    </svg>
  );
}

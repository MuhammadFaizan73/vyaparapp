import { useState } from "react";
import type { LicenseStatus } from "@vyapar/api-client";
import { api } from "../lib/api";

type Props = {
  onActivated: (status: LicenseStatus) => void | Promise<void>;
  onClose: () => void;
};

export function ActivateLicenseModal({ onActivated, onClose }: Props) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (key.trim().length < 8) {
      setError("Enter a valid license key");
      return;
    }
    setBusy(true);
    try {
      const next = await api.activateLicense(key.trim());
      await onActivated(next);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ??
        "Could not activate. Check the key and your connection.";
      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="onboarding-card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="onboarding-card__brand">
          <div className="brand-badge">V</div>
          <div>
            <h1>Get Vyapar Premium</h1>
            <p>Enter your license key to unlock unlimited access.</p>
          </div>
        </div>

        <label className="field-label">License key</label>
        <input
          className="license-input"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          autoFocus
        />

        {error && <div className="form-error">{error}</div>}

        <button type="submit" className="submit-btn" disabled={busy || !key}>
          {busy ? "Activating…" : "Activate license"}
        </button>

        <p className="fine-print">
          Don't have a key yet? Contact sales at support@vyapar.pk — pricing and self-serve checkout are coming soon.
        </p>
      </form>
    </div>
  );
}

import { useState } from "react";
import type { LicenseStatus } from "@vyapar/api-client";
import { api } from "../lib/api";

type Props = {
  status: LicenseStatus;
  onActivated: (status: LicenseStatus) => void | Promise<void>;
  onLogout: () => void;
};

export function LicenseGate({ status, onActivated, onLogout }: Props) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expired = status.state === "trial_expired";

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
    <div className="modal-backdrop">
      <form className="onboarding-card" onSubmit={submit}>
        <div className="onboarding-card__brand">
          <div className="brand-badge brand-badge--warn">!</div>
          <div>
            <h1>{expired ? "Your free trial has ended" : "Your license expired"}</h1>
            <p>Enter your Vyapar Pakistan license key to continue.</p>
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

        <button type="button" className="ghost-btn" onClick={onLogout}>
          Sign in with a different number
        </button>
      </form>
    </div>
  );
}

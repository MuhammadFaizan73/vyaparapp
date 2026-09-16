import { useState } from "react";
import type { LicenseStatus, LicenseListingEntry } from "@vyapar/api-client";
import { api } from "../lib/api";

type Stage = "email" | "list" | "key";

type Props = {
  onActivated: (status: LicenseStatus) => void | Promise<void>;
};

function extractError(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  if (!msg) return fallback;
  return Array.isArray(msg) ? msg.join(", ") : String(msg);
}

const STATUS_LABEL: Record<LicenseListingEntry["status"], string> = {
  available: "Ready to activate",
  taken: "Already in use",
  expired: "Expired",
};

// Shared by ActivateLicenseModal (first-run "get premium" flow) and LicenseGate
// (trial/license expired) — only the surrounding chrome (header, close/logout button)
// differs between the two, so the actual email → pick-a-license → activate flow lives
// here once instead of being duplicated.
//
// Every license is now bought against a customer email rather than handed out as a
// bare key, and one email can hold several (e.g. bought in bulk, or one per device) —
// so activation starts with an email lookup instead of asking for a key up front.
// A key is still accepted directly for a license bought through a reseller/partner,
// who hands the customer the exact key instead of them ever seeing the full list.
export function LicenseActivationForm({ onActivated }: Props) {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [licenses, setLicenses] = useState<LicenseListingEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function lookupEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      const all = await api.lookupLicenses(trimmed);
      const usable = all.filter((l) => l.platform === "desktop" || l.platform === "both");
      if (usable.length === 0) {
        setError("No desktop licenses found for this email. If you already have a license key, enter it below instead.");
        setStage("key");
      } else {
        setLicenses(usable);
        setStage("list");
      }
    } catch (err) {
      setError(extractError(err, "Could not look up licenses. Check your connection."));
    } finally {
      setBusy(false);
    }
  }

  async function activateByLicenseId(licenseId: string) {
    setError(null);
    setBusy(true);
    try {
      const next = await api.activateLicense({ email: email.trim(), platform: "desktop", licenseId });
      await onActivated(next);
    } catch (err) {
      setError(extractError(err, "Could not activate. Check your connection."));
    } finally {
      setBusy(false);
      setActivatingId(null);
    }
  }

  async function activateByKey(keyValue: string) {
    setError(null);
    setBusy(true);
    try {
      const next = await api.activateLicense({ email: email.trim(), platform: "desktop", key: keyValue });
      await onActivated(next);
    } catch (err) {
      setError(extractError(err, "Could not activate. Check the key and your connection."));
    } finally {
      setBusy(false);
    }
  }

  async function submitKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (key.trim().length < 8) {
      setError("Enter a valid license key");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Enter the email this license was registered to");
      return;
    }
    await activateByKey(key.trim());
  }

  if (stage === "list") {
    return (
      <>
        <p className="fine-print" style={{ marginBottom: 10 }}>Licenses for <strong>{email}</strong></p>
        <div className="alm-list">
          {licenses.map((l) => (
            <div key={l.id} className="alm-license-row">
              <div className="alm-license-row__info">
                <div className="alm-license-row__key">{l.maskedKey}</div>
                <div className="alm-license-row__meta">
                  {l.customerName ? `${l.customerName} · ` : ""}{l.plan} · {l.durationType} · expires {new Date(l.expiresAt).toLocaleDateString()}
                </div>
              </div>
              {l.status === "available" ? (
                <button
                  type="button"
                  className="submit-btn alm-license-row__btn"
                  disabled={busy}
                  onClick={() => { setActivatingId(l.id); void activateByLicenseId(l.id); }}
                >
                  {busy && activatingId === l.id ? "Activating…" : "Activate"}
                </button>
              ) : (
                <span className={`alm-badge alm-badge--${l.status}`}>{STATUS_LABEL[l.status]}</span>
              )}
            </div>
          ))}
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="button" className="alm-link" onClick={() => { setStage("email"); setError(null); }}>
          ← Search a different email
        </button>
        <button type="button" className="alm-link" onClick={() => { setStage("key"); setError(null); }}>
          Have a license key instead?
        </button>
      </>
    );
  }

  if (stage === "key") {
    return (
      <form onSubmit={submitKey}>
        <label className="field-label">Email this license was registered to</label>
        <input
          className="license-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <label className="field-label" style={{ marginTop: 10 }}>License key</label>
        <input
          className="license-input"
          placeholder="VYPR-XXXX-XXXX-XXXX"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
        />

        {error && <div className="form-error">{error}</div>}

        <button type="submit" className="submit-btn" disabled={busy || !key || !email}>
          {busy ? "Activating…" : "Activate license"}
        </button>
        <button type="button" className="alm-link" onClick={() => { setStage("email"); setError(null); }}>
          ← Look up licenses by email instead
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={lookupEmail}>
      <label className="field-label">Email</label>
      <input
        className="license-input"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <p className="fine-print" style={{ marginTop: 6 }}>
        The email your license was purchased under — every license bought there will show up to activate.
      </p>

      {error && <div className="form-error">{error}</div>}

      <button type="submit" className="submit-btn" disabled={busy || !email}>
        {busy ? "Looking up…" : "Find my licenses"}
      </button>
    </form>
  );
}

import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { COUNTRIES, DEFAULT_COUNTRY, type Country } from "../data/countries";

type Props = {
  onRegistered: (token: string, tenant: unknown) => void | Promise<void>;
};

export function Onboarding({ onRegistered }: Props) {
  const [tab, setTab] = useState<"owner" | "invite">("owner");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite code state
  const [inviteCode, setInviteCode] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    const code = inviteCode.trim();
    if (!code) { setInviteError("Paste the invite code your employer shared."); return; }
    setInviteBusy(true);
    try {
      const res = await api.acceptInvite(code);
      await onRegistered(res.token, res.tenant);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? "Invalid invite code. Ask your employer to share it again.";
      setInviteError(String(msg));
    } finally {
      setInviteBusy(false);
    }
  }

  const filtered = useMemo(
    () =>
      COUNTRIES.filter((c) =>
        `${c.name} ${c.dial}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 15) {
      setError("Enter a valid mobile number");
      return;
    }
    setBusy(true);
    try {
      const res = await api.register({ countryCode: country.dial, phone: digits });
      await onRegistered(res.token, res.tenant);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ??
        "Could not register. Is the backend running?";
      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="onboarding-card">
        <div className="onboarding-card__brand">
          <div className="brand-badge">V</div>
          <div>
            <h1>Welcome to Vyapar Pakistan</h1>
            <p>Business management made simple</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="ob-tabs">
          <button
            type="button"
            className={`ob-tab${tab === "owner" ? " ob-tab--active" : ""}`}
            onClick={() => setTab("owner")}
          >
            Business Owner
          </button>
          <button
            type="button"
            className={`ob-tab${tab === "invite" ? " ob-tab--active" : ""}`}
            onClick={() => setTab("invite")}
          >
            🔑 Join with Invite Code
          </button>
        </div>

        {/* Owner tab */}
        {tab === "owner" && (
          <form onSubmit={submit}>
            <p className="ob-tab-sub">Enter your mobile number to start your 7-day free trial.</p>
            <label className="field-label">Mobile number</label>
            <div className="phone-row">
              <button
                type="button"
                className="country-trigger"
                onClick={() => setOpen((o) => !o)}
              >
                <span className="country-trigger__flag">{country.flag}</span>
                <span className="country-trigger__dial">{country.dial}</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <input
                className="phone-input"
                type="tel"
                inputMode="numeric"
                placeholder="3001234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </div>

            {open && (
              <div className="country-dropdown">
                <input
                  className="country-search"
                  placeholder="Search country"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                <ul>
                  {filtered.map((c) => (
                    <li key={c.iso}>
                      <button type="button" onClick={() => { setCountry(c); setOpen(false); setQuery(""); }}>
                        <span>{c.flag}</span>
                        <span className="country-dropdown__name">{c.name}</span>
                        <span className="country-dropdown__dial">{c.dial}</span>
                      </button>
                    </li>
                  ))}
                  {filtered.length === 0 && <li className="country-dropdown__empty">No matches</li>}
                </ul>
              </div>
            )}

            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="submit-btn" disabled={busy || !phone}>
              {busy ? "Starting trial…" : "Start 7-day free trial"}
            </button>
            <p className="fine-print">
              Your data syncs across Desktop, Mobile, and Web using this number.
            </p>
          </form>
        )}

        {/* Invite code tab */}
        {tab === "invite" && (
          <form onSubmit={submitInvite}>
            <p className="ob-tab-sub">Your employer added you as a team member and shared an invite code with you.</p>
            <label className="field-label">Invite Code</label>
            <input
              className="phone-input"
              style={{ width: "100%", boxSizing: "border-box", fontFamily: "monospace", fontSize: 13 }}
              type="text"
              placeholder="Paste invite code here…"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <p className="fine-print" style={{ marginTop: 6 }}>
              Looks like: 550e8400-e29b-41d4-a716-446655440000
            </p>
            {inviteError && <div className="form-error">{inviteError}</div>}
            <button type="submit" className="submit-btn" disabled={inviteBusy || !inviteCode.trim()}>
              {inviteBusy ? "Joining…" : "Join Company"}
            </button>
            <p className="fine-print">
              You'll get access to your employer's data with your assigned role permissions.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

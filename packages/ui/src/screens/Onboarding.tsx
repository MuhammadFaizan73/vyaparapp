import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { COUNTRIES, DEFAULT_COUNTRY, type Country } from "../data/countries";

type Props = {
  onRegistered: (token: string, tenant: unknown) => void | Promise<void>;
};

export function Onboarding({ onRegistered }: Props) {
  const [tab, setTab] = useState<"owner" | "invite" | "staff">("owner");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phone → code verification, owner tab only. A phone number only ever gets a JWT after
  // proving receipt of the SMS code — same gate for a brand-new signup and a returning
  // user's login, since verify-otp reuses the exact find-or-create logic register() does.
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // Invite code state
  const [inviteCode, setInviteCode] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Staff/salesman login state — an existing team member signing back in with the
  // permanent email/phone + password their employer set, as opposed to the invite-code
  // tab above which is for accepting a brand-new invite for the first time.
  const [staffIdentifier, setStaffIdentifier] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

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

  async function submitStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    setStaffError(null);
    const identifier = staffIdentifier.trim();
    if (!identifier || !staffPassword) { setStaffError("Enter your email or phone and password."); return; }
    setStaffBusy(true);
    try {
      const res = await api.staffLogin(identifier, staffPassword);
      await onRegistered(res.token, res.tenant);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? "Incorrect email/phone or password.";
      setStaffError(String(msg));
    } finally {
      setStaffBusy(false);
    }
  }

  const filtered = useMemo(
    () =>
      COUNTRIES.filter((c) =>
        `${c.name} ${c.dial}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  function otpErrorMessage(err: unknown, fallback: string): string {
    const msg = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ?? fallback;
    return Array.isArray(msg) ? msg.join(", ") : String(msg);
  }

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
      await api.sendOtp({ countryCode: country.dial, phone: digits });
      setStep("code");
      setResendIn(30);
    } catch (err) {
      setError(otpErrorMessage(err, "Could not send verification code. Is the backend running?"));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/\D/g, "");
    setBusy(true);
    try {
      const res = await api.verifyOtp({ countryCode: country.dial, phone: digits, otp });
      await onRegistered(res.token, res.tenant);
    } catch (err) {
      setError(otpErrorMessage(err, "Incorrect or expired code."));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    const digits = phone.replace(/\D/g, "");
    try {
      await api.resendOtp({ countryCode: country.dial, phone: digits });
      setResendIn(30);
    } catch (err) {
      setError(otpErrorMessage(err, "Could not resend code."));
    }
  }

  function changeNumber() {
    setStep("phone");
    setOtp("");
    setError(null);
  }

  return (
    <div className="modal-backdrop">
      <div className="onboarding-card">
        <div className="onboarding-card__brand">
          <div className="brand-badge">G</div>
          <div>
            <h1>Welcome to Godigi</h1>
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
          <button
            type="button"
            className={`ob-tab${tab === "staff" ? " ob-tab--active" : ""}`}
            onClick={() => setTab("staff")}
          >
            👤 Staff / Salesman Login
          </button>
        </div>

        {/* Owner tab */}
        {tab === "owner" && step === "phone" && (
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
              {busy ? "Sending code…" : "Send verification code"}
            </button>
            <p className="fine-print">
              Your data syncs across Desktop, Mobile, and Web using this number.
            </p>
          </form>
        )}

        {tab === "owner" && step === "code" && (
          <form onSubmit={submitCode}>
            <p className="ob-tab-sub">
              Enter the code sent via SMS to {country.dial}{phone}.
            </p>
            <label className="field-label">Verification code</label>
            <input
              className="phone-input"
              style={{ width: "100%", boxSizing: "border-box", letterSpacing: 3, textAlign: "center" }}
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />

            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="submit-btn" disabled={busy || !otp}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <button type="button" className="fine-print" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }} onClick={changeNumber}>
                Change number
              </button>
              <button
                type="button"
                className="fine-print"
                style={{ background: "none", border: "none", padding: 0, textDecoration: resendIn > 0 ? "none" : "underline", cursor: resendIn > 0 ? "default" : "pointer", opacity: resendIn > 0 ? 0.6 : 1 }}
                onClick={resend}
                disabled={resendIn > 0}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
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

        {/* Staff/salesman login tab */}
        {tab === "staff" && (
          <form onSubmit={submitStaffLogin}>
            <p className="ob-tab-sub">Sign in with the email/phone and password your employer set for you.</p>
            <label className="field-label">Email or Phone</label>
            <input
              className="phone-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              type="text"
              placeholder="you@example.com or 03001234567"
              value={staffIdentifier}
              onChange={(e) => setStaffIdentifier(e.target.value)}
              autoFocus
              autoComplete="username"
            />
            <label className="field-label" style={{ marginTop: 10 }}>Password</label>
            <input
              className="phone-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              type="password"
              placeholder="Password"
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
              autoComplete="current-password"
            />
            {staffError && <div className="form-error">{staffError}</div>}
            <button type="submit" className="submit-btn" disabled={staffBusy || !staffIdentifier.trim() || !staffPassword}>
              {staffBusy ? "Signing in…" : "Sign In"}
            </button>
            <p className="fine-print">
              New team member? Use the "Join with Invite Code" tab instead.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

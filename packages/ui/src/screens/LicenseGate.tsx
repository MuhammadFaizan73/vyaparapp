import type { LicenseStatus } from "@vyapar/api-client";
import { LicenseActivationForm } from "./LicenseActivationForm";

type Props = {
  status: LicenseStatus;
  onActivated: (status: LicenseStatus) => void | Promise<void>;
  onLogout: () => void;
};

export function LicenseGate({ status, onActivated, onLogout }: Props) {
  const expired = status.state === "trial_expired";

  return (
    <div className="modal-backdrop">
      <div className="onboarding-card">
        <div className="onboarding-card__brand">
          <div className="brand-badge brand-badge--warn">!</div>
          <div>
            <h1>{expired ? "Your free trial has ended" : "Your license expired"}</h1>
            <p>Enter the email your Godigi license was purchased under to continue.</p>
          </div>
        </div>

        <LicenseActivationForm onActivated={onActivated} />

        <button type="button" className="ghost-btn" onClick={onLogout}>
          Sign in with a different number
        </button>
      </div>
    </div>
  );
}

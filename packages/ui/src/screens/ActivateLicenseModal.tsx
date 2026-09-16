import type { LicenseStatus } from "@vyapar/api-client";
import { LicenseActivationForm } from "./LicenseActivationForm";

type Props = {
  onActivated: (status: LicenseStatus) => void | Promise<void>;
  onClose: () => void;
};

export function ActivateLicenseModal({ onActivated, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="onboarding-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="onboarding-card__brand">
          <div className="brand-badge">G</div>
          <div>
            <h1>Get Godigi Premium</h1>
            <p>Enter the email your license was purchased under to unlock unlimited access.</p>
          </div>
        </div>

        <LicenseActivationForm onActivated={onActivated} />

        <p className="fine-print">
          Don't have a license yet? Contact sales at support@vyapar.pk.
        </p>
      </div>
    </div>
  );
}

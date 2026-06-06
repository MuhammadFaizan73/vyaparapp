import { useState } from "react";

type Plan = {
  id: string;
  name: string;
  platform: string;
  duration: string;
  price: number;
  originalPrice: number;
};

const PLANS: Plan[] = [
  { id: "platinum-desktop-3y", name: "Vyapar Platinum", platform: "Desktop", duration: "3 Years", price: 259.99, originalPrice: 489.99 },
  { id: "platinum-desktop-1y", name: "Vyapar Platinum", platform: "Desktop", duration: "1 Year",  price: 119.99, originalPrice: 179.99 },
  { id: "platinum-mobile-1y",  name: "Vyapar Platinum", platform: "Mobile",  duration: "1 Year",  price:  89.99, originalPrice: 139.99 },
];

type Props = {
  onClose: () => void;
  onProceed: () => void;
};

export function ReviewOrderModal({ onClose, onProceed }: Props) {
  const [selectedPlanId, setSelectedPlanId] = useState(PLANS[0]!.id);
  const [businessName, setBusinessName] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(true);

  const plan = PLANS.find(p => p.id === selectedPlanId) ?? PLANS[0]!;
  const saved = (plan.originalPrice - plan.price).toFixed(2);

  return (
    <div className="ro-backdrop" onClick={onClose}>
      <div className="ro-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ro-header">
          <h2 className="ro-title">Review Order Summary</h2>
          <button className="ro-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ro-body">
          {/* Left column */}
          <div className="ro-left">
            {/* View Selected Plans */}
            <p className="ro-section-label">View Selected Plans</p>
            <div className="ro-plan-list">
              {PLANS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`ro-plan-card${selectedPlanId === p.id ? " ro-plan-card--active" : ""}`}
                  onClick={() => setSelectedPlanId(p.id)}
                >
                  <div className="ro-plan-icon">
                    <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#7c3aed" opacity="0.8"/>
                      <path d="M2 17l10 5 10-5" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M2 12l10 5 10-5" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="ro-plan-info">
                    <span className="ro-plan-name">{p.name}</span>
                    <span className="ro-plan-sub">{p.platform} • {p.duration}</span>
                  </div>
                  <div className="ro-plan-pricing">
                    <span className="ro-plan-original">${p.originalPrice.toFixed(2)}</span>
                    <span className="ro-plan-price">${p.price.toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="ro-divider" />

            {/* Add Details */}
            <button
              type="button"
              className="ro-details-toggle"
              onClick={() => setDetailsOpen(v => !v)}
            >
              <span>
                <strong>Add Details</strong>
                <span className="ro-details-optional"> (Optional)</span>
              </span>
              <span className="ro-chevron">{detailsOpen ? "∧" : "∨"}</span>
            </button>

            {detailsOpen && (
              <div className="ro-details-body">
                <label className="ro-field-label">Business Name</label>
                <input
                  className="ro-field-input"
                  placeholder="Enter Business Name"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                />
                <p className="ro-field-note">
                  <span className="ro-note-icon">ℹ</span>
                  Note: The details can't be updated once the order is completed.
                </p>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="ro-right">
            <p className="ro-price-title">Price Details</p>

            <div className="ro-price-row">
              <span className="ro-price-label">{plan.name} ({plan.platform} • {plan.duration})</span>
              <span className="ro-price-value">${plan.price.toFixed(2)}</span>
            </div>

            <div className="ro-price-row">
              <span className="ro-price-label">VAT (-)</span>
              <span className="ro-price-value ro-price-dash">-</span>
            </div>

            <div className="ro-price-divider" />

            <div className="ro-price-row ro-price-row--total">
              <span className="ro-price-label ro-price-label--bold">Total Amount</span>
              <div className="ro-total-right">
                <span className="ro-savings-badge">You saved ${saved}! 🎉</span>
                <span className="ro-total-amt">${plan.price.toFixed(2)}</span>
              </div>
            </div>

            <button className="ro-pay-btn" onClick={onProceed}>
              Pay ${plan.price.toFixed(2)} Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

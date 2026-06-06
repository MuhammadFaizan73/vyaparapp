import { useState } from "react";

export type PartySettings = {
  tinNumber: boolean;
  shippingAddress: boolean;
  printShippingAddress: boolean;
  partyGrouping: boolean;
  additionalField1: boolean;
  additionalField2: boolean;
  additionalField3: boolean;
  dateField: boolean;
  inviteParties: boolean;
};

export const DEFAULT_PARTY_SETTINGS: PartySettings = {
  tinNumber: true,
  shippingAddress: true,
  printShippingAddress: false,
  partyGrouping: true,
  additionalField1: false,
  additionalField2: false,
  additionalField3: false,
  dateField: false,
  inviteParties: true,
};

const STORAGE_KEY = "vyapar_party_settings";

export function loadPartySettings(): PartySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PARTY_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PARTY_SETTINGS };
}

type Props = {
  onClose: () => void;
  onSaved?: (settings: PartySettings) => void;
};

export function PartySettingsDrawer({ onClose, onSaved }: Props) {
  const [s, setS] = useState<PartySettings>(loadPartySettings);
  const [additionalOpen, setAdditionalOpen] = useState(true);
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof PartySettings) {
    setS((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    onSaved?.(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="ps-backdrop" onClick={onClose}>
      <div className="ps-drawer" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="ps-drawer__header">
          <span className="ps-drawer__title">Party Settings</span>
          <button type="button" className="ps-drawer__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="ps-drawer__body">

          {/* Main fields */}
          <ToggleRow
            label="TIN number"
            checked={s.tinNumber}
            onChange={() => toggle("tinNumber")}
          />
          <ToggleRow
            label="Party Shipping Address"
            checked={s.shippingAddress}
            onChange={() => toggle("shippingAddress")}
          />
          <ToggleRow
            label="Print Shipping Address"
            checked={s.printShippingAddress}
            onChange={() => toggle("printShippingAddress")}
            disabled={!s.shippingAddress}
          />

          {/* OTHERS section */}
          <div className="ps-section-label">OTHERS</div>

          <ToggleRow
            label="Party Grouping"
            checked={s.partyGrouping}
            onChange={() => toggle("partyGrouping")}
          />

          {/* Party Additional Fields (collapsible) */}
          <button
            type="button"
            className="ps-collapsible-row"
            onClick={() => setAdditionalOpen((v) => !v)}
          >
            <span className="ps-collapsible-row__label">Party Additional Fields</span>
            <InfoIcon />
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="16"
              height="16"
              className={`ps-chevron${additionalOpen ? " ps-chevron--open" : ""}`}
            >
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {additionalOpen && (
            <div className="ps-collapsible-body">
              <CheckboxRow label="Additional Field 1" checked={s.additionalField1} onChange={() => toggle("additionalField1")} />
              <CheckboxRow label="Additional Field 2" checked={s.additionalField2} onChange={() => toggle("additionalField2")} />
              <CheckboxRow label="Additional Field 3" checked={s.additionalField3} onChange={() => toggle("additionalField3")} />
              <CheckboxRow label="Date Field" checked={s.dateField} onChange={() => toggle("dateField")} />
            </div>
          )}

          {/* Save */}
          <div className="ps-save-wrap">
            <button
              type="button"
              className={`ps-save-btn${saved ? " ps-save-btn--saved" : ""}`}
              onClick={handleSave}
            >
              {saved ? "✓ Saved!" : "Save"}
            </button>
          </div>

          {/* Invite */}
          <ToggleRow
            label="Invite parties to add themselves"
            checked={s.inviteParties}
            onChange={() => toggle("inviteParties")}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`ps-toggle-row${disabled ? " ps-toggle-row--disabled" : ""}`}>
      <span className="ps-toggle-row__label">{label}</span>
      <InfoIcon />
      <Toggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button type="button" className="ps-checkbox-row" onClick={onChange}>
      <span className={`ps-checkbox-box${checked ? " ps-checkbox-box--checked" : ""}`}>
        {checked && (
          <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" width="9" height="9">
            <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="ps-checkbox-row__label">{label}</span>
    </button>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`ps-toggle${checked ? " ps-toggle--on" : ""}${disabled ? " ps-toggle--disabled" : ""}`}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
    >
      <span className="ps-toggle__thumb" />
    </button>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      width="14"
      height="14"
      style={{ color: "#94a3b8", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

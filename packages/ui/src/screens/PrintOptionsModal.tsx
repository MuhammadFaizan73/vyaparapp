import { useState } from "react";

export interface PrintOptions {
  itemDetails: boolean;
  description: boolean;
  paymentInfo: boolean;
  paymentStatus: boolean;
}

interface Props {
  onClose: () => void;
  onOk: (opts: PrintOptions) => void;
}

export function PrintOptionsModal({ onClose, onOk }: Props) {
  const [opts, setOpts] = useState<PrintOptions>({
    itemDetails: true,
    description: false,
    paymentInfo: false,
    paymentStatus: false,
  });

  function toggle(key: keyof PrintOptions) {
    setOpts((o) => ({ ...o, [key]: !o[key] }));
  }

  return (
    <div className="po-backdrop" onClick={onClose}>
      <div className="po-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="po-title">Print Options</h2>

        <div className="po-options">
          {(
            [
              ["itemDetails", "Item Details"],
              ["description", "Description"],
              ["paymentInfo", "Payment Info"],
              ["paymentStatus", "Payment Status"],
            ] as [keyof PrintOptions, string][]
          ).map(([key, label]) => (
            <label key={key} className="po-option-row">
              <span className="po-option-label">{label}</span>
              <input
                type="checkbox"
                className="po-checkbox"
                checked={opts[key]}
                onChange={() => toggle(key)}
              />
            </label>
          ))}
        </div>

        <div className="po-footer">
          <button type="button" className="po-btn-cancel" onClick={onClose}>CANCEL</button>
          <button type="button" className="po-btn-ok" onClick={() => onOk(opts)}>OK</button>
        </div>
      </div>
    </div>
  );
}

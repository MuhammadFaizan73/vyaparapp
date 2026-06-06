import { useState } from "react";
import { createPortal } from "react-dom";
import type { Item } from "@vyapar/api-client";
import { api } from "../lib/api";

type Props = {
  onClose: () => void;
  onSaved: (item: Item) => void;
};

type ItemTab = "pricing" | "stock";

const UNITS = ["NONE", "PCS", "KG", "G", "L", "ML", "MTR", "CM", "BOX", "PKT", "DOZ", "SET", "BAG", "ROLL", "BUNDLE", "PAIR"];

function genCode() {
  return "ITM-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function AddItemModal({ onClose, onSaved }: Props) {
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab]     = useState<ItemTab>("pricing");
  const [itemType, setItemType] = useState<"product" | "service">("product");

  const [name,           setName]           = useState("");
  const [sku,            setSku]            = useState("");
  const [unit,           setUnit]           = useState("NONE");
  const [secondaryUnit,  setSecondaryUnit]  = useState("NONE");
  const [conversionRate, setConversionRate] = useState("");
  const [mrp,            setMrp]            = useState("");
  const [salePrice,      setSalePrice]      = useState("");
  const [purchasePrice,  setPurchasePrice]  = useState("");
  const [discount,       setDiscount]       = useState("");
  const [openingStock,   setOpeningStock]   = useState("");
  const [minStock,       setMinStock]       = useState("");

  const hasUnit = unit !== "NONE";
  const hasSecondary = hasUnit && secondaryUnit !== "NONE";

  function handleUnitChange(val: string) {
    setUnit(val);
    if (val === "NONE") { setSecondaryUnit("NONE"); setConversionRate(""); }
  }

  async function save(andNew = false) {
    if (!name.trim()) { setError("Item name is required"); return; }
    if (hasSecondary && (!conversionRate || parseFloat(conversionRate) <= 0)) {
      setError("Conversion rate must be > 0");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const saved = await api.createItem({
        name: name.trim(),
        sku:            sku.trim() || undefined,
        unit:           unit === "NONE" ? undefined : unit,
        secondaryUnit:  hasSecondary ? secondaryUnit : undefined,
        conversionRate: hasSecondary ? conversionRate : undefined,
        mrp:            mrp           ? parseFloat(mrp)           : undefined,
        salePrice:      salePrice     ? parseFloat(salePrice)     : undefined,
        purchasePrice:  purchasePrice ? parseFloat(purchasePrice) : undefined,
        discount:       discount      ? parseFloat(discount)      : undefined,
        openingStock:   openingStock  ? parseFloat(openingStock)  : undefined,
        minStock:       minStock      ? parseFloat(minStock)      : undefined,
      });
      if (andNew) {
        setName(""); setSku(""); setUnit("NONE"); setSecondaryUnit("NONE");
        setConversionRate(""); setMrp(""); setSalePrice(""); setPurchasePrice("");
        setDiscount(""); setOpeningStock(""); setMinStock("");
        setTab("pricing"); setError(null);
      } else {
        onSaved(saved);
      }
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })
        .response?.data?.message ?? "Could not save item.";
      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="party-modal-backdrop" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="ai-header">
          <div className="ai-header__left">
            <span className="ai-header__title">Add Item</span>
            <div className="ai-type-toggle">
              <button
                type="button"
                className={`ai-type-btn${itemType === "product" ? " ai-type-btn--active" : ""}`}
                onClick={() => setItemType("product")}
              >Product</button>
              <button
                type="button"
                className={`ai-type-btn${itemType === "service" ? " ai-type-btn--active" : ""}`}
                onClick={() => setItemType("service")}
              >Service</button>
            </div>
          </div>
          <div className="ai-header__right">
            <button type="button" className="party-modal__icon-btn" aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="ai-body">
          {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

          {/* Row 1: Item Name + Unit */}
          <div className="ai-row">
            <div className="ai-field ai-field--grow2">
              <label className="ai-label">ITEM NAME *</label>
              <input
                className="ai-input ai-input--focus"
                placeholder="Enter item name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="ai-field ai-field--grow1">
              <label className="ai-label">UNIT</label>
              <select
                className="ai-input"
                value={unit}
                onChange={(e) => handleUnitChange(e.target.value)}
                style={{ cursor: "pointer" }}
              >
                <option value="NONE">Select Unit</option>
                {UNITS.filter(u => u !== "NONE").map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Item Code + Assign Code */}
          <div className="ai-row">
            <div className="ai-field ai-field--grow1">
              <label className="ai-label">ITEM CODE</label>
              <div className="ai-code-row">
                <input
                  className="ai-input"
                  placeholder="Item code / SKU"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="ai-assign-btn"
                  onClick={() => setSku(genCode())}
                >Assign Code</button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="ai-tabs">
            {(["pricing", "stock"] as ItemTab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`ai-tab${tab === t ? " ai-tab--active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "pricing" ? "Pricing" : "Stock"}
              </button>
            ))}
          </div>

          {/* ── Pricing tab ── */}
          {tab === "pricing" && (
            <div className="ai-price-grid">

              {/* MRP */}
              <div className="ai-price-card">
                <div className="ai-price-card__top">
                  <span className="ai-price-card__label">MRP</span>
                </div>
                <div className="ai-price-card__input-row">
                  <span className="ai-price-card__prefix">Rs</span>
                  <input
                    className="ai-price-card__input"
                    type="number" min="0" placeholder="0.00"
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value)}
                  />
                </div>
              </div>

              {/* Sale Price */}
              <div className="ai-price-card">
                <div className="ai-price-card__top">
                  <span className="ai-price-card__label">SALE PRICE</span>
                </div>
                <div className="ai-price-card__input-row">
                  <span className="ai-price-card__prefix">Rs</span>
                  <input
                    className="ai-price-card__input"
                    type="number" min="0" placeholder="0.00"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Discount */}
              <div className="ai-price-card">
                <div className="ai-price-card__top">
                  <span className="ai-price-card__label">DISCOUNT</span>
                </div>
                <div className="ai-price-card__input-row">
                  <span className="ai-price-card__prefix">%</span>
                  <input
                    className="ai-price-card__input"
                    type="number" min="0" max="100" placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </div>
                {discount && salePrice && (
                  <div className="ai-price-card__hint">
                    After discount: Rs {(parseFloat(salePrice) * (1 - parseFloat(discount) / 100)).toFixed(2)}
                  </div>
                )}
              </div>

              {/* Purchase Price */}
              <div className="ai-price-card ai-price-card--full">
                <div className="ai-price-card__top">
                  <span className="ai-price-card__label">PURCHASE PRICE</span>
                </div>
                <div className="ai-price-card__input-row">
                  <span className="ai-price-card__prefix">Rs</span>
                  <input
                    className="ai-price-card__input"
                    type="number" min="0" placeholder="0.00"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                  />
                </div>
              </div>

            </div>
          )}

          {/* ── Stock tab ── */}
          {tab === "stock" && (
            <div className="ai-stock-grid">

              <div className="ai-price-card">
                <div className="ai-price-card__top">
                  <span className="ai-price-card__label">OPENING STOCK</span>
                </div>
                <div className="ai-price-card__input-row">
                  <input
                    className="ai-price-card__input"
                    style={{ paddingLeft: 12 }}
                    type="number" min="0" placeholder="0"
                    value={openingStock}
                    onChange={(e) => setOpeningStock(e.target.value)}
                  />
                </div>
              </div>

              <div className="ai-price-card">
                <div className="ai-price-card__top">
                  <span className="ai-price-card__label">MIN STOCK ALERT</span>
                </div>
                <div className="ai-price-card__input-row">
                  <input
                    className="ai-price-card__input"
                    style={{ paddingLeft: 12 }}
                    type="number" min="0" placeholder="0"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                  />
                </div>
              </div>

              {/* Secondary unit */}
              {hasUnit && (
                <div className="ai-price-card ai-price-card--full">
                  <div className="ai-price-card__top">
                    <span className="ai-price-card__label">UNIT CONVERSION</span>
                    <span className="ai-price-card__hint-inline">e.g. 1 BOX = 12 PCS</span>
                  </div>
                  <div className="item-conversion__row" style={{ marginTop: 8 }}>
                    <span className="item-conversion__fixed">1</span>
                    <span className="item-conversion__unit-badge">{unit}</span>
                    <span className="item-conversion__eq">=</span>
                    <input
                      className="party-modal__input item-conversion__qty"
                      type="number" min="0.001" step="any" placeholder="Qty"
                      value={conversionRate}
                      onChange={(e) => setConversionRate(e.target.value)}
                      disabled={secondaryUnit === "NONE"}
                    />
                    <select
                      className="party-modal__input item-conversion__sec-unit"
                      value={secondaryUnit}
                      onChange={(e) => setSecondaryUnit(e.target.value)}
                      style={{ cursor: "pointer" }}
                    >
                      <option value="NONE">— Secondary Unit —</option>
                      {UNITS.filter(u => u !== "NONE" && u !== unit).map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  {hasSecondary && conversionRate && (
                    <div className="item-conversion__preview">
                      1 {unit} = {conversionRate} {secondaryUnit}
                      &nbsp;·&nbsp;
                      1 {secondaryUnit} = {(1 / parseFloat(conversionRate)).toFixed(4)} {unit}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="party-modal__footer">
          <button type="button" className="party-modal__btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <div className="party-modal__footer-right">
            <button
              type="button"
              className="party-modal__btn-outline"
              disabled={busy || !name.trim()}
              onClick={() => void save(true)}
            >
              Save &amp; New
            </button>
            <button
              type="button"
              className="party-modal__btn-primary"
              disabled={busy || !name.trim()}
              onClick={() => void save(false)}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Party, PartyGroup } from "@vyapar/api-client";
import { api } from "../lib/api";
import type { PartySettings } from "./PartySettingsDrawer";
import { DEFAULT_PARTY_SETTINGS } from "./PartySettingsDrawer";

type PartyType = "customer" | "supplier" | "both";

type Props = {
  onClose: () => void;
  onSaved: (party: Party) => void;
  party?: Party;
  settings?: PartySettings;
  defaultType?: PartyType;
};

type Tab = "address" | "credit" | "fields";

export function AddPartyModal({ onClose, onSaved, party, settings = DEFAULT_PARTY_SETTINGS, defaultType }: Props) {
  const isEdit = !!party;
  const [tab, setTab] = useState<Tab>("address");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partyType, setPartyType] = useState<PartyType>(
    (party?.partyType as PartyType) ?? defaultType ?? "both"
  );
  const [showDetailedAddress, setShowDetailedAddress] = useState(
    !!(party?.city || party?.state || party?.pincode)
  );
  const [showShipping, setShowShipping] = useState(
    !!(party?.shippingAddress || party?.shippingCity)
  );

  // Party Group
  const [groups, setGroups] = useState<PartyGroup[]>([]);
  const [groupId, setGroupId] = useState<string>(party?.groupId ?? "");
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const showNewGroupInput = groupId === "__new__";

  useEffect(() => {
    api.listPartyGroups().then(setGroups).catch(() => {});
  }, []);

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const g = await api.createPartyGroup(newGroupName.trim());
      setGroups((prev) => [...prev, g]);
      setGroupId(g.id);
      setNewGroupName("");
    } catch {
      // ignore
    } finally {
      setCreatingGroup(false);
    }
  }

  // Basic fields
  const [name, setName] = useState(party?.name ?? "");
  const [phone, setPhone] = useState(party?.phone ?? "");
  const [email, setEmail] = useState(party?.email ?? "");

  // Address
  const [billingAddress, setBillingAddress] = useState(party?.billingAddress ?? "");
  const [city, setCity] = useState(party?.city ?? "");
  const [state, setState] = useState(party?.state ?? "");
  const [pincode, setPincode] = useState(party?.pincode ?? "");

  // Shipping
  const [shippingAddress, setShippingAddress] = useState(party?.shippingAddress ?? "");
  const [shippingCity, setShippingCity] = useState(party?.shippingCity ?? "");
  const [shippingState, setShippingState] = useState(party?.shippingState ?? "");
  const [shippingPincode, setShippingPincode] = useState(party?.shippingPincode ?? "");

  // Credit & Balance
  const [openingBalance, setOpeningBalance] = useState(
    party?.openingBalance ? String(party.openingBalance) : ""
  );
  const [creditLimit, setCreditLimit] = useState(
    party?.creditLimit ? String(party.creditLimit) : ""
  );
  const [creditDays, setCreditDays] = useState(
    party?.creditDays ? String(party.creditDays) : ""
  );

  // Additional fields
  const [gstin, setGstin] = useState(party?.gstin ?? "");
  const [pan, setPan] = useState(party?.pan ?? "");
  const [ntn, setNtn] = useState(party?.ntn ?? "");
  const [cnic, setCnic] = useState(party?.cnic ?? "");
  const [strn, setStrn] = useState(party?.strn ?? "");

  // Geo location
  const [latitude, setLatitude] = useState<string>(party?.latitude != null ? String(party.latitude) : "");
  const [longitude, setLongitude] = useState<string>(party?.longitude != null ? String(party.longitude) : "");
  const [locBusy, setLocBusy] = useState(false);

  function handleUseMyLocation() {
    if (!navigator.geolocation) return;
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
        setLocBusy(false);
      },
      () => { setLocBusy(false); },
      { enableHighAccuracy: true },
    );
  }

  function buildBody() {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    return {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      billingAddress: billingAddress.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      pincode: pincode.trim() || undefined,
      shippingAddress: shippingAddress.trim() || undefined,
      shippingCity: shippingCity.trim() || undefined,
      shippingState: shippingState.trim() || undefined,
      shippingPincode: shippingPincode.trim() || undefined,
      openingBalance: openingBalance ? parseFloat(openingBalance) : undefined,
      creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
      creditDays: creditDays ? parseInt(creditDays, 10) : undefined,
      gstin: gstin.trim() || undefined,
      pan: pan.trim() || undefined,
      ntn: ntn.trim() || undefined,
      cnic: cnic.trim() || undefined,
      strn: strn.trim() || undefined,
      partyType,
      groupId: (groupId && groupId !== "__new__") ? groupId : undefined,
      latitude: !isNaN(lat) ? lat : undefined,
      longitude: !isNaN(lng) ? lng : undefined,
    };
  }

  async function save(andNew = false) {
    if (!name.trim()) { setError("Party name is required"); return; }
    setError(null);
    setBusy(true);
    try {
      const saved = isEdit
        ? await api.updateParty(party!.id, buildBody())
        : await api.createParty({ ...buildBody(), name: name.trim() });

      if (andNew && !isEdit) {
        setName(""); setPhone(""); setEmail(""); setBillingAddress("");
        setCity(""); setState(""); setPincode("");
        setShippingAddress(""); setShippingCity(""); setShippingState(""); setShippingPincode("");
        setOpeningBalance(""); setCreditLimit(""); setCreditDays("");
        setGstin(""); setPan(""); setNtn(""); setCnic(""); setStrn(""); setGroupId("");
        setShowDetailedAddress(false); setShowShipping(false);
        setTab("address");
      } else {
        onSaved(saved);
      }
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ??
        "Could not save party.";
      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="party-modal-backdrop" onClick={onClose}>
      <div className="party-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="party-modal__header">
          <span className="party-modal__title">{isEdit ? "Edit Party" : "Add Party"}</span>
          <div className="party-modal__header-actions">
            <button type="button" className="party-modal__icon-btn" aria-label="Close" onClick={onClose}>
              <XIcon />
            </button>
          </div>
        </div>

        <div className="party-modal__body">
          {error && <div className="form-error">{error}</div>}

          {/* Party Type selector */}
          <div className="party-modal__type-row">
            {(["customer", "supplier", "both"] as PartyType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`party-modal__type-btn${partyType === t ? " party-modal__type-btn--active" : ""}`}
                style={{
                  background: partyType === t
                    ? t === "customer" ? "#3b82f6" : t === "supplier" ? "#f59e0b" : "#6d28d9"
                    : "#f3f4f6",
                  color: partyType === t ? "#fff" : "#374151",
                }}
                onClick={() => setPartyType(t)}
              >
                {t === "customer" ? "Customer" : t === "supplier" ? "Supplier" : "Both"}
              </button>
            ))}
          </div>

          {/* Name + Phone + Group */}
          <div className="party-modal__row">
            <div className="party-modal__field">
              <input
                className="party-modal__input party-modal__input--focus"
                placeholder="Party Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus={!isEdit}
              />
            </div>
            <div className="party-modal__field">
              <input
                className="party-modal__input"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="party-modal__field">
              <select
                className="party-modal__input"
                style={{ cursor: "pointer", color: groupId && groupId !== "__new__" ? "#111827" : "#9ca3af" }}
                value={groupId}
                onChange={(e) => { setGroupId(e.target.value); setNewGroupName(""); }}
              >
                <option value="">Party Group</option>
                <option value="__new__">＋ New Group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* New group inline input — shown when "+ New Group" is selected */}
          {showNewGroupInput && (
            <div className="party-group-inline">
              <input
                className="party-modal__input party-group-inline__input"
                autoFocus
                placeholder="Group name (e.g. Distributor, Retailer)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); void handleCreateGroup(); }
                  if (e.key === "Escape") { setGroupId(""); setNewGroupName(""); }
                }}
              />
              <button
                type="button"
                className="party-modal__btn-primary party-group-inline__btn"
                disabled={creatingGroup || !newGroupName.trim()}
                onClick={() => void handleCreateGroup()}
              >
                {creatingGroup ? "Adding…" : "Add Group"}
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="party-modal__tabs">
            {(["address", "credit", "fields"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`party-modal__tab${tab === t ? " party-modal__tab--active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "address" ? "Address" : t === "credit" ? "Credit & Balance" : "Additional Fields"}
                {t === "credit" && <span className="party-modal__tab-badge">New</span>}
              </button>
            ))}
          </div>

          {/* ── Address tab ── */}
          {tab === "address" && (
            <div className="party-modal__address">
              <div className="party-modal__address-left">
                <input
                  className="party-modal__input"
                  placeholder="Email ID"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {/* Shop Location */}
                <div className="party-location-box">
                  <div className="party-location-box__header">
                    <PinIcon />
                    <span className="party-location-box__title">Shop Location</span>
                  </div>
                  <p className="party-location-box__hint">Saved coordinates are shown on the salesman live map.</p>
                  <div className="party-location-box__inputs">
                    <input
                      className="party-modal__input"
                      placeholder="Latitude (e.g. 24.8607)"
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                    />
                    <input
                      className="party-modal__input"
                      placeholder="Longitude (e.g. 67.0011)"
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="party-location-box__btn"
                    disabled={locBusy}
                    onClick={handleUseMyLocation}
                  >
                    <LocateIcon />
                    {locBusy ? "Getting location…" : "Use My Location"}
                  </button>
                  {latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude)) && (
                    <div className="party-location-box__pinned">
                      <span className="party-location-box__pinned-dot" />
                      Location pinned: {parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)}
                      <button type="button" className="party-location-box__clear" onClick={() => { setLatitude(""); setLongitude(""); }}>×</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="party-modal__address-center">
                <textarea
                  className="party-modal__textarea"
                  placeholder="Billing Address"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  rows={3}
                />
                {showDetailedAddress ? (
                  <div className="party-modal__detail-address">
                    <input className="party-modal__input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                    <input className="party-modal__input" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
                    <input className="party-modal__input" placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
                  </div>
                ) : (
                  <button type="button" className="party-modal__link" onClick={() => setShowDetailedAddress(true)}>
                    <EyeIcon /> Show Detailed Address
                  </button>
                )}
              </div>
              {settings.shippingAddress && (
                <div className="party-modal__address-right">
                  <span className="party-modal__shipping-label">Shipping Address</span>
                  {showShipping ? (
                    <div className="party-modal__detail-address">
                      <textarea className="party-modal__textarea" placeholder="Shipping Address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} rows={2} />
                      <input className="party-modal__input" placeholder="City" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} />
                      <input className="party-modal__input" placeholder="State" value={shippingState} onChange={(e) => setShippingState(e.target.value)} />
                      <input className="party-modal__input" placeholder="Pincode" value={shippingPincode} onChange={(e) => setShippingPincode(e.target.value)} />
                      <button type="button" className="party-modal__link party-modal__link--red" onClick={() => { setShowShipping(false); setShippingAddress(""); setShippingCity(""); setShippingState(""); setShippingPincode(""); }}>
                        − Remove Shipping Address
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="party-modal__link party-modal__link--blue" onClick={() => setShowShipping(true)}>
                      + Enable Shipping Address
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Credit & Balance tab ── */}
          {tab === "credit" && (
            <div className="party-modal__credit">
              <div className="party-modal__credit-row">
                <div className="party-modal__credit-field">
                  <label className="party-modal__credit-label">Opening Balance (Rs)</label>
                  <input
                    className="party-modal__input"
                    placeholder="0.00"
                    type="number"
                    min="0"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                  />
                  <p className="party-modal__credit-hint">Balance already owed to/from this party</p>
                </div>
                <div className="party-modal__credit-field">
                  <label className="party-modal__credit-label">Credit Limit (Rs)</label>
                  <input
                    className="party-modal__input"
                    placeholder="No limit"
                    type="number"
                    min="0"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                  />
                  <p className="party-modal__credit-hint">Max amount this party can owe you</p>
                </div>
                <div className="party-modal__credit-field">
                  <label className="party-modal__credit-label">Credit Days</label>
                  <input
                    className="party-modal__input"
                    placeholder="e.g. 30"
                    type="number"
                    min="0"
                    value={creditDays}
                    onChange={(e) => setCreditDays(e.target.value)}
                  />
                  <p className="party-modal__credit-hint">Days allowed before payment is due</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Additional Fields tab ── */}
          {tab === "fields" && (
            <div className="party-modal__credit">
              <div className="party-modal__credit-row">
                <div className="party-modal__credit-field">
                  <label className="party-modal__credit-label">NTN (National Tax Number)</label>
                  <input
                    className="party-modal__input"
                    placeholder="e.g. 1234567-8"
                    value={ntn}
                    onChange={(e) => setNtn(e.target.value)}
                  />
                </div>
                <div className="party-modal__credit-field">
                  <label className="party-modal__credit-label">CNIC</label>
                  <input
                    className="party-modal__input"
                    placeholder="e.g. 42101-1234567-1"
                    value={cnic}
                    onChange={(e) => setCnic(e.target.value)}
                  />
                </div>
                <div className="party-modal__credit-field">
                  <label className="party-modal__credit-label">STRN (Sales Tax Reg. No.)</label>
                  <input
                    className="party-modal__input"
                    placeholder="e.g. 03-00-9999-001-03"
                    value={strn}
                    onChange={(e) => setStrn(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="party-modal__footer">
          <button type="button" className="party-modal__btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <div className="party-modal__footer-right">
            {!isEdit && (
              <button
                type="button"
                className="party-modal__btn-outline"
                disabled={busy || !name.trim()}
                onClick={() => void save(true)}
              >
                Save &amp; New
              </button>
            )}
            <button
              type="button"
              className="party-modal__btn-primary"
              disabled={busy || !name.trim()}
              onClick={() => void save(false)}
            >
              {busy ? "Saving…" : isEdit ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
      <circle cx="12" cy="12" r="3" />
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function LocateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

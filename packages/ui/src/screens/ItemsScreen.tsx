import { useState } from "react";

type TabKey = "products" | "services" | "category" | "units";
type FormTab = "pricing" | "stock";
type ItemType = "product" | "service";

interface MockItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
}

interface MockTransaction {
  dot: "green" | "orange";
  type: string;
  invoice: number;
  name: string;
  date: string;
  qty: string;
  price: string;
  status: string;
}

const MOCK_ITEMS: MockItem[] = [
  { id: "1", name: "Infinix NOte 50", qty: -4, unit: "Box" },
  { id: "2", name: "Sample Item", qty: -10, unit: "" },
];

const MOCK_TRANSACTIONS: MockTransaction[] = [
  { dot: "green", type: "Sale", invoice: 5, name: "Noor Medical store", date: "25/03/2026", qty: "1 Box", price: "Rs 40,000.00", status: "Unpaid" },
  { dot: "green", type: "Sale", invoice: 2, name: "Noor Medical store", date: "19/03/2026", qty: "1 Box", price: "Rs 40,000.00", status: "Unpaid" },
  { dot: "green", type: "PoS Sale", invoice: 3, name: "Cash Sale", date: "19/03/2026", qty: "1 Box", price: "Rs 40,000.00", status: "Paid" },
  { dot: "green", type: "PoS Sale", invoice: 4, name: "Noor Medical store", date: "19/03/2026", qty: "1 Box", price: "Rs 40,000.00", status: "Paid" },
];

export function ItemsScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>("products");
  const [selectedItem, setSelectedItem] = useState<MockItem | null>(MOCK_ITEMS[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formTab, setFormTab] = useState<FormTab>("pricing");
  const [itemType, setItemType] = useState<ItemType>("product");
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [minWholesaleQty, setMinWholesaleQty] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState<string[]>(["Mobiles"]);
  const [baseUnit, setBaseUnit] = useState("None");
  const [secondaryUnit, setSecondaryUnit] = useState("None");
  const [txnSearch, setTxnSearch] = useState("");

  // Settings state
  const [mrpLabel, setMrpLabel] = useState("MRP");
  const [mrpEnabled, setMrpEnabled] = useState(true);
  const [calcFromMrp, setCalcFromMrp] = useState(false);
  const [mrpBatchTracking, setMrpBatchTracking] = useState(false);
  const [serialLabel, setSerialLabel] = useState("Serial No. / IMEI etc.");
  const [serialEnabled, setSerialEnabled] = useState(false);
  const [batchNoEnabled, setBatchNoEnabled] = useState(false);
  const [expDateEnabled, setExpDateEnabled] = useState(false);
  const [mfgDateEnabled, setMfgDateEnabled] = useState(false);
  const [modelNoEnabled, setModelNoEnabled] = useState(false);
  const [sizeEnabled, setSizeEnabled] = useState(false);
  const [wholesalePriceEnabled, setWholesalePriceEnabled] = useState(false);
  const [barcodeScanEnabled, setBarcodeScanEnabled] = useState(false);
  const [itemCategoryEnabled, setItemCategoryEnabled] = useState(false);

  const TABS: { key: TabKey; label: string }[] = [
    { key: "products", label: "PRODUCTS" },
    { key: "services", label: "SERVICES" },
    { key: "category", label: "CATEGORY" },
    { key: "units", label: "UNITS" },
  ];

  function handleAddCategory() {
    if (newCategoryName.trim()) {
      setCategories((prev) => [...prev, newCategoryName.trim()]);
      setSelectedCategory(newCategoryName.trim());
      setNewCategoryName("");
      setShowAddCategoryModal(false);
    }
  }

  function handleCloseForm() {
    setShowAddForm(false);
    setItemName("");
    setItemCode("");
    setSalePrice("");
    setWholesalePrice("");
    setMinWholesaleQty("");
    setPurchasePrice("");
    setSelectedCategory("");
    setFormTab("pricing");
    setItemType("product");
  }

  return (
    <div className="items-layout">
      {/* LEFT PANEL */}
      <div className="items-list">
        {/* Tabs */}
        <div className="items-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`items-tab${activeTab === t.key ? " items-tab--active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List header */}
        <div className="items-list-header">
          {/* Search icon button */}
          <button type="button" className="items-icon-btn" aria-label="Search">
            <SearchIcon />
          </button>

          {/* Add Item button with dropdown */}
          <div className="items-add-btn-wrap" style={{ position: "relative" }}>
            <div className="items-add-btn">
              <button
                type="button"
                className="items-add-btn__main"
                onClick={() => {
                  setShowAddForm(true);
                  setShowImportMenu(false);
                }}
              >
                + Add Item
              </button>
              <span className="items-add-btn__divider" />
              <button
                type="button"
                className="items-add-btn__dropdown"
                aria-label="More options"
                onClick={() => setShowImportMenu((v) => !v)}
              >
                ▾
              </button>
            </div>
            {showImportMenu && (
              <div className="items-import-menu">
                <button
                  type="button"
                  onClick={() => setShowImportMenu(false)}
                >
                  <span>📄</span> Import Items
                </button>
              </div>
            )}
          </div>

          {/* Three-dot menu */}
          <button type="button" className="items-icon-btn" aria-label="More">
            <DotsIcon />
          </button>
        </div>

        {/* Table header */}
        <div className="items-table-header">
          <span className="items-table-header__item">
            ITEM <FilterIcon />
          </span>
          <span className="items-table-header__qty">
            QUANTITY <FilterIcon />
          </span>
        </div>

        {/* Item rows */}
        <div className="items-rows">
          {MOCK_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`items-row${selectedItem?.id === item.id && !showAddForm ? " items-row--active" : ""}`}
              onClick={() => {
                setSelectedItem(item);
                setShowAddForm(false);
              }}
            >
              <span className="items-row__name">{item.name}</span>
              <span
                className={`items-row__qty${item.qty < 0 ? " items-row__qty--neg" : ""}`}
              >
                {item.qty} {item.unit}
              </span>
              <button type="button" className="items-row__dots" aria-label="Row menu">
                <DotsIcon />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="items-detail">
        {showAddForm ? (
          /* ─── ADD ITEM FORM PANEL ─── */
          <div className="items-form-panel">
            {/* Form header */}
            <div className="items-form-header">
              <span className="items-form-header__title">Add Item</span>

              {/* Product / Service toggle */}
              <div className="items-type-toggle">
                <button
                  type="button"
                  className={`items-type-toggle__btn${itemType === "product" ? " items-type-toggle__btn--active" : ""}`}
                  onClick={() => setItemType("product")}
                >
                  Product
                </button>
                <button
                  type="button"
                  className={`items-type-toggle__btn${itemType === "service" ? " items-type-toggle__btn--active" : ""}`}
                  onClick={() => setItemType("service")}
                >
                  Service
                </button>
              </div>

              <div className="items-form-header__actions">
                <button
                  type="button"
                  className="items-icon-btn"
                  aria-label="Settings"
                  onClick={() => setShowSettings(true)}
                >
                  <SettingsGearIcon />
                </button>
                <button
                  type="button"
                  className="items-icon-btn"
                  aria-label="Close"
                  onClick={handleCloseForm}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="items-form-body">
              {/* Row 1 */}
              <div className="items-form-row">
                {/* Item Name */}
                <div className="items-form-field">
                  <label className="items-form-label">Item Name *</label>
                  <input
                    type="text"
                    className="items-form-input"
                    placeholder="Enter item name"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                  />
                </div>

                {/* Category */}
                <div className="items-form-field" style={{ position: "relative" }}>
                  <label className="items-form-label">Category</label>
                  <button
                    type="button"
                    className="items-form-select"
                    onClick={() => setShowCategoryDropdown((v) => !v)}
                  >
                    <span>{selectedCategory || "Select Category"}</span>
                    <ChevDownIcon />
                  </button>
                  {showCategoryDropdown && (
                    <div className="items-category-dropdown">
                      <div className="items-category-dropdown__search">
                        <SearchIcon />
                        <input type="text" placeholder="Search category" />
                      </div>
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className="items-category-dropdown__item"
                          onClick={() => {
                            setSelectedCategory(cat);
                            setShowCategoryDropdown(false);
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="items-category-dropdown__add"
                        onClick={() => {
                          setShowCategoryDropdown(false);
                          setShowAddCategoryModal(true);
                        }}
                      >
                        + Add New Category
                      </button>
                    </div>
                  )}
                </div>

                {/* Select Unit */}
                <div className="items-form-field">
                  <label className="items-form-label">Unit</label>
                  <button
                    type="button"
                    className="items-form-select items-form-select--grey"
                    onClick={() => setShowUnitModal(true)}
                  >
                    <span>{baseUnit !== "None" ? baseUnit : "Select Unit"}</span>
                    <ChevDownIcon />
                  </button>
                </div>

                {/* Add Item Image */}
                <div className="items-form-field">
                  <label className="items-form-label">Image</label>
                  <button type="button" className="items-form-image-btn">
                    <CameraIcon />
                    <span>Add Item Image</span>
                  </button>
                </div>
              </div>

              {/* Row 2 — Item Code */}
              <div className="items-form-row items-form-row--compact">
                <div className="items-form-field items-form-field--short">
                  <label className="items-form-label">Item Code</label>
                  <input
                    type="text"
                    className="items-form-input"
                    placeholder="Enter item code"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                  />
                </div>
                <div className="items-form-field items-form-field--btn-align">
                  <label className="items-form-label">&nbsp;</label>
                  <button type="button" className="items-assign-code-btn">
                    Assign Code
                  </button>
                </div>
              </div>

              {/* Form tabs: Pricing | Stock */}
              <div className="items-form-tabs">
                <button
                  type="button"
                  className={`items-form-tab${formTab === "pricing" ? " items-form-tab--active" : ""}`}
                  onClick={() => setFormTab("pricing")}
                >
                  Pricing
                </button>
                <button
                  type="button"
                  className={`items-form-tab${formTab === "stock" ? " items-form-tab--active" : ""}`}
                  onClick={() => setFormTab("stock")}
                >
                  Stock
                </button>
              </div>

              {formTab === "pricing" && (
                <div className="items-form-section">
                  {/* Sale Price */}
                  <div className="items-form-price-row">
                    <label className="items-form-price-label">Sale Price</label>
                    <div className="items-form-price-input-wrap">
                      <span className="items-form-price-prefix">Rs</span>
                      <input
                        type="text"
                        className="items-form-price-input"
                        placeholder="0.00"
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Wholesale Price */}
                  <div className="items-form-price-row">
                    <label className="items-form-price-label">Wholesale Price</label>
                    <div className="items-form-price-double">
                      <div className="items-form-price-input-wrap">
                        <span className="items-form-price-prefix">Rs</span>
                        <input
                          type="text"
                          className="items-form-price-input"
                          placeholder="0.00"
                          value={wholesalePrice}
                          onChange={(e) => setWholesalePrice(e.target.value)}
                        />
                      </div>
                      <div className="items-form-price-input-wrap">
                        <input
                          type="text"
                          className="items-form-price-input"
                          placeholder="Min Wholesale Qty"
                          value={minWholesaleQty}
                          onChange={(e) => setMinWholesaleQty(e.target.value)}
                        />
                        <button type="button" className="items-form-info-btn" title="Minimum quantity for wholesale price">
                          ⓘ
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Purchase Price */}
                  <div className="items-form-price-row">
                    <label className="items-form-price-label">Purchase Price</label>
                    <div className="items-form-price-input-wrap">
                      <span className="items-form-price-prefix">Rs</span>
                      <input
                        type="text"
                        className="items-form-price-input"
                        placeholder="0.00"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {formTab === "stock" && (
                <div className="items-form-section">
                  <p style={{ color: "#94a3b8", fontSize: 13 }}>Stock details coming soon.</p>
                </div>
              )}
            </div>

            {/* Form footer */}
            <div className="items-form-footer">
              <button type="button" className="items-form-footer__save-new">
                Save &amp; New
              </button>
              <button type="button" className="items-form-footer__save">
                Save
              </button>
            </div>
          </div>
        ) : selectedItem ? (
          /* ─── ITEM DETAIL ─── */
          <>
            {/* Detail header */}
            <div className="items-detail-header">
              <div className="items-detail-header__left">
                <span className="items-detail-header__name">
                  {selectedItem.name.toUpperCase()}
                </span>
                <button type="button" className="items-icon-btn" aria-label="Link">
                  <LinkArrowIcon />
                </button>
              </div>
              <button type="button" className="items-adjust-btn">
                <AdjustGridIcon />
                ADJUST ITEM
              </button>
            </div>

            {/* Stats row */}
            <div className="items-stats-row">
              <div className="items-stat">
                <span className="items-stat__label">SALE PRICE</span>
                <span className="items-stat__value items-stat__value--green">Rs 40,000.00</span>
              </div>
              <div className="items-stat__divider" />
              <div className="items-stat">
                <span className="items-stat__label">PURCHASE PRICE</span>
                <span className="items-stat__value items-stat__value--orange">Rs 35,000.00</span>
              </div>
              <div className="items-stat__divider" />
              <div className="items-stat">
                <span className="items-stat__label">STOCK QUANTITY</span>
                <span className="items-stat__value items-stat__value--red">{selectedItem.qty}</span>
              </div>
              <div className="items-stat__divider" />
              <div className="items-stat">
                <span className="items-stat__label">STOCK VALUE</span>
                <span className="items-stat__value">Rs 0.00</span>
              </div>
            </div>

            {/* Transactions section */}
            <div className="items-txn-section">
              <div className="items-txn-header">
                <span className="items-txn-header__title">TRANSACTIONS</span>
                <div className="items-txn-header__tools">
                  <div className="items-txn-search">
                    <SearchIcon />
                    <input
                      type="text"
                      placeholder="Search"
                      value={txnSearch}
                      onChange={(e) => setTxnSearch(e.target.value)}
                    />
                  </div>
                  <button type="button" className="items-excel-btn" title="Export to Excel">
                    <ExcelIcon />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="items-txn-table">
                <div className="items-txn-table__head">
                  <span />
                  <span>TYPE <FilterIcon /></span>
                  <span>INVOICE/REF. NO <FilterIcon /></span>
                  <span>NAME <FilterIcon /></span>
                  <span>DATE <FilterIcon /></span>
                  <span>QUANTITY <FilterIcon /></span>
                  <span>PRICE/UNIT <FilterIcon /></span>
                  <span>STATUS <FilterIcon /></span>
                </div>
                {MOCK_TRANSACTIONS.map((tx) => (
                  <div key={tx.invoice} className="items-txn-table__row">
                    <span>
                      <span
                        className={`items-txn-dot items-txn-dot--${tx.dot}`}
                      />
                    </span>
                    <span>{tx.type}</span>
                    <span>#{tx.invoice}</span>
                    <span>{tx.name}</span>
                    <span>{tx.date}</span>
                    <span>{tx.qty}</span>
                    <span>{tx.price}</span>
                    <span
                      className={`items-txn-status${tx.status === "Paid" ? " items-txn-status--paid" : " items-txn-status--unpaid"}`}
                    >
                      {tx.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="items-detail__placeholder">Select an item from the list</div>
        )}
      </div>

      {/* ─── Settings Drawer ─── */}
      {showSettings && (
        <div className="items-settings-backdrop" onClick={() => setShowSettings(false)}>
          <div
            className="items-settings-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="items-settings-drawer__header">
              <span>Item Settings</span>
              <button type="button" className="items-icon-btn" onClick={() => setShowSettings(false)}>
                <CloseIcon />
              </button>
            </div>
            <div className="items-settings-drawer__body">
              <div className="items-settings-section-title">
                Additional Item Fields
                <ChevDownIcon />
              </div>

              {/* MRP */}
              <div className="items-settings-row">
                <span className="items-settings-row__label">MRP/Price:</span>
                <input
                  type="text"
                  className="items-settings-input"
                  value={mrpLabel}
                  onChange={(e) => setMrpLabel(e.target.value)}
                />
                <input
                  type="checkbox"
                  checked={mrpEnabled}
                  onChange={(e) => setMrpEnabled(e.target.checked)}
                />
              </div>
              <div className="items-settings-row">
                <span className="items-settings-row__label">Calculate Sale Price From MRP &amp; Disc.</span>
                <input type="checkbox" checked={calcFromMrp} onChange={(e) => setCalcFromMrp(e.target.checked)} />
              </div>
              <div className="items-settings-row">
                <span className="items-settings-row__label">Use MRP For Batch Tracking</span>
                <input type="checkbox" checked={mrpBatchTracking} onChange={(e) => setMrpBatchTracking(e.target.checked)} />
              </div>

              {/* Serial No. */}
              <div className="items-settings-row">
                <span className="items-settings-row__label">Serial No. Tracking:</span>
                <input
                  type="text"
                  className="items-settings-input"
                  value={serialLabel}
                  onChange={(e) => setSerialLabel(e.target.value)}
                />
                <input type="checkbox" checked={serialEnabled} onChange={(e) => setSerialEnabled(e.target.checked)} />
              </div>

              {/* Batch Tracking */}
              <div className="items-settings-subsection">Batch Tracking</div>
              {[
                { label: "Batch No.", state: batchNoEnabled, set: setBatchNoEnabled },
                { label: "Exp Date (mm/yy)", state: expDateEnabled, set: setExpDateEnabled },
                { label: "Mfg Date", state: mfgDateEnabled, set: setMfgDateEnabled },
                { label: "Model No.", state: modelNoEnabled, set: setModelNoEnabled },
                { label: "Size", state: sizeEnabled, set: setSizeEnabled },
              ].map(({ label, state, set }) => (
                <div key={label} className="items-settings-row">
                  <span className="items-settings-row__label">{label}</span>
                  <input type="checkbox" checked={state} onChange={(e) => set(e.target.checked)} />
                </div>
              ))}

              <div className="items-settings-section-title" style={{ marginTop: 16 }}>
                Item Custom Fields
                <ChevRightIcon />
              </div>

              <div className="items-settings-row">
                <span className="items-settings-row__label">Wholesale Price</span>
                <input type="checkbox" checked={wholesalePriceEnabled} onChange={(e) => setWholesalePriceEnabled(e.target.checked)} />
              </div>
              <div className="items-settings-row">
                <span className="items-settings-row__label">Barcode Scan</span>
                <input type="checkbox" checked={barcodeScanEnabled} onChange={(e) => setBarcodeScanEnabled(e.target.checked)} />
              </div>
              <div className="items-settings-row">
                <span className="items-settings-row__label">Item Category</span>
                <input type="checkbox" checked={itemCategoryEnabled} onChange={(e) => setItemCategoryEnabled(e.target.checked)} />
              </div>
            </div>
            <div className="items-settings-drawer__footer">
              <button type="button" className="items-settings-save-btn" onClick={() => setShowSettings(false)}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Unit Modal ─── */}
      {showUnitModal && (
        <div className="items-modal-backdrop" onClick={() => setShowUnitModal(false)}>
          <div className="items-modal" onClick={(e) => e.stopPropagation()}>
            <div className="items-modal__header">
              <span>Select Unit</span>
              <button type="button" className="items-icon-btn" onClick={() => setShowUnitModal(false)}>
                <CloseIcon />
              </button>
            </div>
            <div className="items-modal__body">
              <div className="items-modal__field">
                <label className="items-form-label">BASE UNIT</label>
                <select
                  className="items-form-input"
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                >
                  <option value="None">None</option>
                  <option value="Box">Box</option>
                  <option value="Piece">Piece</option>
                  <option value="Kg">Kg</option>
                  <option value="Litre">Litre</option>
                </select>
              </div>
              <div className="items-modal__field">
                <label className="items-form-label">SECONDARY UNIT</label>
                <select
                  className="items-form-input"
                  value={secondaryUnit}
                  onChange={(e) => setSecondaryUnit(e.target.value)}
                >
                  <option value="None">None</option>
                  <option value="Box">Box</option>
                  <option value="Piece">Piece</option>
                  <option value="Kg">Kg</option>
                  <option value="Litre">Litre</option>
                </select>
              </div>
            </div>
            <div className="items-modal__footer">
              <button type="button" className="items-modal__save-btn" onClick={() => setShowUnitModal(false)}>
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Category Modal ─── */}
      {showAddCategoryModal && (
        <div className="items-modal-backdrop" onClick={() => setShowAddCategoryModal(false)}>
          <div className="items-modal" onClick={(e) => e.stopPropagation()}>
            <div className="items-modal__header">
              <span>Add Category</span>
              <button type="button" className="items-icon-btn" onClick={() => setShowAddCategoryModal(false)}>
                <CloseIcon />
              </button>
            </div>
            <div className="items-modal__body">
              <div className="items-modal__field">
                <label className="items-form-label">Enter Category Name</label>
                <input
                  type="text"
                  className="items-form-input items-form-input--focused"
                  placeholder="e.g. Electronics"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(); }}
                />
              </div>
            </div>
            <div className="items-modal__footer">
              <button type="button" className="items-modal__create-btn" onClick={handleAddCategory}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Icon components ─── */

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11" style={{ marginLeft: 3, flexShrink: 0 }}>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function SettingsGearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 3h6v6M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AdjustGridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ marginRight: 5 }}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ExcelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#16a34a" stroke="none" />
      <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

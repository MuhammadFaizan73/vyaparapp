import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";
import type { Item } from "@vyapar/api-client";

type TabKey = "products" | "services" | "category" | "units";
type FormTab = "pricing" | "stock";
type ItemType = "product" | "service";
type ConvDir = "p2s" | "s2p";

const UNITS = [
  { label: "BAGS", short: "Bags" },
  { label: "BOTTLES", short: "Btl" },
  { label: "BOX", short: "Box" },
  { label: "BUNDLES", short: "Bdl" },
  { label: "CARTONS", short: "Ctn" },
  { label: "DOZENS", short: "Doz" },
  { label: "GRAMS", short: "Gms" },
  { label: "KILOGRAMS", short: "Kg" },
  { label: "LITRE", short: "Ltr" },
  { label: "METERS", short: "Mtr" },
  { label: "MILILITRE", short: "Ml" },
  { label: "NUMBERS", short: "Nos" },
  { label: "PAIRS", short: "Prs" },
  { label: "PIECES", short: "Pcs" },
  { label: "QUINTAL", short: "Qtl" },
  { label: "ROLLS", short: "Rol" },
  { label: "SQUARE METERS", short: "Sqm" },
  { label: "STRIP", short: "Strip" },
  { label: "TABLETS", short: "Tbs" },
];

type ItemsScreenProps = { isLocked?: boolean; onLockedAction?: () => void };

function generateItemCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "ITM-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function ItemsScreen({ isLocked = false, onLockedAction }: ItemsScreenProps = {}) {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("products");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showImportItemsModal, setShowImportItemsModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formTab, setFormTab] = useState<FormTab>("pricing");
  const [itemType, setItemType] = useState<ItemType>("product");
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [mrpValue, setMrpValue] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [showWholesalePrice, setShowWholesalePrice] = useState(false);
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [minWholesaleQty, setMinWholesaleQty] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [openingStock, setOpeningStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState<string[]>(["Mobiles"]);
  const [baseUnit, setBaseUnit] = useState("None");
  const [secondaryUnit, setSecondaryUnit] = useState("None");
  const [conversionRate, setConversionRate] = useState("");
  const [convDir, setConvDir] = useState<ConvDir>("p2s");
  const [showPrimaryPicker, setShowPrimaryPicker] = useState(false);
  const [showSecondaryPicker, setShowSecondaryPicker] = useState(false);
  const [txnSearch, setTxnSearch] = useState("");
  const [dotsMenuId, setDotsMenuId] = useState<string | null>(null);
  const [dotsMenuPos, setDotsMenuPos] = useState({ top: 0, left: 0 });

  // Company
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyTag, setSelectedCompanyTag] = useState("");

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

  useEffect(() => {
    api.getItems().then(setItems).catch(() => {});
    // Load companies: active tenant + extras from backend
    api.getTenant().then((t) => {
      const mainName = t.companyName || t.phone || "My Company";
      const extras: Array<{ id: string; name: string }> = Array.isArray(t.extraCompanies) ? t.extraCompanies : [];
      const all = [{ id: "__main__", name: mainName }, ...extras];
      setCompanies(all);
      setSelectedCompanyTag(mainName);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!dotsMenuId) return;
    const close = () => setDotsMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [dotsMenuId]);

  async function handleSaveItem() {
    if (!itemName.trim()) return;
    try {
      const created = await api.createItem({
        name: itemName.trim(),
        sku: itemCode || undefined,
        unit: baseUnit !== "None" ? baseUnit : undefined,
        secondaryUnit: secondaryUnit !== "None" ? secondaryUnit : undefined,
        conversionRate: conversionRate || undefined,
        mrp: mrpValue ? Number(mrpValue) : undefined,
        salePrice: salePrice ? Number(salePrice) : undefined,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        openingStock: openingStock ? Number(openingStock) : undefined,
        minStock: minStock ? Number(minStock) : undefined,
        companyTag: selectedCompanyTag || undefined,
      });
      setItems((prev) => [created, ...prev]);
      setSelectedItem(created);
      handleCloseForm();
    } catch { /* network error */ }
  }

  async function handleDeleteItem(id: string) {
    try {
      await api.deleteItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedItem((prev) => prev?.id === id ? null : prev);
    } catch { /* network error */ }
  }

  function handleCloseForm() {
    setShowAddForm(false);
    setEditingItem(null);
    setItemName("");
    setItemCode("");
    setMrpValue("");
    setSalePrice("");
    setShowWholesalePrice(false);
    setWholesalePrice("");
    setMinWholesaleQty("");
    setPurchasePrice("");
    setOpeningStock("");
    setMinStock("");
    setSelectedCategory("");
    setFormTab("pricing");
    setItemType("product");
    setBaseUnit("None");
    setSecondaryUnit("None");
    setConversionRate("");
    setConvDir("p2s");
    setShowPrimaryPicker(false);
    setShowSecondaryPicker(false);
    setSelectedCompanyTag(companies[0]?.name ?? "");
  }

  function openEditForm(item: Item) {
    setEditingItem(item);
    setItemName(item.name);
    setItemCode(item.sku ?? "");
    setMrpValue(item.mrp != null ? String(item.mrp) : "");
    setSalePrice(item.salePrice != null ? String(item.salePrice) : "");
    setPurchasePrice(item.purchasePrice != null ? String(item.purchasePrice) : "");
    setOpeningStock(item.openingStock != null ? String(item.openingStock) : "");
    setMinStock(item.minStock != null ? String(item.minStock) : "");
    setBaseUnit(item.unit ?? "None");
    setSecondaryUnit(item.secondaryUnit ?? "None");
    setConversionRate(item.conversionRate ?? "");
    setSelectedCompanyTag((item as any).companyTag ?? companies[0]?.name ?? "");
    setFormTab("pricing");
    setItemType("product");
    setShowAddForm(false);
  }

  async function handleUpdateItem() {
    if (!editingItem || !itemName.trim()) return;
    try {
      const updated = await api.updateItem(editingItem.id, {
        name: itemName.trim(),
        sku: itemCode || undefined,
        unit: baseUnit !== "None" ? baseUnit : undefined,
        secondaryUnit: secondaryUnit !== "None" ? secondaryUnit : undefined,
        conversionRate: conversionRate || undefined,
        mrp: mrpValue ? Number(mrpValue) : undefined,
        salePrice: salePrice ? Number(salePrice) : undefined,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        openingStock: openingStock ? Number(openingStock) : undefined,
        minStock: minStock ? Number(minStock) : undefined,
        companyTag: selectedCompanyTag || undefined,
      });
      setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
      setSelectedItem(updated);
      handleCloseForm();
    } catch { /* network error */ }
  }

  function handleExportItems() {
    const headers = ["Item Name", "Item Code", "Unit", "MRP", "Sale Price", "Purchase Price", "Opening Stock", "Min Stock"];
    const rows = items.map((it) => [
      it.name,
      it.sku ?? "",
      it.unit ?? "",
      it.mrp ?? "",
      it.salePrice ?? "",
      it.purchasePrice ?? "",
      it.openingStock ?? "",
      it.minStock ?? "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Items");
    XLSX.writeFile(wb, "items_export.xlsx");
  }

  function handleDownloadItemsTemplate() {
    const headers = ["Item Name*", "Item Code", "Unit", "MRP", "Sale Price", "Purchase Price", "Opening Stock", "Min Stock"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Items");
    XLSX.writeFile(wb, "items_template.xlsx");
  }

  return (
    <div className="items-layout">
      {(showAddForm || editingItem) && (
        /* ── ADD / EDIT ITEM MODAL ── */
        <div className="items-add-form-backdrop" onClick={handleCloseForm}>
          <div className="items-add-form-modal" onClick={(e) => e.stopPropagation()}>
          <div className="items-form-panel">
            {/* Form header */}
            <div className="items-form-header">
              <span className="items-form-header__title">{editingItem ? "Edit Item" : "Add Item"}</span>
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
                <button type="button" className="items-icon-btn" aria-label="Settings" onClick={() => setShowSettings(true)}>
                  <SettingsGearIcon />
                </button>
                <button type="button" className="items-icon-btn" aria-label="Close" onClick={handleCloseForm}>
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="items-form-body">
              {/* Company selector */}
              {companies.length > 0 && (
                <div className="items-form-row" style={{ marginBottom: 8 }}>
                  <div className="items-form-field" style={{ flex: 1 }}>
                    <label className="items-form-label">Company</label>
                    <select
                      className="items-form-input"
                      value={selectedCompanyTag}
                      onChange={(e) => setSelectedCompanyTag(e.target.value)}
                      style={{ cursor: "pointer" }}
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Row 1: Item Name | Unit */}
              <div className="items-form-row">
                <div className="items-form-field items-form-field--name">
                  <label className="items-form-label">Item Name *</label>
                  <input
                    type="text"
                    className="items-form-input items-form-input--focused"
                    placeholder="Enter item name"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="items-form-field" style={{ flex: "0 0 200px" }}>
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
              </div>

              {/* Row 2: Item Code | Category */}
              <div className="items-form-row">
                <div className="items-form-field">
                  <label className="items-form-label">Item Code</label>
                  <div className="items-form-code-row">
                    <input
                      type="text"
                      className="items-form-input"
                      placeholder="Item code / SKU"
                      value={itemCode}
                      onChange={(e) => setItemCode(e.target.value)}
                    />
                    <button type="button" className="items-assign-code-btn" onClick={() => setItemCode(generateItemCode())}>
                      Assign Code
                    </button>
                  </div>
                </div>
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
              </div>

              {/* Form tabs */}
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
                  {/* MRP + Sale Price side by side */}
                  <div className="items-price-card-row">
                    {mrpEnabled && (
                      <div className="items-price-card">
                        <div className="items-price-card__header">
                          <span className="items-price-card__label">{mrpLabel}</span>
                          <button type="button" className="items-form-info-btn" title="Maximum Retail Price" style={{ border: "none", background: "none" }}>ⓘ</button>
                        </div>
                        <div className="items-form-price-input-wrap">
                          <span className="items-form-price-prefix">Rs</span>
                          <input type="text" className="items-form-price-input" placeholder="0.00" value={mrpValue} onChange={(e) => setMrpValue(e.target.value)} />
                        </div>
                      </div>
                    )}
                    <div className="items-price-card">
                      <span className="items-price-card__label">Sale Price</span>
                      <div className="items-form-price-input-wrap">
                        <span className="items-form-price-prefix">Rs</span>
                        <input type="text" className="items-form-price-input" placeholder="0.00" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Wholesale */}
                  {!showWholesalePrice ? (
                    <button type="button" className="items-wholesale-link" onClick={() => setShowWholesalePrice(true)}>
                      + Add Wholesale Price &nbsp;👑
                    </button>
                  ) : (
                    <div className="items-price-card">
                      <span className="items-price-card__label">Wholesale Price</span>
                      <div className="items-form-price-double">
                        <div className="items-form-price-input-wrap">
                          <span className="items-form-price-prefix">Rs</span>
                          <input type="text" className="items-form-price-input" placeholder="0.00" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} />
                        </div>
                        <div className="items-form-price-input-wrap">
                          <input type="text" className="items-form-price-input" placeholder="Min Wholesale Qty" value={minWholesaleQty} onChange={(e) => setMinWholesaleQty(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Purchase Price */}
                  <div className="items-price-card">
                    <span className="items-price-card__label">Purchase Price</span>
                    <div className="items-form-price-input-wrap">
                      <span className="items-form-price-prefix">Rs</span>
                      <input type="text" className="items-form-price-input" placeholder="0.00" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {formTab === "stock" && (
                <div className="items-form-section">
                  {/* Opening Stock + Min Stock side by side */}
                  <div className="items-price-card-row">
                    <div className="items-price-card">
                      <span className="items-price-card__label">Opening Stock</span>
                      <div className="items-form-price-double">
                        <div className="items-form-price-input-wrap" style={{ flex: 1 }}>
                          <span className="items-form-price-prefix">{baseUnit !== "None" ? baseUnit : "Qty"}</span>
                          <input
                            type="number"
                            className="items-form-price-input"
                            placeholder="0"
                            value={openingStock}
                            onChange={(e) => setOpeningStock(e.target.value)}
                          />
                        </div>
                        <div className="items-form-price-input-wrap" style={{ flex: 1 }}>
                          <span className="items-form-price-prefix">Rs</span>
                          <input type="number" className="items-form-price-input" placeholder="At price" />
                        </div>
                      </div>
                    </div>
                    <div className="items-price-card">
                      <span className="items-price-card__label">Minimum Stock to Maintain</span>
                      <div className="items-form-price-input-wrap">
                        <span className="items-form-price-prefix">{baseUnit !== "None" ? baseUnit : "Qty"}</span>
                        <input
                          type="number"
                          className="items-form-price-input"
                          placeholder="e.g. 5"
                          value={minStock}
                          onChange={(e) => setMinStock(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Location card */}
                  <div className="items-price-card">
                    <span className="items-price-card__label">Storage Location</span>
                    <div className="items-form-price-input-wrap">
                      <input type="text" className="items-form-price-input" placeholder="Location / Rack" style={{ paddingLeft: 12 }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Form footer */}
            <div className="items-form-footer">
              {!editingItem && (
                <button type="button" className="items-form-footer__save-new" onClick={async () => { await handleSaveItem(); setShowAddForm(true); }}>
                  Save &amp; New
                </button>
              )}
              <button
                type="button"
                className="items-form-footer__save"
                onClick={editingItem ? handleUpdateItem : handleSaveItem}
              >
                {editingItem ? "Update" : "Save"}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

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
                  if (isLocked) { onLockedAction?.(); return; }
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
                  onClick={() => { setShowImportMenu(false); handleDownloadItemsTemplate(); }}
                >
                  <span>⬇️</span> Download Template
                </button>
                <button
                  type="button"
                  onClick={() => { setShowImportMenu(false); setShowImportItemsModal(true); }}
                >
                  <span>📄</span> Import Items (Excel)
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
          {items.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              No items yet. Click + Add Item to get started.
            </div>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`items-row${selectedItem?.id === item.id && !showAddForm ? " items-row--active" : ""}`}
              onClick={() => { setSelectedItem(item); setShowAddForm(false); }}
            >
              <span className="items-row__name">{item.name}</span>
              <span className={`items-row__qty${(item.openingStock ?? 0) < 0 ? " items-row__qty--neg" : ""}`}>
                {item.openingStock ?? 0} {item.unit ?? ""}
              </span>
              <div className="items-row__dots-wrap">
                <button
                  type="button"
                  className="items-row__dots"
                  aria-label="Item options"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dotsMenuId === item.id) { setDotsMenuId(null); return; }
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setDotsMenuPos({ top: rect.bottom + 4, left: rect.right - 150 });
                    setDotsMenuId(item.id);
                  }}
                >
                  <DotsIcon />
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="items-detail">
        {selectedItem ? (
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
              <button type="button" className="items-edit-btn" onClick={() => openEditForm(selectedItem!)}>
                ✎ Edit Item
              </button>
            </div>

            {/* Stats row */}
            <div className="items-stats-row">
              <div className="items-stat">
                <span className="items-stat__label">SALE PRICE</span>
                <span className="items-stat__value items-stat__value--green">
                  Rs {(selectedItem.salePrice ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="items-stat__divider" />
              <div className="items-stat">
                <span className="items-stat__label">PURCHASE PRICE</span>
                <span className="items-stat__value items-stat__value--orange">
                  Rs {(selectedItem.purchasePrice ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="items-stat__divider" />
              <div className="items-stat">
                <span className="items-stat__label">STOCK QUANTITY</span>
                <span className="items-stat__value items-stat__value--red">{selectedItem.openingStock ?? 0} {selectedItem.unit ?? ""}</span>
              </div>
              <div className="items-stat__divider" />
              <div className="items-stat">
                <span className="items-stat__label">STOCK VALUE</span>
                <span className="items-stat__value">
                  Rs {((selectedItem.openingStock ?? 0) * (selectedItem.salePrice ?? 0)).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </span>
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
                  <button type="button" className="items-excel-btn" title="Export to Excel" onClick={handleExportItems}>
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
                {([] as Array<{ invoice: string; dot: string; type: string; name: string; date: string; qty: number; price: number; status: string }>).map((tx) => (
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

      {/* ─── Row dots menu (fixed so it escapes overflow containers) ─── */}
      {dotsMenuId && (() => {
        const item = items.find((i) => i.id === dotsMenuId);
        if (!item) return null;
        return (
          <div
            className="items-row__dots-menu"
            style={{ position: "fixed", top: dotsMenuPos.top, left: dotsMenuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="items-row__dots-menu-item" onClick={() => { setDotsMenuId(null); setSelectedItem(item); }}>
              View Details
            </button>
            <button type="button" className="items-row__dots-menu-item" onClick={() => { setDotsMenuId(null); openEditForm(item); }}>
              Edit
            </button>
            <button type="button" className="items-row__dots-menu-item items-row__dots-menu-item--danger" onClick={() => { setDotsMenuId(null); handleDeleteItem(item.id); }}>
              Delete
            </button>
          </div>
        );
      })()}

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
      {showUnitModal && (() => {
        const primaryShort = UNITS.find((u) => u.label === baseUnit)?.short ?? baseUnit;
        const secondaryShort = UNITS.find((u) => u.label === secondaryUnit)?.short ?? secondaryUnit;
        return (
          <div className="items-modal-backdrop" onClick={() => { setShowUnitModal(false); setShowPrimaryPicker(false); setShowSecondaryPicker(false); }}>
            <div className="items-unit-modal" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="items-modal__header">
                <span>Add Item Unit</span>
                <button type="button" className="items-icon-btn" onClick={() => setShowUnitModal(false)}>
                  <CloseIcon />
                </button>
              </div>

              {/* Body */}
              <div className="items-unit-modal__body">
                {/* Primary Unit */}
                <p className="items-unit-label">Primary Unit</p>
                <button
                  type="button"
                  className={`items-unit-dropdown${showPrimaryPicker ? " items-unit-dropdown--open" : ""}`}
                  onClick={() => { setShowPrimaryPicker((v) => !v); setShowSecondaryPicker(false); }}
                >
                  <span className={baseUnit === "None" ? "items-unit-dropdown__placeholder" : "items-unit-dropdown__value"}>
                    {baseUnit !== "None" ? `${baseUnit}  ·  ${primaryShort}` : "Select Primary Unit"}
                  </span>
                  <span className="items-unit-chevron">{showPrimaryPicker ? "▲" : "▼"}</span>
                </button>
                {showPrimaryPicker && (
                  <div className="items-unit-picker">
                    {UNITS.map((u) => (
                      <button
                        key={u.label}
                        type="button"
                        className={`items-unit-picker__row${baseUnit === u.label ? " items-unit-picker__row--active" : ""}`}
                        onClick={() => { setBaseUnit(u.label); setShowPrimaryPicker(false); }}
                      >
                        <span className="items-unit-picker__name">{u.label}</span>
                        <span className="items-unit-picker__short">{u.short}</span>
                        {baseUnit === u.label && <span className="items-unit-picker__check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Secondary Unit */}
                <p className="items-unit-label" style={{ marginTop: 20 }}>
                  Secondary Unit <span className="items-unit-label__optional">(optional)</span>
                </p>
                <button
                  type="button"
                  className={`items-unit-dropdown${showSecondaryPicker ? " items-unit-dropdown--open" : ""}`}
                  onClick={() => { setShowSecondaryPicker((v) => !v); setShowPrimaryPicker(false); }}
                >
                  <span className={secondaryUnit === "None" ? "items-unit-dropdown__placeholder" : "items-unit-dropdown__value"}>
                    {secondaryUnit !== "None" ? `${secondaryUnit}  ·  ${secondaryShort}` : "Select Secondary Unit"}
                  </span>
                  <span className="items-unit-chevron">{showSecondaryPicker ? "▲" : "▼"}</span>
                </button>
                {showSecondaryPicker && (
                  <div className="items-unit-picker">
                    <button
                      type="button"
                      className={`items-unit-picker__row items-unit-picker__row--none${secondaryUnit === "None" ? " items-unit-picker__row--active" : ""}`}
                      onClick={() => { setSecondaryUnit("None"); setConversionRate(""); setShowSecondaryPicker(false); }}
                    >
                      <span className="items-unit-picker__name" style={{ color: "#94a3b8" }}>None</span>
                      {secondaryUnit === "None" && <span className="items-unit-picker__check">✓</span>}
                    </button>
                    {UNITS.filter((u) => u.label !== baseUnit).map((u) => (
                      <button
                        key={u.label}
                        type="button"
                        className={`items-unit-picker__row${secondaryUnit === u.label ? " items-unit-picker__row--active" : ""}`}
                        onClick={() => { setSecondaryUnit(u.label); setShowSecondaryPicker(false); }}
                      >
                        <span className="items-unit-picker__name">{u.label}</span>
                        <span className="items-unit-picker__short">{u.short}</span>
                        {secondaryUnit === u.label && <span className="items-unit-picker__check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Conversion Rate — only when both chosen */}
                {baseUnit !== "None" && secondaryUnit !== "None" && (
                  <>
                    <p className="items-unit-label" style={{ marginTop: 20 }}>Conversion Rate</p>
                    <div className="items-unit-conv-card">
                      {/* 1 Primary = X Secondary */}
                      <button
                        type="button"
                        className="items-unit-conv-row"
                        onClick={() => setConvDir("p2s")}
                      >
                        <span className={`items-unit-radio${convDir === "p2s" ? " items-unit-radio--active" : ""}`}>
                          {convDir === "p2s" && <span className="items-unit-radio__dot" />}
                        </span>
                        <span className="items-unit-conv-label">1 {primaryShort} =</span>
                        <input
                          type="number"
                          className={`items-unit-conv-input${convDir === "p2s" ? " items-unit-conv-input--active" : ""}`}
                          value={convDir === "p2s" ? conversionRate : ""}
                          onChange={(e) => setConversionRate(e.target.value)}
                          onFocus={() => setConvDir("p2s")}
                          placeholder="0"
                        />
                        <span className="items-unit-conv-label">{secondaryShort}</span>
                      </button>
                      <div className="items-unit-conv-divider" />
                      {/* 1 Secondary = X Primary */}
                      <button
                        type="button"
                        className="items-unit-conv-row"
                        onClick={() => setConvDir("s2p")}
                      >
                        <span className={`items-unit-radio${convDir === "s2p" ? " items-unit-radio--active" : ""}`}>
                          {convDir === "s2p" && <span className="items-unit-radio__dot" />}
                        </span>
                        <span className="items-unit-conv-label">1 {secondaryShort} =</span>
                        <input
                          type="number"
                          className={`items-unit-conv-input${convDir === "s2p" ? " items-unit-conv-input--active" : ""}`}
                          value={convDir === "s2p" ? conversionRate : ""}
                          onChange={(e) => setConversionRate(e.target.value)}
                          onFocus={() => setConvDir("s2p")}
                          placeholder="0"
                        />
                        <span className="items-unit-conv-label">{primaryShort}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="items-unit-modal__footer">
                <button type="button" className="items-unit-cancel-btn" onClick={() => setShowUnitModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`items-unit-save-btn${baseUnit === "None" ? " items-unit-save-btn--disabled" : ""}`}
                  disabled={baseUnit === "None"}
                  onClick={() => setShowUnitModal(false)}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {showImportItemsModal && (
        <ImportItemsModal
          onClose={() => setShowImportItemsModal(false)}
          onImported={() => { setShowImportItemsModal(false); api.getItems().then(setItems).catch(() => {}); }}
        />
      )}
    </div>
  );
}

/* ─── Import Items Modal ─── */
type ItemImportRow = {
  name: string; sku: string; unit: string;
  mrp: string; salePrice: string; purchasePrice: string;
  openingStock: string; minStock: string;
  errors: string[];
};

function ImportItemsModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<"upload" | "review">("upload");
  const [rows, setRows] = useState<ItemImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"valid" | "errors">("valid");

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]!];
      if (!ws) { setRows([]); setStage("review"); return; }
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const parsed: ItemImportRow[] = raw.map((r) => {
        const name = String(r["Item Name*"] ?? r["Item Name"] ?? r["Name"] ?? "").trim();
        const errs: string[] = [];
        if (!name) errs.push("Item Name is required");
        return {
          name,
          sku: String(r["Item Code"] ?? r["SKU"] ?? "").trim(),
          unit: String(r["Unit"] ?? "").trim(),
          mrp: String(r["MRP"] ?? "").trim(),
          salePrice: String(r["Sale Price"] ?? "").trim(),
          purchasePrice: String(r["Purchase Price"] ?? "").trim(),
          openingStock: String(r["Opening Stock"] ?? "").trim(),
          minStock: String(r["Min Stock"] ?? "").trim(),
          errors: errs,
        };
      });
      setRows(parsed);
      setActiveTab(parsed.some(r => r.errors.length) ? "errors" : "valid");
      setStage("review");
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    const valid = rows.filter(r => r.errors.length === 0);
    if (!valid.length) return;
    setImporting(true); setImportError(null);
    let failed = 0;
    for (const r of valid) {
      try {
        await api.createItem({
          name: r.name,
          sku: r.sku || undefined,
          unit: r.unit || undefined,
          mrp: r.mrp ? Number(r.mrp) : undefined,
          salePrice: r.salePrice ? Number(r.salePrice) : undefined,
          purchasePrice: r.purchasePrice ? Number(r.purchasePrice) : undefined,
          openingStock: r.openingStock ? Number(r.openingStock) : undefined,
          minStock: r.minStock ? Number(r.minStock) : undefined,
        });
      } catch { failed++; }
    }
    setImporting(false);
    if (failed > 0) setImportError(`${failed} item(s) could not be imported.`);
    else onImported();
  }

  const validRows = rows.filter(r => r.errors.length === 0);
  const errorRows = rows.filter(r => r.errors.length > 0);
  const display = activeTab === "valid" ? validRows : errorRows;

  if (stage === "upload") return (
    <div className="import-backdrop">
      <div className="import-main">
        <div className="import-topbar">
          <span className="import-topbar__title">Import Items</span>
          <button type="button" className="import-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="import-body">
          <div className="import-left">
            <p className="import-left__hint">Download .xlsx template<br/>to enter item data</p>
            <div className="import-xls-icon">
              <div className="import-xls-icon__shadow"/>
              <div className="import-xls-icon__card"><span className="import-xls-icon__label">xls</span></div>
            </div>
            <button type="button" className="import-download-btn" onClick={() => {
              const headers = ["Item Name*","Item Code","Unit","MRP","Sale Price","Purchase Price","Opening Stock","Min Stock"];
              const ws = XLSX.utils.aoa_to_sheet([headers]);
              ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Items");
              XLSX.writeFile(wb, "items_template.xlsx");
            }}>Download Template</button>
          </div>
          <div className="import-divider"/>
          <div className="import-right">
            <p className="import-right__hint">Upload your filled .xlsx file</p>
            <div
              className={`import-dropzone${dragOver ? " import-dropzone--over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
              onClick={() => inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" accept=".xls,.xlsx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
              <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" width="40" height="40" style={{ marginBottom: 10 }}>
                <path d="M12 4v12M6 10l6-6 6 6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 20h16" strokeLinecap="round"/>
              </svg>
              <p className="import-dropzone__text">Drag and drop or <span className="import-dropzone__link">Click to Browse</span></p>
              <p className="import-dropzone__sub">formatted .xlsx file</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="import-backdrop">
      <div className="import-main">
        <div className="import-topbar">
          <span className="import-topbar__title">Review Items</span>
          <button type="button" className="import-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="import-review-tabs">
          <button type="button" className={`import-review-tab${activeTab === "valid" ? " import-review-tab--active" : ""}`} onClick={() => setActiveTab("valid")}>
            <svg viewBox="0 0 24 24" fill="#16a34a" width="16" height="16"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14.414-4.707-4.707 1.414-1.414L11 13.586l5.293-5.293 1.414 1.414L11 16.414z"/></svg>
            Valid Items : {validRows.length}
          </button>
          <button type="button" className={`import-review-tab${activeTab === "errors" ? " import-review-tab--active import-review-tab--error" : ""}`} onClick={() => setActiveTab("errors")}>
            <svg viewBox="0 0 24 24" fill="#f97316" width="16" height="16"><path d="M12 2L1 21h22L12 2zm0 3.516L21.016 19H2.984L12 5.516zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
            Items with Errors : {errorRows.length}
          </button>
        </div>
        <div className="import-review-body">
          {importError && <div style={{ color: "#dc2626", background: "#fee2e2", padding: "8px 16px", margin: "0 20px 10px", borderRadius: 6, fontSize: 13 }}>{importError}</div>}
          <div className="import-table-wrap">
            <table className="import-table">
              <thead><tr>
                <th style={{ width: 36 }}/>
                <th>Item Name*</th><th>Item Code</th><th>Unit</th>
                <th>MRP</th><th>Sale Price</th><th>Purchase Price</th>
                <th>Opening Stock</th><th>Min Stock</th>
              </tr></thead>
              <tbody>
                {display.map((row, i) => (
                  <tr key={i} className={row.errors.length ? "import-table__row--error" : ""}>
                    <td className="import-table__icon-cell">
                      {row.errors.length > 0
                        ? <svg viewBox="0 0 24 24" fill="#ef4444" width="16" height="16"><path d="M12 2L1 21h22L12 2zm0 3.516L21.016 19H2.984L12 5.516zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
                        : <svg viewBox="0 0 24 24" fill="#16a34a" width="16" height="16"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14.414-4.707-4.707 1.414-1.414L11 13.586l5.293-5.293 1.414 1.414L11 16.414z"/></svg>}
                    </td>
                    <td className={row.errors.some(e => e.includes("Name")) ? "import-table__cell--invalid" : ""}>{row.name}</td>
                    <td>{row.sku}</td><td>{row.unit}</td><td>{row.mrp}</td>
                    <td>{row.salePrice}</td><td>{row.purchasePrice}</td>
                    <td>{row.openingStock}</td><td>{row.minStock}</td>
                  </tr>
                ))}
                {display.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>No {activeTab === "valid" ? "valid" : "error"} rows</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="import-review-footer">
          <button
            type="button"
            className={`import-import-btn${validRows.length > 0 ? " import-import-btn--active" : ""}`}
            disabled={validRows.length === 0 || importing}
            onClick={() => void handleImport()}
          >
            {importing ? "Importing…" : `Import ${validRows.length} Valid Item${validRows.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
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

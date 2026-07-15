import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaxRate = { id: string; name: string; rate: number };

type Settings = {
  // GENERAL
  enablePasscode: boolean;
  currency: string;
  amountDecimals: number;
  tinNumber: boolean;
  stopSaleOnNegativeStock: boolean;
  blockNewItemsFromTxn: boolean;
  blockNewPartiesFromTxn: boolean;
  showEstimate: boolean;
  showProforma: boolean;
  showSaleOrder: boolean;
  showOtherIncome: boolean;
  showFixedAssets: boolean;
  showDeliveryChallan: boolean;
  goodsReturnOnChallan: boolean;
  printAmountInChallan: boolean;
  autoBackup: boolean;
  transactionHistory: boolean;
  // TRANSACTION
  showInvoiceNo: boolean;
  addTimeOnTxn: boolean;
  cashSaleByDefault: boolean;
  billingNameOfParties: boolean;
  customerPoOnTxn: boolean;
  inclusiveExclusiveTax: boolean;
  displayPurchasePrice: boolean;
  showLast5SalePrice: boolean;
  showLast5PurchasePrice: boolean;
  freeItemQuantity: boolean;
  txnWiseTax: boolean;
  txnWiseDiscount: boolean;
  roundOffTotal: boolean;
  roundNearest: string;
  roundTo: string;
  quickEntry: boolean;
  noInvoicePreview: boolean;
  passcodeForEdit: boolean;
  discountDuringPayments: boolean;
  linkPaymentsToInvoices: boolean;
  dueDatesPaymentTerms: boolean;
  showProfitOnSale: boolean;
  termsAndConditions: boolean;
  termsText: string;
  billingType: "lite" | "full";
  prefixSale: string;
  prefixCreditNote: string;
  prefixSaleOrder: string;
  prefixPurchaseOrder: string;
  prefixEstimate: string;
  prefixProforma: string;
  prefixDeliveryChallan: string;
  prefixPaymentIn: string;
  // PRINT
  printTheme: number;
  makeRegularDefault: boolean;
  repeatHeader: boolean;
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  showTinOnSale: boolean;
  paperSize: string;
  orientation: string;
  companyNameSize: string;
  invoiceTextSize: string;
  // TAXES
  taxRates: TaxRate[];
  // TRANSACTION MESSAGE
  sendMsgToParty: boolean;
  webInvoiceLinkInMsg: boolean;
  autoMsgSales: boolean;
  autoMsgPurchase: boolean;
  autoMsgSaleReturn: boolean;
  autoMsgPurchaseReturn: boolean;
  autoMsgPaymentIn: boolean;
  autoMsgPaymentOut: boolean;
  autoMsgSaleOrder: boolean;
  autoMsgPurchaseOrder: boolean;
  autoMsgEstimate: boolean;
  autoMsgProforma: boolean;
  autoMsgDeliveryChallan: boolean;
  autoMsgCancelledInvoice: boolean;
  txnMsgTemplate: string;
  // PARTY
  partyGrouping: boolean;
  shippingAddress: boolean;
  printShippingAddress: boolean;
  managePartyStatus: boolean;
  enablePaymentReminder: boolean;
  paymentReminderDays: number;
  enableLoyaltyPoint: boolean;
  // ITEM
  enableItem: boolean;
  whatDoYouSell: string;
  barcodeScan: boolean;
  stockMaintenance: boolean;
  showLowStockDialog: boolean;
  itemsUnit: boolean;
  defaultUnit: boolean;
  itemCategory: boolean;
  itemDescription: boolean;
  itemWiseTax: boolean;
  itemWiseDiscount: boolean;
  updateSalePriceFromTxn: boolean;
  qtyDecimals: number;
  showMRP: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  enablePasscode: false, currency: "Rs", amountDecimals: 4, tinNumber: true,
  stopSaleOnNegativeStock: false, blockNewItemsFromTxn: false, blockNewPartiesFromTxn: false,
  showEstimate: true, showProforma: true, showSaleOrder: true, showOtherIncome: false,
  showFixedAssets: false, showDeliveryChallan: true, goodsReturnOnChallan: true, printAmountInChallan: false,
  autoBackup: false, transactionHistory: true,
  showInvoiceNo: true, addTimeOnTxn: false, cashSaleByDefault: false, billingNameOfParties: false,
  customerPoOnTxn: false, inclusiveExclusiveTax: true, displayPurchasePrice: true,
  showLast5SalePrice: false, showLast5PurchasePrice: false, freeItemQuantity: false,
  txnWiseTax: true, txnWiseDiscount: true, roundOffTotal: true, roundNearest: "Nearest", roundTo: "1",
  quickEntry: false, noInvoicePreview: false, passcodeForEdit: false, discountDuringPayments: false,
  linkPaymentsToInvoices: true, dueDatesPaymentTerms: false, showProfitOnSale: false,
  termsAndConditions: true, termsText: "Thanks for doing business with us!", billingType: "full",
  prefixSale: "", prefixCreditNote: "", prefixSaleOrder: "", prefixPurchaseOrder: "",
  prefixEstimate: "", prefixProforma: "", prefixDeliveryChallan: "", prefixPaymentIn: "",
  printTheme: 4, makeRegularDefault: true, repeatHeader: true,
  companyName: "Godigi", companyAddress: "", companyEmail: "", companyPhone: "",
  showTinOnSale: false, paperSize: "A4", orientation: "Portrait",
  companyNameSize: "Large", invoiceTextSize: "Medium",
  taxRates: [{ id: "1", name: "Sale tax", rate: 2 }],
  sendMsgToParty: true, webInvoiceLinkInMsg: true,
  autoMsgSales: true, autoMsgPurchase: true, autoMsgSaleReturn: true, autoMsgPurchaseReturn: true,
  autoMsgPaymentIn: true, autoMsgPaymentOut: true, autoMsgSaleOrder: true, autoMsgPurchaseOrder: false,
  autoMsgEstimate: false, autoMsgProforma: false, autoMsgDeliveryChallan: false, autoMsgCancelledInvoice: true,
  txnMsgTemplate: "Thanks for your purchase with us!!\nPurchase Details:\n\nInvoice Amount: {amount}\nReceived: {received}\nBalance: {balance}\nTotal Balance: {total_balance}",
  partyGrouping: true, shippingAddress: true, printShippingAddress: true,
  managePartyStatus: false, enablePaymentReminder: true, paymentReminderDays: 1, enableLoyaltyPoint: true,
  enableItem: true, whatDoYouSell: "Product/Service", barcodeScan: false, stockMaintenance: true,
  showLowStockDialog: true, itemsUnit: true, defaultUnit: false, itemCategory: true,
  itemDescription: false, itemWiseTax: false, itemWiseDiscount: false, updateSalePriceFromTxn: false,
  qtyDecimals: 2, showMRP: true,
};

const STORAGE_KEY = "vyapar_settings";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

type Tab = "general" | "transaction" | "print" | "taxes" | "message" | "party" | "item" | "reminders";

const TABS: { key: Tab; label: string }[] = [
  { key: "general",     label: "GENERAL" },
  { key: "transaction", label: "TRANSACTION" },
  { key: "print",       label: "PRINT" },
  { key: "taxes",       label: "TAXES" },
  { key: "message",     label: "TRANSACTION MESSAGE" },
  { key: "party",       label: "PARTY" },
  { key: "item",        label: "ITEM" },
  { key: "reminders",   label: "SERVICE REMINDERS" },
];

// ─── Main screen ─────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const [tab, setTab] = useState<Tab>("general");
  const [s, setS] = useState<Settings>(loadSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newTaxName, setNewTaxName] = useState("");
  const [newTaxRate, setNewTaxRate] = useState("");
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    const bridge = (window as any).vyapar;
    if (bridge?.getAppVersion) {
      bridge.getAppVersion().then(setAppVersion).catch(() => {});
    }
  }, []);

  function set<K extends keyof Settings>(key: K, val: Settings[K]) {
    setS(prev => {
      const next = { ...prev, [key]: val };
      saveSettings(next);
      return next;
    });
  }

  const saveToBackend = useCallback(async () => {
    setSaving(true);
    try {
      await api.updateTenant({
        companyName: s.companyName || undefined,
        companyEmail: s.companyEmail || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* offline ok */ }
    finally { setSaving(false); }
  }, [s.companyName, s.companyEmail]);

  function Chk({ k, label, sub }: { k: keyof Settings; label: string; sub?: boolean }) {
    return (
      <label className={`st-check${sub ? " st-check--sub" : ""}`}>
        <input type="checkbox" checked={!!s[k]} onChange={e => set(k, e.target.checked as Settings[typeof k])} />
        <span>{label}</span>
      </label>
    );
  }

  function SectionTitle({ title }: { title: string }) {
    return <div className="st-section-title">{title}</div>;
  }

  // ── Tab content ─────────────────────────────────────────────────────────────

  function General() {
    return (
      <div className="st-cols-3">
        {/* Application */}
        <div>
          <SectionTitle title="Application" />
          <Chk k="enablePasscode" label="Enable Passcode" />
          <div className="st-field-row">
            <span className="st-field-label">Business Currency</span>
            <select className="st-select" value={s.currency} onChange={e => set("currency", e.target.value)}>
              {["Rs", "$", "€", "£", "AED"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="st-field-row">
            <span className="st-field-label">Amount (upto Decimal Places)</span>
            <div className="st-stepper">
              <button onClick={() => set("amountDecimals", Math.max(0, s.amountDecimals - 1))}>−</button>
              <span>{s.amountDecimals}</span>
              <button onClick={() => set("amountDecimals", Math.min(6, s.amountDecimals + 1))}>+</button>
            </div>
            <span className="st-hint">e.g. {Number(1).toFixed(s.amountDecimals)}</span>
          </div>
          <Chk k="tinNumber" label="TIN Number" />
          <Chk k="stopSaleOnNegativeStock" label="Stop Sale on Negative Stock" />
          <Chk k="blockNewItemsFromTxn" label="Block New Items from Txn Form" />
          <Chk k="blockNewPartiesFromTxn" label="Block New Parties from Txn Form" />

          <div className="st-spacer" />
          <SectionTitle title="More Transactions" />
          <Chk k="showEstimate" label="Estimate/Quotation" />
          <Chk k="showProforma" label="Proforma Invoice" />
          <Chk k="showSaleOrder" label="Sale/Purchase Order" />
          <Chk k="showOtherIncome" label="Other Income" />
          <Chk k="showFixedAssets" label="Fixed Assets (FA)" />
          <Chk k="showDeliveryChallan" label="Delivery Challan" />
          {s.showDeliveryChallan && <>
            <Chk k="goodsReturnOnChallan" label="Goods return on Delivery Challan" sub />
            <Chk k="printAmountInChallan" label="Print amount in Delivery Challan" sub />
          </>}
        </div>

        {/* Multi Firm */}
        <div>
          <SectionTitle title="Multi Firm" />
          <div className="st-firm-row">
            <input type="radio" defaultChecked readOnly />
            <span className="st-firm-name">{s.companyName || "My Company"}</span>
            <span className="st-firm-badge">DEFAULT</span>
          </div>

          <div className="st-spacer" />
          <SectionTitle title="Stock Transfer Between Stores" />
          <p className="st-desc">Manage all your stores/godowns and transfer stock seamlessly between them.</p>
          <label className="st-check st-check--premium">
            <input type="checkbox" disabled />
            <span>Store management &amp; Stock transfer</span>
            <span className="st-premium-badge">PRO</span>
          </label>

          <div className="st-spacer" />
          <SectionTitle title="Customize Your View" />
          <p className="st-desc">Choose Your Screen Zoom/Scale</p>
          <div className="st-zoom-row">
            <span className="st-zoom-label">70%</span>
            <input type="range" min={70} max={130} step={5} defaultValue={100} className="st-slider" />
            <span className="st-zoom-label">130%</span>
          </div>
        </div>

        {/* Backup & History */}
        <div>
          <SectionTitle title="Backup &amp; History" />
          <Chk k="autoBackup" label="Auto Backup" />
          <p className="st-desc">Last Backup 19/03/2026 | 04:03 AM</p>
          <Chk k="transactionHistory" label="Transaction History" />
        </div>
      </div>
    );
  }

  function Transaction() {
    return (
      <div className="st-cols-3">
        {/* Transaction Header */}
        <div>
          <SectionTitle title="Transaction Header" />
          <Chk k="showInvoiceNo" label="Invoice/Bill No." />
          <Chk k="addTimeOnTxn" label="Add Time on Transactions" />
          <Chk k="cashSaleByDefault" label="Cash Sale by default" />
          <Chk k="billingNameOfParties" label="Billing Name of Parties" />
          <Chk k="customerPoOnTxn" label="Customers P.O. Details on Transactions" />

          <div className="st-spacer" />
          <SectionTitle title="More Transaction Features" />
          <Chk k="quickEntry" label="Quick Entry" />
          <Chk k="noInvoicePreview" label="Do not Show Invoice Preview" />
          <Chk k="passcodeForEdit" label="Enable Passcode for transaction edit/delete" />
          <Chk k="discountDuringPayments" label="Discount During Payments" />
          <Chk k="linkPaymentsToInvoices" label="Link Payments to Invoices" />
          <Chk k="dueDatesPaymentTerms" label="Due Dates and Payment Terms" />
          <Chk k="showProfitOnSale" label="Show Profit while making Sale Invoice" />
          <Chk k="termsAndConditions" label="Terms and Conditions" />
          {s.termsAndConditions && (
            <textarea
              className="st-textarea"
              placeholder="Enter terms and conditions..."
              value={s.termsText}
              onChange={e => set("termsText", e.target.value)}
            />
          )}
        </div>

        {/* Items Table */}
        <div>
          <SectionTitle title="Items Table" />
          <Chk k="inclusiveExclusiveTax" label="Inclusive/Exclusive Tax on Rate(Price/Unit)" />
          <Chk k="displayPurchasePrice" label="Display Purchase Price of Items" />
          <Chk k="showLast5SalePrice" label="Show last 5 Sale Price of Items" />
          <Chk k="showLast5PurchasePrice" label="Show last 5 Purchase Price of Items" />
          <Chk k="freeItemQuantity" label="Free Item Quantity" />

          <div className="st-spacer" />
          <SectionTitle title="Transaction Prefixes" />
          <div className="st-prefix-grid">
            {([
              ["Sale", "prefixSale"], ["Credit Note", "prefixCreditNote"],
              ["Sale Order", "prefixSaleOrder"], ["Purchase Order", "prefixPurchaseOrder"],
              ["Estimate", "prefixEstimate"], ["Proforma Invoice", "prefixProforma"],
              ["Delivery Challan", "prefixDeliveryChallan"], ["Payment In", "prefixPaymentIn"],
            ] as [string, keyof Settings][]).map(([label, key]) => (
              <div key={key} className="st-prefix-field">
                <span className="st-prefix-label">{label}</span>
                <select className="st-prefix-select" value={s[key] as string} onChange={e => set(key, e.target.value)}>
                  <option value="">None</option>
                  {["INV", "EST", "ORD", "PO", "DN", "PI", "CR", "PMT"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Taxes & Totals */}
        <div>
          <SectionTitle title="Taxes, Discount &amp; Totals" />
          <Chk k="txnWiseTax" label="Transaction wise Tax" />
          <Chk k="txnWiseDiscount" label="Transaction wise Discount" />
          <Chk k="roundOffTotal" label="Round Off Total" />
          {s.roundOffTotal && (
            <div className="st-field-row">
              <select className="st-select" value={s.roundNearest} onChange={e => set("roundNearest", e.target.value)}>
                <option>Nearest</option><option>Up</option><option>Down</option>
              </select>
              <span className="st-field-label" style={{ margin: "0 6px" }}>To</span>
              <select className="st-select" value={s.roundTo} onChange={e => set("roundTo", e.target.value)}>
                <option>1</option><option>0.5</option><option>0.1</option>
              </select>
            </div>
          )}

          <div className="st-spacer" />
          <SectionTitle title="Billing Type" />
          <label className="st-radio-row">
            <input type="radio" checked={s.billingType === "lite"} onChange={() => set("billingType", "lite")} />
            <span>Lite Sale</span>
          </label>
          <label className="st-radio-row">
            <input type="radio" checked={s.billingType === "full"} onChange={() => set("billingType", "full")} />
            <span>Full Sale</span>
          </label>
        </div>
      </div>
    );
  }

  function Print() {
    return (
      <div className="st-print-layout">
        <div className="st-print-left">
          {/* Printer type tabs */}
          <div className="st-subtabs">
            <button className="st-subtab st-subtab--active">REGULAR PRINTER</button>
            <button className="st-subtab">THERMAL PRINTER</button>
          </div>
          <div className="st-subtabs" style={{ marginTop: 12 }}>
            <button className="st-subtab st-subtab--active">CHANGE LAYOUT</button>
            <button className="st-subtab">CHANGE COLORS</button>
          </div>

          {/* Themes */}
          <div className="st-themes">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                className={`st-theme${s.printTheme === n ? " st-theme--active" : ""}`}
                onClick={() => set("printTheme", n)}
              >
                <div className="st-theme-preview">
                  <div className="st-theme-line" /><div className="st-theme-line st-theme-line--short" />
                  <div className="st-theme-line" /><div className="st-theme-line st-theme-line--short" />
                </div>
                <span>Theme {n}</span>
              </button>
            ))}
          </div>

          <SectionTitle title="Print Company Info / Header" />
          <Chk k="makeRegularDefault" label="Make Regular Printer Default" />
          <Chk k="repeatHeader" label="Print repeat header in all pages" />

          <div className="st-labeled-field">
            <span className="st-field-label">Company Name</span>
            <input className="st-input" value={s.companyName} onChange={e => set("companyName", e.target.value)} />
          </div>
          <div className="st-labeled-field">
            <span className="st-field-label">Address</span>
            <input className="st-input" placeholder="Enter address" value={s.companyAddress} onChange={e => set("companyAddress", e.target.value)} />
          </div>
          <div className="st-labeled-field">
            <span className="st-field-label">Email</span>
            <input className="st-input" placeholder="Enter email" value={s.companyEmail} onChange={e => set("companyEmail", e.target.value)} />
          </div>
          <div className="st-labeled-field">
            <span className="st-field-label">Phone Number</span>
            <input className="st-input" value={s.companyPhone} onChange={e => set("companyPhone", e.target.value)} />
          </div>
          <Chk k="showTinOnSale" label="TIN on Sale" />

          <div className="st-field-row" style={{ marginTop: 12 }}>
            <span className="st-field-label">Paper Size</span>
            <select className="st-select" value={s.paperSize} onChange={e => set("paperSize", e.target.value)}>
              {["A4", "A5", "Letter", "Legal"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="st-field-row">
            <span className="st-field-label">Orientation</span>
            <select className="st-select" value={s.orientation} onChange={e => set("orientation", e.target.value)}>
              <option>Portrait</option><option>Landscape</option>
            </select>
          </div>
          <div className="st-field-row">
            <span className="st-field-label">Company Name Text Size</span>
            <select className="st-select" value={s.companyNameSize} onChange={e => set("companyNameSize", e.target.value)}>
              {["Small", "Medium", "Large"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="st-field-row">
            <span className="st-field-label">Invoice Text Size</span>
            <select className="st-select" value={s.invoiceTextSize} onChange={e => set("invoiceTextSize", e.target.value)}>
              {["Small", "Medium", "Large"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Invoice preview */}
        <div className="st-invoice-preview">
          <div className="st-inv-header">
            <div>
              <div className="st-inv-company">{s.companyName || "Company Name"}</div>
              {s.companyPhone && <div className="st-inv-sub">Ph. no.: {s.companyPhone}</div>}
            </div>
            <div className="st-inv-logo">Image</div>
          </div>
          <div className="st-inv-title">Sale</div>
          <div className="st-inv-table-header">
            <span>#</span><span>Item name</span><span>Qty</span><span>Price</span><span>Amount</span>
          </div>
          <div className="st-inv-row"><span>1</span><span>Item 1</span><span>2</span><span>Rs 100</span><span>Rs 200</span></div>
          <div className="st-inv-row"><span>2</span><span>Item 2</span><span>1</span><span>Rs 500</span><span>Rs 500</span></div>
          <div className="st-inv-total">
            <span>Total</span><span>Rs 700.00</span>
          </div>
          {s.termsAndConditions && s.termsText && (
            <div className="st-inv-terms">Terms and conditions {s.termsText}</div>
          )}
        </div>
      </div>
    );
  }

  function Taxes() {
    function addTax() {
      if (!newTaxName.trim() || !newTaxRate) return;
      const updated = [...s.taxRates, { id: Date.now().toString(), name: newTaxName.trim(), rate: Number(newTaxRate) }];
      set("taxRates", updated);
      setNewTaxName(""); setNewTaxRate("");
    }
    function deleteTax(id: string) {
      set("taxRates", s.taxRates.filter(t => t.id !== id));
    }
    return (
      <div className="st-cols-2">
        <div>
          <div className="st-section-header-row">
            <SectionTitle title="Tax Rates" />
            <button className="st-icon-add" title="Add tax rate">⊕</button>
          </div>
          {s.taxRates.map(t => (
            <div key={t.id} className="st-tax-row">
              <span className="st-tax-name">{t.name}</span>
              <span className="st-tax-rate">{t.rate}</span>
              <button className="st-tax-btn" title="Edit">✎</button>
              <button className="st-tax-btn st-tax-btn--del" title="Delete" onClick={() => deleteTax(t.id)}>🗑</button>
            </div>
          ))}
          <div className="st-tax-add-row">
            <input className="st-input" placeholder="Tax name" value={newTaxName} onChange={e => setNewTaxName(e.target.value)} style={{ flex: 2 }} />
            <input className="st-input" placeholder="Rate %" type="number" min="0" value={newTaxRate} onChange={e => setNewTaxRate(e.target.value)} style={{ flex: 1 }} />
            <button className="st-btn-primary" onClick={addTax}>Add</button>
          </div>
        </div>
        <div>
          <div className="st-section-header-row">
            <SectionTitle title="Tax Group" />
            <button className="st-icon-add" title="Add tax group">⊕</button>
          </div>
          <p className="st-desc">No tax groups yet. Add a group to combine multiple tax rates.</p>
        </div>
      </div>
    );
  }

  function TxnMessage() {
    const autoMsgItems: [string, keyof Settings][] = [
      ["Sales", "autoMsgSales"], ["Purchase", "autoMsgPurchase"], ["Sales Return", "autoMsgSaleReturn"],
      ["Purchase Return", "autoMsgPurchaseReturn"], ["Payment In", "autoMsgPaymentIn"], ["Payment Out", "autoMsgPaymentOut"],
      ["Sale Order", "autoMsgSaleOrder"], ["Purchase Order", "autoMsgPurchaseOrder"], ["Estimate", "autoMsgEstimate"],
      ["Proforma Invoice", "autoMsgProforma"], ["Delivery Challan", "autoMsgDeliveryChallan"], ["Cancelled Invoice", "autoMsgCancelledInvoice"],
    ];
    return (
      <div className="st-msg-layout">
        <div className="st-msg-left">
          <SectionTitle title="Select Message Type:" />
          <div className="st-whatsapp-row">
            <span className="st-whatsapp-icon">💬</span>
            <span>Send via Personal WhatsApp</span>
            <button className="st-btn-outline">Login</button>
          </div>

          <div className="st-spacer" />
          <SectionTitle title="Message Recipient Settings:" />
          <Chk k="sendMsgToParty" label="Send Message to Party" />
          <label className="st-check st-check--premium">
            <input type="checkbox" disabled />
            <span>Send Transaction Update Message</span>
            <span className="st-premium-badge">PRO</span>
          </label>
          <label className="st-check st-check--premium">
            <input type="checkbox" disabled />
            <span>Send Message Copy to Self</span>
            <span className="st-premium-badge">PRO</span>
          </label>

          <div className="st-spacer" />
          <SectionTitle title="Message Content:" />
          <Chk k="webInvoiceLinkInMsg" label="Web invoice link in Message" />

          <div className="st-spacer" />
          <SectionTitle title="Send Automatic Message for:" />
          <div className="st-auto-msg-grid">
            {autoMsgItems.map(([label, key]) => (
              <label key={key} className="st-check">
                <input type="checkbox" checked={!!s[key]} onChange={e => set(key, e.target.checked as Settings[typeof key])} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="st-msg-right">
          <div className="st-field-row">
            <span className="st-field-label">Transaction Type :</span>
            <select className="st-select">
              <option>Sales Transaction</option><option>Purchase Transaction</option>
            </select>
          </div>
          <SectionTitle title="Edit Message" />
          <textarea
            className="st-msg-editor"
            value={s.txnMsgTemplate}
            onChange={e => set("txnMsgTemplate", e.target.value)}
            rows={8}
          />
          <div className="st-spacer" />
          <SectionTitle title="Message Preview" />
          <div className="st-msg-preview">
            <div className="st-msg-preview-attach">🔗 Transaction Image Attached</div>
            <div className="st-msg-preview-body">{s.txnMsgTemplate}</div>
          </div>
        </div>
      </div>
    );
  }

  function Party() {
    return (
      <div className="st-cols-3">
        <div>
          <SectionTitle title="Party Settings" />
          <Chk k="partyGrouping" label="Party Grouping" />
          <Chk k="shippingAddress" label="Shipping Address" />
          <Chk k="printShippingAddress" label="Print Shipping Address" />
          <Chk k="managePartyStatus" label="Manage Party Status" />
          <Chk k="enablePaymentReminder" label="Enable Payment Reminder" />
          {s.enablePaymentReminder && (
            <div className="st-field-row">
              <span className="st-field-label">Remind me for payment due in</span>
              <div className="st-stepper">
                <button onClick={() => set("paymentReminderDays", Math.max(1, s.paymentReminderDays - 1))}>−</button>
                <span>{s.paymentReminderDays}</span>
                <button onClick={() => set("paymentReminderDays", s.paymentReminderDays + 1)}>+</button>
              </div>
              <span className="st-hint">(days)</span>
            </div>
          )}
        </div>
        <div>
          <SectionTitle title="Additional fields" />
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="st-additional-field">
              <input type="checkbox" />
              <input className="st-input" placeholder={`Additional Field ${n}`} />
              <label className="st-toggle-row">
                <span className="st-toggle-label">Show In Print</span>
                <div className="st-toggle" />
              </label>
            </div>
          ))}
        </div>
        <div>
          <SectionTitle title="Enable Loyalty Point" />
          <label className="st-check st-check--premium">
            <input type="checkbox" checked={s.enableLoyaltyPoint} onChange={e => set("enableLoyaltyPoint", e.target.checked)} />
            <span>Enable Loyalty Point</span>
            <span className="st-premium-badge">PRO</span>
          </label>
        </div>
      </div>
    );
  }

  function Item() {
    return (
      <div className="st-cols-3">
        <div>
          <SectionTitle title="Item Settings" />
          <Chk k="enableItem" label="Enable Item" />
          <div className="st-field-row">
            <span className="st-field-label">What do you sell?</span>
            <select className="st-select" value={s.whatDoYouSell} onChange={e => set("whatDoYouSell", e.target.value)}>
              <option>Product/Service</option><option>Product Only</option><option>Service Only</option>
            </select>
          </div>
          <Chk k="barcodeScan" label="Barcode Scan" />
          <Chk k="stockMaintenance" label="Stock Maintenance" />
          <label className="st-check st-check--premium">
            <input type="checkbox" disabled />
            <span>Manufacturing</span>
            <span className="st-locked-badge">🔒 Locked</span>
          </label>
          <Chk k="showLowStockDialog" label="Show Low Stock Dialog" />
          <Chk k="itemsUnit" label="Items Unit" />
          <Chk k="defaultUnit" label="Default Unit" />
          <Chk k="itemCategory" label="Item Category" />
          <label className="st-check st-check--premium">
            <input type="checkbox" disabled />
            <span>Party Wise Item Rate</span>
            <span className="st-premium-badge">PRO</span>
          </label>
          <Chk k="itemDescription" label="Description" />
          <Chk k="itemWiseTax" label="Item wise Tax" />
          <Chk k="itemWiseDiscount" label="Item wise Discount" />
          <Chk k="updateSalePriceFromTxn" label="Update Sale Price from Transaction" />
          <div className="st-field-row">
            <span className="st-field-label">Quantity (upto Decimal Places)</span>
            <div className="st-stepper">
              <button onClick={() => set("qtyDecimals", Math.max(0, s.qtyDecimals - 1))}>−</button>
              <span>{s.qtyDecimals}</span>
              <button onClick={() => set("qtyDecimals", Math.min(4, s.qtyDecimals + 1))}>+</button>
            </div>
          </div>
          <label className="st-check st-check--premium">
            <input type="checkbox" disabled />
            <span>Wholesale Price</span>
            <span className="st-premium-badge">PRO</span>
          </label>
        </div>
        <div>
          <SectionTitle title="Additional Item Fields" />
          <div className="st-subsection">MRP/Price</div>
          <Chk k="showMRP" label="MRP" />
          <label className="st-check">
            <input type="checkbox" disabled />
            <span>Calculate Sale Price From MRP &amp; Disc.</span>
          </label>
          <label className="st-check">
            <input type="checkbox" disabled />
            <span>Use MRP for Batch Tracking</span>
          </label>
          <div className="st-subsection" style={{ marginTop: 16 }}>Serial No. Tracking</div>
          <label className="st-check">
            <input type="checkbox" />
            <span>Serial No./ IMEI No. etc</span>
          </label>
          <div className="st-subsection" style={{ marginTop: 16 }}>Batch Tracking</div>
          {["Batch No.", "Exp Date", "Mfg Date", "Model No.", "Size"].map(f => (
            <label key={f} className="st-check">
              <input type="checkbox" />
              <span>{f}</span>
            </label>
          ))}
        </div>
        <div>
          <SectionTitle title="Item Custom Fields" />
          <button className="st-btn-outline">Add Custom Fields &gt;</button>
        </div>
      </div>
    );
  }

  function Reminders() {
    return (
      <div className="st-placeholder">
        <span>⏰</span>
        <p>Service Reminders — coming soon</p>
      </div>
    );
  }

  const tabContent: Record<Tab, React.ReactNode> = {
    general: <General />, transaction: <Transaction />, print: <Print />,
    taxes: <Taxes />, message: <TxnMessage />, party: <Party />,
    item: <Item />, reminders: <Reminders />,
  };

  return (
    <div className="st-screen">
      {/* Left sidebar */}
      <aside className="st-sidebar">
        <div className="st-sidebar-header">
          <span className="st-sidebar-title">Settings</span>
          <button className="st-icon-btn">🔍</button>
        </div>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`st-tab${tab === t.key ? " st-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "reminders" && <span className="st-tab-badge">●</span>}
          </button>
        ))}
        {appVersion && <div className="st-sidebar-version">Version {appVersion}</div>}
      </aside>

      {/* Content */}
      <div className="st-content">
        {/* Save bar for company-info-affecting tabs */}
        {(tab === "general" || tab === "print") && (
          <div className="st-save-bar">
            <span className="st-save-hint">Changes to company info are saved automatically. Click Save to sync to server.</span>
            <button className="st-btn-primary" onClick={saveToBackend} disabled={saving}>
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save"}
            </button>
          </div>
        )}
        {tabContent[tab]}
      </div>

      <style>{STYLES}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
.st-screen {
  display: flex;
  height: 100%;
  background: #f8fafc;
  overflow: hidden;
}

/* Sidebar */
.st-sidebar {
  width: 220px;
  min-width: 180px;
  background: #1e2433;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}
.st-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 16px 14px;
  color: #fff;
}
.st-sidebar-title { font-size: 16px; font-weight: 700; }
.st-icon-btn { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; }

.st-tab {
  width: 100%;
  text-align: left;
  padding: 11px 16px;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-left: 3px solid transparent;
}
.st-tab:hover { color: #e2e8f0; background: rgba(255,255,255,0.05); }
.st-tab--active { color: #fff; background: rgba(255,255,255,0.1); border-left-color: #3b82f6; }
.st-tab-badge { color: #3b82f6; font-size: 10px; }
.st-sidebar-version {
  margin-top: auto;
  padding: 12px 16px;
  font-size: 11px;
  color: #64748b;
  border-top: 1px solid rgba(255,255,255,0.08);
}

/* Content */
.st-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
}

.st-save-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 20px;
  font-size: 12.5px;
  color: #1d4ed8;
}

/* Layout grids */
.st-cols-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  align-items: start;
}
.st-cols-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32px;
  align-items: start;
}

/* Section */
.st-section-title {
  font-size: 12.5px;
  font-weight: 700;
  color: #1e293b;
  border-bottom: 1.5px solid #e5e7eb;
  padding-bottom: 6px;
  margin-bottom: 12px;
}
.st-section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
}
.st-spacer { height: 20px; }
.st-desc { font-size: 12px; color: #64748b; margin: 4px 0 10px; line-height: 1.5; }
.st-subsection { font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 8px; }

/* Checkbox */
.st-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
}
.st-check input[type="checkbox"] { accent-color: #3b82f6; width: 14px; height: 14px; }
.st-check--sub { padding-left: 20px; font-size: 12.5px; color: #64748b; }
.st-check--premium { opacity: 0.8; }

/* Radio */
.st-radio-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
}

/* Badges */
.st-premium-badge {
  font-size: 9px;
  font-weight: 700;
  background: #fbbf24;
  color: #fff;
  padding: 2px 5px;
  border-radius: 4px;
  margin-left: 4px;
}
.st-locked-badge {
  font-size: 10px;
  background: #f1f5f9;
  color: #64748b;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
}

/* Field rows */
.st-field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.st-field-label { font-size: 12.5px; color: #374151; }
.st-hint { font-size: 11.5px; color: #94a3b8; }

.st-labeled-field {
  margin-bottom: 12px;
}
.st-labeled-field .st-field-label { display: block; margin-bottom: 4px; }

/* Inputs */
.st-input {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  color: #1e293b;
  outline: none;
  background: #fff;
}
.st-input:focus { border-color: #3b82f6; }
.st-select {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 13px;
  color: #374151;
  background: #fff;
  outline: none;
}
.st-textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12.5px;
  color: #374151;
  outline: none;
  resize: vertical;
  min-height: 60px;
  margin-top: 4px;
  box-sizing: border-box;
}

/* Stepper */
.st-stepper {
  display: flex;
  align-items: center;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  overflow: hidden;
}
.st-stepper button {
  background: #f8fafc;
  border: none;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 16px;
  color: #374151;
}
.st-stepper span {
  padding: 4px 12px;
  font-size: 13px;
  color: #1e293b;
  border-left: 1px solid #e5e7eb;
  border-right: 1px solid #e5e7eb;
}

/* Buttons */
.st-btn-primary {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.st-btn-primary:hover:not(:disabled) { background: #2563eb; }
.st-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.st-btn-outline {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  padding: 7px 14px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}
.st-btn-outline:hover { background: #f8fafc; }
.st-icon-add {
  background: none;
  border: none;
  font-size: 18px;
  color: #3b82f6;
  cursor: pointer;
}

/* Firm row */
.st-firm-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  margin-bottom: 8px;
}
.st-firm-name { flex: 1; font-size: 13.5px; font-weight: 500; color: #1e293b; }
.st-firm-badge {
  font-size: 10px;
  font-weight: 700;
  background: #e5e7eb;
  color: #64748b;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Zoom slider */
.st-zoom-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.st-zoom-label { font-size: 11px; color: #94a3b8; }
.st-slider { flex: 1; accent-color: #3b82f6; }

/* Tax */
.st-tax-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
}
.st-tax-name { flex: 1; font-size: 13px; color: #374151; }
.st-tax-rate { font-size: 13px; color: #374151; min-width: 30px; }
.st-tax-btn { background: none; border: none; cursor: pointer; font-size: 14px; color: #64748b; padding: 2px 6px; }
.st-tax-btn--del { color: #dc2626; }
.st-tax-add-row { display: flex; gap: 8px; align-items: center; margin-top: 12px; }

/* Prefix grid */
.st-prefix-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.st-prefix-field { display: flex; flex-direction: column; gap: 4px; }
.st-prefix-label { font-size: 11px; color: #64748b; }
.st-prefix-select { border: 1px solid #d1d5db; border-radius: 6px; padding: 5px 8px; font-size: 12.5px; color: #374151; background: #fff; }

/* Print layout */
.st-print-layout { display: grid; grid-template-columns: 1fr 420px; gap: 28px; align-items: start; }
.st-print-left { display: flex; flex-direction: column; gap: 0; }
.st-subtabs { display: flex; gap: 0; border-bottom: 2px solid #e5e7eb; }
.st-subtab {
  padding: 8px 16px;
  background: none;
  border: none;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}
.st-subtab--active { color: #dc2626; border-bottom-color: #dc2626; }
.st-themes { display: flex; gap: 12px; margin: 16px 0; }
.st-theme {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 11px;
  color: #64748b;
}
.st-theme--active { border-color: #3b82f6; background: #eff6ff; color: #1d4ed8; }
.st-theme-preview { display: flex; flex-direction: column; gap: 3px; width: 50px; height: 36px; justify-content: center; }
.st-theme-line { height: 3px; background: #d1d5db; border-radius: 2px; }
.st-theme-line--short { width: 60%; }
.st-theme--active .st-theme-line { background: #3b82f6; }

/* Invoice preview */
.st-invoice-preview {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  font-size: 11.5px;
  color: #374151;
}
.st-inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
.st-inv-company { font-size: 14px; font-weight: 700; color: #1e293b; }
.st-inv-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
.st-inv-logo { width: 48px; height: 32px; border: 1px dashed #d1d5db; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #94a3b8; border-radius: 4px; }
.st-inv-title { text-align: center; font-size: 14px; font-weight: 700; color: #2563eb; margin: 8px 0; }
.st-inv-table-header { display: grid; grid-template-columns: 24px 1fr 60px 80px 80px; gap: 6px; background: #3b82f6; color: #fff; padding: 4px 8px; font-size: 10.5px; font-weight: 600; border-radius: 4px; }
.st-inv-row { display: grid; grid-template-columns: 24px 1fr 60px 80px 80px; gap: 6px; padding: 4px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
.st-inv-total { display: flex; justify-content: space-between; padding: 6px 8px; font-weight: 700; font-size: 12px; border-top: 1px solid #e5e7eb; margin-top: 4px; }
.st-inv-terms { font-size: 10px; color: #64748b; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e5e7eb; }

/* Message layout */
.st-msg-layout { display: grid; grid-template-columns: 1fr 380px; gap: 28px; align-items: start; }
.st-msg-left { display: flex; flex-direction: column; }
.st-msg-right { }
.st-whatsapp-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  font-size: 13px;
  color: #15803d;
  margin-bottom: 8px;
}
.st-whatsapp-icon { font-size: 18px; }
.st-auto-msg-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
.st-msg-editor {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 10px;
  font-size: 12.5px;
  color: #374151;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
.st-msg-preview {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 12px;
  font-size: 12.5px;
  color: #374151;
  white-space: pre-line;
}
.st-msg-preview-attach { color: #2563eb; font-size: 12px; margin-bottom: 8px; }
.st-msg-preview-body { color: #374151; line-height: 1.6; }

/* Additional fields */
.st-additional-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.st-additional-field .st-input { flex: 1; }
.st-toggle-row { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.st-toggle-label { font-size: 9px; color: #94a3b8; white-space: nowrap; }
.st-toggle {
  width: 28px; height: 14px;
  background: #d1d5db;
  border-radius: 7px;
}

/* Placeholder */
.st-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  gap: 12px;
  color: #94a3b8;
  font-size: 36px;
}
.st-placeholder p { font-size: 14px; margin: 0; }
`;

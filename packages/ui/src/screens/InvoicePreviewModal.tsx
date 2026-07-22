import { useState } from "react";
import { createPortal } from "react-dom";
import type { Transaction, Party } from "@vyapar/api-client";

/* ── helpers ── */
function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function numToWords(n: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function conv(x: number): string {
    if (x === 0) return "";
    if (x < 20)  return ones[x];
    if (x < 100) return tens[Math.floor(x/10)] + (x%10 ? " "+ones[x%10] : "");
    if (x < 1000) return ones[Math.floor(x/100)]+" Hundred"+(x%100 ? " "+conv(x%100) : "");
    if (x < 100000) return conv(Math.floor(x/1000))+" Thousand"+(x%1000 ? " "+conv(x%1000) : "");
    if (x < 10000000) return conv(Math.floor(x/100000))+" Lakh"+(x%100000 ? " "+conv(x%100000) : "");
    return conv(Math.floor(x/10000000))+" Crore"+(x%10000000 ? " "+conv(x%10000000) : "");
  }
  const int = Math.floor(Math.abs(n));
  const dec = Math.round((Math.abs(n)-int)*100);
  return (conv(int)||"Zero")+" Rupees"+(dec>0 ? " and "+conv(dec)+" Paise" : "")+" only";
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function isLight(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  return (r*299+g*587+b*114)/1000 > 150;
}

/* ── theme config ── */
type ThemeConfig = {
  headerBand: boolean; colorTitle: boolean; colorTableHead: boolean;
  colorSectionHead: boolean; logoSide: "left"|"right"; thermal: boolean; twoColMeta: boolean;
};
const THEME_MAP: Record<string, ThemeConfig> = {
  "Classic":          { headerBand:false, colorTitle:false, colorTableHead:false, colorSectionHead:false, logoSide:"left",  thermal:false, twoColMeta:true  },
  "Tax Theme 2":      { headerBand:true,  colorTitle:true,  colorTableHead:true,  colorSectionHead:true,  logoSide:"left",  thermal:false, twoColMeta:true  },
  "Tax Theme 4":      { headerBand:true,  colorTitle:false, colorTableHead:true,  colorSectionHead:false, logoSide:"left",  thermal:false, twoColMeta:true  },
  "Tax Theme 5":      { headerBand:false, colorTitle:true,  colorTableHead:true,  colorSectionHead:true,  logoSide:"right", thermal:false, twoColMeta:false },
  "Tax Theme 6":      { headerBand:false, colorTitle:false, colorTableHead:true,  colorSectionHead:false, logoSide:"left",  thermal:false, twoColMeta:true  },
  "Theme 1":          { headerBand:true,  colorTitle:true,  colorTableHead:true,  colorSectionHead:false, logoSide:"left",  thermal:false, twoColMeta:true  },
  "Theme 2":          { headerBand:true,  colorTitle:false, colorTableHead:true,  colorSectionHead:true,  logoSide:"left",  thermal:false, twoColMeta:true  },
  "Theme 3":          { headerBand:true,  colorTitle:true,  colorTableHead:true,  colorSectionHead:true,  logoSide:"left",  thermal:false, twoColMeta:true  },
  "Theme 4":          { headerBand:true,  colorTitle:true,  colorTableHead:false, colorSectionHead:true,  logoSide:"right", thermal:false, twoColMeta:true  },
  "Thermal Theme 1":  { headerBand:false, colorTitle:false, colorTableHead:false, colorSectionHead:false, logoSide:"left",  thermal:true,  twoColMeta:false },
  "Thermal Theme 2":  { headerBand:false, colorTitle:true,  colorTableHead:false, colorSectionHead:false, logoSide:"left",  thermal:true,  twoColMeta:false },
  "Thermal Theme 3":  { headerBand:true,  colorTitle:false, colorTableHead:true,  colorSectionHead:false, logoSide:"left",  thermal:true,  twoColMeta:false },
  "Thermal Theme 4":  { headerBand:false, colorTitle:false, colorTableHead:false, colorSectionHead:true,  logoSide:"left",  thermal:true,  twoColMeta:false },
  "Thermal Theme 5":  { headerBand:true,  colorTitle:true,  colorTableHead:false, colorSectionHead:true,  logoSide:"left",  thermal:true,  twoColMeta:false },
};

/* Sidebar theme categories — Vintage collapsible, Thermal listed directly */
const COLLAPSIBLE_CATS = [
  { id:"classic", label:"Classic Themes", themes:["Classic"] },
  { id:"vintage", label:"Vintage Themes", themes:["Tax Theme 2","Tax Theme 4","Tax Theme 5","Tax Theme 6","Theme 1","Theme 2","Theme 3","Theme 4"] },
];
const THERMAL_THEMES = ["Thermal Theme 1","Thermal Theme 2","Thermal Theme 3","Thermal Theme 4","Thermal Theme 5"];

const COLOR_SWATCHES = [
  "#a78bfa","#3b82f6","#9ca3af","#78716c","#a3e635",
  "#1d4ed8","#06b6d4","#16a34a","#d97706","#78350f",
  "#7c3aed","#6d28d9","#92400e","#a16207","#9333ea",
  "#db2777","#b45309","#9f1239","#dc2626","#7f1d1d",
  "#f97316","#eab308","#ef4444","#b91c1c","#000000",
  "#fb923c","#fbbf24","#f43f5e","#111827","#ffffff",
];

/* ── types ── */
export type SaleRow = Transaction & { partyName: string };
type Props = { sale: SaleRow; invoiceNumber: number; party?: Party; onClose: () => void };

/* ═══════════════════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════════════════ */
export function InvoicePreviewModal({ sale, invoiceNumber, party, onClose }: Props) {
  const [theme, setTheme]         = useState("Theme 3");
  const [color, setColor]         = useState("#3b82f6");
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({ classic:true });
  const [doNotShow, setDoNotShow] = useState(false);

  const received = sale.total - sale.balance;
  const tc = THEME_MAP[theme] ?? THEME_MAP["Theme 3"];

  return createPortal(
    <div className="ipv-overlay">
      <div className="ipv-root">

        {/* ── Top bar ── */}
        <div className="ipv-topbar">
          <div className="ipv-tab">
            <span className="ipv-tab__label">{sale.partyName}</span>
            <button type="button" className="ipv-tab__x" onClick={onClose}>✕</button>
          </div>
          <button type="button" className="ipv-tab__add">+</button>

          <div className="ipv-topbar__support">
            <span>💬</span>
            <span>WhatsApp Chat Support</span>
            <span className="ipv-support-sep">|</span>
            <span className="ipv-support-phone">(+92) 300 000 0000</span>
            <span className="ipv-support-sep">|</span>
            <span className="ipv-support-link">Get Instant Online Support</span>
          </div>

          <div className="ipv-topbar__right">
            {[
              <svg key="calc" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10" strokeWidth="2.5"/><line x1="12" y1="10" x2="12" y2="10" strokeWidth="2.5"/><line x1="16" y1="10" x2="16" y2="10" strokeWidth="2.5"/><line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.5"/><line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.5"/><line x1="16" y1="14" x2="16" y2="14" strokeWidth="2.5"/><line x1="8" y1="18" x2="16" y2="18" strokeWidth="2.5"/></svg>,
              <svg key="grid" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
              <svg key="settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
            ].map((icon, i) => (
              <button key={i} type="button" className="ipv-topbar__icon">{icon}</button>
            ))}
            <button type="button" className="ipv-topbar__icon ipv-topbar__icon--close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Action bar (below topbar) ── */}
        <div className="ipv-actionbar">
          <label className="ipv-donotshow">
            <input type="checkbox" checked={doNotShow} onChange={(e) => setDoNotShow(e.target.checked)} />
            <span>Do not show invoice preview again</span>
          </label>
          <button type="button" className="ipv-save-close" onClick={onClose}>Save &amp; Close</button>
        </div>

        {/* ── Body ── */}
        <div className="ipv-body">

          {/* ── Left sidebar ── */}
          <aside className="ipv-sidebar">
            <div className="ipv-sidebar__head">Preview</div>
            <div className="ipv-sidebar__subhead">Select Theme</div>

            {/* Collapsible categories */}
            {COLLAPSIBLE_CATS.map((cat) => {
              const isOpen = !collapsed[cat.id];
              return (
                <div key={cat.id} className="ipv-cat">
                  <button
                    type="button"
                    className="ipv-cat__toggle"
                    onClick={() => setCollapsed((p) => ({ ...p, [cat.id]: !p[cat.id] }))}
                  >
                    <span>{cat.label}</span>
                    <svg
                      className={`ipv-cat__arrow${isOpen ? " ipv-cat__arrow--open" : ""}`}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"
                    >
                      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="ipv-cat__items">
                      {cat.themes.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`ipv-theme-btn${theme === t ? " ipv-theme-btn--active" : ""}`}
                          onClick={() => setTheme(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Thermal themes — direct list */}
            {THERMAL_THEMES.map((t) => (
              <button
                key={t}
                type="button"
                className={`ipv-theme-btn${theme === t ? " ipv-theme-btn--active" : ""}`}
                onClick={() => setTheme(t)}
              >
                {t}
              </button>
            ))}

            {/* Color picker */}
            <div className="ipv-sidebar__subhead" style={{ marginTop: 14 }}>Select Color</div>
            <div className="ipv-selected-row">
              <span
                className="ipv-selected-dot"
                style={{ background: color, border: color === "#ffffff" ? "1.5px solid #d1d5db" : "none" }}
              />
              <span className="ipv-selected-lbl">Selected</span>
            </div>
            <div className="ipv-color-grid">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`ipv-swatch${color === c ? " ipv-swatch--on" : ""}`}
                  style={{ background: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: "2px",
                           border: c === "#ffffff" ? "1.5px solid #d1d5db" : "none" }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </aside>

          {/* ── Center: invoice paper ── */}
          <div className="ipv-center">
            <div className={`ipv-paper${tc.thermal ? " ipv-paper--thermal" : ""}`}>
              <InvoicePaper
                tc={tc} color={color} sale={sale} party={party}
                invoiceNumber={invoiceNumber} received={received}
              />
            </div>
          </div>

          {/* ── Right: share ── */}
          <aside className="ipv-share">
            <div className="ipv-share__head">Share Invoice</div>

            <div className="ipv-share__row">
              <button type="button" className="ipv-share-icon-btn">
                <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32" style={{ color:"#25d366" }}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.858L.057 23.522a.5.5 0 0 0 .614.663l5.834-1.53A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a10 10 0 0 1-5.197-1.452l-.372-.22-3.858 1.012 1.03-3.748-.242-.386A10 10 0 1 1 12 22z"/>
                </svg>
                <span>Whatsapp</span>
              </button>
              <button type="button" className="ipv-share-icon-btn">
                <svg viewBox="52 42 88 66" width="32" height="32">
                  <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6z"/>
                  <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15z"/>
                  <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2z"/>
                  <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92z"/>
                  <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2C60.47 39.35 52 43.58 52 51z"/>
                </svg>
                <span>Gmail</span>
              </button>
            </div>

            <div className="ipv-share__divider" />

            <button type="button" className="ipv-action-card">
              <span className="ipv-action-card__icon ipv-action-card__icon--outline">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </span>
              <div>
                <div className="ipv-action-card__lbl">Download</div>
                <div className="ipv-action-card__sub">PDF</div>
              </div>
            </button>

            <button type="button" className="ipv-action-card">
              <span className="ipv-action-card__icon ipv-action-card__icon--outline">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
              </span>
              <div>
                <div className="ipv-action-card__lbl">Print Invoice</div>
                <div className="ipv-action-card__sub">(Thermal)</div>
              </div>
            </button>

            <button type="button" className="ipv-action-card ipv-action-card--primary">
              <span className="ipv-action-card__icon ipv-action-card__icon--filled">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
              </span>
              <div>
                <div className="ipv-action-card__lbl">Print Invoice</div>
                <div className="ipv-action-card__sub">(Normal)</div>
              </div>
            </button>
          </aside>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════
   INVOICE PAPER
═══════════════════════════════════════════════════════════ */
const TXN_TYPE_LABELS: Record<string, string> = {
  sale: "Invoice",
  purchase: "Purchase Bill",
  payment_in: "Payment In",
  payment_out: "Payment Out",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
  expense: "Expense",
  estimate: "Estimate",
  proforma_invoice: "Proforma Invoice",
  sale_order: "Sale Order",
  delivery_challan: "Delivery Challan",
};

function parseNotesItems(notes: string | null | undefined): Array<{ name: string; qty: number; unit: string; rate: number; mrp: number }> {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes);
    // Every transaction-creation path (SaleScreen, DeliveryChallanModal, bulk-import) stores
    // line items as a bare array; the `.items`-wrapped shape is kept as a defensive fallback.
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.items)) return parsed.items;
    return [];
  } catch { return []; }
}

function InvoicePaperHeader({ tc, color, fg, companyName, companyPhone }: {
  tc: ThemeConfig; color: string; fg: string; companyName: string; companyPhone: string;
}) {
  return tc.headerBand ? (
    <div className="sinv__band" style={{ background: color }}>
      <div className="sinv__logo" style={{ color: fg, borderColor: `${fg}50` }}>LOGO</div>
      <div className="sinv__company" style={{ color: fg }}>
        <div className="sinv__company-name">{companyName}</div>
        {companyPhone && <div className="sinv__company-phone">Phone no. : {companyPhone}</div>}
      </div>
    </div>
  ) : (
    <div className="sinv__plain-header">
      <div className="sinv__logo sinv__logo--plain">LOGO</div>
      <div className="sinv__company">
        <div className="sinv__company-name">{companyName}</div>
        {companyPhone && <div className="sinv__company-phone">Phone no. : {companyPhone}</div>}
      </div>
    </div>
  );
}

function InvoicePaper({ tc, color, sale, party, invoiceNumber, received }: {
  tc: ThemeConfig; color: string; sale: SaleRow; party?: Party;
  invoiceNumber: number; received: number;
}) {
  const fg = isLight(color) ? "#111827" : "#ffffff";
  const companyName = "Rootocloud";
  const companyPhone = party?.phone ?? "";
  const partyName    = sale.partyName;
  const partyAddress = party?.billingAddress ?? "";
  const partyPhone   = party?.phone ?? "";
  const invoiceDate  = fmtDate(sale.date);
  const docTitle     = TXN_TYPE_LABELS[sale.type] ?? "Invoice";
  const lineItems    = parseNotesItems(sale.notes);

  /* ── Delivery Challan layout ── */
  if (sale.type === "delivery_challan") {
    const thHdr = tc.colorTableHead ? { background: color, color: fg } : { background: "#f3f4f6", color: "#374151" };
    const secHdr = tc.colorSectionHead ? { background: color, color: fg } : { background: "#f3f4f6", color: "#374151" };
    const totalQty = lineItems.reduce((s, i) => s + i.qty, 0);
    return (
      <div className="sinv">
        <InvoicePaperHeader tc={tc} color={color} fg={fg} companyName={companyName} companyPhone={companyPhone} />
        <div className="sinv__title" style={{ color: tc.colorTitle ? color : "#111827" }}>{docTitle}</div>

        {/* Meta */}
        <div className="sinv__meta">
          <div className="sinv__meta-col">
            <div className="sinv__meta-hdr" style={secHdr}>Delivery Challan For</div>
            <div className="sinv__meta-body">
              <div className="sinv__meta-name">{partyName}</div>
              {partyAddress && <div className="sinv__meta-sub">{partyAddress}</div>}
              {partyPhone && <div className="sinv__meta-sub">Contact No. : {partyPhone}</div>}
            </div>
          </div>
          <div className="sinv__meta-col">
            <div className="sinv__meta-hdr" style={secHdr}>Challan Details</div>
            <div className="sinv__meta-body">
              <div className="sinv__meta-sub">Challan No. : {invoiceNumber}</div>
              <div className="sinv__meta-sub">Date : {invoiceDate}</div>
            </div>
          </div>
        </div>

        {/* Items table — only #, Item name, MRP, Quantity */}
        <table className="sinv__table">
          <thead>
            <tr style={thHdr}>
              {["#", "Item name", "MRP", "Quantity"].map((h) => (
                <th key={h} className="sinv__th" style={{ color: thHdr.color }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.length > 0 ? lineItems.map((item, idx) => (
              <tr key={idx} className="sinv__tr">
                <td className="sinv__td">{idx + 1}</td>
                <td className="sinv__td">{item.name}</td>
                <td className="sinv__td sinv__td--r">{item.mrp ? `Rs ${fmt(item.mrp)}` : "—"}</td>
                <td className="sinv__td sinv__td--r">{item.qty}</td>
              </tr>
            )) : (
              <tr className="sinv__tr">
                <td className="sinv__td">1</td>
                <td className="sinv__td">—</td>
                <td className="sinv__td sinv__td--r">—</td>
                <td className="sinv__td sinv__td--r">1</td>
              </tr>
            )}
            <tr className="sinv__tr sinv__tr--total">
              <td className="sinv__td" colSpan={2}><strong>Total</strong></td>
              <td className="sinv__td" />
              <td className="sinv__td sinv__td--r"><strong>{totalQty || 1}</strong></td>
            </tr>
          </tbody>
        </table>

        {/* Terms */}
        <div style={{ padding: "6px 8px" }}>
          <div className="sinv__sec-hdr" style={secHdr}>Terms and Conditions</div>
          <div className="sinv__terms">Thanks for doing business with us!</div>
        </div>

        {/* Received By / Delivered By */}
        <div style={{ display: "flex", gap: 0, margin: "8px 0" }}>
          {["Received By", "Delivered By"].map((label) => (
            <div key={label} style={{ flex: 1, border: "1px solid #e5e7eb", padding: 8 }}>
              <div className="sinv__sec-hdr" style={{ ...secHdr, marginBottom: 6 }}>{label}</div>
              {["Name:", "Comment:", "Date:", "Signature:"].map((f) => (
                <div key={f} style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>{f}</div>
              ))}
            </div>
          ))}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "flex-end", padding: 8 }}>
            <div style={{ fontSize: 12, color: "#374151" }}>For : {companyName}</div>
            <div style={{ marginTop: 24, fontSize: 11, color: "#6b7280", borderTop: "1px solid #d1d5db", paddingTop: 4 }}>Authorized Signatory</div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Sale Order layout ── */
  if (sale.type === "sale_order") {
    const thHdr = tc.colorTableHead ? { background: color, color: fg } : { background: "#f3f4f6", color: "#374151" };
    const secHdr = tc.colorSectionHead ? { background: color, color: fg } : { background: "#f3f4f6", color: "#374151" };
    const notesData = (() => { try { return JSON.parse(sale.notes ?? "{}"); } catch { return {}; } })();
    const dueDateStr = notesData.dueDate ? fmtDate(new Date(notesData.dueDate).toISOString()) : invoiceDate;
    const totalQty = lineItems.reduce((s, i) => s + i.qty, 0);
    const totalAmt = lineItems.reduce((s, i) => s + i.rate * i.qty, 0) || sale.total;
    const advance = sale.total - sale.balance;
    return (
      <div className="sinv">
        <InvoicePaperHeader tc={tc} color={color} fg={fg} companyName={companyName} companyPhone={companyPhone} />
        <div className="sinv__title" style={{ color: tc.colorTitle ? color : "#111827" }}>{docTitle}</div>

        {/* Meta */}
        <div className="sinv__meta">
          <div className="sinv__meta-col">
            <div className="sinv__meta-hdr" style={secHdr}>Order From</div>
            <div className="sinv__meta-body">
              <div className="sinv__meta-name">{partyName}</div>
              {partyAddress && <div className="sinv__meta-sub">{partyAddress}</div>}
              {partyPhone && <div className="sinv__meta-sub">Contact No. : {partyPhone}</div>}
            </div>
          </div>
          <div className="sinv__meta-col">
            <div className="sinv__meta-hdr" style={secHdr}>Order Details</div>
            <div className="sinv__meta-body">
              <div className="sinv__meta-sub">Order No. : {invoiceNumber}</div>
              <div className="sinv__meta-sub">Date : {invoiceDate}</div>
              <div className="sinv__meta-sub">Due Date : {dueDateStr}</div>
            </div>
          </div>
        </div>

        {/* Items table — #, Item name, MRP, Quantity, Price/Unit, Amount */}
        <table className="sinv__table">
          <thead>
            <tr style={thHdr}>
              {["#", "Item name", "MRP", "Quantity", "Price/ Unit", "Amount"].map((h) => (
                <th key={h} className="sinv__th" style={{ color: thHdr.color }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.length > 0 ? lineItems.map((item, idx) => (
              <tr key={idx} className="sinv__tr">
                <td className="sinv__td">{idx + 1}</td>
                <td className="sinv__td">{item.name}</td>
                <td className="sinv__td sinv__td--r">{item.mrp ? `Rs ${fmt(item.mrp)}` : "—"}</td>
                <td className="sinv__td sinv__td--r">{item.qty}</td>
                <td className="sinv__td sinv__td--r">Rs {fmt(item.rate)}</td>
                <td className="sinv__td sinv__td--r">Rs {fmt(item.rate * item.qty)}</td>
              </tr>
            )) : (
              <tr className="sinv__tr">
                <td className="sinv__td">1</td>
                <td className="sinv__td">—</td>
                <td className="sinv__td sinv__td--r">—</td>
                <td className="sinv__td sinv__td--r">1</td>
                <td className="sinv__td sinv__td--r">Rs {fmt(sale.total)}</td>
                <td className="sinv__td sinv__td--r">Rs {fmt(sale.total)}</td>
              </tr>
            )}
            <tr className="sinv__tr sinv__tr--total">
              <td className="sinv__td" colSpan={2}><strong>Total</strong></td>
              <td className="sinv__td" />
              <td className="sinv__td sinv__td--r"><strong>{totalQty || 1}</strong></td>
              <td className="sinv__td" />
              <td className="sinv__td sinv__td--r"><strong>Rs {fmt(totalAmt)}</strong></td>
            </tr>
          </tbody>
        </table>

        {/* Bottom */}
        <div className="sinv__bottom">
          <div className="sinv__bottom-l">
            <div className="sinv__sec-hdr" style={secHdr}>Order Amount In Words</div>
            <div className="sinv__words">{numToWords(sale.total)}</div>
            <div className="sinv__sec-hdr" style={{ ...secHdr, marginTop: 10 }}>Terms and Conditions</div>
            <div className="sinv__terms">Thanks for doing business with us!</div>
          </div>
          <div className="sinv__bottom-r">
            <div className="sinv__sec-hdr" style={secHdr}>Amounts</div>
            <div className="sinv__amount-row"><span>Sub Total</span><span>Rs {fmt(totalAmt)}</span></div>
            <div className="sinv__amount-row sinv__amount-row--bold"><span>Total</span><span>Rs {fmt(sale.total)}</span></div>
            <div className="sinv__amount-row"><span>Advance</span><span>Rs {fmt(advance)}</span></div>
            <div className="sinv__amount-row"><span>Balance</span><span>Rs {fmt(sale.balance)}</span></div>
          </div>
        </div>

        {/* Signature */}
        <div className="sinv__sign-area">
          <div />
          <div className="sinv__sign">
            <div className="sinv__sign-for">For : {companyName}</div>
            <div className="sinv__sign-lbl">Authorized Signatory</div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Proforma Invoice / Estimate layout ── */
  if (sale.type === "proforma_invoice" || sale.type === "estimate") {
    const thHdr = tc.colorTableHead ? { background: color, color: fg } : { background: "#f3f4f6", color: "#374151" };
    const secHdr = tc.colorSectionHead ? { background: color, color: fg } : { background: "#f3f4f6", color: "#374151" };
    const totalQty = lineItems.reduce((s, i) => s + i.qty, 0);
    const totalAmt = lineItems.reduce((s, i) => s + i.rate * i.qty, 0) || sale.total;
    const forLabel  = sale.type === "proforma_invoice" ? "Proforma Invoice For" : "Estimate For";
    const detLabel  = sale.type === "proforma_invoice" ? "Proforma Invoice Details" : "Estimate Details";
    const noLabel   = sale.type === "proforma_invoice" ? "Proforma Invoice No." : "Estimate No.";
    const wordsLabel = sale.type === "proforma_invoice" ? "Proforma Invoice Amount In Words" : "Estimate Amount In Words";
    return (
      <div className="sinv">
        <InvoicePaperHeader tc={tc} color={color} fg={fg} companyName={companyName} companyPhone={companyPhone} />
        <div className="sinv__title" style={{ color: tc.colorTitle ? color : "#111827" }}>{docTitle}</div>

        {/* Meta */}
        <div className="sinv__meta">
          <div className="sinv__meta-col">
            <div className="sinv__meta-hdr" style={secHdr}>{forLabel}</div>
            <div className="sinv__meta-body">
              <div className="sinv__meta-name">{partyName}</div>
              {partyAddress && <div className="sinv__meta-sub">{partyAddress}</div>}
              {partyPhone && <div className="sinv__meta-sub">Contact No. : {partyPhone}</div>}
            </div>
          </div>
          <div className="sinv__meta-col">
            <div className="sinv__meta-hdr" style={secHdr}>{detLabel}</div>
            <div className="sinv__meta-body">
              <div className="sinv__meta-sub">{noLabel} : {invoiceNumber}</div>
              <div className="sinv__meta-sub">Date : {invoiceDate}</div>
            </div>
          </div>
        </div>

        {/* Items table — #, Item name, MRP, Quantity, Price/Unit, Amount */}
        <table className="sinv__table">
          <thead>
            <tr style={thHdr}>
              {["#", "Item name", "MRP", "Quantity", "Price/ Unit", "Amount"].map((h) => (
                <th key={h} className="sinv__th" style={{ color: thHdr.color }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.length > 0 ? lineItems.map((item, idx) => (
              <tr key={idx} className="sinv__tr">
                <td className="sinv__td">{idx + 1}</td>
                <td className="sinv__td">{item.name}</td>
                <td className="sinv__td sinv__td--r">{item.mrp ? `Rs ${fmt(item.mrp)}` : "—"}</td>
                <td className="sinv__td sinv__td--r">{item.qty}</td>
                <td className="sinv__td sinv__td--r">Rs {fmt(item.rate)}</td>
                <td className="sinv__td sinv__td--r">Rs {fmt(item.rate * item.qty)}</td>
              </tr>
            )) : (
              <tr className="sinv__tr">
                <td className="sinv__td">1</td><td className="sinv__td">—</td>
                <td className="sinv__td sinv__td--r">—</td><td className="sinv__td sinv__td--r">1</td>
                <td className="sinv__td sinv__td--r">Rs {fmt(sale.total)}</td>
                <td className="sinv__td sinv__td--r">Rs {fmt(sale.total)}</td>
              </tr>
            )}
            <tr className="sinv__tr sinv__tr--total">
              <td className="sinv__td" colSpan={2}><strong>Total</strong></td>
              <td className="sinv__td" />
              <td className="sinv__td sinv__td--r"><strong>{totalQty || 1}</strong></td>
              <td className="sinv__td" />
              <td className="sinv__td sinv__td--r"><strong>Rs {fmt(totalAmt)}</strong></td>
            </tr>
          </tbody>
        </table>

        {/* Bottom */}
        <div className="sinv__bottom">
          <div className="sinv__bottom-l">
            <div className="sinv__sec-hdr" style={secHdr}>{wordsLabel}</div>
            <div className="sinv__words">{numToWords(sale.total)}</div>
            <div className="sinv__sec-hdr" style={{ ...secHdr, marginTop: 10 }}>Terms and Conditions</div>
            <div className="sinv__terms">Thanks for doing business with us!</div>
          </div>
          <div className="sinv__bottom-r">
            <div className="sinv__sec-hdr" style={secHdr}>Amounts</div>
            <div className="sinv__amount-row"><span>Sub Total</span><span>Rs {fmt(totalAmt)}</span></div>
            <div className="sinv__amount-row sinv__amount-row--bold"><span>Total</span><span>Rs {fmt(sale.total)}</span></div>
          </div>
        </div>

        {/* Signature */}
        <div className="sinv__sign-area">
          <div />
          <div className="sinv__sign">
            <div className="sinv__sign-for">For : {companyName}</div>
            <div className="sinv__sign-lbl">Authorized Signatory</div>
          </div>
        </div>
      </div>
    );
  }

  if (tc.thermal) return (
    <div className="tinv">
      <div className="tinv__header" style={tc.headerBand ? { background: color, color: fg } : {}}>
        <div className="tinv__company" style={tc.colorTitle && !tc.headerBand ? { color } : {}}>{companyName}</div>
        {companyPhone && <div className="tinv__phone">{companyPhone}</div>}
      </div>
      <div className="tinv__title" style={tc.colorTitle ? { color } : {}}>{docTitle.toUpperCase()}</div>
      <div className="tinv__dashed" />
      <div className="tinv__row"><span>{docTitle} No:</span><strong>#{invoiceNumber}</strong></div>
      <div className="tinv__row"><span>Date:</span><strong>{invoiceDate}</strong></div>
      <div className="tinv__row"><span>Bill To:</span><strong>{partyName}</strong></div>
      {partyPhone && <div className="tinv__row"><span>Phone:</span><span>{partyPhone}</span></div>}
      <div className="tinv__dashed" />
      <table className="tinv__table">
        <thead><tr style={tc.colorTableHead ? { background: color, color: fg } : { borderBottom: "1px solid #e5e7eb" }}>
          <th className="tinv__th">#</th><th className="tinv__th">Item</th>
          <th className="tinv__th tinv__th--r">Qty</th><th className="tinv__th tinv__th--r">Amount</th>
        </tr></thead>
        <tbody>
          {lineItems.length > 0 ? lineItems.map((item, idx) => (
            <tr key={idx}>
              <td className="tinv__td">{idx + 1}</td>
              <td className="tinv__td">{item.name}</td>
              <td className="tinv__td tinv__td--r">{item.qty}</td>
              <td className="tinv__td tinv__td--r">Rs {fmt(item.rate * item.qty)}</td>
            </tr>
          )) : (
            <tr><td className="tinv__td">1</td><td className="tinv__td">Sale</td>
                <td className="tinv__td tinv__td--r">1</td><td className="tinv__td tinv__td--r">Rs {fmt(sale.total)}</td></tr>
          )}
        </tbody>
      </table>
      <div className="tinv__dashed" />
      <div className="tinv__total-row"><span>Sub Total</span><span>Rs {fmt(sale.total)}</span></div>
      <div className="tinv__total-row tinv__total-row--bold"><span>Total</span><span>Rs {fmt(sale.total)}</span></div>
      <div className="tinv__total-row"><span>Received</span><span>Rs {fmt(received)}</span></div>
      <div className="tinv__total-row"><span>Balance</span><span>Rs {fmt(sale.balance)}</span></div>
      <div className="tinv__dashed" />
      <div className="tinv__words">{numToWords(sale.total)}</div>
      <div className="tinv__terms">Thanks for doing business with us!</div>
      <div className="tinv__sign">
        <div>For : {companyName}</div>
        <div className="tinv__sign-lbl">Authorized Signatory</div>
      </div>
    </div>
  );

  /* Standard / Vintage */
  return (
    <div className="sinv">
      {/* Header */}
      <InvoicePaperHeader tc={tc} color={color} fg={fg} companyName={companyName} companyPhone={companyPhone} />

      {/* Title */}
      <div className="sinv__title" style={{ color: tc.colorTitle ? color : "#111827" }}>{docTitle}</div>

      {/* Bill To / Invoice Details */}
      <div className="sinv__meta">
        <div className="sinv__meta-col">
          <div className="sinv__meta-hdr" style={tc.colorSectionHead ? { background: color, color: fg } : {}}>
            Bill To
          </div>
          <div className="sinv__meta-body">
            <div className="sinv__meta-name">{partyName}</div>
            {partyAddress && <div className="sinv__meta-sub">{partyAddress}</div>}
            {partyPhone && <div className="sinv__meta-sub">Contact No. : {partyPhone}</div>}
          </div>
        </div>
        <div className="sinv__meta-col">
          <div className="sinv__meta-hdr" style={tc.colorSectionHead ? { background: color, color: fg } : {}}>
            {docTitle} Details
          </div>
          <div className="sinv__meta-body">
            <div className="sinv__meta-sub">{docTitle} No. : {invoiceNumber}</div>
            <div className="sinv__meta-sub">Date : {invoiceDate}</div>
          </div>
        </div>
      </div>

      {/* Items table */}
      <table className="sinv__table">
        <thead>
          <tr style={tc.colorTableHead ? { background: color } : { background: "#f3f4f6" }}>
            {["#","Item name","MRP","Quantity","Unit","Price/ Unit","Amount"].map((h) => (
              <th key={h} className="sinv__th" style={{ color: tc.colorTableHead ? fg : "#374151" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineItems.length > 0 ? lineItems.map((item, idx) => (
            <tr key={idx} className="sinv__tr">
              <td className="sinv__td">{idx + 1}</td>
              <td className="sinv__td">{item.name}</td>
              <td className="sinv__td sinv__td--r">{item.mrp ? `Rs ${fmt(item.mrp)}` : "—"}</td>
              <td className="sinv__td sinv__td--r">{item.qty}</td>
              <td className="sinv__td">{item.unit !== "NONE" ? item.unit : "—"}</td>
              <td className="sinv__td sinv__td--r">Rs {fmt(item.rate)}</td>
              <td className="sinv__td sinv__td--r">Rs {fmt(item.rate * item.qty)}</td>
            </tr>
          )) : (
            <tr className="sinv__tr">
              <td className="sinv__td">1</td>
              <td className="sinv__td">—</td>
              <td className="sinv__td sinv__td--r">Rs {fmt(sale.total)}</td>
              <td className="sinv__td sinv__td--r">1</td>
              <td className="sinv__td">—</td>
              <td className="sinv__td sinv__td--r">Rs {fmt(sale.total)}</td>
              <td className="sinv__td sinv__td--r">Rs {fmt(sale.total)}</td>
            </tr>
          )}
          <tr className="sinv__tr sinv__tr--total">
            <td className="sinv__td" colSpan={2}><strong>Total</strong></td>
            <td className="sinv__td" />
            <td className="sinv__td sinv__td--r"><strong>{lineItems.reduce((s, i) => s + i.qty, 0) || 1}</strong></td>
            <td className="sinv__td" colSpan={3} />
          </tr>
        </tbody>
      </table>

      {/* Bottom */}
      <div className="sinv__bottom">
        <div className="sinv__bottom-l">
          <div className="sinv__sec-hdr" style={tc.colorSectionHead ? { background: color, color: fg } : {}}>
            Invoice Amount In Words
          </div>
          <div className="sinv__words">{numToWords(sale.total)}</div>
          <div className="sinv__sec-hdr" style={tc.colorSectionHead ? { background: color, color: fg } : { marginTop: 10 }}>
            Terms and Conditions
          </div>
          <div className="sinv__terms">Thanks for doing business with us!</div>
        </div>
        <div className="sinv__bottom-r">
          <div className="sinv__sec-hdr" style={tc.colorSectionHead ? { background: color, color: fg } : {}}>
            Amounts
          </div>
          <div className="sinv__amount-row"><span>Sub Total</span><span>Rs {fmt(sale.total)}</span></div>
          <div className="sinv__amount-row sinv__amount-row--bold"><span>Total</span><span>Rs {fmt(sale.total)}</span></div>
          <div className="sinv__amount-row"><span>Received</span><span>Rs {fmt(received)}</span></div>
          <div className="sinv__amount-row"><span>Balance</span><span>Rs {fmt(sale.balance)}</span></div>
        </div>
      </div>

      {/* Signature */}
      <div className="sinv__sign-area">
        <div />
        <div className="sinv__sign">
          <div className="sinv__sign-for">For : {companyName}</div>
          <div className="sinv__sign-lbl">Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState, type ReactNode } from "react";
import type { LicenseStatus } from "@vyapar/api-client";
import { loadTenant, loadRole } from "../lib/api";

// Keys allowed per role. "owner" / undefined = full access.
const ROLE_ALLOWED: Record<string, string[]> = {
  salesman: [
    "home", "parties", "parties-all", "parties-customers",
    "items",
    "sale", "sale-invoices", "sale-estimate", "sale-proforma",
    "sale-payment-in", "sale-order", "sale-delivery", "sale-return",
    "purchase", "purchase-expense",
    "settings", "plans",
  ],
  biller: [
    "home", "parties", "parties-all", "parties-customers",
    "sale", "sale-invoices", "sale-estimate", "sale-proforma",
    "sale-payment-in", "sale-order", "sale-delivery", "sale-return",
    "purchase", "purchase-expense",
    "cash-bank", "settings", "plans",
  ],
  biller_salesman: [
    "home", "parties", "parties-all", "parties-customers",
    "items",
    "sale", "sale-invoices", "sale-estimate", "sale-proforma",
    "sale-payment-in", "sale-order", "sale-delivery", "sale-return",
    "purchase", "purchase-expense",
    "cash-bank", "settings", "plans",
  ],
  stock_keeper: [
    "home", "items",
    "purchase", "purchase-bills", "purchase-payment-out",
    "purchase-expense", "purchase-order", "purchase-return",
    "settings", "plans",
  ],
  ca_accountant: [
    "home", "parties", "parties-all", "parties-customers", "parties-suppliers",
    "items",
    "sale", "sale-invoices", "sale-estimate", "sale-proforma",
    "sale-payment-in", "sale-order", "sale-delivery", "sale-return",
    "purchase", "purchase-bills", "purchase-payment-out",
    "purchase-expense", "purchase-order", "purchase-return",
    "cash-bank", "grow", "grow-reports", "reports", "settings",
  ],
  ca_accountant_edit: [
    "home", "parties", "parties-all", "parties-customers", "parties-suppliers",
    "items",
    "sale", "sale-invoices", "sale-estimate", "sale-proforma",
    "sale-payment-in", "sale-order", "sale-delivery", "sale-return",
    "purchase", "purchase-bills", "purchase-payment-out",
    "purchase-expense", "purchase-order", "purchase-return",
    "cash-bank", "grow", "grow-reports", "reports", "settings",
  ],
  secondary_admin: [
    "home", "parties", "parties-all", "parties-customers", "parties-suppliers",
    "items",
    "sale", "sale-invoices", "sale-estimate", "sale-proforma",
    "sale-payment-in", "sale-order", "sale-delivery", "sale-return",
    "purchase", "purchase-bills", "purchase-payment-out",
    "purchase-expense", "purchase-order", "purchase-return",
    "cash-bank", "grow", "grow-reports", "reports",
    "utilities", "settings", "plans",
  ],
};
import { ActivateLicenseModal } from "./ActivateLicenseModal";
import { ReviewOrderModal } from "./ReviewOrderModal";
import { HomeScreen } from "./HomeScreen";
import { PartiesScreen } from "./PartiesScreen";
import { ItemsScreen } from "./ItemsScreen";
import { SaleScreen } from "./SaleScreen";
import { PurchaseScreen } from "./PurchaseScreen";
import { PaymentInScreen } from "./PaymentInScreen";
import { SaleTxnScreen } from "./SaleTxnScreen";
import { SyncShareScreen } from "./SyncShareScreen";
import { ReportsScreen } from "./ReportsScreen";
import { CashInHandScreen } from "./CashInHandScreen";
import { LoanAccountsScreen } from "./LoanAccountsScreen";
import {
  HomeIcon,
  PartiesIcon,
  ItemsIcon,
  SaleIcon,
  PurchaseIcon,
  GrowIcon,
  BankIcon,
  ReportsIcon,
  SyncIcon,
  UtilitiesIcon,
  SettingsIcon,
  PlansIcon,
  SearchIcon,
  PlusAction,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  PremiumDiamond,
} from "../components/icons";

type SubAction = "add" | "premium" | "none";
type NavSubItem = { key: string; label: string; action?: SubAction };
type NavItem = {
  type: "item";
  key: string;
  label: string;
  icon: ReactNode;
  action?: "add" | "chevron" | "none";
  children?: NavSubItem[];
};
type NavEntry = NavItem;

const navStructure: NavEntry[] = [
  { type: "item", key: "home",     label: "Home",               icon: <HomeIcon />,     action: "none" },
  {
    type: "item", key: "parties",  label: "Parties",             icon: <PartiesIcon />,  action: "chevron",
    children: [
      { key: "parties-all",       label: "All Parties",           action: "add" },
      { key: "parties-customers", label: "Customers",             action: "add" },
      { key: "parties-suppliers", label: "Suppliers",             action: "add" },
    ],
  },
  { type: "item", key: "items",    label: "Items",               icon: <ItemsIcon />,    action: "add" },
  {
    type: "item", key: "sale",     label: "Sale",                icon: <SaleIcon />,     action: "chevron",
    children: [
      { key: "sale-invoices",    label: "Sale Invoices",           action: "add" },
      { key: "sale-estimate",    label: "Estimate/ Quotation",     action: "add" },
      { key: "sale-proforma",    label: "Proforma Invoice",        action: "add" },
      { key: "sale-payment-in",  label: "Payment-In",             action: "add" },
      { key: "sale-order",       label: "Sale Order",             action: "add" },
      { key: "sale-delivery",    label: "Delivery Challan",       action: "add" },
      { key: "sale-return",      label: "Sale Return/ Credit Note", action: "add" },
      { key: "sale-pos",         label: "Vyapar POS",             action: "premium" },
    ],
  },
  {
    type: "item", key: "purchase", label: "Purchase & Expense",  icon: <PurchaseIcon />, action: "chevron",
    children: [
      { key: "purchase-bills",       label: "Purchase Bills",              action: "add" },
      { key: "purchase-payment-out", label: "Payment-Out",                 action: "add" },
      { key: "purchase-expense",     label: "Expenses",                    action: "add" },
      { key: "purchase-order",       label: "Purchase Order",              action: "add" },
      { key: "purchase-return",      label: "Purchase Return/ Dr. Note",   action: "add" },
    ],
  },
  {
    type: "item", key: "grow",     label: "Grow Your Business",  icon: <GrowIcon />,     action: "chevron",
    children: [
      { key: "grow-reports",   label: "Business Reports",  action: "none" },
      { key: "grow-insights",  label: "Insights",          action: "none" },
    ],
  },
  {
    type: "item", key: "cash",     label: "Cash & Bank",         icon: <BankIcon />,     action: "chevron",
    children: [
      { key: "cash-bank",     label: "Bank Accounts",  action: "add" },
      { key: "cash-in-hand",  label: "Cash In Hand",   action: "add" },
      { key: "cash-cheques",  label: "Cheques",         action: "add" },
      { key: "cash-loans",    label: "Loan Accounts",  action: "add" },
    ],
  },
  { type: "item", key: "reports",   label: "Reports",            icon: <ReportsIcon />,  action: "none" },
  {
    type: "item", key: "sync",      label: "Sync, Share & Backup", icon: <SyncIcon />,   action: "chevron",
    children: [
      { key: "sync-data",   label: "Sync Data",  action: "none" },
      { key: "sync-share",  label: "Share",      action: "none" },
      { key: "sync-backup", label: "Backup",     action: "none" },
    ],
  },
  {
    type: "item", key: "utilities", label: "Utilities",           icon: <UtilitiesIcon />, action: "chevron",
    children: [
      { key: "utilities-tools",    label: "Tools",           action: "none" },
      { key: "utilities-import",   label: "Import Data",     action: "none" },
    ],
  },
  { type: "item", key: "settings",  label: "Settings",           icon: <SettingsIcon />, action: "none" },
  { type: "item", key: "plans",     label: "Plans & Pricing",    icon: <PlansIcon />,    action: "none" },
];

type Props = {
  status: LicenseStatus;
  onLogout: () => void;
  onLicenseActivated: (status: LicenseStatus) => void | Promise<void>;
};

export function Shell({ status, onLogout, onLicenseActivated }: Props) {
  const [active, setActive]     = useState("home");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showReviewOrder, setShowReviewOrder] = useState(false);
  const [showActivate,    setShowActivate]    = useState(false);

  const role = loadRole();
  const allowed = ROLE_ALLOWED[role]; // undefined = owner = full access

  const visibleNav = useMemo(() => {
    if (!allowed) return navStructure;
    return navStructure
      .filter(item => allowed.includes(item.key))
      .map(item => ({
        ...item,
        children: item.children?.filter(sub => allowed.includes(sub.key)),
      }));
  }, [allowed]);

  const tenant     = loadTenant<{ phone?: string }>();
  const phoneLabel = tenant?.phone ?? "Rootocloud";
  const avatarChar = phoneLabel.replace(/\D/g, "").slice(-1) || "R";

  const isLocked = status.state === "trial_expired" || status.state === "license_expired";
  const handleLockedAction = () => setShowReviewOrder(true);

  const trialPct = useMemo(() => {
    if (status.state !== "trial") return 100;
    const used = 7 - status.daysRemaining;
    return Math.min(100, Math.max(0, (used / 7) * 100));
  }, [status]);

  const trialLabel = useMemo(() => {
    if (status.state === "licensed") return "Licensed";
    if (status.state === "trial") return `${status.daysRemaining} days left in trial`;
    return "Trial ended";
  }, [status]);

  const planBadge = status.state === "licensed" ? "Pro" : "Free Trial";

  const activeLabel = useMemo(() => {
    for (const item of visibleNav) {
      if (item.key === active) return item.label;
      if (item.children) {
        const child = item.children.find((c) => c.key === active);
        if (child) return child.label;
      }
    }
    return "Home";
  }, [active]);

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      if (prev.has(key)) return new Set<string>();
      return new Set([key]);
    });
  }

  function handleItemClick(item: NavEntry) {
    if (item.children?.length) {
      const wasExpanded = expanded.has(item.key);
      toggleExpand(item.key);
      if (!wasExpanded) {
        const childKeys = item.children.map((c) => c.key);
        if (!childKeys.includes(active)) {
          setActive(item.children[0].key);
        }
      }
    } else {
      setActive(item.key);
    }
  }

  const screenKey = (() => {
    if (active === "home")                  return "home";
    if (active === "items")                 return "items";
    if (active.startsWith("parties"))       return "parties";
    if (active === "sale-payment-in")        return "payment-in";
    if (active === "sale-estimate" || active === "sale-proforma" || active === "sale-order" || active === "sale-delivery" || active === "sale-return") return "sale-txn";
    if (active.startsWith("sale"))          return "sale";
    if (active.startsWith("purchase"))      return "purchase";
    if (active === "sync-share")            return "sync-share";
    if (active === "reports")               return "reports";
    if (active === "cash-in-hand")          return "cash-in-hand";
    if (active === "cash-loans")            return "loan-accounts";
    return "placeholder";
  })();

  return (
    <div className="app">
      <aside className="sidebar">

        {/* ── Brand ── */}
        <div className="sidebar__brand">
          <span className="sidebar__logo">V</span>
          <div className="sidebar__brand-text">
            <span className="sidebar__app-name">Vyapar PK</span>
            <span className="sidebar__plan-badge">{planBadge}</span>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="nav">
          {visibleNav.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const isExpanded  = expanded.has(item.key);
            const isActive    = !hasChildren && active === item.key;

            return (
              <div key={item.key} className="nav-section">
                <button
                  type="button"
                  className={`nav-item${isActive ? " nav-item--active" : ""}`}
                  onClick={() => handleItemClick(item)}
                >
                  <span className="nav-item__icon">{item.icon}</span>
                  <span className="nav-item__label">{item.label}</span>
                  {item.action === "add" && <PlusAction />}
                  {item.action === "chevron" && (
                    <span className={`nav-item__chevron${isExpanded ? " nav-item__chevron--open" : ""}`}>
                      <ChevronDown />
                    </span>
                  )}
                </button>

                {hasChildren && isExpanded && (
                  <div className="nav-sublist">
                    {item.children!.map((sub) => (
                      <button
                        key={sub.key}
                        type="button"
                        className={`nav-subitem${active === sub.key ? " nav-subitem--active" : ""}`}
                        onClick={() => setActive(sub.key)}
                      >
                        <span className="nav-subitem__label">{sub.label}</span>
                        {sub.action === "add"     && <PlusAction />}
                        {sub.action === "premium" && <PremiumDiamond />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="sidebar__footer">
          {status.state !== "licensed" && (
            <div className="trial-card">
              <div className="trial-card__header">
                <span className="trial-card__icon">⚡</span>
                <span className="trial-card__title">{trialLabel}</span>
              </div>
              <div className="trial-card__bar">
                <div className="trial-card__fill" style={{ width: `${trialPct}%` }} />
              </div>
              <button
                type="button"
                className="premium-btn"
                onClick={() => setShowReviewOrder(true)}
              >
                <span className="premium-btn__badge"><PremiumDiamond /></span>
                <span>Upgrade to Pro</span>
                <ArrowRight />
              </button>
            </div>
          )}

          <div className="sidebar__account">
            <button
              type="button"
              className="workspace"
              onClick={onLogout}
              title="Sign out"
            >
              <span className="workspace__avatar">{avatarChar.toUpperCase()}</span>
              <div className="workspace__info">
                <span className="workspace__name">{phoneLabel}</span>
                <span className="workspace__sub">
                  {allowed
                    ? (role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()))
                    : "Owner · Click to sign out"}
                </span>
              </div>
              <ChevronRight />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        {/* ── Topbar ── */}
        <header className="topbar">
          <div className="topbar__left">
            <span className="topbar__page-name">{activeLabel}</span>
          </div>

          <button type="button" className="topbar__search">
            <SearchIcon />
            <span>Search anything…</span>
            <kbd className="topbar__kbd">⌘K</kbd>
          </button>

          <div className="topbar__actions">
            <button
              type="button"
              className="topbar__btn-sale"
              onClick={() => isLocked && handleLockedAction()}
            >
              <TopbarPlusIcon /> Add Sale
            </button>
            <button
              type="button"
              className="topbar__btn-purchase"
              onClick={() => isLocked && handleLockedAction()}
            >
              <TopbarPlusIcon /> Add Purchase
            </button>
            <div className="topbar__divider" />
            <button type="button" className="topbar__icon-btn" title="Notifications">
              <BellIcon />
            </button>
            <button
              type="button"
              className="topbar__avatar-btn"
              title={`Signed in as ${phoneLabel}`}
              onClick={onLogout}
            >
              {avatarChar.toUpperCase()}
            </button>
          </div>
        </header>

        {/* ── Expired banner ── */}
        {isLocked && (
          <div className="expired-banner">
            <span className="expired-banner__icon">🔒</span>
            <span className="expired-banner__text">
              Your {status.state === "license_expired" ? "license" : "free trial"} has expired.
              Browse-only mode — add or edit is disabled.
            </span>
            <button
              type="button"
              className="expired-banner__btn"
              onClick={() => setShowReviewOrder(true)}
            >
              Upgrade Now →
            </button>
          </div>
        )}

        {/* ── Screen content ── */}
        {screenKey === "home"        && <HomeScreen />}
        {screenKey === "parties"     && <PartiesScreen  isLocked={isLocked} onLockedAction={handleLockedAction} />}
        {screenKey === "items"       && <ItemsScreen    isLocked={isLocked} onLockedAction={handleLockedAction} />}
        {screenKey === "payment-in"  && <PaymentInScreen isLocked={isLocked} onLockedAction={handleLockedAction} />}
        {screenKey === "sale"        && <SaleScreen     isLocked={isLocked} onLockedAction={handleLockedAction} activeKey={active} />}
        {screenKey === "sale-txn"    && <SaleTxnScreen  isLocked={isLocked} onLockedAction={handleLockedAction} activeKey={active} />}
        {screenKey === "purchase"    && <PurchaseScreen isLocked={isLocked} onLockedAction={handleLockedAction} activeKey={active} />}
        {screenKey === "sync-share"  && <SyncShareScreen />}
        {screenKey === "reports"     && <ReportsScreen />}
        {screenKey === "cash-in-hand"  && <CashInHandScreen />}
        {screenKey === "loan-accounts" && <LoanAccountsScreen />}
        {screenKey === "placeholder" && (
          <section className="content">
            <p>{activeLabel} — coming soon.</p>
          </section>
        )}
      </main>

      {showReviewOrder && (
        <ReviewOrderModal
          onClose={() => setShowReviewOrder(false)}
          onProceed={() => { setShowReviewOrder(false); setShowActivate(true); }}
        />
      )}
      {showActivate && (
        <ActivateLicenseModal
          onClose={() => setShowActivate(false)}
          onActivated={async (next) => {
            await onLicenseActivated(next);
            setShowActivate(false);
          }}
        />
      )}
    </div>
  );
}

function TopbarPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

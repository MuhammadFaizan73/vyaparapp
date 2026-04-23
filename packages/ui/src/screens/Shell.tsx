import { useMemo, useState, type ReactNode } from "react";
import type { LicenseStatus } from "@vyapar/api-client";
import { loadTenant } from "../lib/api";
import { ActivateLicenseModal } from "./ActivateLicenseModal";
import { PartiesScreen } from "./PartiesScreen";
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

type Action = "add" | "chevron" | "none";
type NavItem = { key: string; label: string; icon: ReactNode; action?: Action };

const primaryNav: NavItem[] = [
  { key: "home", label: "Home", icon: <HomeIcon />, action: "none" },
  { key: "parties", label: "Parties", icon: <PartiesIcon />, action: "add" },
  { key: "items", label: "Items", icon: <ItemsIcon />, action: "add" },
  { key: "sale", label: "Sale", icon: <SaleIcon />, action: "chevron" },
  { key: "purchase", label: "Purchase & Expense", icon: <PurchaseIcon />, action: "chevron" },
  { key: "grow", label: "Grow Your Business", icon: <GrowIcon />, action: "chevron" },
  { key: "cash", label: "Cash & Bank", icon: <BankIcon />, action: "chevron" },
  { key: "reports", label: "Reports", icon: <ReportsIcon />, action: "none" },
  { key: "sync", label: "Sync, Share & Backup", icon: <SyncIcon />, action: "chevron" },
  { key: "utilities", label: "Utilities", icon: <UtilitiesIcon />, action: "chevron" },
  { key: "settings", label: "Settings", icon: <SettingsIcon />, action: "none" },
  { key: "plans", label: "Plans & Pricing", icon: <PlansIcon />, action: "none" },
];

type Props = {
  status: LicenseStatus;
  onLogout: () => void;
  onLicenseActivated: (status: LicenseStatus) => void | Promise<void>;
};

export function Shell({ status, onLogout, onLicenseActivated }: Props) {
  const [active, setActive] = useState("parties");
  const [showActivate, setShowActivate] = useState(false);
  const tenant = loadTenant<{ phone?: string }>();
  const phoneLabel = tenant?.phone ?? "Rootocloud";
  const avatarChar = phoneLabel.replace(/\D/g, "").slice(-1) || "R";

  const trialPct = useMemo(() => {
    if (status.state !== "trial") return 100;
    const total = 7;
    const used = total - status.daysRemaining;
    return Math.min(100, Math.max(0, (used / total) * 100));
  }, [status]);

  const trialLabel = useMemo(() => {
    if (status.state === "licensed") return "Licensed";
    if (status.state === "trial") return `${status.daysRemaining} days Free Trial left`;
    return "Trial ended";
  }, [status]);

  return (
    <div className="app">
      <aside className="sidebar">
        <button type="button" className="search-pill">
          <SearchIcon />
          <span>Open Anything (CMD+F)</span>
        </button>

        <nav className="nav">
          {primaryNav.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-item${active === item.key ? " nav-item--active" : ""}`}
              onClick={() => setActive(item.key)}
            >
              <span className="nav-item__icon">{item.icon}</span>
              <span className="nav-item__label">{item.label}</span>
              {item.action === "add" && <PlusAction />}
              {item.action === "chevron" && <ChevronDown />}
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          {status.state !== "licensed" && (
            <div className="trial-card">
              <div className="trial-card__title">{trialLabel}</div>
              <div className="trial-card__bar">
                <div className="trial-card__fill" style={{ width: `${trialPct}%` }} />
              </div>
              <button
                type="button"
                className="premium-btn"
                onClick={() => setShowActivate(true)}
              >
                <span className="premium-btn__badge">
                  <PremiumDiamond />
                </span>
                <span>Get Vyapar Premium</span>
                <ArrowRight />
              </button>
            </div>
          )}

          <button type="button" className="workspace" onClick={onLogout} title="Sign out">
            <span className="workspace__avatar">{avatarChar.toUpperCase()}</span>
            <span className="workspace__name">{phoneLabel}</span>
            <ChevronRight />
          </button>
        </div>
      </aside>

      <main className="main">
        {/* Global topbar */}
        <header className="topbar">
          <div className="topbar__search">
            <SearchIcon />
            <span>Search Transactions</span>
          </div>
          <div className="topbar__actions">
            <button type="button" className="topbar__btn-sale">
              <TopbarPlusIcon /> Add Sale
            </button>
            <button type="button" className="topbar__btn-purchase">
              <TopbarPlusIcon /> Add Purchase
            </button>
            <button type="button" className="topbar__icon-btn">
              <TopbarPlusIcon />
            </button>
            <button type="button" className="topbar__icon-btn">
              <MoreIcon />
            </button>
          </div>
        </header>

        {/* Screen content */}
        {active === "parties" && <PartiesScreen />}
        {active !== "parties" && (
          <section className="content">
            <p>{primaryNav.find((n) => n.key === active)?.label} — coming soon.</p>
          </section>
        )}
      </main>

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

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

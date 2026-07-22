import { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import type { Party, Transaction } from "@vyapar/api-client";

type Period = "This Month" | "Last Month" | "This Year";

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(Math.round(n));
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  if (period === "This Month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  if (period === "Last Month") return {
    start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
  };
  return { start: new Date(now.getFullYear(), 0, 1), end: now };
}

function inRange(iso: string, { start, end }: { start: Date; end: Date }) {
  const d = new Date(iso);
  return d >= start && d <= end;
}

function buildChart(txns: Transaction[], period: Period): { labels: string[]; values: number[] } {
  const range = getRange(period);

  if (period === "This Year") {
    const now = new Date();
    const labels = MONTH_SHORT.slice(0, now.getMonth() + 1);
    const values = labels.map((_, m) =>
      txns.filter(t => { const d = new Date(t.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === m; })
          .reduce((s, t) => s + t.total, 0)
    );
    return { labels, values };
  }

  // day-by-day
  const days: Date[] = [];
  const cur = new Date(range.start);
  while (cur <= range.end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  const values = days.map(d =>
    txns.filter(t => {
      const td = new Date(t.date);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate();
    }).reduce((s, t) => s + t.total, 0)
  );
  const step = Math.max(1, Math.floor(days.length / 9));
  const labels = days.map((d, i) => (i % step === 0 || i === days.length - 1) ? `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}` : "");
  return { labels, values };
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function SalesChart({ values, labels }: { values: number[]; labels: string[] }) {
  const W = 800; const H = 280;
  const padL = 52; const padR = 16; const padT = 14; const padB = 34;
  const iW = W - padL - padR; const iH = H - padT - padB;

  const maxVal = Math.max(...values, 1);
  const pts = values.map((v, i) => ({
    x: padL + (values.length === 1 ? iW / 2 : (i / (values.length - 1)) * iW),
    y: padT + iH - (v / maxVal) * iH,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = pts.length > 1
    ? `${linePath} L${pts[pts.length - 1]!.x.toFixed(1)},${(padT + iH).toFixed(1)} L${pts[0]!.x.toFixed(1)},${(padT + iH).toFixed(1)} Z`
    : "";

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {yTicks.map((t) => {
        const y = padT + iH - t * iH;
        return (
          <g key={t}>
            <line x1={padL} x2={padL + iW} y1={y} y2={y} stroke="#f0f0f0" strokeWidth="1" />
            <text x={padL - 7} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize="10.5" fontFamily="inherit">
              {fmtShort(t * maxVal)}
            </text>
          </g>
        );
      })}

      {areaPath && <path d={areaPath} fill="url(#sg)" />}
      {pts.length > 1 && <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map((p, i) => values[i]! > 0 && <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#3b82f6" />)}

      {labels.map((lbl, i) => {
        if (!lbl) return null;
        const x = padL + (values.length === 1 ? iW / 2 : (i / (values.length - 1)) * iW);
        return <text key={i} x={x} y={H - 6} textAnchor="middle" fill="#9ca3af" fontSize="10.5" fontFamily="inherit">{lbl}</text>;
      })}
    </svg>
  );
}

// ── Home Screen ───────────────────────────────────────────────────────────────
export function HomeScreen() {
  const [period, setPeriod] = useState<Period>("This Month");
  const [showPeriod, setShowPeriod] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [sales, setSales] = useState<Transaction[]>([]);
  const [purchases, setPurchases] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => getRange(period), [period]);

  const prevRange = useMemo(() => {
    const now = new Date();
    if (period === "This Month") return getRange("Last Month");
    if (period === "Last Month") return {
      start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      end: new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59),
    };
    return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear() - 1, 11, 31) };
  }, [period]);

  // Bound the fetch to cover the selected period plus its comparison period — still a
  // fixed window, never "every sale/purchase ever" — instead of fetching the whole history
  // just to filter it down to a month or two client-side.
  const fetchFrom = useMemo(
    () => new Date(Math.min(range.start.getTime(), prevRange.start.getTime())).toISOString().slice(0, 10),
    [range, prevRange]
  );
  const fetchTo = useMemo(
    () => new Date(Math.max(range.end.getTime(), prevRange.end.getTime())).toISOString().slice(0, 10),
    [range, prevRange]
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getParties(),
      api.getTransactionsByType("sale", { from: fetchFrom, to: fetchTo }),
      api.getTransactionsByType("purchase", { from: fetchFrom, to: fetchTo }),
    ]).then(([ps, ss, pur]) => {
      setParties(ps);
      setSales(ss);
      setPurchases(pur);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [fetchFrom, fetchTo]);

  const receivable = useMemo(() => {
    const pos = parties.filter(p => p.balance > 0);
    return { total: pos.reduce((s, p) => s + p.balance, 0), count: pos.length };
  }, [parties]);

  const payable = useMemo(() => {
    const neg = parties.filter(p => p.balance < 0);
    return { total: neg.reduce((s, p) => s + Math.abs(p.balance), 0), count: neg.length };
  }, [parties]);

  const periodSales = useMemo(
    () => sales.filter(t => inRange(t.date, range)),
    [sales, range]
  );
  const periodPurchases = useMemo(
    () => purchases.filter(t => inRange(t.date, range)),
    [purchases, range]
  );

  const totalSale = useMemo(() => periodSales.reduce((s, t) => s + t.total, 0), [periodSales]);
  const totalPurchase = useMemo(() => periodPurchases.reduce((s, t) => s + t.total, 0), [periodPurchases]);

  const prevSaleTotal = useMemo(
    () => sales.filter(t => inRange(t.date, prevRange)).reduce((s, t) => s + t.total, 0),
    [sales, prevRange]
  );

  const saleChange = useMemo(() => {
    if (prevSaleTotal === 0 && totalSale === 0) return null;
    if (prevSaleTotal === 0) return { pct: 100, up: true };
    const pct = Math.round(((totalSale - prevSaleTotal) / prevSaleTotal) * 100);
    return { pct: Math.abs(pct), up: pct >= 0 };
  }, [totalSale, prevSaleTotal]);

  const { labels: chartLabels, values: chartValues } = useMemo(
    () => buildChart(periodSales, period),
    [periodSales, period]
  );

  const recentSales = useMemo(() => {
    const partyMap: Record<string, string> = {};
    parties.forEach(p => { partyMap[p.id] = p.name; });
    return [...sales]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
      .map(t => ({ ...t, partyName: partyMap[t.partyId] ?? "Unknown" }));
  }, [sales, parties]);

  const AVATAR_COLORS = ["#dbeafe:#1d4ed8","#dcfce7:#15803d","#fef3c7:#b45309","#ede9fe:#6d28d9","#fce7f3:#be185d","#fff1e6:#c2410c"];
  function avatarStyle(name: string) {
    const [bg, fg] = (AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!).split(":");
    return { background: bg, color: fg };
  }

  return (
    <div className="hs-root">
      {/* Support banner */}
      <div className="hs-banner">
        <span className="hs-banner-sep">|</span>
        <span>WhatsApp Chat Support</span>
        <span style={{ fontSize: 14 }}>📱</span>
        <span className="hs-banner-phone">(+971) 501 759 794</span>
        <span className="hs-banner-sep">|</span>
        <span style={{ fontSize: 14 }}>💬</span>
        <a href="#" className="hs-banner-support">Get Instant Online Support</a>
      </div>

      <div className="hs-body">
        {/* ── Main column ── */}
        <div className="hs-main">

          {/* KPI cards */}
          <div className="hs-kpi-row">
            <div className="hs-kpi-card hs-kpi-card--border-r">
              <div className="hs-kpi-top">
                <span className="hs-kpi-label">Total Receivable</span>
                <div className="hs-kpi-circle hs-kpi-circle--green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                    <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              {loading
                ? <span className="hs-kpi-loading">…</span>
                : <>
                    <span className="hs-kpi-amt">Rs {fmt(receivable.total)}</span>
                    <span className="hs-kpi-sub">
                      {receivable.count === 0 ? "No outstanding receivables" : `From ${receivable.count} ${receivable.count === 1 ? "Party" : "Parties"}`}
                    </span>
                  </>
              }
            </div>

            <div className="hs-kpi-card">
              <div className="hs-kpi-top">
                <span className="hs-kpi-label">Total Payable</span>
                <div className="hs-kpi-circle hs-kpi-circle--red">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                    <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              {loading
                ? <span className="hs-kpi-loading">…</span>
                : <>
                    <span className="hs-kpi-amt">Rs {fmt(payable.total)}</span>
                    <span className="hs-kpi-sub">
                      {payable.count === 0 ? "No outstanding payables" : `From ${payable.count} ${payable.count === 1 ? "Party" : "Parties"}`}
                    </span>
                  </>
              }
            </div>
          </div>

          {/* Sale + Purchase summary row */}
          <div className="hs-metric-row">
            <div className="hs-metric-item hs-metric-item--border-r">
              <span className="hs-metric-label">Sale (period)</span>
              <span className="hs-metric-val">{loading ? "…" : `Rs ${fmt(totalSale)}`}</span>
            </div>
            <div className="hs-metric-item">
              <span className="hs-metric-label">Purchase (period)</span>
              <span className="hs-metric-val">{loading ? "…" : `Rs ${fmt(totalPurchase)}`}</span>
            </div>
            <div className="hs-metric-item hs-metric-item--border-l">
              <span className="hs-metric-label">Transactions</span>
              <span className="hs-metric-val">{loading ? "…" : periodSales.length + periodPurchases.length}</span>
            </div>
            <div className="hs-metric-item hs-metric-item--border-l">
              <span className="hs-metric-label">Parties</span>
              <span className="hs-metric-val">{loading ? "…" : parties.length}</span>
            </div>
          </div>

          {/* Total Sale + Chart */}
          <div className="hs-sale-card">
            <div className="hs-sale-header">
              <div>
                <span className="hs-kpi-label">Sale Chart</span>
                <div className="hs-sale-meta">
                  <span className="hs-sale-amt">{loading ? "…" : `Rs ${fmt(totalSale)}`}</span>
                  {!loading && saleChange && (
                    <span className={`hs-sale-change${saleChange.up ? " hs-sale-change--up" : " hs-sale-change--down"}`}>
                      {saleChange.up ? "▲" : "▼"} {saleChange.pct}% {saleChange.up ? "more" : "less"} than previous period
                    </span>
                  )}
                  {!loading && !saleChange && (
                    <span className="hs-sale-change">No sales recorded yet</span>
                  )}
                </div>
              </div>
              <div className="hs-period-wrap">
                <button type="button" className="hs-period-btn" onClick={() => setShowPeriod(v => !v)}>
                  <span>{period}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {showPeriod && (
                  <div className="hs-period-menu">
                    {(["This Month", "Last Month", "This Year"] as Period[]).map(p => (
                      <button key={p} type="button"
                        className={`hs-period-item${period === p ? " hs-period-item--on" : ""}`}
                        onClick={() => { setPeriod(p); setShowPeriod(false); }}>
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="hs-chart-wrap">
              {loading
                ? <div className="hs-chart-loading">Loading chart…</div>
                : <SalesChart values={chartValues} labels={chartLabels} />
              }
            </div>
          </div>

          {/* Most Used Reports */}
          <div className="hs-reports-card">
            <div className="hs-reports-header">
              <span className="hs-reports-title">Most Used Reports</span>
              <button type="button" className="hs-reports-all">View All</button>
            </div>
            <div className="hs-reports-grid">
              {["Sale Report", "All Transactions", "Daybook Report", "Party Statement"].map(label => (
                <button key={label} type="button" className="hs-report-item">
                  <span>{label}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="hs-right">

          {/* Recent Transactions */}
          <div className="hs-widget">
            <div className="hs-widget-head">
              <span className="hs-widget-title">Recent Sales</span>
              {!loading && <span className="hs-widget-count">{sales.length} total</span>}
            </div>
            {loading ? (
              <p className="hs-widget-empty">Loading…</p>
            ) : recentSales.length === 0 ? (
              <p className="hs-widget-empty">No sales yet. Add your first sale.</p>
            ) : (
              <div className="hs-txn-list">
                {recentSales.map(t => {
                  const style = avatarStyle(t.partyName);
                  const isPaid = t.balance === 0;
                  return (
                    <div key={t.id} className="hs-txn-row">
                      <div className="hs-txn-avatar" style={style}>
                        {t.partyName[0]?.toUpperCase()}
                      </div>
                      <div className="hs-txn-info">
                        <span className="hs-txn-name">{t.partyName}</span>
                        <span className="hs-txn-date">{fmtDate(t.date)}</span>
                      </div>
                      <div className="hs-txn-right">
                        <span className="hs-txn-amt">Rs {fmt(t.total)}</span>
                        <span className={`hs-txn-badge${isPaid ? " hs-txn-badge--paid" : " hs-txn-badge--unpaid"}`}>
                          {isPaid ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Widget placeholder */}
          <button type="button" className="hs-add-widget">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Add Widget of Your Choice
          </button>
        </div>
      </div>
    </div>
  );
}

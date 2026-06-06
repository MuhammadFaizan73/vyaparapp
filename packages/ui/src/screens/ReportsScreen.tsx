import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../lib/api";

// ─── Report list structure ────────────────────────────────────────────────────

type ReportItem = { key: string; label: string; premium?: boolean };
type ReportGroup = { title: string; items: ReportItem[] };

const REPORT_GROUPS: ReportGroup[] = [
  {
    title: "Transaction report",
    items: [
      { key: "sale",           label: "Sale" },
      { key: "purchase",       label: "Purchase" },
      { key: "day-book",       label: "Day book" },
      { key: "all-transactions", label: "All Transactions" },
      { key: "profit-and-loss",  label: "Profit And Loss" },
      { key: "bill-wise-profit", label: "Bill Wise Profit", premium: true },
      { key: "cash-flow",        label: "Cash flow" },
      { key: "trial-balance",    label: "Trial Balance Report", premium: true },
      { key: "balance-sheet",    label: "Balance Sheet",        premium: true },
    ],
  },
  {
    title: "Party report",
    items: [
      { key: "party-statement",            label: "Party Statement" },
      { key: "party-wise-pnl",             label: "Party wise Profit & Loss", premium: true },
      { key: "all-parties",                label: "All parties" },
      { key: "party-report-by-item",       label: "Party Report By Item" },
      { key: "sale-purchase-by-party",     label: "Sale Purchase By Party" },
      { key: "sale-purchase-by-party-group", label: "Sale Purchase By Party Group" },
    ],
  },
  {
    title: "Item/ Stock report",
    items: [
      { key: "stock-summary",              label: "Stock summary" },
      { key: "item-report-by-party",       label: "Item Report By Party" },
      { key: "item-wise-pnl",              label: "Item Wise Profit And Loss" },
      { key: "item-category-pnl",          label: "Item Category Wise Profit And Loss" },
      { key: "low-stock",                  label: "Low Stock Summary" },
      { key: "stock-detail",               label: "Stock Detail" },
      { key: "item-detail",                label: "Item Detail" },
      { key: "sale-purchase-by-item-category", label: "Sale/ Purchase Report By Item Category" },
      { key: "stock-summary-by-category", label: "Stock Summary Report By Item Category" },
      { key: "item-wise-discount",         label: "Item Wise Discount" },
    ],
  },
  {
    title: "Business Status",
    items: [
      { key: "bank-statement",  label: "Bank Statement" },
      { key: "discount-report", label: "Discount Report" },
    ],
  },
  {
    title: "Taxes",
    items: [
      { key: "tax-report",      label: "Tax Report" },
      { key: "tax-rate-report", label: "Tax Rate report" },
    ],
  },
  {
    title: "Expense report",
    items: [
      { key: "expense",          label: "Expense" },
      { key: "expense-category", label: "Expense Category Report" },
      { key: "expense-item",     label: "Expense Item Report" },
    ],
  },
  {
    title: "Sale/ Purchase Order report",
    items: [
      { key: "sale-purchase-orders",      label: "Sale/ Purchase Orders" },
      { key: "sale-purchase-order-items", label: "Sale/ Purchase Order Item" },
    ],
  },
  {
    title: "Loan Accounts",
    items: [{ key: "loan-statement", label: "Loan Statement" }],
  },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function monthStart(d = new Date()): string {
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function monthEnd(d = new Date()): string {
  return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function todayStr(): string { return isoDate(new Date()); }

function rs(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const color = s === "paid" ? "#16a34a" : s === "partial" ? "#d97706" : s === "unpaid" ? "#dc2626" : s === "unused" ? "#9ca3af" : s === "used" ? "#2563eb" : "#6b7280";
  return <span style={{ color, fontWeight: 600, fontSize: 12 }}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReportsScreen() {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [panelSearch, setPanelSearch] = useState("");

  const filteredGroups = useMemo(() => {
    if (!panelSearch) return REPORT_GROUPS;
    const q = panelSearch.toLowerCase();
    return REPORT_GROUPS.map(g => ({
      ...g,
      items: g.items.filter(i => i.label.toLowerCase().includes(q)),
    })).filter(g => g.items.length > 0);
  }, [panelSearch]);

  return (
    <div className="rpt-layout">
      {/* ── Left panel ── */}
      <aside className="rpt-panel">
        <div className="rpt-panel__search">
          <SearchIcon />
          <input
            className="rpt-panel__search-input"
            placeholder="Search Reports…"
            value={panelSearch}
            onChange={e => setPanelSearch(e.target.value)}
          />
        </div>
        <div className="rpt-panel__list">
          {filteredGroups.map(group => (
            <div key={group.title} className="rpt-group">
              <div className="rpt-group__header">{group.title}</div>
              {group.items.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={`rpt-item${activeKey === item.key ? " rpt-item--active" : ""}`}
                  onClick={() => setActiveKey(item.key)}
                >
                  <span className="rpt-item__label">{item.label}</span>
                  {item.premium && <PremiumBadge />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Right content ── */}
      <div className="rpt-main">
        {activeKey ? (
          <ReportContent reportKey={activeKey} />
        ) : (
          <div className="rpt-empty">
            <div className="rpt-empty__icon"><ReportsEmptyIcon /></div>
            <div className="rpt-empty__title">Select a Report</div>
            <div className="rpt-empty__sub">Choose a report from the list on the left to view details.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Report Content Dispatcher ────────────────────────────────────────────────

function ReportContent({ reportKey }: { reportKey: string }) {
  switch (reportKey) {
    case "sale":            return <SaleReport />;
    case "purchase":        return <PurchaseReport />;
    case "day-book":        return <DayBookReport />;
    case "all-transactions": return <AllTransactionsReport />;
    case "profit-and-loss": return <ProfitAndLossReport />;
    case "cash-flow":       return <CashFlowReport />;
    case "party-statement": return <PartyStatementReport />;
    case "all-parties":     return <AllPartiesReport />;
    case "party-report-by-item": return <PartyReportByItemReport />;
    case "sale-purchase-by-party": return <SalePurchaseByPartyReport />;
    case "sale-purchase-by-party-group": return <SalePurchaseByPartyGroupReport />;
    case "stock-summary":   return <StockSummaryReport />;
    case "item-report-by-party": return <ItemReportByPartyReport />;
    case "item-wise-pnl":   return <ItemWisePnlReport />;
    case "item-category-pnl": return <ItemCategoryPnlReport />;
    case "low-stock":       return <LowStockReport />;
    case "stock-detail":    return <StockDetailReport />;
    case "item-detail":     return <ItemDetailReport />;
    case "sale-purchase-by-item-category": return <SalePurchaseByItemCategoryReport />;
    case "stock-summary-by-category": return <StockSummaryByCategoryReport />;
    case "item-wise-discount": return <ItemWiseDiscountReport />;
    case "bank-statement":  return <BankStatementReport />;
    case "discount-report": return <DiscountReport />;
    case "tax-report":      return <TaxReport />;
    case "tax-rate-report": return <TaxRateReport />;
    case "expense":         return <ExpenseReport />;
    case "expense-category": return <ExpenseCategoryReport />;
    case "expense-item":    return <ExpenseItemReport />;
    case "sale-purchase-orders": return <SalePurchaseOrdersReport />;
    case "sale-purchase-order-items": return <SalePurchaseOrderItemsReport />;
    case "loan-statement":  return <LoanStatementReport />;
    default: return <PremiumGate />;
  }
}

// ─── Shared hooks / components ────────────────────────────────────────────────

function useReport(type: string, params: Record<string, string | undefined>) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = type + JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getReport(type, params);
      setData(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error };
}

function ReportWrap({ children, loading, error }: { children: React.ReactNode; loading: boolean; error: string | null }) {
  if (loading) return <div className="rpt-loading">Loading…</div>;
  if (error)   return <div className="rpt-error">{error}</div>;
  return <div className="rpt-body">{children}</div>;
}

function NoData() {
  return <div className="rpt-no-data">No transactions to show</div>;
}

function DateRange({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div className="rpt-filter-row">
      <span className="rpt-filter-label">From</span>
      <input type="date" className="rpt-date-input" value={from} onChange={e => onFrom(e.target.value)} />
      <span className="rpt-filter-label">To</span>
      <input type="date" className="rpt-date-input" value={to} onChange={e => onTo(e.target.value)} />
    </div>
  );
}

// ─── SALE REPORT ──────────────────────────────────────────────────────────────

function useCompanies() {
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    api.getTenant().then((t) => {
      const mainName = t.companyName || t.phone || "My Company";
      const extras = Array.isArray(t.extraCompanies) ? t.extraCompanies : [];
      setCompanies([{ id: "__main__", name: mainName }, ...extras.map((e: any) => ({ id: e.id, name: e.name }))]);
    }).catch(() => {});
  }, []);
  return companies;
}

function SaleReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(monthEnd);
  const [companyTag, setCompanyTag] = useState("");
  const companies = useCompanies();
  const { data, loading, error } = useReport("sale", { from, to, ...(companyTag ? { companyTag } : {}) });

  return (
    <div className="rpt-content">
      <div className="rpt-page-header">
        <h2 className="rpt-page-title">Sale Invoices</h2>
        <button className="rpt-add-btn" type="button">+ Add Sale</button>
      </div>
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      {companies.length > 1 && (
        <div className="nsf-company-chips" style={{ padding: "8px 0 4px" }}>
          <button type="button" className={`nsf-company-chip${!companyTag ? " nsf-company-chip--active" : ""}`} onClick={() => setCompanyTag("")}>All</button>
          {companies.map((c) => (
            <button key={c.id} type="button" className={`nsf-company-chip${companyTag === c.name ? " nsf-company-chip--active" : ""}`} onClick={() => setCompanyTag(companyTag === c.name ? "" : c.name)}>{c.name}</button>
          ))}
        </div>
      )}
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            <div className="rpt-summary-card">
              <div className="rpt-summary-block">
                <div className="rpt-summary-label">Total Sales Amount</div>
                <div className="rpt-summary-value">{rs(data.summary?.totalAmount ?? 0)}</div>
                <div className="rpt-summary-sub">
                  Received: <strong>{rs(data.summary?.received ?? 0)}</strong>
                  &nbsp;|&nbsp;Balance: <strong>{rs(data.summary?.balance ?? 0)}</strong>
                </div>
              </div>
            </div>
            {(!data.transactions?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Date</th><th>Invoice No</th><th>Party Name</th>
                  <th>Transaction</th><th>Payment Type</th>
                  <th className="rpt-num">Amount</th><th className="rpt-num">Balance</th>
                  <th>Status</th>
                </tr></thead>
                <tbody>
                  {data.transactions.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{fmt(r.date)}</td>
                      <td>{r.invoiceNo || "–"}</td>
                      <td>{r.partyName}</td>
                      <td>{txnLabel(r.type)}</td>
                      <td>{r.paymentType}</td>
                      <td className="rpt-num">{rs(r.amount)}</td>
                      <td className="rpt-num">{rs(r.balance)}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── PURCHASE REPORT ──────────────────────────────────────────────────────────

function PurchaseReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(monthEnd);
  const { data, loading, error } = useReport("purchase", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-page-header">
        <h2 className="rpt-page-title">Purchase Bills</h2>
        <button className="rpt-add-btn rpt-add-btn--blue" type="button">+ Add Purchase</button>
      </div>
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {data.summary && (
              <div className="rpt-purchase-summary">
                <div className="rpt-ps-block rpt-ps-block--green">
                  <div className="rpt-ps-label">Paid</div>
                  <div className="rpt-ps-value">{rs(data.summary.paid ?? 0)}</div>
                </div>
                <div className="rpt-ps-plus">+</div>
                <div className="rpt-ps-block rpt-ps-block--red">
                  <div className="rpt-ps-label">Unpaid</div>
                  <div className="rpt-ps-value">- {rs(data.summary.unpaid ?? 0)}</div>
                </div>
                <div className="rpt-ps-eq">=</div>
                <div className="rpt-ps-block rpt-ps-block--amber">
                  <div className="rpt-ps-label">Total</div>
                  <div className="rpt-ps-value">{rs(data.summary.total ?? 0)}</div>
                </div>
              </div>
            )}
            {(!data.transactions?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Date</th><th>Invoice No.</th><th>Party Name</th>
                  <th>Transaction</th><th>Payment Type</th>
                  <th className="rpt-num">Amount</th><th className="rpt-num">Balance Due</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {data.transactions.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{fmt(r.date)}</td><td>{r.invoiceNo || "–"}</td>
                      <td>{r.partyName}</td><td>{txnLabel(r.type)}</td>
                      <td>{r.paymentType}</td>
                      <td className="rpt-num">{r.amount}</td>
                      <td className="rpt-num">{r.balance}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── DAY BOOK ─────────────────────────────────────────────────────────────────

function DayBookReport() {
  const [date, setDate] = useState(todayStr);
  const { data, loading, error } = useReport("day-book", { date });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <span className="rpt-filter-label">Date</span>
        <input type="date" className="rpt-date-input" value={date} onChange={e => setDate(e.target.value)} />
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.transactions?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Name</th><th>Ref No.</th><th>Type</th><th>Payment Type</th>
                  <th className="rpt-num">Total</th><th className="rpt-num">Money In</th>
                  <th className="rpt-num">Money Out</th>
                </tr></thead>
                <tbody>
                  {data.transactions.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.name}</td><td>{r.refNo || "–"}</td>
                      <td>{txnLabel(r.type)}</td><td>{r.paymentType}</td>
                      <td className="rpt-num">{rs(r.total)}</td>
                      <td className="rpt-num rpt-green">{r.moneyIn > 0 ? rs(r.moneyIn) : ""}</td>
                      <td className="rpt-num rpt-red">{r.moneyOut > 0 ? rs(r.moneyOut) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="rpt-footer-bar">
              <span className="rpt-green">Total Money-In: {rs(data.totalMoneyIn ?? 0)}</span>
              <span className="rpt-red">Total Money-Out: {rs(data.totalMoneyOut ?? 0)}</span>
              <span className="rpt-green">Net: {rs((data.totalMoneyIn ?? 0) - (data.totalMoneyOut ?? 0))}</span>
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── ALL TRANSACTIONS ─────────────────────────────────────────────────────────

function AllTransactionsReport() {
  const [from,    setFrom]    = useState(monthStart);
  const [to,      setTo]      = useState(monthEnd);
  const [txnType, setTxnType] = useState("");
  const { data, loading, error } = useReport("all-transactions", { from, to, txnType: txnType || undefined });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <select className="rpt-select" value={txnType} onChange={e => setTxnType(e.target.value)}>
          <option value="">All Transaction</option>
          <option value="sale">Sale</option>
          <option value="purchase">Purchase</option>
          <option value="payment_in">Payment-In</option>
          <option value="payment_out">Payment-Out</option>
          <option value="credit_note">Credit Note</option>
          <option value="debit_note">Debit Note</option>
          <option value="expense">Expense</option>
          <option value="sale_order">Sale Order</option>
          <option value="estimate">Estimate</option>
        </select>
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.transactions?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>#</th><th>Date</th><th>Ref No.</th><th>Party Name</th>
                  <th>Category N...</th><th>Type</th>
                  <th className="rpt-num">Total</th>
                  <th className="rpt-num">Received/...</th>
                  <th className="rpt-num">Balance</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {data.transactions.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{fmt(r.date)}</td>
                      <td>{r.refNo || "–"}</td>
                      <td>{r.partyName}</td>
                      <td>{r.category || "–"}</td>
                      <td>{txnLabel(r.type)}</td>
                      <td className="rpt-num">{rs(r.total)}</td>
                      <td className="rpt-num">{rs(r.received)}</td>
                      <td className="rpt-num">{rs(r.balance)}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── PROFIT AND LOSS ──────────────────────────────────────────────────────────

function ProfitAndLossReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const [view, setView] = useState<"vyapar" | "accounting">("vyapar");
  const { data, loading, error } = useReport("profit-and-loss", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            <div className="rpt-pnl-view-toggle">
              <span className="rpt-filter-label">View :</span>
              {(["vyapar","accounting"] as const).map(v => (
                <label key={v} className="rpt-radio-label">
                  <input type="radio" name="pnl-view" value={v} checked={view === v} onChange={() => setView(v)} />
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </label>
              ))}
            </div>
            {view === "vyapar" ? (
              <div className="rpt-pnl-table">
                <div className="rpt-pnl-header"><span>Particulars</span><span>Amount</span></div>
                <PnlRow label="Sale (+)" value={data.saleTotal} />
                <PnlRow label="Credit Note (-)" value={data.creditNoteTotal} isNeg />
                <PnlRow label="Purchase (-)" value={data.purchaseTotal} isNeg />
                <PnlRow label="Debit Note (+)" value={data.debitNoteTotal} />
                <PnlRow label="Direct Expenses(-)" value={0} isNeg />
                <PnlRow label="Opening Stock (-)" value={data.openingStockValue} isNeg />
                <PnlRow label="Closing Stock (+)" value={data.closingStockValue} />
                <div className="rpt-pnl-divider" />
                <PnlRow label="Gross Profit" value={data.grossProfit} bold green />
                <PnlRow label="Other Income (+)" value={0} />
                <PnlRow label="Indirect Expenses (-)" value={data.expenseTotal} isNeg />
                <div className="rpt-pnl-divider" />
                <PnlRow label="Net Profit" value={data.netProfit} bold green />
              </div>
            ) : (
              <div className="rpt-pnl-accounting">
                <div className="rpt-pnl-section">
                  <div className="rpt-pnl-section-title">Incomes</div>
                  <PnlRow label="  Sale Accounts" value={data.saleTotal} indent />
                  <PnlRow label="  Other Incomes (Direct)" value={0} indent />
                  <PnlRow label="  Other Incomes (Indirect)" value={0} indent />
                </div>
                <div className="rpt-pnl-section">
                  <div className="rpt-pnl-section-title">Expenses</div>
                  <PnlRow label="  Cost of Goods Sold" value={data.purchaseTotal - data.debitNoteTotal + data.openingStockValue - data.closingStockValue} indent />
                  <PnlRow label="    Purchase Accounts" value={data.purchaseTotal} indent />
                  <PnlRow label="    Opening Stock" value={data.openingStockValue} indent />
                  <PnlRow label="    Closing Stock" value={data.closingStockValue} indent green />
                  <PnlRow label="  Direct Expenses" value={0} indent />
                  <PnlRow label="  Indirect Expenses" value={data.expenseTotal} indent />
                </div>
                <div className="rpt-pnl-divider" />
                <PnlRow label="Net Profit (Incomes - Expenses)" value={data.netProfit} bold green />
              </div>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

function PnlRow({ label, value, isNeg, bold, green, indent }: { label: string; value: number; isNeg?: boolean; bold?: boolean; green?: boolean; indent?: boolean }) {
  return (
    <div className={`rpt-pnl-row${bold ? " rpt-pnl-row--bold" : ""}${indent ? " rpt-pnl-row--indent" : ""}`}>
      <span>{label}</span>
      <span className={green || (!isNeg && value > 0) ? "rpt-green" : isNeg ? "rpt-red" : ""}>{rs(value ?? 0)}</span>
    </div>
  );
}

// ─── CASH FLOW ────────────────────────────────────────────────────────────────

function CashFlowReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(monthEnd);
  const { data, loading, error } = useReport("cash-flow", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            <div className="rpt-opening-line">Opening Cash-in-Hand: <strong className="rpt-green">{rs(data.openingCash ?? 0)}</strong></div>
            {(!data.transactions?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Date</th><th>Ref No.</th><th>Name</th><th>Category</th><th>Type</th>
                  <th className="rpt-num">Cash In</th><th className="rpt-num">Cash Out</th>
                  <th className="rpt-num">Running Balance</th>
                </tr></thead>
                <tbody>
                  {data.transactions.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{fmt(r.date)}</td><td>{r.refNo || "–"}</td>
                      <td>{r.name}</td><td>{r.category || "–"}</td>
                      <td>{txnLabel(r.type)}</td>
                      <td className="rpt-num rpt-green">{r.cashIn > 0 ? rs(r.cashIn) : ""}</td>
                      <td className="rpt-num rpt-red">{r.cashOut > 0 ? rs(r.cashOut) : ""}</td>
                      <td className="rpt-num rpt-green">{rs(r.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="rpt-footer-bar">
              <span className="rpt-green">Total Cash-in: {rs(data.totalCashIn ?? 0)}</span>
              <span className="rpt-red">Total Cash-out: {rs(data.totalCashOut ?? 0)}</span>
              <span className="rpt-green">Closing Cash-in-Hand: {rs(data.closingCash ?? 0)}</span>
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── PARTY STATEMENT ──────────────────────────────────────────────────────────

function PartyStatementReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(monthEnd);
  const [view, setView] = useState<"vyapar" | "accounting">("vyapar");
  const { data, loading, error } = useReport("party-statement", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <div className="rpt-pnl-view-toggle">
        <span className="rpt-filter-label">View :</span>
        {(["vyapar","accounting"] as const).map(v => (
          <label key={v} className="rpt-radio-label">
            <input type="radio" name="ps-view" value={v} checked={view === v} onChange={() => setView(v)} />
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </label>
        ))}
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.transactions?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Date</th><th>TXN Type</th><th>Ref No.</th><th>Payment Type</th>
                  <th className="rpt-num">Total</th><th className="rpt-num">Received</th>
                  <th className="rpt-num">TXN Balance</th>
                  <th className="rpt-num">Receivable Balance</th>
                  <th className="rpt-num">Payable Balance</th>
                </tr></thead>
                <tbody>
                  {data.transactions.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{fmt(r.date)}</td><td>{txnLabel(r.type)}</td>
                      <td>{r.refNo || "–"}</td><td>{r.paymentType}</td>
                      <td className="rpt-num">{rs(r.total)}</td>
                      <td className="rpt-num">{rs(r.received)}</td>
                      <td className="rpt-num">{rs(r.txnBalance)}</td>
                      <td className="rpt-num rpt-green">{rs(r.receivableBalance)}</td>
                      <td className="rpt-num rpt-red">{rs(r.payableBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {data.summary && (
              <div className="rpt-party-summary">
                <div className="rpt-ps-grid">
                  <span>Total Sale: {rs(data.summary.totalSale ?? 0)}</span>
                  <span>Total Purchase: {rs(data.summary.totalPurchase ?? 0)}</span>
                  <span>Total Expense: {rs(0)}</span>
                  <span className="rpt-green">Total Receivable: {rs(data.summary.totalReceivable ?? 0)}</span>
                  <span>Total Money-In: {rs(data.summary.totalMoneyIn ?? 0)}</span>
                  <span>Total Money-Out: {rs(data.summary.totalMoneyOut ?? 0)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── ALL PARTIES ──────────────────────────────────────────────────────────────

function AllPartiesReport() {
  const { data, loading, error } = useReport("all-parties", {});

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.parties?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>#</th><th>Party Name</th><th>Email</th><th>Phone No.</th>
                  <th className="rpt-num">Receivable Balance</th>
                  <th className="rpt-num">Payable Balance</th>
                  <th className="rpt-num">Credit Limit</th>
                </tr></thead>
                <tbody>
                  {data.parties.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>
                        <input type="checkbox" defaultChecked style={{ marginRight: 8 }} />
                        {i + 1}
                      </td>
                      <td>{r.name}</td><td>{r.email || "---"}</td>
                      <td>{r.phone || "---"}</td>
                      <td className="rpt-num rpt-green">{r.receivableBalance > 0 ? rs(r.receivableBalance) : "---"}</td>
                      <td className="rpt-num rpt-red">{r.payableBalance > 0 ? rs(r.payableBalance) : "---"}</td>
                      <td className="rpt-num">{r.creditLimit ? rs(r.creditLimit) : "---"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="rpt-footer-bar">
              <span className="rpt-green">Total Receivable: {rs(data.totalReceivable ?? 0)}</span>
              <span className="rpt-red">Total Payable: {rs(data.totalPayable ?? 0)}</span>
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── PARTY REPORT BY ITEM ─────────────────────────────────────────────────────

function PartyReportByItemReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(monthEnd);
  const { data, loading, error } = useReport("party-report-by-item", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.parties?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>#</th><th>Party Name</th>
                  <th className="rpt-num">Sale Quantity</th><th className="rpt-num">Sale Amount</th>
                  <th className="rpt-num">Purchase Quantity</th><th className="rpt-num">Purchase Amount</th>
                </tr></thead>
                <tbody>
                  {data.parties.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{i + 1}</td><td style={{ fontWeight: i === 0 ? 700 : 400 }}>{r.partyName}</td>
                      <td className="rpt-num">{r.saleQty}</td>
                      <td className="rpt-num rpt-green">{rs(r.saleAmount)}</td>
                      <td className="rpt-num">{r.purchaseQty}</td>
                      <td className="rpt-num rpt-red">{rs(r.purchaseAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                {data.total && (
                  <tfoot><tr>
                    <td colSpan={2}>Total</td>
                    <td className="rpt-num">{data.total.saleQty}</td>
                    <td className="rpt-num rpt-green">{rs(data.total.saleAmount)}</td>
                    <td className="rpt-num">{data.total.purchaseQty}</td>
                    <td className="rpt-num rpt-red">{rs(data.total.purchaseAmount)}</td>
                  </tr></tfoot>
                )}
              </table>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── SALE PURCHASE BY PARTY ───────────────────────────────────────────────────

function SalePurchaseByPartyReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(monthEnd);
  const { data, loading, error } = useReport("sale-purchase-by-party", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.parties?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>#</th><th>Party Name</th>
                  <th className="rpt-num">Sale Amount</th>
                  <th className="rpt-num">Purchase Amount</th>
                </tr></thead>
                <tbody>
                  {data.parties.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{i + 1}</td><td>{r.partyName}</td>
                      <td className="rpt-num rpt-green">{r.saleAmount > 0 ? rs(r.saleAmount) : "---"}</td>
                      <td className="rpt-num rpt-red">{r.purchaseAmount > 0 ? rs(r.purchaseAmount) : "---"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="rpt-footer-bar">
              <span>Total Sale Amount: {rs(data.totalSaleAmount ?? 0)}</span>
              <span>Total Purchase Amount: {rs(data.totalPurchaseAmount ?? 0)}</span>
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── SALE PURCHASE BY PARTY GROUP ─────────────────────────────────────────────

function SalePurchaseByPartyGroupReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(monthEnd);
  const { data, loading, error } = useReport("sale-purchase-by-party-group", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">SALE PURCHASE BY PARTY GROUP</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <table className="rpt-table">
            <thead><tr>
              <th>Group Name</th>
              <th className="rpt-num">Sale Amount</th>
              <th className="rpt-num">Purchase Amount</th>
            </tr></thead>
            <tbody>
              {(data.groups ?? []).map((r: any, i: number) => (
                <tr key={i}>
                  <td>{r.groupName}</td>
                  <td className="rpt-num">{rs(r.saleAmount)}</td>
                  <td className="rpt-num">{rs(r.purchaseAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── STOCK SUMMARY ────────────────────────────────────────────────────────────

function StockSummaryReport() {
  const [asOf,   setAsOf]   = useState(todayStr);
  const { data, loading, error } = useReport("stock-summary", { asOf });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <span className="rpt-filter-label">Date</span>
        <input type="date" className="rpt-date-input" value={asOf} onChange={e => setAsOf(e.target.value)} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">STOCK SUMMARY</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.items?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>#</th><th>Item Name</th>
                  <th className="rpt-num">Sale Price</th>
                  <th className="rpt-num">Purchase Price</th>
                  <th className="rpt-num">Stock Qty</th>
                  <th className="rpt-num">Stock Value</th>
                </tr></thead>
                <tbody>
                  {data.items.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{i + 1}</td><td>{r.name}</td>
                      <td className="rpt-num">{rs(r.salePrice ?? 0)}</td>
                      <td className="rpt-num">{rs(r.purchasePrice ?? 0)}</td>
                      <td className={`rpt-num ${r.stockQty < 0 ? "rpt-red" : "rpt-green"}`}>{r.stockQty}</td>
                      <td className="rpt-num">{rs(r.stockValue ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                {data.total && (
                  <tfoot><tr>
                    <td colSpan={4}>Total</td>
                    <td className={`rpt-num ${(data.total.stockQty ?? 0) < 0 ? "rpt-red" : ""}`}>{data.total.stockQty}</td>
                    <td className="rpt-num">{rs(data.total.stockValue ?? 0)}</td>
                  </tr></tfoot>
                )}
              </table>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── ITEM REPORT BY PARTY ─────────────────────────────────────────────────────

function ItemReportByPartyReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const { data, loading, error } = useReport("item-report-by-party", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">DETAILS</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.items?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Item Name</th>
                  <th className="rpt-num">Sale Quantity</th><th className="rpt-num">Sale Amount</th>
                  <th className="rpt-num">Purchase Quantity</th><th className="rpt-num">Purchase Amount</th>
                </tr></thead>
                <tbody>
                  {data.items.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.itemName}</td>
                      <td className="rpt-num">{r.saleQty}</td>
                      <td className="rpt-num">{rs(r.saleAmount)}</td>
                      <td className="rpt-num">{r.purchaseQty}</td>
                      <td className="rpt-num">{rs(r.purchaseAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                {data.total && (
                  <tfoot><tr>
                    <td>Total</td>
                    <td className="rpt-num">{data.total.saleQty}</td>
                    <td className="rpt-num">{rs(data.total.saleAmount)}</td>
                    <td className="rpt-num">{data.total.purchaseQty}</td>
                    <td className="rpt-num">{rs(data.total.purchaseAmount)}</td>
                  </tr></tfoot>
                )}
              </table>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── ITEM WISE P&L ────────────────────────────────────────────────────────────

function ItemWisePnlReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const { data, loading, error } = useReport("item-wise-pnl", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">DETAILS</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.items?.length) ? <NoData /> : (
              <div style={{ overflowX: "auto" }}>
                <table className="rpt-table">
                  <thead><tr>
                    <th>Item Name</th><th className="rpt-num">Sale</th>
                    <th className="rpt-num">Cr. Note/ Sale Return</th>
                    <th className="rpt-num">Purchase</th>
                    <th className="rpt-num">Dr. Note/ Purchase Return</th>
                    <th className="rpt-num">Opening Stock</th><th className="rpt-num">Closing Stock</th>
                    <th className="rpt-num">Tax Receivable</th><th className="rpt-num">Tax Payable</th>
                    <th className="rpt-num">Mfg. Cost</th><th className="rpt-num">Consumption Cost</th>
                    <th className="rpt-num">Net Profit/Loss</th>
                  </tr></thead>
                  <tbody>
                    {data.items.map((r: any, i: number) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td className="rpt-num">{r.sale}</td><td className="rpt-num">{r.creditNote}</td>
                        <td className="rpt-num">{r.purchase}</td><td className="rpt-num">{r.debitNote}</td>
                        <td className="rpt-num">{r.openingStock}</td><td className="rpt-num rpt-green">{r.closingStock}</td>
                        <td className="rpt-num">0</td><td className="rpt-num">0</td>
                        <td className="rpt-num">0</td><td className="rpt-num">0</td>
                        <td className={`rpt-num ${r.netProfit >= 0 ? "rpt-green" : "rpt-red"}`}>{rs(r.netProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.totalAmount !== undefined && (
              <div className="rpt-footer-bar">
                <span>Total Amount: {rs(data.totalAmount)}</span>
              </div>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── ITEM CATEGORY P&L ────────────────────────────────────────────────────────

function ItemCategoryPnlReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const { data, loading, error } = useReport("item-category-pnl", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">DETAILS</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <div style={{ overflowX: "auto" }}>
            <table className="rpt-table">
              <thead><tr>
                <th>Category Name</th>
                <th className="rpt-num">Sale</th><th className="rpt-num">Cr. Note /...</th>
                <th className="rpt-num">Purchase</th><th className="rpt-num">Dr. Note /...</th>
                <th className="rpt-num">Opening Stock</th><th className="rpt-num">Closing Stock</th>
                <th className="rpt-num">Tax Receivable</th><th className="rpt-num">Tax Payable</th>
                <th className="rpt-num">Mfg. Cost</th><th className="rpt-num">Consumption...</th>
                <th className="rpt-num">Net Profit/...</th>
              </tr></thead>
              <tbody>
                {(data.categories ?? []).map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td className="rpt-num">{r.sale}</td><td className="rpt-num">{r.creditNote}</td>
                    <td className="rpt-num">{r.purchase}</td><td className="rpt-num">{r.debitNote}</td>
                    <td className="rpt-num">{r.openingStock}</td>
                    <td className="rpt-num rpt-green">{r.closingStock}</td>
                    <td className="rpt-num">0</td><td className="rpt-num">0</td>
                    <td className="rpt-num">0</td><td className="rpt-num">0</td>
                    <td className={`rpt-num ${r.netProfit >= 0 ? "rpt-green" : "rpt-red"}`}>{rs(r.netProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── LOW STOCK ────────────────────────────────────────────────────────────────

function LowStockReport() {
  const { data, loading, error } = useReport("low-stock", {});

  return (
    <div className="rpt-content">
      <div className="rpt-filters"><ExcelPrint /></div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.items?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>#</th><th>Item Name</th>
                  <th className="rpt-num">Minimum Stock Qty</th>
                  <th className="rpt-num">Stock Qty</th>
                  <th className="rpt-num">Stock Value</th>
                </tr></thead>
                <tbody>
                  {data.items.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{i + 1}</td><td>{r.name}</td>
                      <td className="rpt-num">{r.minStockQty}</td>
                      <td className={`rpt-num ${r.stockQty < 0 ? "rpt-red" : ""}`}>{r.stockQty}</td>
                      <td className="rpt-num">{rs(r.stockValue ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── STOCK DETAIL ─────────────────────────────────────────────────────────────

function StockDetailReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const { data, loading, error } = useReport("stock-detail", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">DETAILS</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.items?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Item Name</th>
                  <th className="rpt-num">Beginning Quantity</th><th className="rpt-num">Quantity In</th>
                  <th className="rpt-num">Purchase Amount</th><th className="rpt-num">Quantity Out</th>
                  <th className="rpt-num">Sale Amount</th><th className="rpt-num">Closing Quantity</th>
                </tr></thead>
                <tbody>
                  {data.items.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td className="rpt-num">{r.beginningQty}</td>
                      <td className="rpt-num">{r.qtyIn}</td>
                      <td className="rpt-num">{rs(r.purchaseAmount)}</td>
                      <td className="rpt-num">{r.qtyOut}</td>
                      <td className="rpt-num">{rs(r.saleAmount)}</td>
                      <td className={`rpt-num ${r.closingQty < 0 ? "rpt-red" : ""}`}>{r.closingQty}</td>
                    </tr>
                  ))}
                </tbody>
                {data.total && (
                  <tfoot><tr>
                    <td>Total</td>
                    <td className="rpt-num">{data.total.beginningQty}</td>
                    <td className="rpt-num">{data.total.qtyIn}</td>
                    <td className="rpt-num">{rs(data.total.purchaseAmount)}</td>
                    <td className="rpt-num">{data.total.qtyOut}</td>
                    <td className="rpt-num">{rs(data.total.saleAmount)}</td>
                    <td className="rpt-num">{data.total.closingQty}</td>
                  </tr></tfoot>
                )}
              </table>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── ITEM DETAIL ──────────────────────────────────────────────────────────────

function ItemDetailReport() {
  const [from,     setFrom]     = useState(monthStart);
  const [to,       setTo]       = useState(todayStr);
  const [itemName, setItemName] = useState("");
  const { data, loading, error } = useReport("item-detail", { from, to, itemName: itemName || undefined });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <input className="rpt-text-input" placeholder="Item name…" value={itemName} onChange={e => setItemName(e.target.value)} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">DETAILS</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.items?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Date</th>
                  <th className="rpt-num">Sale Quantity</th>
                  <th className="rpt-num">Purchase Quantity</th>
                  <th className="rpt-num">Adjustment Quantity</th>
                  <th className="rpt-num">Closing Quantity</th>
                </tr></thead>
                <tbody>
                  {data.items.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{fmt(r.date)}</td>
                      <td className="rpt-num">{r.saleQty}</td>
                      <td className="rpt-num">{r.purchaseQty}</td>
                      <td className="rpt-num">{r.adjustmentQty}</td>
                      <td className="rpt-num">{r.closingQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── SALE/PURCHASE BY ITEM CATEGORY ──────────────────────────────────────────

function SalePurchaseByItemCategoryReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const { data, loading, error } = useReport("sale-purchase-by-item-category", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">SALE/PURCHASE REPORT BY ITEM CATEGORY</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <table className="rpt-table">
            <thead><tr>
              <th>Item Category</th>
              <th className="rpt-num">Sale Quantity</th><th className="rpt-num">Total Sale Amount</th>
              <th className="rpt-num">Purchase Quantity</th><th className="rpt-num">Total Purchase Amount</th>
            </tr></thead>
            <tbody>
              {(data.categories ?? []).map((r: any, i: number) => (
                <tr key={i}>
                  <td>{r.category}</td>
                  <td className="rpt-num">{r.saleQty}</td><td className="rpt-num">{rs(r.saleAmount)}</td>
                  <td className="rpt-num">{r.purchaseQty}</td><td className="rpt-num">{rs(r.purchaseAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── STOCK SUMMARY BY CATEGORY ────────────────────────────────────────────────

function StockSummaryByCategoryReport() {
  const { data, loading, error } = useReport("stock-summary-by-category", {});

  return (
    <div className="rpt-content">
      <div className="rpt-filters"><ExcelPrint /></div>
      <h3 className="rpt-section-title">STOCK SUMMARY BY ITEM CATEGORY</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <table className="rpt-table">
            <thead><tr>
              <th>Item Category</th>
              <th className="rpt-num">Stock Quantity</th>
              <th className="rpt-num">Stock Value</th>
            </tr></thead>
            <tbody>
              {(data.categories ?? []).map((r: any, i: number) => (
                <tr key={i}>
                  <td>{r.category}</td>
                  <td className="rpt-num">{r.stockQty}</td>
                  <td className="rpt-num">{r.stockValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── ITEM WISE DISCOUNT ───────────────────────────────────────────────────────

function ItemWiseDiscountReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(monthEnd);
  const { data, loading, error } = useReport("item-wise-discount", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">Item Wise Discount</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.items?.length) ? <div className="rpt-no-data">No Items</div> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>#</th><th>Item Name</th>
                  <th className="rpt-num">Total Qty Sold</th>
                  <th className="rpt-num">Total Sale Amount</th>
                  <th className="rpt-num">Total Disc. Amount</th>
                  <th className="rpt-num">Avg. Disc. (%)</th>
                </tr></thead>
                <tbody>
                  {data.items.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{i+1}</td><td>{r.name}</td>
                      <td className="rpt-num">{r.qtySold}</td>
                      <td className="rpt-num">{rs(r.saleAmount)}</td>
                      <td className="rpt-num">{rs(r.discountAmount)}</td>
                      <td className="rpt-num">{r.avgDiscount.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="rpt-footer-bar">
              <span>Total Sale Amount: {rs(data.totalSaleAmount ?? 0)}</span>
              <span>Total Discount amount: {rs(data.totalDiscountAmount ?? 0)}</span>
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── BANK STATEMENT ───────────────────────────────────────────────────────────

function BankStatementReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const { data, loading, error } = useReport("bank-statement", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">TRANSACTIONS</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            <NoData />
            <div className="rpt-footer-bar">
              <span>Balance</span>
              <span>{rs(0)}</span>
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── DISCOUNT REPORT ──────────────────────────────────────────────────────────

function DiscountReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const { data, loading, error } = useReport("discount-report", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">DISCOUNT REPORT</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.parties?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Party Name</th>
                  <th className="rpt-num">Sale Discount</th>
                  <th className="rpt-num">Purchase / Expense Discount</th>
                </tr></thead>
                <tbody>
                  {data.parties.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td className="rpt-num">{rs(r.saleDiscount)}</td>
                      <td className="rpt-num">{rs(r.purchaseDiscount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="rpt-footer-bar">
              <span className="rpt-green">Total Sale Discount: {rs(data.totalSaleDiscount ?? 0)}</span>
              <span className="rpt-red">Total Purchase Discount: {rs(data.totalPurchaseDiscount ?? 0)}</span>
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── TAX REPORT ───────────────────────────────────────────────────────────────

function TaxReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const { data, loading, error } = useReport("tax-report", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">TAX REPORT</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.parties?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Party Name</th>
                  <th className="rpt-num">Sale Tax</th>
                  <th className="rpt-num">Purchase /Expense Tax</th>
                </tr></thead>
                <tbody>
                  {data.parties.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td className="rpt-num">{rs(r.saleTax)}</td>
                      <td className="rpt-num">{rs(r.purchaseTax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="rpt-footer-bar">
              <span className="rpt-green">Total Tax In: {rs(data.totalTaxIn ?? 0)}</span>
              <span className="rpt-red">Total Tax Out: {rs(data.totalTaxOut ?? 0)}</span>
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── TAX RATE REPORT ──────────────────────────────────────────────────────────

function TaxRateReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const { data, loading, error } = useReport("tax-rate-report", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">TAX RATE REPORT</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <table className="rpt-table">
            <thead><tr>
              <th>Tax Name</th><th>Tax Percent</th>
              <th className="rpt-num">Taxable Sale Amount</th><th className="rpt-num">Tax In</th>
              <th className="rpt-num">Taxable Purchase/Expense Amount</th><th className="rpt-num">Tax Out</th>
            </tr></thead>
            <tbody>
              {(data.rates ?? []).length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>No tax rates configured</td></tr>
              )}
            </tbody>
          </table>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── EXPENSE REPORT ───────────────────────────────────────────────────────────

function ExpenseReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(monthEnd);
  const { data, loading, error } = useReport("expense", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <button className="rpt-add-btn rpt-add-btn--red" type="button">+ Add Expense</button>
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">TRANSACTIONS</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.transactions?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Date</th><th>Exp No.</th><th>Party</th>
                  <th>Category Name</th><th>Payment Type</th>
                  <th className="rpt-num">Amount</th>
                  <th className="rpt-num">Balance Due</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {data.transactions.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{fmt(r.date)}</td><td>{r.expNo || "–"}</td>
                      <td>{r.party}</td><td>{r.category}</td>
                      <td>{r.paymentType}</td>
                      <td className="rpt-num">{r.amount}</td>
                      <td className="rpt-num">{r.balanceDue}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── EXPENSE CATEGORY ─────────────────────────────────────────────────────────

function ExpenseCategoryReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const { data, loading, error } = useReport("expense-category", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <ExcelPrint />
      </div>
      <h3 className="rpt-section-title">EXPENSE</h3>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.categories?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Expense Category</th>
                  <th>Category Type</th>
                  <th className="rpt-num">Amount</th>
                </tr></thead>
                <tbody>
                  {data.categories.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.category}</td>
                      <td>{r.categoryType}</td>
                      <td className="rpt-num">{rs(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="rpt-footer-bar rpt-red">
              Total Expense: {rs(data.totalExpense ?? 0)}
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── EXPENSE ITEM ─────────────────────────────────────────────────────────────

function ExpenseItemReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(monthEnd);
  const { data, loading, error } = useReport("expense-item", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <button className="rpt-add-btn rpt-add-btn--red" type="button">+ Add Expense</button>
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.items?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Expense Item</th>
                  <th className="rpt-num">Unit Price</th>
                  <th className="rpt-num">Quantity</th>
                  <th className="rpt-num">Amount</th>
                </tr></thead>
                <tbody>
                  {data.items.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.expenseItem}</td>
                      <td className="rpt-num">{rs(r.unitPrice)}</td>
                      <td className="rpt-num">{r.quantity}</td>
                      <td className="rpt-num">{rs(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="rpt-footer-bar">
              <span>Total Quantity: {data.totalQty ?? 0}</span>
              <span className="rpt-red">Total Amount: {rs(data.totalAmount ?? 0)}</span>
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── SALE/PURCHASE ORDERS ─────────────────────────────────────────────────────

function SalePurchaseOrdersReport() {
  const [from,      setFrom]      = useState(monthStart);
  const [to,        setTo]        = useState(todayStr);
  const [orderType, setOrderType] = useState("sale_order");
  const { data, loading, error } = useReport("sale-purchase-orders", { from, to, orderType });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <select className="rpt-select" value={orderType} onChange={e => setOrderType(e.target.value)}>
          <option value="sale_order">Sale Order</option>
          <option value="purchase_order">Purchase Order</option>
          <option value="estimate">Estimate</option>
          <option value="proforma_invoice">Proforma Invoice</option>
        </select>
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.orders?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Date</th><th>Order No.</th><th>Name</th><th>Due Date</th>
                  <th>Status</th><th>Type</th>
                  <th className="rpt-num">Total</th>
                  <th className="rpt-num">Advance</th>
                  <th className="rpt-num">Balance</th>
                </tr></thead>
                <tbody>
                  {data.orders.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{fmt(r.date)}</td><td>{r.orderNo}</td>
                      <td>{r.name}</td><td>{r.dueDate ? fmt(r.dueDate) : "–"}</td>
                      <td>{r.status}</td><td>{txnLabel(r.type)}</td>
                      <td className="rpt-num">{rs(r.total)}</td>
                      <td className="rpt-num">{rs(r.advance)}</td>
                      <td className="rpt-num">{rs(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="rpt-footer-bar">
              <span>Total Amount: {rs(data.totalAmount ?? 0)}</span>
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── SALE/PURCHASE ORDER ITEMS ────────────────────────────────────────────────

function SalePurchaseOrderItemsReport() {
  const [from,      setFrom]      = useState(monthStart);
  const [to,        setTo]        = useState(todayStr);
  const [orderType, setOrderType] = useState("sale_order");
  const { data, loading, error } = useReport("sale-purchase-order-items", { from, to, orderType });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <select className="rpt-select" value={orderType} onChange={e => setOrderType(e.target.value)}>
          <option value="sale_order">Sale Order</option>
          <option value="purchase_order">Purchase Order</option>
          <option value="estimate">Estimate</option>
        </select>
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            {(!data.items?.length) ? <NoData /> : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Item Name</th>
                  <th className="rpt-num">Quantity</th>
                  <th className="rpt-num">Amount</th>
                </tr></thead>
                <tbody>
                  {data.items.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td className="rpt-num">{r.qty}</td>
                      <td className="rpt-num">{rs(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                {data.total && (
                  <tfoot><tr>
                    <td>Total</td>
                    <td className="rpt-num">{data.total.qty}</td>
                    <td className="rpt-num">{rs(data.total.amount)}</td>
                  </tr></tfoot>
                )}
              </table>
            )}
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── LOAN STATEMENT ───────────────────────────────────────────────────────────

function LoanStatementReport() {
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(todayStr);
  const { data, loading, error } = useReport("loan-statement", { from, to });

  return (
    <div className="rpt-content">
      <div className="rpt-filters">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <button className="rpt-add-btn" type="button">+ Add Loan A/C</button>
        <ExcelPrint />
      </div>
      <ReportWrap loading={loading} error={error}>
        {data && (
          <>
            <NoData />
            <div className="rpt-party-summary">
              <div className="rpt-ps-grid">
                <span>Opening Balance: {rs(data.summary?.openingBalance ?? 0)}</span>
                <span>Balance Due: {rs(data.summary?.balanceDue ?? 0)}</span>
                <span>Total Principal Paid: {rs(data.summary?.totalPrincipalPaid ?? 0)}</span>
                <span>Total Interest Paid: {rs(data.summary?.totalInterestPaid ?? 0)}</span>
              </div>
            </div>
          </>
        )}
      </ReportWrap>
    </div>
  );
}

// ─── PREMIUM GATE ─────────────────────────────────────────────────────────────

function PremiumGate() {
  return (
    <div className="rpt-empty">
      <div style={{ fontSize: 40 }}>💎</div>
      <div className="rpt-empty__title">Premium Feature</div>
      <div className="rpt-empty__sub">Upgrade to Pro to access this report.</div>
    </div>
  );
}

// ─── Small shared UI ──────────────────────────────────────────────────────────

function ExcelPrint() {
  return (
    <div className="rpt-toolbar-right">
      <button type="button" className="rpt-icon-btn" title="Excel Report">
        <ExcelIcon />
      </button>
      <button type="button" className="rpt-icon-btn" title="Print">
        <PrintIcon />
      </button>
    </div>
  );
}

function txnLabel(type: string): string {
  const MAP: Record<string, string> = {
    sale: "Sale", purchase: "Purchase", payment_in: "Payment-In", payment_out: "Payment-Out",
    credit_note: "Credit Note", debit_note: "Debit Note", expense: "Expense",
    opening_balance: "Opening Balance", estimate: "Estimate",
    proforma_invoice: "Proforma Invoice", sale_order: "Sale Order",
    purchase_order: "Purchase Order", delivery_challan: "Delivery Challan",
  };
  return MAP[type] ?? type;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function PremiumBadge() {
  return (
    <span className="rpt-item__premium" title="Premium feature">
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <circle cx="8" cy="8" r="7" fill="#3b82f6" opacity="0.15" />
        <circle cx="8" cy="8" r="7" stroke="#3b82f6" strokeWidth="1.2" />
        <path d="M5 9.5L8 6l3 3.5" stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="11" r="0.8" fill="#3b82f6" />
      </svg>
    </span>
  );
}

function ReportsEmptyIcon() {
  return (
    <svg viewBox="0 0 80 80" fill="none" width="80" height="80">
      <rect width="80" height="80" rx="20" fill="#eff6ff" />
      <rect x="18" y="24" width="44" height="6" rx="3" fill="#bfdbfe" />
      <rect x="18" y="35" width="36" height="4" rx="2" fill="#dbeafe" />
      <rect x="18" y="44" width="40" height="4" rx="2" fill="#dbeafe" />
      <rect x="18" y="53" width="28" height="4" rx="2" fill="#dbeafe" />
      <rect x="48" y="44" width="14" height="13" rx="2" fill="#3b82f6" opacity="0.6" />
      <rect x="54" y="38" width="8" height="19" rx="2" fill="#3b82f6" opacity="0.4" />
    </svg>
  );
}

function ExcelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#16a34a" opacity="0.15" stroke="#16a34a" strokeWidth="1.5" />
      <path d="M8 8l3 4-3 4M16 8l-3 4 3 4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" width="16" height="16">
      <path d="M6 9V2h12v7" strokeLinecap="round" />
      <rect x="2" y="9" width="20" height="9" rx="2" />
      <path d="M6 18v4h12v-4" strokeLinecap="round" />
      <circle cx="17" cy="13.5" r="1" fill="#6b7280" />
    </svg>
  );
}

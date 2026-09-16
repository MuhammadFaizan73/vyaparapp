import { useEffect, useState } from "react";
import { listLicenses, expiringSoon, generateLicenses, extendLicense, revokeLicense } from "../../lib/api";

interface License {
  id: string;
  key: string;
  plan: string;
  platform: string;
  phone: string | null;
  email: string | null;
  customerName: string | null;
  durationType: string;
  expiresAt: string;
  computedStatus: string;
  tenant: { id: string; phone: string; companyName: string | null } | null;
}

const DEFAULT_GEN_FORM = {
  count: 1, platform: "desktop", plan: "pro",
  durationType: "yearly" as "monthly" | "yearly" | "custom", customDays: 365,
  email: "", customerName: "", phone: "",
};

// Reporting period for the "Expiring" tab — maps to the same `days` window the
// existing GET /admin/licenses/expiring?days= already supports server-side, so this
// is a client-side reshaping of one endpoint, not new backend surface.
type Period = "today" | "week" | "month" | "custom";
const PERIOD_DAYS: Record<Exclude<Period, "custom">, number> = { today: 1, week: 7, month: 30 };
const PERIOD_LABEL: Record<Period, string> = { today: "Today", week: "This Week", month: "This Month", custom: "Custom" };

export default function LicenseList() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [expiring, setExpiring] = useState<License[]>([]);
  const [expiringCounts, setExpiringCounts] = useState<Record<Period, number>>({ today: 0, week: 0, month: 0, custom: 0 });
  const [period, setPeriod] = useState<Period>("month");
  const [customDaysFilter, setCustomDaysFilter] = useState(90);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [emailFilter, setEmailFilter] = useState("");
  const [tab, setTab] = useState<"all" | "expiring">("all");
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState(DEFAULT_GEN_FORM);
  const [genError, setGenError] = useState("");
  const [genResult, setGenResult] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [expiringLoading, setExpiringLoading] = useState(false);

  const periodDays = period === "custom" ? Math.max(1, customDaysFilter) : PERIOD_DAYS[period];

  async function load() {
    setLoading(true);
    try {
      const all = await listLicenses({ page, limit: 20, ...(emailFilter.trim() ? { email: emailFilter.trim() } : {}) });
      setLicenses(all.data);
      setTotal(all.total);
    } finally {
      setLoading(false);
    }
  }

  // The three stat cards (Today/This Week/This Month) always reflect their own fixed
  // windows regardless of which one is selected, so switching the active period never
  // has to re-fetch the other two counts.
  async function loadExpiringStats() {
    const [today, week, month] = await Promise.all([
      expiringSoon(PERIOD_DAYS.today), expiringSoon(PERIOD_DAYS.week), expiringSoon(PERIOD_DAYS.month),
    ]);
    setExpiringCounts((prev) => ({ ...prev, today: today.length, week: week.length, month: month.length }));
  }

  async function loadExpiringList() {
    setExpiringLoading(true);
    try {
      const soon = await expiringSoon(periodDays);
      setExpiring(soon);
      if (period === "custom") setExpiringCounts((prev) => ({ ...prev, custom: soon.length }));
    } finally {
      setExpiringLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, emailFilter]);
  useEffect(() => { loadExpiringStats(); }, []);
  useEffect(() => { loadExpiringList(); }, [period, period === "custom" ? customDaysFilter : null]);

  async function handleGenerate() {
    setGenError("");
    if (!genForm.email.trim()) { setGenError("Customer email is required."); return; }
    if (genForm.durationType === "custom" && !(genForm.customDays > 0)) {
      setGenError("Enter how many days this custom license is valid for.");
      return;
    }
    try {
      const res = await generateLicenses({
        count: genForm.count, platform: genForm.platform, plan: genForm.plan,
        durationType: genForm.durationType,
        ...(genForm.durationType === "custom" ? { customDays: genForm.customDays } : {}),
        email: genForm.email.trim(),
        customerName: genForm.customerName.trim() || undefined,
        phone: genForm.phone.trim() || undefined,
      });
      setGenResult(res.keys);
      load();
    } catch (e: any) {
      setGenError(e?.response?.data?.message ?? "Failed to generate");
    }
  }

  async function handleExtend(id: string) {
    const days = parseInt(prompt("Extend by how many days?") ?? "0");
    if (!days) return;
    try {
      await extendLicense(id, days);
      load();
    } catch {
      alert("Failed to extend");
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this license? This immediately invalidates it.")) return;
    try {
      await revokeLicense(id);
      load();
    } catch {
      alert("Failed to revoke");
    }
  }

  const STATUS_BADGE: Record<string, string> = {
    active: "badge-green",
    expired: "badge-red",
    unassigned: "badge-gray",
  };

  const displayed = tab === "all" ? licenses : expiring;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Licenses</h1>
          <p className="text-sm text-gray-500">{total} total license keys</p>
        </div>
        <button onClick={() => { setGenForm(DEFAULT_GEN_FORM); setGenError(""); setShowGenerate(true); }} className="btn-primary">
          + Generate Keys
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("all")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "all" ? "border-primary text-primary" : "border-transparent text-gray-500"
            }`}
          >
            All Keys
          </button>
          <button
            onClick={() => setTab("expiring")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "expiring" ? "border-primary text-primary" : "border-transparent text-gray-500"
            }`}
          >
            Expiring
            {expiringCounts.month > 0 && (
              <span className="ml-2 badge-yellow">{expiringCounts.month}</span>
            )}
          </button>
        </div>
        {tab === "all" && (
          <input
            type="text"
            placeholder="Filter by customer email…"
            className="input !w-64 mb-1"
            value={emailFilter}
            onChange={(e) => { setPage(1); setEmailFilter(e.target.value); }}
          />
        )}
      </div>

      {/* Expiring reporting: fixed-window stat cards + a period picker driving the table below */}
      {tab === "expiring" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {(["today", "week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`card p-4 text-left transition-colors ${period === p ? "ring-2 ring-primary" : "hover:bg-gray-50"}`}
              >
                <div className="text-xs font-medium text-gray-500 uppercase">{PERIOD_LABEL[p]}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{expiringCounts[p]}</div>
                <div className="text-xs text-gray-400 mt-1">license{expiringCounts[p] === 1 ? "" : "s"} expiring</div>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeriod("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                period === "custom" ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-500"
              }`}
            >
              Custom
            </button>
            {period === "custom" && (
              <>
                <span className="text-xs text-gray-500">Within</span>
                <input
                  type="number" min={1} className="input !w-20 !py-1"
                  value={customDaysFilter}
                  onChange={(e) => setCustomDaysFilter(+e.target.value)}
                />
                <span className="text-xs text-gray-500">days</span>
              </>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              Showing licenses expiring within {periodDays} day{periodDays === 1 ? "" : "s"} — {expiringCounts[period]} found
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Key", "Customer", "Platform", "Plan", "Duration", "Tenant", "Expires", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(tab === "all" ? loading : expiringLoading) ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">No licenses found</td></tr>
            ) : displayed.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{l.key}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">
                  {l.email
                    ? <><div>{l.customerName || "—"}</div><div className="text-gray-400">{l.email}</div></>
                    : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 capitalize">{l.platform}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{l.plan}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{l.durationType}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">
                  {l.tenant
                    ? (l.tenant.companyName ?? l.tenant.phone)
                    : l.phone
                      ? <span className="text-gray-500">Reserved: {l.phone}</span>
                      : <span className="text-gray-400">Unassigned</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{l.expiresAt?.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <span className={STATUS_BADGE[l.computedStatus] ?? "badge-gray"}>{l.computedStatus}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleExtend(l.id)} className="text-xs text-primary hover:underline">
                      Extend
                    </button>
                    <button onClick={() => handleRevoke(l.id)} className="text-xs text-red-600 hover:underline">
                      Revoke
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && tab === "all" && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {Math.ceil(total / 20)}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
            <button className="btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total}>Next</button>
          </div>
        </div>
      )}

      {/* Generate modal */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Generate License Keys</h2>

            {genResult.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-green-700 font-medium">✓ {genResult.length} keys generated for {genForm.email}</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                  {genResult.map((k) => (
                    <div key={k} className="font-mono text-sm text-gray-700">{k}</div>
                  ))}
                </div>
                <button className="btn-primary w-full justify-center" onClick={() => { setShowGenerate(false); setGenResult([]); }}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Customer Email *</label>
                    <input type="email" placeholder="customer@example.com" className="input" value={genForm.email}
                      onChange={(e) => setGenForm({ ...genForm, email: e.target.value })} />
                    <p className="text-xs text-gray-400 mt-1">Every license this customer owns shows up under this email in their app's "Activate License" screen.</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name (optional)</label>
                    <input type="text" placeholder="Full name or business name" className="input" value={genForm.customerName}
                      onChange={(e) => setGenForm({ ...genForm, customerName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Count</label>
                    <input type="number" min={1} max={100} className="input" value={genForm.count}
                      onChange={(e) => setGenForm({ ...genForm, count: +e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
                    <select className="input" value={genForm.platform}
                      onChange={(e) => setGenForm({ ...genForm, platform: e.target.value })}>
                      <option value="desktop">Desktop</option>
                      <option value="mobile">Mobile</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
                    <select className="input" value={genForm.plan}
                      onChange={(e) => setGenForm({ ...genForm, plan: e.target.value })}>
                      <option value="pro">Pro</option>
                      <option value="basic">Basic</option>
                      <option value="lifetime">Lifetime</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                    <select className="input" value={genForm.durationType}
                      onChange={(e) => setGenForm({ ...genForm, durationType: e.target.value as typeof genForm.durationType })}>
                      <option value="monthly">Monthly (30 days)</option>
                      <option value="yearly">Yearly (365 days)</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  {genForm.durationType === "custom" && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Valid for (days)</label>
                      <input type="number" min={1} className="input" value={genForm.customDays}
                        onChange={(e) => setGenForm({ ...genForm, customDays: +e.target.value })} />
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Also lock to phone (optional, legacy)</label>
                    <input type="text" placeholder="+923328286016" className="input" value={genForm.phone}
                      onChange={(e) => setGenForm({ ...genForm, phone: e.target.value })} />
                    <p className="text-xs text-gray-400 mt-1">Only needed for the old phone-locked activation path. Leave blank — the email above is what the app now looks the license up by.</p>
                  </div>
                </div>
                {genError && <p className="text-xs text-red-600">{genError}</p>}
                <div className="flex gap-2 pt-2">
                  <button className="btn-secondary flex-1 justify-center" onClick={() => setShowGenerate(false)}>Cancel</button>
                  <button className="btn-primary flex-1 justify-center" onClick={handleGenerate}>Generate</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

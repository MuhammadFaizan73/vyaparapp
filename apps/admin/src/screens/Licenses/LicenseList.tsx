import { useEffect, useState } from "react";
import { listLicenses, expiringSoon, generateLicenses, extendLicense, revokeLicense } from "../../lib/api";

interface License {
  id: string;
  key: string;
  plan: string;
  platform: string;
  expiresAt: string;
  computedStatus: string;
  tenant: { id: string; phone: string; companyName: string | null } | null;
}

export default function LicenseList() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [expiring, setExpiring] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"all" | "expiring">("all");
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ count: 1, platform: "desktop", plan: "pro", daysValid: 365 });
  const [genResult, setGenResult] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [all, soon] = await Promise.all([listLicenses({ page, limit: 20 }), expiringSoon(30)]);
      setLicenses(all.data);
      setTotal(all.total);
      setExpiring(soon);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  async function handleGenerate() {
    try {
      const res = await generateLicenses(genForm);
      setGenResult(res.keys);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to generate");
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
        <button onClick={() => setShowGenerate(true)} className="btn-primary">
          + Generate Keys
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
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
          Expiring in 30 days
          {expiring.length > 0 && (
            <span className="ml-2 badge-yellow">{expiring.length}</span>
          )}
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Key", "Platform", "Plan", "Tenant", "Expires", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No licenses found</td></tr>
            ) : displayed.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{l.key}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{l.platform}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{l.plan}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">
                  {l.tenant ? (l.tenant.companyName ?? l.tenant.phone) : <span className="text-gray-400">Unassigned</span>}
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
                <p className="text-sm text-green-700 font-medium">✓ {genResult.length} keys generated</p>
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">Valid (days)</label>
                    <input type="number" min={1} className="input" value={genForm.daysValid}
                      onChange={(e) => setGenForm({ ...genForm, daysValid: +e.target.value })} />
                  </div>
                </div>
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

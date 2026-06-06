import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTenant, getTenantActivity, setTenantActive, impersonate } from "../../lib/api";

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<"overview" | "team" | "activity">("overview");

  useEffect(() => {
    if (!id) return;
    Promise.all([getTenant(id), getTenantActivity(id)])
      .then(([t, a]) => { setTenant(t); setActivity(a); })
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleActive() {
    if (!tenant || !id) return;
    const confirm = window.confirm(
      `${tenant.isActive ? "Disable" : "Enable"} this company?`,
    );
    if (!confirm) return;
    setActionLoading(true);
    try {
      await setTenantActive(id, !tenant.isActive);
      setTenant({ ...tenant, isActive: !tenant.isActive });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleImpersonate() {
    if (!id) return;
    const confirm = window.confirm("Start a read-only impersonation session for this tenant?");
    if (!confirm) return;
    try {
      const res = await impersonate(id);
      window.open(`http://localhost:5174?impToken=${res.token}`, "_blank");
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Impersonation failed");
    }
  }

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;
  if (!tenant) return <div className="p-6 text-gray-400">Tenant not found</div>;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate("/tenants")} className="text-sm text-gray-500 hover:text-gray-700 mb-1">
            ← Back to Companies
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{tenant.companyName ?? tenant.phone}</h1>
          <p className="text-sm text-gray-500 font-mono">{tenant.phone}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleImpersonate} className="btn-secondary">
            👁 View as tenant
          </button>
          <button
            onClick={toggleActive}
            disabled={actionLoading}
            className={tenant.isActive ? "btn-danger" : "btn-primary"}
          >
            {tenant.isActive ? "Disable Account" : "Enable Account"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["overview", "team", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Company Info</h2>
            {[
              ["Phone", tenant.phone],
              ["Company", tenant.companyName ?? "—"],
              ["Business Type", tenant.businessType ?? "—"],
              ["Email", tenant.companyEmail ?? "—"],
              ["Country", tenant.countryCode],
              ["Registered", tenant.createdAt?.slice(0, 10)],
              ["Trial Expires", tenant.trialExpiresAt?.slice(0, 10)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-500">{k}</span>
                <span className="text-gray-900 font-medium">{v}</span>
              </div>
            ))}
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Usage Summary</h2>
            {[
              ["Sales / Transactions", "—"],
              ["Parties / Customers", tenant._count?.parties],
              ["Items / Products", tenant._count?.items],
              ["Team Members", tenant._count?.teamMembers],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between text-sm">
                <span className="text-gray-500">{k}</span>
                <span className="text-gray-900 font-bold">{v ?? 0}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">Desktop License</h3>
              {tenant.desktopLicense ? (
                <div className="text-sm text-gray-700">
                  Expires: {tenant.desktopLicense.expiresAt?.slice(0, 10)} · Plan: {tenant.desktopLicense.plan}
                </div>
              ) : <span className="text-sm text-gray-400">No desktop license</span>}
            </div>
            <div className="pt-2 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">Mobile License</h3>
              {tenant.mobileLicense ? (
                <div className="text-sm text-gray-700">
                  Expires: {tenant.mobileLicense.expiresAt?.slice(0, 10)} · Plan: {tenant.mobileLicense.plan}
                </div>
              ) : <span className="text-sm text-gray-400">No mobile license</span>}
            </div>
          </div>
        </div>
      )}

      {tab === "team" && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "Email", "Role", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenant.teamMembers?.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">No team members</td></tr>
              ) : tenant.teamMembers?.map((m: any) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-gray-500">{m.email ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{m.role}</td>
                  <td className="px-4 py-3">
                    <span className={m.status === "active" ? "badge-green" : "badge-red"}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "activity" && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Action", "IP", "Timestamp"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activity.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-gray-400">No recent activity</td></tr>
              ) : activity.map((a: any) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 text-xs">{
                    Array.isArray(JSON.parse(a.changes ?? "[]"))
                      ? JSON.parse(a.changes).join(", ")
                      : a.changes
                  }</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{a.ipAddress ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{a.createdAt?.slice(0, 19).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

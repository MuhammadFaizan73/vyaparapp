import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listTenants } from "../../lib/api";

interface Tenant {
  id: string;
  phone: string;
  companyName: string | null;
  isActive: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  licenseStatus: string;
  platforms: string[];
}

const STATUS_BADGE: Record<string, string> = {
  active: "badge-green",
  trial: "badge-blue",
  expired: "badge-red",
};

export default function TenantList() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listTenants({ page, limit: 20, search, status });
      setTenants(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, status]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500">{total} total registered tenants</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-48">
          <input
            className="input"
            placeholder="Search by phone or company name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-primary shrink-0">Search</button>
        </form>
        <select
          className="input w-44"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Phone", "Company", "License", "Platform", "Registered", "Last Active", "Status", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No companies found</td></tr>
            ) : tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.phone}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{t.companyName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={STATUS_BADGE[t.licenseStatus] ?? "badge-gray"}>
                    {t.licenseStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{t.platforms.join(", ")}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{t.createdAt.slice(0, 10)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {t.lastActiveAt ? t.lastActiveAt.slice(0, 10) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={t.isActive ? "badge-green" : "badge-red"}>
                    {t.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/tenants/${t.id}`)}
                    className="text-primary text-xs font-medium hover:underline"
                  >
                    View →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {Math.ceil(total / 20)}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </button>
            <button
              className="btn-secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 20 >= total}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

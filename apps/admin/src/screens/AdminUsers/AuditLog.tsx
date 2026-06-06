import { useEffect, useState } from "react";
import { auditLog } from "../../lib/api";

interface Log {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: string | null;
  createdAt: string;
  admin: { name: string; email: string } | null;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await auditLog({ page, limit: 30 });
      setLogs(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  function parseMeta(raw: string | null) {
    if (!raw) return "";
    try {
      return Object.entries(JSON.parse(raw))
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
    } catch {
      return raw;
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500">{total} total entries — append-only</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Admin", "Action", "Target", "Details", "Timestamp"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">No audit entries yet</td></tr>
            ) : logs.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700 text-xs">
                  {l.admin ? (
                    <div>
                      <div className="font-medium">{l.admin.name}</div>
                      <div className="text-gray-400">{l.admin.email}</div>
                    </div>
                  ) : <span className="text-gray-400">System</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    {l.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {l.targetType && <div className="capitalize">{l.targetType}</div>}
                  {l.targetId && <div className="font-mono text-gray-400">{l.targetId.slice(0, 8)}…</div>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{parseMeta(l.meta)}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{l.createdAt.slice(0, 19).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 30 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {Math.ceil(total / 30)}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
            <button className="btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={page * 30 >= total}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

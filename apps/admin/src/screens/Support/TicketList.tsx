import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listTickets } from "../../lib/api";

interface Ticket {
  id: string;
  tenantId: string;
  subject: string;
  issueType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  assignedTo: { name: string } | null;
  _count: { messages: number };
}

const STATUS_BADGE: Record<string, string> = {
  open: "badge-red",
  in_progress: "badge-yellow",
  resolved: "badge-green",
  closed: "badge-gray",
};

export default function TicketList() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listTickets({ page, limit: 20, ...(status && { status }) });
      setTickets(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, status]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-500">{total} total tickets</p>
        </div>
      </div>

      <div className="card p-4 flex gap-3">
        {["", "open", "in_progress", "resolved", "closed"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              status === s ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Subject", "Type", "Status", "Assigned To", "Messages", "Created", "Updated", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : tickets.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No tickets</td></tr>
            ) : tickets.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/support/${t.id}`)}>
                <td className="px-4 py-3 font-medium text-gray-900">{t.subject}</td>
                <td className="px-4 py-3 text-gray-500 capitalize text-xs">{t.issueType}</td>
                <td className="px-4 py-3">
                  <span className={STATUS_BADGE[t.status] ?? "badge-gray"}>{t.status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{t.assignedTo?.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{t._count.messages}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{t.createdAt.slice(0, 10)}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{t.updatedAt.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <span className="text-primary text-xs font-medium">View →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {Math.ceil(total / 20)}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
            <button className="btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

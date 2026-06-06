import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTicket, replyTicket, updateTicketStatus } from "../../lib/api";

const STATUSES = ["open", "in_progress", "resolved", "closed"];

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    if (!id) return;
    const t = await getTicket(id);
    setTicket(t);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  useEffect(() => { load(); }, [id]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !id) return;
    setSending(true);
    try {
      await replyTicket(id, reply, isInternal);
      setReply("");
      await load();
    } finally {
      setSending(false);
    }
  }

  async function handleStatus(status: string) {
    if (!id) return;
    await updateTicketStatus(id, status);
    await load();
  }

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;
  if (!ticket) return <div className="p-6 text-gray-400">Ticket not found</div>;

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <button onClick={() => navigate("/support")} className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to Tickets
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Tenant: {ticket.tenantId} · Type: {ticket.issueType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Status:</span>
          <select
            className="input w-36 text-xs"
            value={ticket.status}
            onChange={(e) => handleStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="card divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
        {ticket.messages.map((m: any) => (
          <div
            key={m.id}
            className={`p-4 ${m.sender === "admin" ? "bg-blue-50" : "bg-white"} ${m.isInternal ? "opacity-75 border-l-4 border-yellow-400" : ""}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold uppercase ${m.sender === "admin" ? "text-blue-600" : "text-gray-600"}`}>
                {m.sender}
              </span>
              {m.isInternal && (
                <span className="badge-yellow text-xs">Internal note</span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{m.createdAt?.slice(0, 16).replace("T", " ")}</span>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply form */}
      {ticket.status !== "closed" && (
        <form onSubmit={handleReply} className="card p-4 space-y-3">
          <textarea
            className="input min-h-[80px] resize-none"
            placeholder="Write a reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded border-gray-300"
              />
              Internal note (not visible to tenant)
            </label>
            <button type="submit" className="btn-primary" disabled={sending || !reply.trim()}>
              {sending ? "Sending…" : isInternal ? "Add Note" : "Send Reply"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

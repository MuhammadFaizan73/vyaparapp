import { useEffect, useState } from "react";
import { listAnnouncements, createAnnouncement } from "../../lib/api";

interface Ann {
  id: string;
  title: string;
  body: string;
  type: string;
  target: string;
  sentAt: string | null;
  scheduledAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  _count: { reads: number };
}

const TYPE_BADGE: Record<string, string> = {
  info: "badge-blue",
  warning: "badge-yellow",
  critical: "badge-red",
};

export default function AnnouncementList() {
  const [items, setItems] = useState<Ann[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", body: "", type: "info", target: "all",
    targetValue: "", scheduledAt: "", expiresAt: "",
  });
  const [creating, setCreating] = useState(false);

  async function load() {
    listAnnouncements().then(setItems);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createAnnouncement({
        ...form,
        scheduledAt: form.scheduledAt || undefined,
        expiresAt: form.expiresAt || undefined,
        targetValue: form.targetValue || undefined,
      });
      setShowCreate(false);
      setForm({ title: "", body: "", type: "info", target: "all", targetValue: "", scheduledAt: "", expiresAt: "" });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to create announcement");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500">Push messages to tenants</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ New Announcement</button>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="card p-10 text-center text-gray-400">No announcements yet</div>
        ) : items.map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={TYPE_BADGE[a.type] ?? "badge-gray"}>{a.type}</span>
                  <span className="badge-gray capitalize">{a.target}</span>
                  {a.sentAt && <span className="badge-green">Sent</span>}
                  {a.scheduledAt && !a.sentAt && <span className="badge-blue">Scheduled</span>}
                </div>
                <h3 className="font-semibold text-gray-900">{a.title}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.body}</p>
              </div>
              <div className="text-right text-xs text-gray-400 shrink-0">
                <div>{a.sentAt ? `Sent ${a.sentAt.slice(0, 10)}` : a.scheduledAt ? `Scheduled ${a.scheduledAt.slice(0, 10)}` : "Draft"}</div>
                <div className="mt-1">{a._count.reads} read{a._count.reads !== 1 ? "s" : ""}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">New Announcement</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
                <textarea className="input min-h-[80px]" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Target</label>
                  <select className="input" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}>
                    <option value="all">All tenants</option>
                    <option value="platform">By platform</option>
                    <option value="license_type">By license type</option>
                    <option value="tenant">Specific tenant</option>
                  </select>
                </div>
              </div>
              {form.target !== "all" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Target value</label>
                  <input className="input" placeholder={form.target === "tenant" ? "Tenant ID" : "e.g. mobile or pro"} value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Schedule (optional)</label>
                  <input type="datetime-local" className="input" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expires (optional)</label>
                  <input type="datetime-local" className="input" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={creating}>
                  {creating ? "Sending…" : "Send Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

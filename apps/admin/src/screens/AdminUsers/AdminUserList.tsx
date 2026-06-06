import { useEffect, useState } from "react";
import { listAdminUsers, createAdminUser, updateAdminRole, setAdminActive } from "../../lib/api";
import { getAdmin } from "../../lib/auth";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function AdminUserList() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "support" });
  const [creating, setCreating] = useState(false);
  const me = getAdmin();

  async function load() {
    listAdminUsers().then(setUsers).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createAdminUser(form);
      setShowCreate(false);
      setForm({ name: "", email: "", password: "", role: "support" });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to create admin user");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(id: string, role: string) {
    try {
      await updateAdminRole(id, role);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to update role");
    }
  }

  async function handleToggleActive(user: AdminUser) {
    if (user.id === me?.id) { alert("Cannot deactivate yourself"); return; }
    if (!confirm(`${user.isActive ? "Deactivate" : "Activate"} ${user.name}?`)) return;
    try {
      await setAdminActive(user.id, !user.isActive);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed");
    }
  }

  const ROLE_BADGE: Record<string, string> = {
    superadmin: "badge-red",
    support: "badge-blue",
    readonly: "badge-gray",
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
          <p className="text-sm text-gray-500">{users.length} admin accounts</p>
        </div>
        {me?.role === "superadmin" && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ Add Admin</button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Name", "Email", "Role", "Status", "Last Login", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {u.name} {u.id === me?.id && <span className="text-xs text-gray-400">(you)</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  {me?.role === "superadmin" && u.id !== me?.id ? (
                    <select
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="superadmin">superadmin</option>
                      <option value="support">support</option>
                      <option value="readonly">readonly</option>
                    </select>
                  ) : (
                    <span className={ROLE_BADGE[u.role] ?? "badge-gray"}>{u.role}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={u.isActive ? "badge-green" : "badge-red"}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{u.lastLoginAt?.slice(0, 10) ?? "Never"}</td>
                <td className="px-4 py-3">
                  {me?.role === "superadmin" && u.id !== me?.id && (
                    <button
                      onClick={() => handleToggleActive(u)}
                      className={`text-xs font-medium hover:underline ${u.isActive ? "text-red-600" : "text-green-600"}`}
                    >
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Add Admin User</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <input type="password" className="input" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="superadmin">superadmin</option>
                  <option value="support">support</option>
                  <option value="readonly">readonly</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={creating}>
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

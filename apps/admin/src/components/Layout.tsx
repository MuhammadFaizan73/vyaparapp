import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { clearToken, getAdmin } from "../lib/auth";

const NAV = [
  { to: "/dashboard",      icon: "📊", label: "Dashboard" },
  { to: "/tenants",        icon: "🏢", label: "Companies" },
  { to: "/licenses",       icon: "🔑", label: "Licenses" },
  { to: "/support",        icon: "🎫", label: "Support" },
  { to: "/announcements",  icon: "📢", label: "Announcements" },
  { to: "/health",         icon: "💊", label: "System Health" },
  { to: "/users",          icon: "👤", label: "Admin Users" },
  { to: "/audit",          icon: "📋", label: "Audit Log" },
];

export default function Layout() {
  const navigate = useNavigate();
  const admin = getAdmin();

  function logout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-primary-dark text-white flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-lg font-bold tracking-tight">Vyapar Pakistan</div>
          <div className="text-xs text-white/50 mt-0.5">Super Admin</div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/65 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <span className="text-base">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="text-xs text-white/50 truncate">{admin?.name}</div>
          <div className="text-xs text-white/35 truncate mb-2">{admin?.email}</div>
          <button
            onClick={logout}
            className="w-full text-left text-xs text-white/50 hover:text-white transition-colors"
          >
            Sign out →
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { tenantStats } from "../lib/api";

interface Stats {
  total: number;
  newThisMonth: number;
  active: number;
  expired: number;
  expiring7: number;
  expiring30: number;
  dailyRegistrations: { date: string; count: number }[];
}

const PIE_COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#6b7280"];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    tenantStats().then(setStats).catch(console.error);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  const pieData = [
    { name: "Active", value: stats.active },
    { name: "Expiring (30d)", value: stats.expiring30 },
    { name: "Expired", value: stats.expired },
    { name: "Other", value: Math.max(0, stats.total - stats.active - stats.expired) },
  ];

  const cards = [
    { label: "Total Companies", value: stats.total, color: "text-gray-900", bg: "bg-blue-50 border-blue-100", click: "/tenants" },
    { label: "New This Month", value: stats.newThisMonth, color: "text-blue-700", bg: "bg-blue-50 border-blue-100", click: "/tenants" },
    { label: "Active Licenses", value: stats.active, color: "text-green-700", bg: "bg-green-50 border-green-100", click: "/licenses" },
    { label: "Expiring in 7 days", value: stats.expiring7, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-100", click: "/licenses?status=expiring7" },
    { label: "Expiring in 30 days", value: stats.expiring30, color: "text-orange-700", bg: "bg-orange-50 border-orange-100", click: "/licenses?status=expiring30" },
    { label: "Expired", value: stats.expired, color: "text-red-700", bg: "bg-red-50 border-red-100", click: "/licenses?status=expired" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of all registered companies and licenses</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => navigate(c.click)}
            className={`card p-5 text-left border hover:shadow-md transition-shadow ${c.bg}`}
          >
            <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-sm text-gray-500 mt-1">{c.label}</div>
          </button>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">New Registrations — Last 30 Days</h2>
          {stats.dailyRegistrations.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={stats.dailyRegistrations}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip labelFormatter={(v) => String(v)} />
                <Line type="monotone" dataKey="count" stroke="#0f5a72" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">License Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "View All Companies", to: "/tenants", icon: "🏢" },
          { label: "Manage Licenses", to: "/licenses", icon: "🔑" },
          { label: "Support Tickets", to: "/support", icon: "🎫" },
          { label: "System Health", to: "/health", icon: "💊" },
        ].map((q) => (
          <button
            key={q.to}
            onClick={() => navigate(q.to)}
            className="card p-4 text-left hover:shadow-md transition-shadow flex items-center gap-3"
          >
            <span className="text-2xl">{q.icon}</span>
            <span className="text-sm font-medium text-gray-700">{q.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

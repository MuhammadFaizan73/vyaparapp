import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { healthStats, healthChart } from "../lib/api";

interface Stats {
  total: number;
  errors: number;
  errorRate: string;
  p50Ms: number;
  p95Ms: number;
  activeSessions: number;
}

export default function Health() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([healthStats(), healthChart()])
      .then(([s, c]) => { setStats(s); setChart(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: "API Requests (24h)", value: stats.total, color: "text-gray-900" },
    { label: "5xx Errors (24h)", value: stats.errors, color: stats.errors > 0 ? "text-red-600" : "text-green-600" },
    { label: "Error Rate", value: stats.errorRate, color: stats.errors > 0 ? "text-red-600" : "text-green-600" },
    { label: "p50 Response", value: `${stats.p50Ms}ms`, color: "text-gray-700" },
    { label: "p95 Response", value: `${stats.p95Ms}ms`, color: stats.p95Ms > 1000 ? "text-yellow-600" : "text-gray-700" },
    { label: "Active Sessions (24h)", value: stats.activeSessions, color: "text-blue-700" },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
        <p className="text-sm text-gray-500">Last 24 hours</p>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cards.map((c) => (
              <div key={c.label} className="card p-5">
                <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
                <div className="text-sm text-gray-500 mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Hourly Request Volume (24h)</h2>
            {chart.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No metrics collected yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chart}>
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(11)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip labelFormatter={(v) => `Hour: ${String(v).slice(11)}:00`} />
                  <Bar dataKey="requests" fill="#0f5a72" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="errors" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Avg Response Time by Hour (ms)</h2>
            {chart.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No metrics yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chart}>
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(11)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip labelFormatter={(v) => `Hour: ${String(v).slice(11)}:00`} />
                  <Bar dataKey="avgMs" fill="#6366f1" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}

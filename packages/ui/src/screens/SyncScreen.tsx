import { useState, useEffect } from "react";
import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncStatus = "idle" | "syncing" | "done" | "error";

type ModuleSync = {
  label: string;
  key: string;
  count: number | null;
  lastSync: number | null; // timestamp ms
  status: SyncStatus;
  error?: string;
};

const SYNC_KEY = "vyapar_sync_meta";

function loadSyncMeta(): Record<string, { count: number; lastSync: number }> {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY) || "{}"); } catch { return {}; }
}
function saveSyncMeta(key: string, count: number) {
  const meta = loadSyncMeta();
  meta[key] = { count, lastSync: Date.now() };
  localStorage.setItem(SYNC_KEY, JSON.stringify(meta));
}

function age(ts: number | null): string {
  if (!ts) return "Never synced";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function staleness(ts: number | null): "fresh" | "stale" | "never" {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  if (diff < 3_600_000) return "fresh"; // < 1 hour
  return "stale";
}

// ─── Sync Data Screen ─────────────────────────────────────────────────────────

export function SyncDataScreen() {
  const meta = loadSyncMeta();

  const [modules, setModules] = useState<ModuleSync[]>([
    { label: "Parties",          key: "parties",      count: meta.parties?.count ?? null,      lastSync: meta.parties?.lastSync ?? null,      status: "idle" },
    { label: "Items",            key: "items",        count: meta.items?.count ?? null,        lastSync: meta.items?.lastSync ?? null,        status: "idle" },
    { label: "Transactions",     key: "transactions", count: meta.transactions?.count ?? null, lastSync: meta.transactions?.lastSync ?? null, status: "idle" },
    { label: "Account Info",     key: "tenant",       count: meta.tenant?.count ?? null,       lastSync: meta.tenant?.lastSync ?? null,       status: "idle" },
  ]);

  const [syncingAll, setSyncingAll] = useState(false);
  const [allDone, setAllDone] = useState(false);

  function updateModule(key: string, patch: Partial<ModuleSync>) {
    setModules(prev => prev.map(m => m.key === key ? { ...m, ...patch } : m));
  }

  async function syncModule(key: string) {
    updateModule(key, { status: "syncing", error: undefined });
    try {
      let count = 0;
      if (key === "parties")      { const d = await api.getParties();            count = d.length; }
      if (key === "items")        { const d = await api.getItems();              count = d.length; }
      if (key === "transactions") { const d = await api.getAllTransactions();     count = d.length; }
      if (key === "tenant")       { await api.getTenant();                        count = 1; }
      saveSyncMeta(key, count);
      updateModule(key, { status: "done", count, lastSync: Date.now() });
    } catch (e: any) {
      updateModule(key, { status: "error", error: e?.message ?? "Failed" });
    }
  }

  async function syncAll() {
    setSyncingAll(true);
    setAllDone(false);
    await Promise.all(modules.map(m => syncModule(m.key)));
    setSyncingAll(false);
    setAllDone(true);
    setTimeout(() => setAllDone(false), 3000);
  }

  const anyError = modules.some(m => m.status === "error");
  const allSyncing = modules.some(m => m.status === "syncing");

  return (
    <div className="sync-screen">
      <div className="sync-header">
        <div>
          <h2 className="sync-title">Sync Data</h2>
          <p className="sync-subtitle">Force-refresh all modules from the server to ensure your local view is up to date.</p>
        </div>
        <button
          className={`sync-btn-primary${syncingAll ? " sync-btn-primary--loading" : ""}`}
          onClick={syncAll}
          disabled={allSyncing}
        >
          {allSyncing ? <><span className="sync-spinner" />Syncing…</> : allDone ? "✓ All Synced" : "↻ Sync All Now"}
        </button>
      </div>

      {anyError && (
        <div className="sync-error-banner">
          ⚠ Some modules failed to sync. Check your connection and try again.
        </div>
      )}

      <div className="sync-module-grid">
        {modules.map(m => {
          const s = staleness(m.lastSync);
          return (
            <div key={m.key} className={`sync-card sync-card--${m.status === "error" ? "error" : s}`}>
              <div className="sync-card__top">
                <div>
                  <div className="sync-card__label">{m.label}</div>
                  <div className="sync-card__age">{age(m.lastSync)}</div>
                </div>
                <div className={`sync-dot sync-dot--${m.status === "syncing" ? "pulse" : m.status === "error" ? "error" : s === "fresh" ? "fresh" : "stale"}`} />
              </div>
              {m.count !== null && (
                <div className="sync-card__count">{m.count.toLocaleString()} records</div>
              )}
              {m.status === "error" && <div className="sync-card__error">{m.error}</div>}
              <button
                className="sync-card__btn"
                onClick={() => syncModule(m.key)}
                disabled={m.status === "syncing"}
              >
                {m.status === "syncing" ? <><span className="sync-spinner sync-spinner--sm" />Syncing…</> : "Sync Now"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="sync-info-box">
        <div className="sync-info-title">About Sync</div>
        <ul className="sync-info-list">
          <li>Your data is stored on the server — any device on the same account sees the same data after syncing.</li>
          <li><span className="sync-dot sync-dot--fresh sync-dot--inline" /> Fresh — synced within the last hour.</li>
          <li><span className="sync-dot sync-dot--stale sync-dot--inline" /> Stale — last sync was over 1 hour ago.</li>
          <li><span className="sync-dot sync-dot--never sync-dot--inline" /> Never synced this session.</li>
        </ul>
      </div>

      <style>{SYNC_STYLES}</style>
    </div>
  );
}

// ─── Backup Screen ────────────────────────────────────────────────────────────

type BackupRecord = { date: number; parties: number; items: number; transactions: number; size: string };
const BACKUP_HISTORY_KEY = "vyapar_backup_history";

function loadBackupHistory(): BackupRecord[] {
  try { return JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveBackupRecord(r: BackupRecord) {
  const hist = loadBackupHistory();
  hist.unshift(r);
  localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(hist.slice(0, 20))); // keep last 20
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BackupScreen() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<BackupRecord[]>(loadBackupHistory);
  const [progress, setProgress] = useState("");

  async function createBackup() {
    setStatus("loading");
    setError("");
    try {
      setProgress("Fetching parties…");
      const parties = await api.getParties();

      setProgress("Fetching items…");
      const items = await api.getItems();

      setProgress("Fetching transactions…");
      const transactions = await api.getAllTransactions();

      setProgress("Fetching account info…");
      const tenant = await api.getTenant();

      const payload = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tenant,
        parties,
        items,
        transactions,
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const ts = Date.now();
      const sizeKb = (blob.size / 1024).toFixed(1);
      const filename = `godigi-backup-${new Date(ts).toISOString().slice(0, 10)}.json`;
      downloadBlob(blob, filename);

      const record: BackupRecord = {
        date: ts,
        parties: parties.length,
        items: items.length,
        transactions: transactions.length,
        size: `${sizeKb} KB`,
      };
      saveBackupRecord(record);
      setHistory(loadBackupHistory());
      setStatus("done");
      setProgress("");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (e: any) {
      setError(e?.message ?? "Backup failed");
      setStatus("error");
      setProgress("");
    }
  }

  return (
    <div className="sync-screen">
      <div className="sync-header">
        <div>
          <h2 className="sync-title">Backup</h2>
          <p className="sync-subtitle">Download a complete copy of your data as a JSON file. Store it safely as an offline backup.</p>
        </div>
        <button
          className={`sync-btn-primary${status === "loading" ? " sync-btn-primary--loading" : ""}`}
          onClick={createBackup}
          disabled={status === "loading"}
        >
          {status === "loading"
            ? <><span className="sync-spinner" />{progress || "Preparing…"}</>
            : status === "done"
            ? "✓ Downloaded"
            : "⬇ Create Backup"}
        </button>
      </div>

      {status === "error" && (
        <div className="sync-error-banner">⚠ {error}</div>
      )}

      {/* What's included */}
      <div className="backup-included-grid">
        {[
          { icon: "👥", label: "Parties", desc: "Customers & suppliers" },
          { icon: "📦", label: "Items", desc: "Products & services" },
          { icon: "🧾", label: "Transactions", desc: "All sale & purchase records" },
          { icon: "🏢", label: "Account Info", desc: "Company name, settings" },
        ].map(c => (
          <div key={c.label} className="backup-included-card">
            <span className="backup-included-icon">{c.icon}</span>
            <div>
              <div className="backup-included-label">{c.label}</div>
              <div className="backup-included-desc">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* History */}
      <div className="backup-history">
        <div className="backup-history-title">Backup History</div>
        {history.length === 0 ? (
          <div className="backup-history-empty">No backups yet. Create your first backup above.</div>
        ) : (
          <table className="backup-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Parties</th>
                <th>Items</th>
                <th>Transactions</th>
                <th>File Size</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r, i) => (
                <tr key={i}>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.parties}</td>
                  <td>{r.items}</td>
                  <td>{r.transactions}</td>
                  <td>{r.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sync-info-box" style={{ marginTop: 20 }}>
        <div className="sync-info-title">Important Notes</div>
        <ul className="sync-info-list">
          <li>Backup files are saved to your Downloads folder.</li>
          <li>The file format is JSON — it can be opened in any text editor.</li>
          <li>Keep multiple backups on different dates for safety.</li>
          <li>Backup history below is only tracked on this device.</li>
        </ul>
      </div>

      <style>{SYNC_STYLES}</style>
    </div>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const SYNC_STYLES = `
.sync-screen {
  padding: 28px 32px;
  max-width: 860px;
}

.sync-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}
.sync-title { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
.sync-subtitle { font-size: 13px; color: #64748b; margin: 0; }

.sync-btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.sync-btn-primary:hover:not(:disabled) { background: #2563eb; }
.sync-btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

.sync-error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 13px;
  margin-bottom: 20px;
}

/* Sync module cards */
.sync-module-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}
.sync-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sync-card--fresh { border-color: #bbf7d0; background: #f0fdf4; }
.sync-card--stale { border-color: #fde68a; background: #fffbeb; }
.sync-card--never { border-color: #e5e7eb; }
.sync-card--error { border-color: #fecaca; background: #fef2f2; }

.sync-card__top { display: flex; justify-content: space-between; align-items: flex-start; }
.sync-card__label { font-size: 14px; font-weight: 600; color: #1e293b; }
.sync-card__age { font-size: 11.5px; color: #64748b; margin-top: 2px; }
.sync-card__count { font-size: 22px; font-weight: 700; color: #3b82f6; }
.sync-card__error { font-size: 11.5px; color: #dc2626; }
.sync-card__btn {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  color: #374151;
}
.sync-card__btn:hover:not(:disabled) { background: #e2e8f0; }
.sync-card__btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* Status dots */
.sync-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sync-dot--inline { display: inline-block; margin-right: 6px; vertical-align: middle; }
.sync-dot--fresh  { background: #22c55e; }
.sync-dot--stale  { background: #f59e0b; }
.sync-dot--never  { background: #d1d5db; }
.sync-dot--error  { background: #ef4444; }
.sync-dot--pulse  {
  background: #3b82f6;
  animation: sync-pulse 0.8s ease-in-out infinite alternate;
}
@keyframes sync-pulse { from { opacity: 1; } to { opacity: 0.3; } }

/* Spinner */
.sync-spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: sync-spin 0.7s linear infinite;
  flex-shrink: 0;
}
.sync-spinner--sm {
  width: 11px; height: 11px;
  border-color: rgba(55,65,81,0.3);
  border-top-color: #374151;
}
@keyframes sync-spin { to { transform: rotate(360deg); } }

/* Info box */
.sync-info-box {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px 20px;
}
.sync-info-title { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 10px; }
.sync-info-list {
  margin: 0;
  padding-left: 18px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sync-info-list li { font-size: 12.5px; color: #64748b; line-height: 1.5; }

/* Backup */
.backup-included-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}
.backup-included-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 16px;
}
.backup-included-icon { font-size: 24px; }
.backup-included-label { font-size: 13.5px; font-weight: 600; color: #1e293b; }
.backup-included-desc { font-size: 11.5px; color: #64748b; margin-top: 2px; }

.backup-history { }
.backup-history-title { font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 12px; }
.backup-history-empty { font-size: 13px; color: #94a3b8; padding: 20px 0; }
.backup-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.backup-table th {
  text-align: left;
  padding: 8px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
  color: #374151;
  font-size: 12px;
}
.backup-table td {
  padding: 9px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #374151;
}
.backup-table tr:last-child td { border-bottom: none; }
.backup-table tr:hover td { background: #f8fafc; }
`;

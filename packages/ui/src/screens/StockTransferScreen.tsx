import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Item, StockTransfer } from "@vyapar/api-client";
import { api } from "../lib/api";
import { useCompany } from "../lib/CompanyContext";
import { useStores } from "../lib/useStores";

type PendingLine = { itemId: string; itemName: string; unit: string; quantity: number };

const border = "#e2e8f0";
const textMuted = "#64748b";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function StockTransferScreen() {
  const { companies, selectedCompanyId } = useCompany();
  const [viewCompanyId, setViewCompanyId] = useState("");

  useEffect(() => {
    if (!viewCompanyId || !companies.some((c) => c.id === viewCompanyId)) {
      setViewCompanyId(selectedCompanyId ?? companies[0]?.id ?? "");
    }
  }, [companies, selectedCompanyId, viewCompanyId]);

  const { stores } = useStores(viewCompanyId || null);
  const [items, setItems] = useState<Item[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);

  const [date, setDate] = useState(todayISO());
  const [fromStoreId, setFromStoreId] = useState("");
  const [toStoreId, setToStoreId] = useState("");
  const [pickItemId, setPickItemId] = useState("");
  const [pickSearch, setPickSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [pickQty, setPickQty] = useState("");
  const [lines, setLines] = useState<PendingLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!viewCompanyId) return;
    api.getItems({ companyId: viewCompanyId }).then(setItems).catch(() => setItems([]));
  }, [viewCompanyId]);

  const loadTransfers = useMemo(
    () => async () => {
      if (!viewCompanyId) return;
      setLoadingTransfers(true);
      try {
        const rows = await api.getStockTransfers({ companyId: viewCompanyId, take: 50 });
        setTransfers(rows);
      } catch {
        setTransfers([]);
      } finally {
        setLoadingTransfers(false);
      }
    },
    [viewCompanyId],
  );

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers]);

  useEffect(() => {
    if (stores.length === 0) {
      setFromStoreId("");
      setToStoreId("");
      return;
    }
    setFromStoreId((prev) => (stores.some((s) => s.id === prev) ? prev : (stores.find((s) => s.isMain)?.id ?? stores[0].id)));
    setToStoreId((prev) => (stores.some((s) => s.id === prev) ? prev : (stores.find((s) => !s.isMain)?.id ?? stores[0].id)));
  }, [stores]);

  useEffect(() => {
    // From/To store must always differ — nudge To forward when they collide.
    if (fromStoreId && toStoreId && fromStoreId === toStoreId) {
      const other = stores.find((s) => s.id !== fromStoreId);
      if (other) setToStoreId(other.id);
    }
  }, [fromStoreId, toStoreId, stores]);

  const matches = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
    return filtered.slice(0, 20);
  }, [items, pickSearch]);

  function selectPickItem(item: Item) {
    setPickItemId(item.id);
    setPickSearch(item.name);
    setShowResults(false);
  }

  function closeResults() {
    setTimeout(() => setShowResults(false), 150);
  }

  function availableAt(itemId: string, storeId: string): number {
    const item = items.find((i) => i.id === itemId);
    if (!item) return 0;
    const entry = item.stocks.find((s) => s.storeId === storeId);
    return entry ? entry.quantity : 0;
  }

  function pendingQtyFor(itemId: string): number {
    return lines.filter((l) => l.itemId === itemId).reduce((sum, l) => sum + l.quantity, 0);
  }

  function addLine() {
    const item = items.find((i) => i.id === pickItemId);
    const qty = parseFloat(pickQty);
    if (!item || !qty || qty <= 0) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) => (l.itemId === item.id ? { ...l, quantity: l.quantity + qty } : l));
      }
      return [...prev, { itemId: item.id, itemName: item.name, unit: item.unit ?? "", quantity: qty }];
    });
    setPickItemId("");
    setPickSearch("");
    setPickQty("");
  }

  function removeLine(itemId: string) {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  const hasInsufficientLine = lines.some((l) => l.quantity > availableAt(l.itemId, fromStoreId));
  const canSave = fromStoreId && toStoreId && fromStoreId !== toStoreId && lines.length > 0 && !hasInsufficientLine && !busy;

  async function handleSave() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await api.createStockTransfer({
        companyId: viewCompanyId,
        fromStoreId,
        toStoreId,
        date,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unit: l.unit || undefined })),
      });
      setLines([]);
      setDate(todayISO());
      await Promise.all([loadTransfers(), api.getItems({ companyId: viewCompanyId }).then(setItems)]);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Could not save transfer.";
      setError(String(msg));
    } finally {
      setBusy(false);
    }
  }

  if (companies.length > 0 && stores.length < 2) {
    return (
      <section className="content" style={{ padding: 24 }}>
        <div style={{ background: "#fff", border: `1px solid ${border}`, borderRadius: 12, padding: "48px 24px", textAlign: "center", color: textMuted }}>
          You need at least two stores to transfer stock. Add another store from Manage Stores first.
        </div>
      </section>
    );
  }

  return (
    <section className="content" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Transfer form card */}
      <div style={{ background: "#fff", border: `1px solid ${border}`, borderRadius: 12, overflow: "visible" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${border}` }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#0f172a" }}>New Stock Transfer</h2>
          {companies.length > 1 && (
            <select
              className="items-form-input"
              style={{ maxWidth: 280, cursor: "pointer" }}
              value={viewCompanyId}
              onChange={(e) => setViewCompanyId(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Field label="Date">
              <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="From Store">
              <select style={{ ...inputStyle, cursor: "pointer" }} value={fromStoreId} onChange={(e) => setFromStoreId(e.target.value)}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="To Store">
              <select style={{ ...inputStyle, cursor: "pointer" }} value={toStoreId} onChange={(e) => setToStoreId(e.target.value)}>
                {stores.filter((s) => s.id !== fromStoreId).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 16, alignItems: "end" }}>
            <Field label="Item">
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="Search item…"
                  value={pickSearch}
                  onChange={(e) => { setPickSearch(e.target.value); setPickItemId(""); setShowResults(true); }}
                  onFocus={() => setShowResults(true)}
                  onBlur={closeResults}
                />
                {showResults && (
                  <div
                    style={{
                      position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
                      background: "#fff", border: `1px solid ${border}`, borderRadius: 8,
                      boxShadow: "0 8px 28px rgba(15,23,42,0.16)", maxHeight: 320, overflowY: "auto",
                    }}
                  >
                    {matches.length === 0 && (
                      <p style={{ padding: 18, textAlign: "center", fontSize: 12.5, color: "#9ca3af", margin: 0 }}>No items found</p>
                    )}
                    {matches.map((i) => {
                      const available = availableAt(i.id, fromStoreId) - pendingQtyFor(i.id);
                      return (
                        <button
                          key={i.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPickItem(i)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                            padding: "9px 14px", background: "none", border: "none", borderBottom: `1px solid #f3f4f6`,
                            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{i.name}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: available > 0 ? "#16a34a" : available < 0 ? "#ef4444" : "#374151" }}>
                            Available: {available}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Field>
            <Field label="Quantity">
              <input type="number" style={inputStyle} value={pickQty} onChange={(e) => setPickQty(e.target.value)} min="0" />
            </Field>
            <button
              type="button"
              onClick={addLine}
              disabled={!pickItemId || !pickQty}
              style={{
                background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8,
                padding: "11px 20px", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                cursor: pickItemId && pickQty ? "pointer" : "not-allowed", opacity: pickItemId && pickQty ? 1 : 0.6,
                whiteSpace: "nowrap", height: 40,
              }}
            >
              + Add Item
            </button>
          </div>

          {lines.length > 0 && (
            <div style={{ border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden" }}>
              {lines.map((l, idx) => {
                const insufficient = l.quantity > availableAt(l.itemId, fromStoreId);
                return (
                  <div
                    key={l.itemId}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 16px", borderTop: idx > 0 ? `1px solid ${border}` : "none",
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: "#0f172a" }}>
                      {l.itemName}
                      {insufficient && (
                        <span style={{ color: "#dc2626", fontSize: 11.5, marginLeft: 10 }}>
                          Not enough stock (available {availableAt(l.itemId, fromStoreId)})
                        </span>
                      )}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{l.quantity} {l.unit}</span>
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => removeLine(l.itemId)}
                        style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 15, padding: 4 }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              style={{
                background: "#6366f1", color: "#fff", border: "none", borderRadius: 8,
                padding: "11px 24px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit",
                cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.6,
              }}
            >
              {busy ? "Saving…" : "Save Transfer"}
            </button>
          </div>
        </div>
      </div>

      {/* Transfer history card */}
      <div style={{ background: "#fff", border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${border}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a" }}>Transfer History</h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>From → To</th>
              <th style={thStyle}>Items</th>
              <th style={{ ...thStyle, textAlign: "right", paddingRight: 24 }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {loadingTransfers && (
              <tr><td colSpan={4} style={emptyCellStyle}>Loading…</td></tr>
            )}
            {!loadingTransfers && transfers.length === 0 && (
              <tr><td colSpan={4} style={emptyCellStyle}>No transfers yet.</td></tr>
            )}
            {!loadingTransfers && transfers.map((t) => (
              <tr key={t.id} style={{ borderTop: `1px solid ${border}` }}>
                <td style={{ ...tdStyle, color: textMuted }}>{fmtDate(t.date)}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0f172a" }}>{t.fromStoreName} → {t.toStoreName}</td>
                <td style={{ ...tdStyle, color: textMuted }}>{t.lines.map((l) => l.itemName).join(", ")}</td>
                <td style={{ ...tdStyle, textAlign: "right", paddingRight: 24, fontWeight: 600, color: "#0f172a" }}>{t.totalQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 13.5,
  color: "#0f172a",
  border: `1px solid ${border}`,
  borderRadius: 8,
  fontFamily: "inherit",
  background: "#fff",
  height: 40,
  boxSizing: "border-box",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 24px",
  fontSize: 11,
  fontWeight: 700,
  color: textMuted,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const tdStyle: CSSProperties = {
  padding: "14px 24px",
  fontSize: 13.5,
};

const emptyCellStyle: CSSProperties = {
  padding: "40px 24px",
  textAlign: "center",
  fontSize: 13,
  color: "#94a3b8",
};

import { useEffect, useMemo, useState } from "react";
import type { Item, StockTransfer } from "@vyapar/api-client";
import { api } from "../lib/api";
import { useCompany } from "../lib/CompanyContext";
import { useStores } from "../lib/useStores";

type PendingLine = { itemId: string; itemName: string; unit: string; quantity: number };

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
      <section className="content">
        <div style={{ maxWidth: 640, padding: "32px 16px", textAlign: "center", color: "#64748b" }}>
          You need at least two stores to transfer stock. Add another store from Manage Stores first.
        </div>
      </section>
    );
  }

  return (
    <section className="content">
      <div style={{ maxWidth: 760 }}>
        {companies.length > 1 && (
          <div className="items-form-row" style={{ marginBottom: 12 }}>
            <div className="items-form-field" style={{ flex: 1 }}>
              <label className="items-form-label">Company</label>
              <select
                className="items-form-input"
                value={viewCompanyId}
                onChange={(e) => setViewCompanyId(e.target.value)}
                style={{ cursor: "pointer" }}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="items-form-row">
          <div className="items-form-field">
            <label className="items-form-label">Date</label>
            <input type="date" className="items-form-input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="items-form-field">
            <label className="items-form-label">From Store</label>
            <select className="items-form-input" value={fromStoreId} onChange={(e) => setFromStoreId(e.target.value)} style={{ cursor: "pointer" }}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="items-form-field">
            <label className="items-form-label">To Store</label>
            <select className="items-form-input" value={toStoreId} onChange={(e) => setToStoreId(e.target.value)} style={{ cursor: "pointer" }}>
              {stores.filter((s) => s.id !== fromStoreId).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="items-form-row" style={{ marginTop: 8 }}>
          <div className="items-form-field" style={{ flex: 2 }}>
            <label className="items-form-label">Item</label>
            <select className="items-form-input" value={pickItemId} onChange={(e) => setPickItemId(e.target.value)} style={{ cursor: "pointer" }}>
              <option value="">Select item</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — Available at {stores.find((s) => s.id === fromStoreId)?.name ?? "store"}: {availableAt(i.id, fromStoreId) - pendingQtyFor(i.id)}
                </option>
              ))}
            </select>
          </div>
          <div className="items-form-field">
            <label className="items-form-label">Quantity</label>
            <input
              type="number"
              className="items-form-input"
              value={pickQty}
              onChange={(e) => setPickQty(e.target.value)}
              min="0"
            />
          </div>
          <div className="items-form-field" style={{ justifyContent: "flex-end" }}>
            <label className="items-form-label">&nbsp;</label>
            <div className="items-add-btn">
              <button type="button" className="items-add-btn__main" onClick={addLine} disabled={!pickItemId || !pickQty}>
                + Add Item
              </button>
            </div>
          </div>
        </div>

        {lines.length > 0 && (
          <div className="items-rows" style={{ marginTop: 12 }}>
            {lines.map((l) => {
              const insufficient = l.quantity > availableAt(l.itemId, fromStoreId);
              return (
                <div key={l.itemId} className="items-row" style={{ cursor: "default" }}>
                  <span className="items-row__name">
                    {l.itemName}
                    {insufficient && (
                      <span style={{ color: "#dc2626", fontSize: 11, marginLeft: 8 }}>
                        Not enough stock (available {availableAt(l.itemId, fromStoreId)})
                      </span>
                    )}
                  </span>
                  <span className="items-row__qty">{l.quantity} {l.unit}</span>
                  <button type="button" className="items-row__dots" aria-label="Remove" onClick={() => removeLine(l.itemId)}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error && <div className="company-form-modal__error">{error}</div>}

        <div className="company-form-modal__actions" style={{ marginTop: 16 }}>
          <div className="company-form-modal__spacer" />
          <button type="button" className="company-form-modal__save" onClick={handleSave} disabled={!canSave}>
            {busy ? "Saving…" : "Save Transfer"}
          </button>
        </div>

        <h3 style={{ marginTop: 32, marginBottom: 8, fontSize: 15, fontWeight: 700 }}>Transfer History</h3>
        <div className="items-table-header">
          <span className="items-table-header__item">TRANSFER</span>
          <span className="items-table-header__qty">QTY</span>
        </div>
        <div className="items-rows">
          {loadingTransfers && <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>}
          {!loadingTransfers && transfers.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No transfers yet.</div>
          )}
          {!loadingTransfers && transfers.map((t) => (
            <div key={t.id} className="items-row" style={{ cursor: "default" }}>
              <span className="items-row__name">
                {fmtDate(t.date)} · {t.fromStoreName} → {t.toStoreName}
                <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: 8 }}>
                  {t.lines.map((l) => l.itemName).join(", ")}
                </span>
              </span>
              <span className="items-row__qty">{t.totalQty}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

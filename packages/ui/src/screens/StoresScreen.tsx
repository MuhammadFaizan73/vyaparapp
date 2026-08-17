import { useEffect, useState, type CSSProperties } from "react";
import type { Store } from "@vyapar/api-client";
import { useCompany } from "../lib/CompanyContext";
import { useStores } from "../lib/useStores";
import { StoreFormModal } from "./StoreFormModal";

type Props = { onOpenStockTransfer?: () => void };

const border = "#e2e8f0";
const textMuted = "#64748b";

export function StoresScreen({ onOpenStockTransfer }: Props = {}) {
  const { companies, selectedCompanyId } = useCompany();
  const [viewCompanyId, setViewCompanyId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (!viewCompanyId || !companies.some((c) => c.id === viewCompanyId)) {
      setViewCompanyId(selectedCompanyId ?? companies[0]?.id ?? "");
    }
  }, [companies, selectedCompanyId, viewCompanyId]);

  const { stores, loading, refresh } = useStores(viewCompanyId || null);

  function openAdd() {
    setEditingStore(null);
    setShowForm(true);
  }

  function openEdit(store: Store) {
    setEditingStore(store);
    setShowForm(true);
  }

  async function handleSaved() {
    setShowForm(false);
    setEditingStore(null);
    await refresh();
  }

  async function handleDeleted() {
    setShowForm(false);
    setEditingStore(null);
    await refresh();
  }

  return (
    <section className="content" style={{ padding: 24 }}>
      <div style={{ background: "#fff", border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: `1px solid ${border}`,
          }}
        >
          {companies.length > 1 ? (
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
          ) : (
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#0f172a" }}>Manage Stores</h2>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            {onOpenStockTransfer && (
              <button
                type="button"
                onClick={onOpenStockTransfer}
                style={{
                  background: "#fff", color: "#3b82f6", border: "1px solid #3b82f6",
                  borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Transfer Stock
              </button>
            )}
            <button
              type="button"
              onClick={openAdd}
              disabled={!viewCompanyId}
              style={{
                background: "#3b82f6", color: "#fff", border: "none",
                borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600,
                cursor: viewCompanyId ? "pointer" : "not-allowed", opacity: viewCompanyId ? 1 : 0.6,
                fontFamily: "inherit",
              }}
            >
              + Add Store
            </button>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={thStyle}>Store Name</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Phone</th>
              <th style={{ ...thStyle, textAlign: "right", paddingRight: 24 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} style={emptyCellStyle}>Loading…</td>
              </tr>
            )}
            {!loading && stores.length === 0 && (
              <tr>
                <td colSpan={4} style={emptyCellStyle}>No stores yet — click "+ Add Store" to create one.</td>
              </tr>
            )}
            {!loading && stores.map((store) => (
              <tr
                key={store.id}
                onMouseEnter={() => setHoveredId(store.id)}
                onMouseLeave={() => setHoveredId((v) => (v === store.id ? null : v))}
                style={{
                  borderTop: `1px solid ${border}`,
                  background: hoveredId === store.id ? "#f8fafc" : "transparent",
                }}
              >
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{store.name}</span>
                    {store.isMain && (
                      <span
                        style={{
                          fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#dcfce7",
                          borderRadius: 4, padding: "2px 6px", letterSpacing: 0.3,
                        }}
                      >
                        MAIN STORE
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ ...tdStyle, color: textMuted }}>{store.storeType ?? "Store"}</td>
                <td style={{ ...tdStyle, color: textMuted }}>{store.phone || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "right", paddingRight: 24 }}>
                  <button
                    type="button"
                    onClick={() => openEdit(store)}
                    style={{
                      background: "none", border: "none", color: "#3b82f6", fontSize: 13,
                      fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "4px 8px",
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && viewCompanyId && (
        <StoreFormModal
          store={editingStore}
          companyId={viewCompanyId}
          onClose={() => { setShowForm(false); setEditingStore(null); }}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </section>
  );
}

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

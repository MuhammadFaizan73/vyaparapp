import { useEffect, useState } from "react";
import type { Store } from "@vyapar/api-client";
import { useCompany } from "../lib/CompanyContext";
import { useStores } from "../lib/useStores";
import { StoreFormModal } from "./StoreFormModal";
import { StoresIcon } from "../components/icons";

type Props = { onOpenStockTransfer?: () => void };

export function StoresScreen({ onOpenStockTransfer }: Props = {}) {
  const { companies, selectedCompanyId } = useCompany();
  const [viewCompanyId, setViewCompanyId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

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
    <section className="content">
      <div style={{ maxWidth: 760 }}>
        <div className="items-list-header" style={{ marginBottom: 0 }}>
          {companies.length > 1 ? (
            <select
              className="items-form-input"
              style={{ maxWidth: 260, cursor: "pointer" }}
              value={viewCompanyId}
              onChange={(e) => setViewCompanyId(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Manage Stores</h2>
          )}

          <div className="items-add-btn-wrap">
            {onOpenStockTransfer && (
              <button type="button" className="items-add-btn__main" style={{ marginRight: 8 }} onClick={onOpenStockTransfer}>
                Transfer Stock
              </button>
            )}
            <button type="button" className="items-add-btn__main" onClick={openAdd} disabled={!viewCompanyId}>
              + Add Store
            </button>
          </div>
        </div>

        <div className="items-table-header" style={{ marginTop: 16 }}>
          <span className="items-table-header__item">STORE</span>
          <span className="items-table-header__qty">TYPE</span>
        </div>

        <div className="items-rows">
          {loading && <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>}
          {!loading && stores.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              No stores yet.
            </div>
          )}
          {!loading && stores.map((store) => (
            <button
              key={store.id}
              type="button"
              className="items-row"
              onClick={() => openEdit(store)}
            >
              <span className="items-row__name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StoresIcon />
                {store.name}
                {store.isMain && (
                  <span className="badge badge--active" style={{ fontSize: 10 }}>MAIN STORE</span>
                )}
              </span>
              <span className="items-row__qty">{store.storeType ?? "Store"}</span>
            </button>
          ))}
        </div>
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

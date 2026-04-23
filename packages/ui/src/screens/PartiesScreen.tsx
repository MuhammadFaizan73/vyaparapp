import { useEffect, useMemo, useState } from "react";
import type { Party } from "@vyapar/api-client";
import { api } from "../lib/api";
import { AddPartyModal } from "./AddPartyModal";

function fmt(n: number): string {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PartiesScreen() {
  const [parties, setParties] = useState<Party[]>([]);
  const [selected, setSelected] = useState<Party | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const data = await api.getParties();
      setParties(data);
      if (data.length > 0) setSelected(data[0]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () =>
      parties.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [parties, search],
  );

  function handleSaved(party: Party) {
    setParties((prev) => [...prev, party]);
    setSelected(party);
    setShowAdd(false);
  }

  return (
    <>
      {/* Page sub-header */}
      <div className="page-header">
        <button type="button" className="page-header__title">
          Parties
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" className="btn-primary" onClick={() => setShowAdd(true)}>
          + Add Party
        </button>
      </div>

      {/* Two-column layout */}
      <div className="parties-layout">
        {/* Left: party list */}
        <div className="parties-list">
          <div className="parties-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="parties-search__icon">
              <circle cx="11" cy="11" r="6" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              placeholder="Search Party Name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="parties-list__header">
            <span>
              Party Name
              <FilterIcon />
            </span>
            <span>Amount</span>
          </div>

          <div className="parties-list__items">
            {loading && <div className="parties-list__loading">Loading…</div>}
            {!loading && filtered.length === 0 && (
              <div className="parties-list__empty">No parties found</div>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`party-row${selected?.id === p.id ? " party-row--active" : ""}`}
                onClick={() => setSelected(p)}
              >
                <span className="party-row__name">{p.name}</span>
                <span className={`party-row__amount${p.balance < 0 ? " party-row__amount--negative" : ""}`}>
                  {fmt(p.balance)}
                </span>
              </button>
            ))}
          </div>

          <div className="parties-list__tip">
            <ContactsIcon />
            <span>
              Easily convert your <strong>Phone contacts</strong> into parties
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Right: party detail */}
        <div className="parties-detail">
          {selected ? (
            <>
              <div className="party-detail__header">
                <div className="party-detail__info">
                  <div className="party-detail__name-row">
                    <h2 className="party-detail__name">{selected.name}</h2>
                    <button type="button" className="party-detail__edit-btn" aria-label="Edit">
                      <EditIcon />
                    </button>
                  </div>
                  {selected.phone && (
                    <div className="party-detail__phone-block">
                      <span className="party-detail__field-label">Phone Number</span>
                      <p className="party-detail__field-value">{selected.phone}</p>
                    </div>
                  )}
                </div>
                <div className="party-detail__actions">
                  <button type="button" className="party-detail__action-btn">
                    <WhatsAppIcon />
                  </button>
                  <button type="button" className="party-detail__action-btn">
                    <RefreshIcon />
                  </button>
                </div>
              </div>

              <div className="party-transactions">
                <div className="party-transactions__header">
                  <h3 className="party-transactions__title">Transactions</h3>
                  <div className="party-transactions__tools">
                    <button type="button" className="party-transactions__tool-btn"><SearchSmIcon /></button>
                    <button type="button" className="party-transactions__tool-btn"><PrintIcon /></button>
                    <button type="button" className="party-transactions__tool-btn"><DownloadIcon /></button>
                  </div>
                </div>

                <div className="party-transactions__cols">
                  {["Type", "Number", "Date", "Total", "Balance"].map((col) => (
                    <div key={col} className="party-transactions__col">
                      {col} <FilterIcon />
                    </div>
                  ))}
                </div>

                <div className="party-transactions__empty">
                  <EmptyTransactionsIllustration />
                  <p className="party-transactions__empty-title">No Transactions to show</p>
                  <p className="party-transactions__empty-sub">You haven&apos;t added any transactions yet.</p>
                </div>
              </div>
            </>
          ) : (
            <div className="party-detail__placeholder">Select a party to view details</div>
          )}
        </div>
      </div>

      {showAdd && <AddPartyModal onClose={() => setShowAdd(false)} onSaved={handleSaved} />}
    </>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" style={{ marginLeft: 4, flexShrink: 0 }}>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.135.562 4.14 1.542 5.874L0 24l6.302-1.51A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.96 0-3.792-.534-5.362-1.463l-.386-.228-3.98.953.98-3.884-.252-.4A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
      <path d="M4 12a8 8 0 0 1 14-5.3" strokeLinecap="round" />
      <path d="M18 3v4h-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12a8 8 0 0 1-14 5.3" strokeLinecap="round" />
      <path d="M6 21v-4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchSmIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <path d="M6 9V2h12v7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="14" width="12" height="8" rx="1" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m7 10 5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18" style={{ color: "#3b82f6", flexShrink: 0 }}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5" strokeLinecap="round" />
      <path d="M19 8h3M19 12h3" strokeLinecap="round" />
    </svg>
  );
}

function EmptyTransactionsIllustration() {
  return (
    <svg viewBox="0 0 120 100" width="120" height="100" fill="none">
      <rect x="20" y="15" width="80" height="70" rx="8" fill="#dbeafe" />
      <rect x="30" y="28" width="60" height="6" rx="3" fill="#93c5fd" />
      <rect x="30" y="40" width="44" height="5" rx="2.5" fill="#bfdbfe" />
      <rect x="30" y="51" width="50" height="5" rx="2.5" fill="#bfdbfe" />
      <rect x="30" y="62" width="38" height="5" rx="2.5" fill="#bfdbfe" />
      <circle cx="88" cy="72" r="16" fill="#3b82f6" opacity=".15" />
      <path d="M82 72h12M88 66v12" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

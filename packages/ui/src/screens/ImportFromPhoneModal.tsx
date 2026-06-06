import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "../lib/api";

type Props = {
  onClose: () => void;
  onImported?: (count: number) => void;
};

type Contact = { name: string; phone?: string; email?: string };
type Stage = "generating" | "waiting" | "review" | "importing" | "done" | "error";

export function ImportFromPhoneModal({ onClose, onImported }: Props) {
  const [stage, setStage] = useState<Stage>("generating");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [pickUrl, setPickUrl] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importErr, setImportErr] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function init() {
    try {
      const { id } = await api.createImportSession();
      setSessionId(id);

      const host = window.location.hostname === "localhost" ? await getLanIp() : window.location.hostname;
      const url = `http://${host}:3000/api/import-sessions/${id}/pick`;
      setPickUrl(url);

      const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 2, color: { dark: "#1b2a4a", light: "#ffffff" } });
      setQrDataUrl(dataUrl);
      setStage("waiting");

      pollRef.current = setInterval(() => void poll(id), 2000);
    } catch {
      setStage("error");
    }
  }

  async function poll(id: string) {
    try {
      const { status, contacts: c } = await api.pollImportSession(id);
      if (status === "complete" && c.length > 0) {
        if (pollRef.current) clearInterval(pollRef.current);
        setContacts(c);
        setSelected(new Set(c.map((_, i) => i)));
        setStage("review");
      }
    } catch { /* keep polling */ }
  }

  function toggleContact(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map((_, i) => i)));
  }

  async function doImport() {
    const toImport = contacts.filter((_, i) => selected.has(i));
    if (!toImport.length) return;
    setStage("importing");
    let ok = 0;
    for (const c of toImport) {
      try {
        await api.createParty({ name: c.name, phone: c.phone || undefined, email: c.email || undefined });
        ok++;
      } catch { /* skip duplicates */ }
    }
    setImportedCount(ok);
    setStage("done");
    onImported?.(ok);
  }

  async function getLanIp(): Promise<string> {
    try {
      const res = await fetch("/api/import-sessions/lan-ip").catch(() => null);
      if (res?.ok) { const d = await res.json() as { ip: string }; return d.ip; }
    } catch { /* fallback */ }
    return "localhost";
  }

  const SupportBar = () => (
    <div className="import-support-bar">
      <span className="import-support-bar__text">
        | WhatsApp Chat Support
        <svg viewBox="0 0 24 24" fill="#25d366" width="14" height="14" style={{ margin: "0 4px" }}>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.135.562 4.14 1.542 5.874L0 24l6.302-1.51A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.96 0-3.792-.534-5.362-1.463l-.386-.228-3.98.953.98-3.884-.252-.4A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
        (+971) 501 759 794 |
        <a href="#" className="import-support-bar__link" style={{ marginLeft: 6 }}>Get Instant Online Support</a>
      </span>
    </div>
  );

  return (
    <div className="import-backdrop">
      <SupportBar />
      <div className="import-main">
        <div className="import-topbar">
          <span className="import-topbar__title">Import from Phone</span>
          <button type="button" className="import-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Generating ── */}
        {stage === "generating" && (
          <div className="phone-import-center">
            <div className="phone-import-spinner" />
            <p className="phone-import-hint">Generating secure link…</p>
          </div>
        )}

        {/* ── Waiting for scan ── */}
        {stage === "waiting" && (
          <div className="phone-import-center">
            <div className="phone-import-qr-card">
              {qrDataUrl
                ? <img src={qrDataUrl} alt="QR Code" width={220} height={220} />
                : <div style={{ width: 220, height: 220, background: "#f1f5f9", borderRadius: 8 }} />
              }
            </div>
            <p className="phone-import-title">Scan This QR On Your Phone</p>
            <p className="phone-import-sub">Or Open the link we've sent on your WhatsApp/SMS</p>
            {pickUrl && (
              <a href={pickUrl} target="_blank" rel="noreferrer" className="phone-import-link">
                {pickUrl}
              </a>
            )}
            <div className="phone-import-pulse">
              <span className="phone-import-dot" />
              Waiting for phone…
            </div>
          </div>
        )}

        {/* ── Review contacts ── */}
        {stage === "review" && (
          <>
            <div className="import-review-body">
              <div className="import-review-section-title">
                {contacts.length} contact{contacts.length !== 1 ? "s" : ""} received — select which to import
              </div>
              <div className="import-table-wrap">
                <div style={{ padding: "8px 0 12px" }}>
                  <button type="button" className="phone-import-select-all" onClick={toggleAll}>
                    {selected.size === contacts.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <table className="import-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input type="checkbox" checked={selected.size === contacts.length} onChange={toggleAll} />
                      </th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c, i) => (
                      <tr key={i} className={selected.has(i) ? "" : "import-table__row--unselected"}>
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" checked={selected.has(i)} onChange={() => toggleContact(i)} />
                        </td>
                        <td>{c.name}</td>
                        <td>{c.phone ?? ""}</td>
                        <td>{c.email ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {importErr && <div className="form-error" style={{ margin: "0 24px 12px" }}>{importErr}</div>}
            <div className="import-review-footer">
              <button type="button" className="import-import-btn" style={{ background: "#f1f5f9", color: "#475569", marginRight: 10 }} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={`import-import-btn${selected.size > 0 ? " import-import-btn--active" : ""}`}
                disabled={selected.size === 0}
                onClick={() => void doImport()}
              >
                Import {selected.size} Contact{selected.size !== 1 ? "s" : ""}
              </button>
            </div>
          </>
        )}

        {/* ── Importing ── */}
        {stage === "importing" && (
          <div className="phone-import-center">
            <div className="phone-import-spinner" />
            <p className="phone-import-hint">Importing contacts…</p>
          </div>
        )}

        {/* ── Done ── */}
        {stage === "done" && (
          <div className="phone-import-center">
            <svg viewBox="0 0 64 64" width="80" height="80" fill="none">
              <circle cx="32" cy="32" r="32" fill="#dcfce7" />
              <path d="M20 32l9 9 15-15" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="phone-import-title" style={{ color: "#16a34a" }}>Import Complete</p>
            <p className="phone-import-sub">{importedCount} part{importedCount !== 1 ? "ies" : "y"} added successfully.</p>
            <button type="button" className="import-import-btn import-import-btn--active" style={{ marginTop: 20 }} onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {stage === "error" && (
          <div className="phone-import-center">
            <p className="phone-import-title" style={{ color: "#ef4444" }}>Could not create session</p>
            <p className="phone-import-sub">Make sure the backend is running and you are logged in.</p>
            <button type="button" className="import-import-btn import-import-btn--active" style={{ marginTop: 20 }} onClick={() => { setStage("generating"); void init(); }}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

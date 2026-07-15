import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { randomUUID } from "crypto";

type Contact = { name: string; phone?: string; email?: string };
type Session = {
  id: string;
  tenantId: string;
  status: "pending" | "complete";
  contacts: Contact[];
  createdAt: number;
};

@Injectable()
export class ImportSessionsService {
  private readonly sessions = new Map<string, Session>();

  create(tenantId: string) {
    // Clean up sessions older than 30 minutes
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [k, s] of this.sessions) {
      if (s.createdAt < cutoff) this.sessions.delete(k);
    }

    const id = randomUUID();
    this.sessions.set(id, { id, tenantId, status: "pending", contacts: [], createdAt: Date.now() });
    return { id };
  }

  getStatus(id: string, tenantId: string) {
    const s = this.sessions.get(id);
    if (!s) throw new NotFoundException("Session not found");
    if (s.tenantId !== tenantId) throw new ForbiddenException();
    return { status: s.status, contacts: s.contacts };
  }

  submitContacts(id: string, contacts: Contact[]) {
    const s = this.sessions.get(id);
    if (!s) throw new NotFoundException("Session not found or expired");
    s.contacts = contacts;
    s.status = "complete";
    return { ok: true, count: contacts.length };
  }

  getMobileHtml(id: string): string {
    const s = this.sessions.get(id);
    const expired = !s || s.status === "complete";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Import Contacts — Godigi</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f6fa; color: #1e293b; }
    .header { background: #1b2a4a; color: #fff; padding: 16px 20px; display: flex; align-items: center; gap: 12px; }
    .header h1 { font-size: 17px; font-weight: 700; }
    .logo { width: 36px; height: 36px; background: #fbbf24; border-radius: 8px; display: grid; place-items: center; font-size: 18px; font-weight: 800; color: #1b2a4a; flex-shrink: 0; }
    .body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .card h2 { font-size: 15px; font-weight: 700; margin-bottom: 14px; color: #0f172a; }
    .contact-list { display: flex; flex-direction: column; gap: 2px; max-height: 55vh; overflow-y: auto; }
    .contact-item { display: flex; align-items: center; gap: 12px; padding: 11px 8px; border-radius: 8px; cursor: pointer; transition: background 100ms; }
    .contact-item:hover, .contact-item.selected { background: #eff6ff; }
    .contact-item input[type=checkbox] { width: 18px; height: 18px; accent-color: #3b82f6; flex-shrink: 0; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#3b82f6,#6366f1); color: #fff; font-size: 14px; font-weight: 700; display: grid; place-items: center; flex-shrink: 0; text-transform: uppercase; }
    .contact-info { flex: 1; min-width: 0; }
    .contact-name { font-size: 14px; font-weight: 600; color: #0f172a; }
    .contact-phone { font-size: 12px; color: #64748b; margin-top: 1px; }
    .search-wrap { position: relative; margin-bottom: 10px; }
    .search-wrap svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
    .search-input { width: 100%; padding: 10px 12px 10px 36px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-family: inherit; font-size: 14px; outline: none; }
    .search-input:focus { border-color: #3b82f6; }
    .actions { display: flex; gap: 10px; }
    .btn { flex: 1; padding: 13px; border: none; border-radius: 10px; font-family: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
    .btn-ghost { background: #f1f5f9; color: #475569; }
    .select-all { font-size: 13px; font-weight: 600; color: #3b82f6; background: none; border: none; cursor: pointer; padding: 4px 0; margin-bottom: 6px; display: block; }
    .count-badge { display: inline-flex; align-items: center; justify-content: center; background: #3b82f6; color: #fff; border-radius: 999px; font-size: 11px; font-weight: 700; min-width: 20px; height: 20px; padding: 0 5px; margin-left: 6px; }
    .success { text-align: center; padding: 40px 20px; }
    .success svg { margin: 0 auto 16px; display: block; }
    .success h2 { font-size: 20px; font-weight: 700; color: #16a34a; margin-bottom: 8px; }
    .success p { font-size: 14px; color: #64748b; }
    .expired { text-align: center; padding: 40px 20px; }
    .expired h2 { font-size: 18px; color: #ef4444; margin-bottom: 8px; }
    .empty { text-align: center; padding: 24px; color: #94a3b8; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">V</div>
    <h1>Godigi</h1>
  </div>
  <div class="body">
${expired ? `
    <div class="expired">
      <h2>Link Expired</h2>
      <p>This import link has already been used or expired. Please generate a new one from the desktop app.</p>
    </div>
` : `
    <div id="picker-view">
      <div class="card">
        <h2>Select Contacts to Import <span id="count-badge" class="count-badge" style="display:none">0</span></h2>
        <div class="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
            <circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/>
          </svg>
          <input class="search-input" id="search" placeholder="Search contacts..." oninput="filterContacts()" />
        </div>
        <button class="select-all" onclick="toggleAll()">Select All</button>
        <div class="contact-list" id="contact-list">
          <div class="empty">
            <p>Loading contacts…</p>
            <p style="margin-top:8px;font-size:12px">Grant contact permission when prompted</p>
          </div>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" onclick="clearAll()">Clear All</button>
        <button class="btn btn-primary" id="import-btn" onclick="submitSelected()" disabled>
          Import Selected
        </button>
      </div>
    </div>
    <div id="success-view" class="success" style="display:none">
      <svg viewBox="0 0 64 64" width="72" height="72" fill="none">
        <circle cx="32" cy="32" r="32" fill="#dcfce7"/>
        <path d="M20 32l9 9 15-15" stroke="#16a34a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h2>Contacts Sent!</h2>
      <p id="success-msg">Return to your desktop to review and import.</p>
    </div>
`}
  </div>

<script>
const SESSION_ID = "${id}";
let allContacts = [];
let selected = new Set();

async function loadContacts() {
  try {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      const props = ['name', 'tel', 'email'];
      const opts = { multiple: true };
      const raw = await navigator.contacts.select(props, opts);
      allContacts = raw.map((c, i) => ({
        id: i,
        name: (c.name?.[0] ?? '').trim(),
        phone: c.tel?.[0] ?? '',
        email: c.email?.[0] ?? '',
      })).filter(c => c.name);
    } else {
      // Fallback: manual entry form
      allContacts = [];
      document.getElementById('contact-list').innerHTML = \`
        <div style="padding:8px 0">
          <p style="font-size:13px;color:#64748b;margin-bottom:12px">
            Contact picker not available in this browser. Enter contacts manually:
          </p>
          <div id="manual-contacts"></div>
          <button onclick="addManualRow()" style="margin-top:10px;width:100%;padding:10px;border:1.5px dashed #cbd5e1;border-radius:8px;background:none;font-family:inherit;font-size:13px;color:#3b82f6;cursor:pointer;font-weight:600">
            + Add Contact
          </button>
        </div>\`;
      addManualRow();
      return;
    }
    renderContacts(allContacts);
  } catch(e) {
    document.getElementById('contact-list').innerHTML = '<div class="empty">Could not access contacts. ' + e.message + '</div>';
  }
}

let manualCount = 0;
function addManualRow() {
  const id = manualCount++;
  const div = document.createElement('div');
  div.id = 'manual-' + id;
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  div.innerHTML = \`
    <input placeholder="Name *" id="mn-\${id}" style="flex:1;padding:9px;border:1.5px solid #e2e8f0;border-radius:7px;font-family:inherit;font-size:13px;outline:none" oninput="syncManual()"/>
    <input placeholder="Phone" id="mp-\${id}" style="flex:1;padding:9px;border:1.5px solid #e2e8f0;border-radius:7px;font-family:inherit;font-size:13px;outline:none" oninput="syncManual()"/>
    <button onclick="document.getElementById('manual-\${id}').remove();syncManual()" style="border:none;background:none;color:#ef4444;font-size:18px;cursor:pointer;padding:0 4px">×</button>\`;
  document.getElementById('manual-contacts').appendChild(div);
}

function syncManual() {
  const rows = document.querySelectorAll('[id^="manual-"]');
  allContacts = [];
  rows.forEach((_, i) => {
    const name = document.getElementById('mn-' + i)?.value?.trim();
    const phone = document.getElementById('mp-' + i)?.value?.trim();
    if (name) allContacts.push({ id: i, name, phone: phone || '', email: '' });
  });
  selected = new Set(allContacts.map(c => c.id));
  updateImportBtn();
}

function renderContacts(list) {
  const el = document.getElementById('contact-list');
  if (!list.length) { el.innerHTML = '<div class="empty">No contacts found</div>'; return; }
  el.innerHTML = list.map(c => \`
    <label class="contact-item\${selected.has(c.id) ? ' selected' : ''}" for="cb-\${c.id}">
      <input type="checkbox" id="cb-\${c.id}" \${selected.has(c.id) ? 'checked' : ''}
        onchange="toggleContact(\${c.id}, this.checked)" />
      <div class="avatar">\${c.name.charAt(0)}</div>
      <div class="contact-info">
        <div class="contact-name">\${c.name}</div>
        \${c.phone ? '<div class="contact-phone">' + c.phone + '</div>' : ''}
      </div>
    </label>\`).join('');
}

function filterContacts() {
  const q = document.getElementById('search').value.toLowerCase();
  renderContacts(allContacts.filter(c => c.name.toLowerCase().includes(q) || (c.phone||'').includes(q)));
}

function toggleContact(id, checked) {
  checked ? selected.add(id) : selected.delete(id);
  updateImportBtn();
  document.querySelector('[for="cb-' + id + '"]')?.classList.toggle('selected', checked);
}

function toggleAll() {
  if (selected.size === allContacts.length) { selected.clear(); }
  else { allContacts.forEach(c => selected.add(c.id)); }
  renderContacts(allContacts);
  updateImportBtn();
}

function clearAll() { selected.clear(); renderContacts(allContacts); updateImportBtn(); }

function updateImportBtn() {
  const btn = document.getElementById('import-btn');
  const badge = document.getElementById('count-badge');
  if (!btn) return;
  btn.disabled = selected.size === 0;
  btn.textContent = selected.size > 0 ? 'Import ' + selected.size + ' Contact' + (selected.size > 1 ? 's' : '') : 'Import Selected';
  if (badge) { badge.style.display = selected.size > 0 ? 'inline-flex' : 'none'; badge.textContent = selected.size; }
}

async function submitSelected() {
  const contacts = allContacts.filter(c => selected.has(c.id)).map(c => ({
    name: c.name, phone: c.phone || undefined, email: c.email || undefined
  }));
  const btn = document.getElementById('import-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    const res = await fetch('/api/import-sessions/' + SESSION_ID + '/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts })
    });
    if (!res.ok) throw new Error('Failed');
    document.getElementById('picker-view').style.display = 'none';
    document.getElementById('success-view').style.display = 'block';
    document.getElementById('success-msg').textContent =
      contacts.length + ' contact' + (contacts.length > 1 ? 's' : '') + ' sent. Return to your desktop to review and import.';
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Retry';
    alert('Failed to send contacts. Please try again.');
  }
}

loadContacts();
</script>
</body>
</html>`;
  }
}

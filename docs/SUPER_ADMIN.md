# Super Admin Panel — Feature Specification

## Overview

A web-based internal admin panel for the Vyapar Pakistan team to manage all registered
companies, licenses, support tickets, and system health. Never shipped to tenants —
accessible only by the Vyapar Pakistan team.

---

## Deployment Architecture

```
Hetzner CX22 (~€3.90/mo) or DigitalOcean Bangalore (~$6/mo)
│
├── Nginx (port 80/443, SSL via Let's Encrypt)
│   └── reverse proxy → NestJS :3001
│
├── NestJS (PM2, port 3001)
│   ├── /api/*           → tenant API (existing)
│   └── /admin/*         → serves built React admin panel (static files)
│
└── PostgreSQL (production DB, replaces SQLite)
```

- Admin panel URL: `https://yourdomain.com/admin`
- NestJS `ServeStaticModule` serves the built React `dist/` from `apps/backend/public/admin/`
- Single deployment command covers backend + admin panel together
- PM2 keeps NestJS alive on crash and reboot
- Let's Encrypt SSL is free

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend module | `apps/backend/src/admin/` (NestJS) |
| Admin auth | Separate `AdminUser` table (email + password, no phone) |
| Admin guard | `AdminGuard` — completely separate from tenant JWT |
| Frontend | `apps/admin/` — React + Vite (same pattern as desktop renderer) |
| Styling | Tailwind CSS (web-standard, no React Native constraints) |
| Live chat | Tawk.to (100% free, no backend work — drop-in script) |
| DB | Existing Prisma schema — no new database needed |

---

## Admin Roles

| Role | What They Can Do |
|---|---|
| `superadmin` | Everything — full access |
| `support` | View tenants, view tickets, reply to tickets, view activity logs |
| `readonly` | View-only dashboards and tenant list — no mutations |

---

## Feature Modules

---

### 1. Dashboard (Home)

Overview cards shown on login:

| Card | Data |
|---|---|
| Total Companies | Count of all registered tenants |
| Active Licenses | Tenants with valid, non-expired license |
| Trial Accounts | Tenants within 7-day free trial |
| Expiring in 7 days | Licenses expiring this week |
| Expiring in 30 days | Licenses expiring this month |
| Expired | Tenants with lapsed license |

Charts:
- New registrations per day — last 30 days (line chart)
- Platform split — Desktop only / Mobile only / Both (donut chart)
- License status breakdown (donut chart)

---

### 2. Company / Tenant Management

**List view** — searchable, filterable table:

| Column | Notes |
|---|---|
| Phone | Primary identity |
| Company Name | From onboarding |
| Registered | Date of first registration |
| Last Active | Last API call timestamp |
| Platform | Desktop / Mobile / Both |
| License Status | Active / Trial / Expired / Revoked |
| Actions | View · Impersonate · Deactivate |

Filters: License status · Platform · Registration date range · Search by phone or name

**Tenant Detail Page** (`/admin/tenants/:id`):
- Company info (phone, name, country, registration date)
- License details (type, expiry, key used)
- Usage summary: total sales, total parties, total items, total payments
- Recent activity log (last 20 API calls with endpoint + timestamp)
- Team members list (salesmen registered under this tenant)
- Action buttons: Extend License · Revoke · Deactivate · Reset Data (demo accounts only)

**Impersonate Mode:**
- Admin clicks "Impersonate" on any tenant
- Backend issues a short-lived impersonation JWT (1-hour expiry, flagged as `impersonated: true`)
- Admin is redirected to a read-only view of that tenant's data
- Yellow banner always visible: "You are viewing as [phone] — impersonation session"
- All writes blocked during impersonation — view only
- "Exit Impersonation" button returns admin to their session

---

### 3. License Management

**List view** — all license keys ever generated:

| Column | Notes |
|---|---|
| License Key | Masked: `VYPR-****-****-XXXX` |
| Type | Monthly / Yearly / Lifetime |
| Platform | Mobile / Desktop / Both |
| Assigned To | Tenant phone (or "Unassigned") |
| Activated On | Date first activated |
| Expires On | Expiry date |
| Status | Active / Expired / Revoked / Unassigned |

Filters: Status · Type · Platform · Expiry date range

**Actions:**
- Generate new license key (single or bulk — choose count, type, platform)
- Manually extend a license by N days
- Revoke a license (immediately invalidates it)
- Export license list as CSV / Excel

**Expiry Alerts section:**
- Separate tab listing all licenses expiring in the next 30 days
- One-click "Extend 30 days" per row for quick renewal handling

---

### 4. Support & Tickets

**How tickets come in:**
- Tenant taps "Help & Support" in the mobile or desktop app
- A pre-filled form (issue type + description) submits to `POST /api/support/tickets`
- Admin sees new tickets immediately in this panel

**Ticket list view:**

| Column | Notes |
|---|---|
| # | Ticket ID |
| Tenant | Phone + company name |
| Issue Type | Billing / License / Bug / Feature / Other |
| Subject | Short description |
| Status | Open / In Progress / Resolved / Closed |
| Created | Timestamp |
| Last Reply | Timestamp of last admin or tenant message |

**Ticket detail page:**
- Full conversation thread (tenant messages + admin replies)
- Tenant's recent activity log (last 10 actions) shown in sidebar for context
- Internal notes (visible to admin only, not tenant)
- Status change: Open → In Progress → Resolved → Closed
- Assign to a specific support agent
- Link ticket to a related tenant or license

**Live Chat — Tawk.to:**
- Free forever, no backend work needed
- Admin installs Tawk.to mobile app to reply from phone
- A chat widget script tag is added to both the mobile app (WebView overlay) and desktop app
- Tenants can start a live chat session any time
- Tawk.to dashboard shows all active and past chats
- When offline, chat falls back to a message form (email notification to admin)

---

### 5. Announcements / Broadcasts

Admin can push a message to all tenants or a specific subset:

**Create Announcement:**
- Title + body text
- Target: All tenants / Specific license type / Specific platform / Single tenant
- Type: Info (blue) / Warning (yellow) / Critical (red)
- Schedule: Send now OR schedule for a specific date/time
- Expiry: auto-dismiss after N days

**How tenants see it:**
- On next app open, a banner appears at the top of the dashboard
- Tenant can dismiss it — it does not reappear
- Critical announcements cannot be dismissed until read (tap to confirm)

**Announcement list:**
- Shows all past and scheduled announcements
- Status: Draft / Scheduled / Sent / Expired
- Sent count (how many tenants received it) vs Dismissed count

---

### 6. System Health

Basic at first — expandable later:

| Metric | How |
|---|---|
| API Status | Ping `GET /api/health` every 60s — shows Up / Down |
| Uptime | % uptime over last 7 days |
| Error Rate | Count of 5xx responses in last 24h |
| Avg Response Time | p50/p95 of last 1000 requests |
| DB Size | Total Postgres DB size |
| Active Sessions | Count of valid JWTs issued in last 24h |

A simple status page — no external monitoring tool needed initially. Backend logs
write to a `SystemMetric` table; this screen reads from it.

---

### 7. Admin User Management

**Admin list:**
- Name, email, role, last login, created date
- Add new admin (name + email + password + role)
- Edit role or deactivate an admin
- Superadmin cannot be deactivated by a support-role admin

**Audit Log:**
- Every admin action is recorded: who did what to which tenant and when
- Actions logged: Login · Impersonate · Generate License · Extend License · Revoke License · Deactivate Tenant · Resolve Ticket · Send Announcement
- Filterable by admin, action type, and date range
- Cannot be deleted or edited — append-only

---

## Backend Module Structure

```
apps/backend/src/admin/
├── admin.module.ts
├── admin-auth/
│   ├── admin-auth.controller.ts    POST /admin/auth/login
│   ├── admin-auth.service.ts
│   └── admin.guard.ts              AdminGuard (separate from JwtGuard)
├── tenants/
│   ├── tenants.controller.ts       GET /admin/tenants, GET /admin/tenants/:id
│   └── tenants.service.ts
├── licenses/
│   ├── licenses.controller.ts      GET/POST/PATCH /admin/licenses
│   └── licenses.service.ts
├── support/
│   ├── support.controller.ts       GET/POST /admin/support/tickets
│   └── support.service.ts
├── announcements/
│   ├── announcements.controller.ts
│   └── announcements.service.ts
├── health/
│   ├── health.controller.ts        GET /admin/health
│   └── health.service.ts
└── audit/
    └── audit.service.ts            Shared — called from all other services
```

New Prisma models needed:
- `AdminUser` (id, name, email, passwordHash, role, lastLoginAt)
- `SupportTicket` (id, tenantId, issueType, subject, status, assignedTo, createdAt)
- `TicketMessage` (id, ticketId, sender: admin|tenant, body, isInternal, createdAt)
- `Announcement` (id, title, body, type, target, scheduledAt, sentAt, expiresAt)
- `AnnouncementRead` (id, announcementId, tenantId, readAt)
- `AuditLog` (id, adminId, action, targetType, targetId, meta, createdAt)
- `SystemMetric` (id, endpoint, statusCode, responseMs, createdAt)

---

## Frontend Structure

```
apps/admin/
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx                     React Router routes
│   ├── lib/
│   │   ├── api.ts                  Admin API client (axios, admin JWT)
│   │   └── auth.ts                 Admin session (localStorage)
│   └── screens/
│       ├── Login.tsx
│       ├── Dashboard.tsx
│       ├── Tenants/
│       │   ├── TenantList.tsx
│       │   └── TenantDetail.tsx
│       ├── Licenses/
│       │   ├── LicenseList.tsx
│       │   └── GenerateLicenses.tsx
│       ├── Support/
│       │   ├── TicketList.tsx
│       │   └── TicketDetail.tsx
│       ├── Announcements/
│       │   ├── AnnouncementList.tsx
│       │   └── CreateAnnouncement.tsx
│       ├── Health.tsx
│       └── AdminUsers/
│           ├── AdminUserList.tsx
│           └── AuditLog.tsx
```

---

## Build & Deployment Steps

```bash
# 1. Build admin panel
cd apps/admin && pnpm build
# Output: apps/admin/dist/

# 2. Copy into backend public folder
cp -r apps/admin/dist/ apps/backend/public/admin/

# 3. NestJS ServeStaticModule config (apps/backend/src/app.module.ts)
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', 'public', 'admin'),
  serveRoot: '/admin',
})

# 4. On server
git pull
cd apps/backend && pnpm build
pm2 restart vyapar-backend
```

Admin panel accessible at: `https://yourdomain.com/admin`

---

## Build Order

| Phase | Work |
|---|---|
| Phase 1 | Prisma models + Admin auth (login, AdminGuard, audit log) |
| Phase 2 | Tenant list + Tenant detail page + Impersonate |
| Phase 3 | License management (list, generate, extend, revoke) |
| Phase 4 | Support tickets + Tawk.to integration in mobile & desktop |
| Phase 5 | Announcements |
| Phase 6 | System health dashboard |
| Phase 7 | Admin user management + full audit log screen |

---

## Progress Tracker

| Phase | Status |
|---|---|
| Phase 1 — Admin auth + DB models | ❌ Not started |
| Phase 2 — Tenant management + Impersonate | ❌ Not started |
| Phase 3 — License management | ❌ Not started |
| Phase 4 — Support tickets + Live chat | ❌ Not started |
| Phase 5 — Announcements | ❌ Not started |
| Phase 6 — System health | ❌ Not started |
| Phase 7 — Admin users + Audit log | ❌ Not started |

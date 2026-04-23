# Vyapar Pakistan — Architecture

Offline-first business management platform for Pakistani SMBs, with Desktop, Mobile, and Web clients that all sync to a single cloud source of truth.

---

## 1. Product goals

- Shopkeepers can create invoices, manage inventory, and track customers **without reliable internet**.
- Data is **consistent across Desktop + Mobile + Web** — edit on phone, see it on laptop.
- Single identity per business: **mobile number** is the tenant key.
- **7-day free trial** on first registration → license key required to continue.
- Production-grade sync with no data loss, no duplicate invoices, no lost edits.

---

## 2. High-level architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Desktop    │      │   Mobile    │      │    Web      │
│ (Electron)  │      │  (Expo RN)  │      │  (browser)  │
│ SQLite (local)     │ SQLite (local)     │ SQLite (OPFS) │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       └────────────────────┴────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   PowerSync     │  ← bidirectional sync engine
                   │ (managed / self)│
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │  NestJS API     │  ← business logic, auth, licenses
                   │  (apps/backend) │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │    Postgres     │  ← source of truth
                   └─────────────────┘
```

**Reads** happen against the local SQLite in each client — instant, offline-safe.
**Writes** happen locally first, PowerSync propagates to Postgres and to other devices.
**Business logic** (auth, license, invoice numbering, reports) lives in NestJS.

---

## 3. Stack decisions

| Layer          | Choice                              | Why                                                          |
| -------------- | ----------------------------------- | ------------------------------------------------------------ |
| Monorepo       | pnpm workspaces + Turborepo         | Shared types/clients across three apps                       |
| Cloud DB       | PostgreSQL                          | Source of truth; PowerSync requires it                       |
| Sync engine    | **PowerSync**                       | Battle-tested Postgres ↔ SQLite sync; 3-client support       |
| Backend        | NestJS + Prisma                     | Structured modules for auth, licensing, domain logic         |
| Desktop        | Electron + React + Vite             | Cross-platform native window, reuse React skills             |
| Mobile         | Expo + React Native + expo-router   | iOS + Android from one codebase; file-based routing          |
| Web (future)   | Next.js or Vite SPA                 | Same React UI primitives                                     |
| Shared types   | Zod schemas in `packages/shared-types` | One source of truth for API contracts                     |
| Auth           | JWT (signed by backend)             | Same token works online + embedded into PowerSync handshake  |

### Why PowerSync over building our own sync

Multi-device sync is one of the hardest problems in application development. Conflict resolution, schema migration, retry queues, vector clocks, and "resume from where we stopped" all have to work correctly under all failure modes. Rolling this ourselves would take 2–3 weeks to prototype and a year of bug fixes to stabilize.

PowerSync is purpose-built for this with a large customer base solving exactly our problem shape.

**Runner-up considered:** ElectricSQL (also excellent, slightly more opinionated setup).

---

## 4. Identity & licensing

### Tenant = mobile number

- On first launch of any client, user enters **country code + mobile number**.
- Backend creates a `Tenant` keyed by full phone (`+92300…`).
- Same phone entered on another device → same tenant → same data.
- **No OTP verification in MVP** (per product direction — add SMS OTP before production).

### Trial flow

1. Register → `Tenant` created with `trialStartedAt = now`, `trialExpiresAt = now + 7d`.
2. JWT issued with `sub = tenant.id`, 30-day expiry (refreshed on sync).
3. Every client launch calls `GET /license/status`:
   - `trial` + `daysRemaining > 0` → open app, show countdown banner
   - `trial_expired` → show **License Gate** screen
   - `licensed` + not expired → open app, no banner
   - `license_expired` → License Gate

### License activation

- Admin generates keys via seed script / admin panel → `License` rows in Postgres.
- User types key on License Gate → `POST /license/activate` binds it to their tenant.
- One active license per tenant; one tenant per license.

### Offline grace period

- Clients cache the last `license/status` response.
- Up to **72 hours offline** → app continues working on cached status.
- Beyond that → app prompts "Connect to verify license" and blocks writes until online check succeeds.

---

## 5. Data flow examples

### Example A — create invoice while offline

1. User taps "New Invoice" on mobile → form saved to **local SQLite** via PowerSync.
2. PowerSync queues the change in its local outbox.
3. Invoice appears instantly in local lists.
4. When internet returns → PowerSync uploads change → backend applies business rules (e.g. invoice number allocation) → Postgres updated → propagated to desktop + web on their next sync tick.

### Example B — user logs in on a second device

1. User installs Desktop app, types same phone as their Mobile.
2. `POST /auth/register` finds existing tenant → returns existing JWT.
3. Desktop starts PowerSync with that JWT.
4. PowerSync does initial pull of all tenant data → local SQLite populated → user sees their existing invoices, customers, products.

### Example C — two devices edit the same customer offline

1. Mobile edits customer phone number offline.
2. Desktop edits same customer's name offline.
3. Both come online → PowerSync merges by field using last-write-wins on `updatedAt`.
4. If both edited the **same field**, the later timestamp wins; the other change is recorded in a conflict log for admin review.

---

## 6. Data model (Postgres — cloud source of truth)

| Table      | Purpose                                       |
| ---------- | --------------------------------------------- |
| `tenants`  | One row per registered phone number           |
| `licenses` | License keys, plan, expiry                    |
| `users`    | (future) multi-user per tenant                |
| `parties`  | Customers + suppliers (Vyapar terminology)    |
| `products` | Items / inventory                             |
| `invoices` | Sales records                                 |
| `purchases`| Purchase / expense records                    |

**Every sync-able table must have:**
- `id` (UUID)
- `tenant_id` (FK to `tenants`, used for row-level filtering)
- `created_at`
- `updated_at` (bumped on every write — drives conflict resolution)
- `deleted_at` (soft delete — sync-safe)

---

## 7. Phased delivery plan

### Phase 0 — MVP spine *(current — ~1 week)*
- [x] Monorepo scaffold
- [x] Desktop sidebar UI
- [x] Backend: Tenant + License models + JWT
- [x] `POST /auth/register`, `GET /license/status`, `POST /license/activate`
- [x] Desktop onboarding popup + License Gate
- [ ] Finish Postgres setup and verify register → trial → license flow end-to-end
- [ ] Seed admin with demo license keys

### Phase 1 — PowerSync integration *(1–2 weeks)*
- [ ] Add `updated_at`/`deleted_at` to all sync-able tables
- [ ] Sign up for PowerSync Cloud (free tier) or deploy self-host Docker image
- [ ] Define sync rules: `WHERE tenant_id = token.sub`
- [ ] Desktop: install `@powersync/node`, replace direct API reads with local SQLite
- [ ] Mobile: install `@powersync/react-native`
- [ ] Web: install `@powersync/web` (when web client is built)
- [ ] Implement 72h offline grace for license check
- [ ] End-to-end test: create invoice on mobile offline → appears on desktop after internet returns

### Phase 2 — domain modules *(2–4 weeks)*
- [ ] Parties (customers + suppliers)
- [ ] Items (inventory with stock tracking)
- [ ] Sale (invoice creation, PDF export, WhatsApp share)
- [ ] Purchase & Expense
- [ ] Cash & Bank
- [ ] Reports (P&L, GST summary, outstanding)

### Phase 3 — production hardening *(1–2 weeks)*
- [ ] SMS OTP via local Pakistani gateway (Jazz / EasyPaisa / Twilio)
- [ ] License admin panel (generate, revoke, extend keys)
- [ ] Payment integration (JazzCash / EasyPaisa) for self-serve license purchase
- [ ] Crash reporting (Sentry)
- [ ] Auto-update for Desktop (electron-updater)
- [ ] App Store + Play Store submissions (EAS Build)

---

## 8. Open decisions / risks

| Item                    | Status       | Notes                                                                 |
| ----------------------- | ------------ | --------------------------------------------------------------------- |
| SMS OTP provider        | **Open**     | Pakistan-friendly options: Jazz Business SMS, Twilio, Vonage          |
| Payment gateway         | **Open**     | JazzCash and EasyPaisa have PKR merchant APIs; Stripe for international |
| PowerSync hosting       | **Decide**   | Managed cloud (easier) vs self-host (zero vendor lock-in)             |
| Conflict UI             | **Open**     | Show user-visible conflict resolution, or silent last-write-wins?     |
| Multi-user per tenant   | **Phase 3**  | Roles: owner, cashier, accountant — decide permission model           |
| Web client timeline     | **Open**     | Ship Desktop + Mobile first; web later                                |
| Trial abuse prevention  | **Risk**     | Without OTP, users can reinstall with new numbers; mitigated by OTP in Phase 3 |

---

## 9. Developer workflow

```bash
# one-time
pnpm install
cp apps/backend/.env.example apps/backend/.env    # fill DATABASE_URL
cd apps/backend && pnpm prisma:migrate --name init && pnpm prisma:seed

# run
pnpm dev:backend      # NestJS on :3000
pnpm dev:desktop      # Electron window (maximized)
pnpm dev:mobile       # Expo dev server
```

**Troubleshooting:**
- Desktop Electron error `Cannot read properties of undefined (reading 'isPackaged')` → unset `ELECTRON_RUN_AS_NODE` in your shell.
- Register button shows "Could not register" → backend not running or `DATABASE_URL` misconfigured.

---

## 10. Glossary

- **Tenant** — one registered business (identified by phone number).
- **License key** — string that unlocks a tenant beyond trial, bound to one tenant.
- **Sync rule** — PowerSync config that says which rows each tenant receives.
- **Outbox** — local queue of writes waiting to sync to the server.
- **Source of truth** — Postgres; all local SQLite copies are derived from it.

---

*Last updated: 2026-04-19*

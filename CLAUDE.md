# CLAUDE.md

Project context for Claude Code. Read this first before making changes.

## What this project is

**Vyapar Pakistan** — a business management platform (invoices, inventory, customers) targeting Pakistani SMBs. Shipped as three clients that all operate on the same business data:

- **Desktop** — Electron + React + Vite (`apps/desktop`)
- **Mobile** — Expo + React Native (`apps/mobile`)
- **Web** — browser app (`apps/web`, not yet scaffolded)

All three clients are **connected to each other through a single backend** and share the same data.

## Architecture in one picture

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Desktop   │       │   Mobile    │       │    Web      │
│  Electron   │       │  Expo RN    │       │  browser    │
└──────┬──────┘       └──────┬──────┘       └──────┬──────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │  HTTP + JWT
                    ┌────────▼────────┐
                    │  NestJS API     │  apps/backend
                    └────────┬────────┘
                             │  Prisma
                    ┌────────▼────────┐
                    │ SQLite (dev) /  │
                    │ Postgres (prod) │
                    └─────────────────┘
```

## Sync model

**All three clients sync automatically through the shared backend.** The backend's database (SQLite in dev, Postgres in prod) is the single source of truth.

- **Online**: any write on one client is immediately visible to the other clients (on their next read). Same tenant (identified by mobile number) = same data everywhere.
- **Offline-first (Phase 1, planned)**: PowerSync will be added to give each client a local SQLite mirror so writes work offline and sync automatically when internet returns. Architecture already supports this — no rework needed.

## Structure principles

The monorepo is organized so **all three clients follow the same structure and share the same code where possible**:

```
vyapar-pakistan/
├── apps/
│   ├── desktop/          Electron shell + React renderer
│   ├── mobile/           Expo RN app
│   ├── web/              browser app (future)
│   └── backend/          NestJS API + Prisma
├── packages/
│   ├── shared-types/     Zod schemas = API contract
│   ├── api-client/       axios-based HTTP client (used by all three clients)
│   └── ui/               shared React screens (future — used by desktop + web)
└── docs/
    └── ARCHITECTURE.md   full architecture doc + phased roadmap
```

### What is shared across clients

| Shared                                      | Used by                    |
| ------------------------------------------- | -------------------------- |
| `@vyapar/shared-types` (Zod schemas)        | all three clients + backend |
| `@vyapar/api-client` (auth, license, data)  | all three clients           |
| `@vyapar/ui` (React components + screens)   | desktop + web (RN is separate) |
| JWT auth token format                       | all three clients           |
| `/auth/register`, `/license/*` endpoints    | all three clients           |

### Identity = mobile number

One phone number = one `Tenant` row in Postgres. User enters the same phone on Desktop, Mobile, and Web → they see the same data. 7-day free trial on first registration, then a license key is required.

## Current state (Phase 0)

- ✅ Desktop sidebar UI, onboarding popup (country + phone), license gate, activation modal
- ✅ Backend: `POST /api/auth/register`, `GET /api/license/status`, `POST /api/license/activate`
- ✅ JWT auth, 7-day trial logic, demo license keys seeded
- ⏳ Mobile — scaffolded, not yet wired to backend
- ⏳ Web — not yet created
- ⏳ PowerSync (Phase 1) — planned, not installed
- ⏳ Domain modules (Parties, Items, Sale, etc.) — not started

## Developer workflow

```bash
# one-time setup
pnpm install
cp apps/backend/.env.example apps/backend/.env
cd apps/backend && pnpm exec prisma migrate dev --name init && pnpm prisma:seed

# run
pnpm dev:backend     # NestJS on :3000
pnpm dev:desktop     # Vite on :5173 + Electron window
pnpm dev:mobile      # Expo dev server
```

Open the web UI in a browser at `http://localhost:5173` while `dev:desktop` is running (same React bundle, just rendered in Chrome instead of Electron).

## Gotchas

- **`ELECTRON_RUN_AS_NODE=1`** in your shell breaks Electron. Unset it before `pnpm dev:desktop`.
- **Mobile simulator + localhost**: iOS sim can reach `localhost:3000`; Android emulator needs `10.0.2.2:3000`; real devices need your Mac's LAN IP.
- **No OTP verification** yet — anyone can register any number. SMS OTP is Phase 3.
- **SQLite is dev-only** — production flips `DATABASE_URL` to Postgres.

## Conventions

- **All data flows through the backend.** Clients never read or write the DB directly.
- **Types come from `@vyapar/shared-types`.** Don't redefine DTOs in each app.
- **HTTP calls go through `@vyapar/api-client`.** Don't `fetch` or `axios` directly in UI code.
- **Phone as identity** — never use email as the primary key for a tenant.
- **JWT on every request** — store in `localStorage` on web/desktop, Expo Secure Store on mobile.

## Roadmap reference

Full phased plan lives in `docs/ARCHITECTURE.md` — follow it when deciding scope.

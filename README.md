# Vyapar Pakistan

Business management platform — Desktop, Mobile, and Backend.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Desktop:** Electron + React + Vite + TypeScript
- **Mobile:** React Native (Expo) + TypeScript
- **Backend:** NestJS + PostgreSQL + Prisma + TypeScript
- **Shared:** TypeScript type contracts + API client

## Structure

```
vyapar-pakistan/
├── apps/
│   ├── desktop/         Electron app
│   ├── mobile/          Expo app
│   └── backend/         NestJS API
└── packages/
    ├── shared-types/    API contracts (Zod schemas)
    └── api-client/      Typed HTTP client
```

## Getting Started

```bash
# 1. Install dependencies (run once at root)
pnpm install

# 2. Run any app
pnpm dev:backend      # http://localhost:3000
pnpm dev:desktop      # launches Electron window
pnpm dev:mobile       # starts Expo dev server
```

## Next Steps

1. Set up PostgreSQL and create `.env` files.
2. Initialize Prisma schema in `apps/backend`.
3. Implement auth module first, then domain modules (invoices, inventory, customers).

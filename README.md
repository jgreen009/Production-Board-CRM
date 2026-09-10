# SALT PRINTS — Production Board / CRM

Order management, staff assignment, mockup design, and production tracking
for SALT PRINTS. React 19 + TypeScript + Vite, backed by Supabase
(Postgres, Auth, Storage, Edge Functions), deployed to Netlify.

## Documentation

- **[docs/CLIENT_USER_GUIDE.md](docs/CLIENT_USER_GUIDE.md)** — for SALT
  PRINTS staff: logging in, creating orders, mockups, production, reorder,
  reporting.
- **[docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md)** — for a
  developer/technical administrator: local setup, database, auth, Edge
  Functions, Storage, deployment, operations, recovery, security.
- **[docs/PHASE_5_HANDOVER.md](docs/PHASE_5_HANDOVER.md)** — final
  engineering/UAT/deployment/handover status as of the close of Phase 5.
- Earlier phase handovers (`docs/PHASE_2_HANDOVER.md`,
  `docs/PHASE_3_HANDOVER.md`, `docs/PHASE_4_HANDOVER.md`) and the
  `docs/PHASE_4_BRIEF.md` / `docs/PHASE_4_PLAN.md` architecture references
  remain the historical record of how each phase's decisions were made.

## Quick start

```
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                  # local dev server
npm run build                # tsc -b && vite build
npm run lint                 # oxlint
npm run test                 # vitest run
```

See `PRODUCTION_RUNBOOK.md` for database migrations, Edge Function
deployment, and the full production environment setup — this app has no
meaningful "local-only" mode beyond a Supabase project to point it at.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router v7 ·
React Hook Form + Zod · TanStack Query · Supabase (Postgres/Auth/Storage/
Edge Functions) · Fabric.js (Mockup Studio editor, lazy-loaded) ·
lucide-react · Netlify (hosting).

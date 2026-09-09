# SALT PRINTS — Phase 2.5 Verification Plan

Phase 2.5 is verification/regression/stabilization, not feature work — see
`CLAUDE.md`, `docs/HANDOVER.md`, `docs/PHASE_2_SPEC.md`,
`docs/PHASE_2_BACKEND_PLAN.md`, `docs/PHASE_2_HANDOVER.md` for everything
Phase 2 built. This document scopes exactly what gets checked, how, and by
whom, before any further code changes beyond confirmed-defect fixes.

**Important constraint, stated up front**: this session has shell/Supabase
MCP access but no browser-automation tool. Anything requiring an actual
rendered browser (click-through, responsive breakpoints, visual regression)
cannot be executed by the agent directly — those steps are marked **[USER]**
below and need to be run manually, with results reported back. Anything
requiring real staff login credentials (the two verification scripts) is
also **[USER]**, per this project's standing rule that Supabase credentials
never pass through the chat/agent (the same reason `supabase login`/`link`
were run by the user directly back in Phase 2 setup). Everything else —
code audits, migrations/schema inspection, RLS/advisor checks, direct
database integrity queries via Supabase MCP, build/lint/test — is marked
**[AGENT]** and is run directly.

## 1. Environment being tested

Hosted Supabase project `pphzbtqfttfkaphmwutr` ("Brand Fanatix",
`eu-west-1`, Postgres 17.6) — the same project used throughout Phase 2, per
`docs/PHASE_2_BACKEND_PLAN.md` §0. Frontend run locally via `npm run dev`
against `.env.local`. No separate staging project exists; all testing below
happens against this one real backend, so test data must be cleaned up
deliberately (see §13).

## 2. Supabase project connection

- CLI: linked (`supabase migration list --linked` confirms).
- MCP: connected read/write to the same project (`execute_sql`,
  `get_advisors`, `list_tables`, `list_migrations`).
- Frontend: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local`
  (gitignored).

## 3. Required test accounts

At least one real staff account (Supabase Dashboard → Auth → Users), already
created during Milestone 1. **[USER]** Confirm which account to use for
manual click-through and for `SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD`
when running the two scripts (§5) — credentials are set as local shell env
vars by the user, never pasted into chat.

## 4. Required seed/test data

No seed data is required to exist — Phase 2.5 explicitly tests empty-state
behavior too (§12 in the original request). Test records created during
verification (customers, orders, artwork) use an obvious, greppable naming
convention: `Phase 2.5 Test Customer`, `Phase 2.5 seq sanity N`, etc., so
they're unambiguous to find and delete afterward.

## 5. Verification scripts

- `scripts/verify-order-number-concurrency.ts` — **[USER]**, needs real
  credentials. **[AGENT]** substitute performed instead: 8 sequential
  `upsert_order(...)` RPC calls fired directly via SQL (bypassing the
  authenticated-client network path, since MCP `execute_sql` runs as
  `postgres`) confirm the underlying Postgres sequence/trigger produces
  strictly unique, sequential order numbers with no collision — see the
  Phase 2.5 handover for the actual output. This checks the DB-side
  guarantee but is **not** a substitute for the real concurrency stress
  test (genuine parallel network requests through the authenticated RPC
  path), which still needs the user to run the script.
- `scripts/verify-artwork-upload.ts` — **[USER]**, needs real credentials.
  **[AGENT]** substitute performed instead: direct SQL queries cross-checking
  every `artwork` row against `storage.objects` (both directions — orphan
  rows and orphan objects) against the two real artwork files already in the
  database from earlier Phase 2 work.

## 6. Manual test sequence

**[USER]** — the full click-through sequence specified in the Phase 2.5
request (Login → customer → New Order → garments → sizes → services →
artwork → print spec → Save Draft → navigate away → refresh → Resume Draft
→ Finalize → Production Board → status changes → Order Detail → Edit Order
→ save → refresh → search → logout → login → verify). Report each step as
PASS/FAIL/FIXED/NOT APPLICABLE back to this session so results can be
recorded in `docs/PHASE_2_5_HANDOVER.md`.

## 7. Expected results

Per the acceptance criteria already defined in `PHASE_2_SPEC.md` §16 and
`PHASE_2_BACKEND_PLAN.md` §17 — unique order numbers, correct relations,
cross-screen status consistency, refresh/logout survival, no raw DB errors
surfaced to users, RLS blocking anonymous access, private artwork storage.

## 8. Database checks [AGENT]

Direct SQL via Supabase MCP: orphan child rows (`order_garments`,
`garment_quantities`, `order_services`, `print_specs`, `artwork`), negative
quantities, invalid `order_state` values, duplicate `order_number` values,
RLS enabled on every `public` table, no `anon`-role policy anywhere.

## 9. Storage checks [AGENT]

Bucket `artwork-originals` privacy flag, storage policies restricted to
`authenticated`, every `artwork.storage_path` resolves to a real
`storage.objects` row and vice versa (no orphans either direction).

## 10. RLS checks [AGENT]

`pg_policies` review across all 14 `public` tables plus `storage.objects` —
confirm every write path matches the intended shape from
`PHASE_2_BACKEND_PLAN.md` §6 (staff full read/write on operational tables,
admin/owner-gated writes on catalogs, RPC-only child tables with no direct
write policy). Supabase `get_advisors` (security + performance) re-run.

## 11. Regression checks [AGENT + USER]

Code-level: grep for `"arrives with backend integration."`, runtime imports
of `mockOrders`/`mockCustomers`, and any remaining client-side order-number
scanning (`nextOrderNumber`). UI-level (drafts, status sync across
screens, responsive breakpoints, loading/empty/error states): **[USER]**.

## 12. Failure-reporting format

For every failed check: **what was tested → expected → actual → root cause
→ fix applied (file/migration) → re-verification result.** Findings are
logged directly into `docs/PHASE_2_5_HANDOVER.md` §"Bugs discovered"/"Bugs
fixed" rather than a separate tracker, since this is a single bounded pass,
not an ongoing backlog.

## 13. Cleanup strategy for test data

Every row created during agent-run verification is deleted in the same
session immediately after the check that needed it (already done for the
8 order-number sanity rows — see handover). Any customer/order/artwork
created during the **[USER]** manual click-through should be deleted (or
clearly left in place and noted) once verified — the user's call, since it's
their live project; nothing here auto-deletes on their behalf.

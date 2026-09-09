# SALT PRINTS — Phase 2 Handover (Backend Integration)

**Purpose of this doc**: a complete, current snapshot of what Phase 2 built
on top of the Phase 1 frontend (`docs/HANDOVER.md`) — real Supabase
persistence, auth, file storage, and the data-access architecture that
replaced every mock-data shortcut Phase 1 documented. Read `docs/HANDOVER.md`
§8 first if you want the "before" picture; this doc is the "after."

Governing docs for this phase: `docs/PHASE_2_SPEC.md` (requirements) and
`docs/PHASE_2_BACKEND_PLAN.md` (the approved implementation plan, milestone
breakdown, and acceptance tests — still the most detailed reference for
*why* things are shaped the way they are).

Last verified against the codebase: 2026-09-09.

---

## 1. What changed, in one paragraph

Every one of Phase 1's documented gaps (HANDOVER.md §8) is now closed except
two deliberately-deferred items (mockup canvas editor, garment reference
photo cleanup — both cosmetic/tooling, not data). Orders, customers,
catalogs, business settings, artwork files, and activity history are all
real rows in a hosted Supabase Postgres database, gated behind email/password
auth, with Row Level Security enforced on every table. The frontend never
talks to Supabase directly from a component — everything goes through
`src/api/*.ts` → `src/api/mappers/*.ts` → `src/hooks/use*.ts` (TanStack
Query) → components.

## 2. Tech stack additions

- **Supabase**: Postgres, Auth (email/password, invite-only — no public
  sign-up screen), Storage (private `artwork` bucket), Row Level Security,
  Postgres RPCs (`security definer` functions), a `pg_trgm`-indexed
  full-text-ish search, a real order-number sequence.
- **Supabase CLI**, linked to the hosted project — every schema change is a
  versioned migration file under `supabase/migrations/`, applied via
  `supabase db push --linked`. No manual dashboard schema edits.
- **@tanstack/react-query** — the data layer for every list/detail view and
  every mutation (replacing local `useState` copies of mock arrays).
- **Vitest** — unit tests for pure logic (mappers, validation, the activity
  diff function, catalog-selection helper). `npm run test` runs them.
- No ORM — plain `@supabase/supabase-js` queries and RPC calls.

## 3. Auth

- Email/password, invite-only (Supabase Auth — no self-serve sign-up UI).
  Decided explicitly during planning: this is an internal staff tool, not a
  customer-facing product.
- `src/layouts/RequireAuth.tsx` gates every route except `/login` — an
  unauthenticated visitor is redirected to `/login`.
- `profiles` table (one row per `auth.users` row, created by trigger) backs
  "who did this" attribution on `order_activity` rows.
- Login errors show Supabase Auth's own message text directly (e.g. "Invalid
  login credentials") — this is the one deliberate exception to the
  no-raw-error-text rule in §8, because Auth's messages are already
  generic/user-appropriate.

## 4. Database schema (`supabase/migrations/`)

One file per logical change, applied in order:

| Migration | What it added |
|---|---|
| `20260908073845_profiles.sql` (+ `_security_lint_fixes`) | `profiles` table, auth trigger, RLS |
| `20260908080153_catalogs_and_settings.sql` | `garment_types`, `garment_brands`, `services`, `business_settings` — seeded to match the paper form catalogs from Phase 1 |
| `20260908081319_customers.sql` (+ `_trgm_extension_schema`) | `customers` table, `pg_trgm` extension (search) |
| `20260908084613_order_core.sql` | `orders`, `order_garments`, `garment_quantities`, `order_services`, `artwork` (schema only), `print_specs`, `order_activity`, the `upsert_order` RPC, the order-number sequence |
| `20260908091750_artwork_storage.sql` | Private `artwork` Storage bucket + access policies |
| `20260908182746_mockup_templates.sql` | `mockup_templates` (per garment/view reference photo + active flag, drives the Preview Garment picker) |
| `20260908220621_rls_hardening.sql` | Fixed a missing artwork DELETE policy (see §7); removed excess write grants on RPC-only child tables |
| `20260908221048_performance_hardening.sql` | Merged duplicate `profiles` SELECT policies, wrapped `auth.uid()` calls per Supabase's performance advisor, added FK-covering indexes |

Key modeling decisions (per plan, all deliberate):

- **No organizations/tenants** — single shared workspace, matches Phase 1's
  scope and the "one small print shop" reality.
- **`PrintSpec` stayed one table** (`print_specs`), not split into print
  details + mockups — Phase 1's HANDOVER.md §4 flagged this as a hard
  requirement and it was honored.
- **Order numbers are a Postgres sequence**, generated inside `upsert_order`
  on first insert — never scanned/computed client-side (Phase 1 gap #13,
  closed; see `verify-order-number-concurrency.ts` in §9).
- **IDs are real UUIDs** from Postgres, not client-generated strings (Phase 1
  gap #14, closed).
- **Whole-child-set-replace**, not diffing: every `upsert_order` call
  deletes and reinserts `order_garments`/`order_services`/`print_specs` for
  that order. Simple, correct, and cheap enough at this data volume — a
  deliberate simplicity-over-cleverness tradeoff.
- **Draft vs. Active orders** are the same `orders` table, distinguished by
  an `order_state` column (`'Draft' | 'Active'`) — not a separate table.
  Drafts are excluded from every "real" list (Production Board, Dashboard,
  Orders List's default tabs) and only surfaced via the dedicated Drafts tab.

## 5. Row Level Security

Every table has RLS enabled. The general shape: any authenticated staff
member can read/write everything (no per-row ownership — this is a small
shared-workspace tool, not multi-tenant), enforced via `to authenticated
using (true)` policies, with narrower policies only where a table is
RPC-only (see below).

Two real bugs found and fixed during the Milestone 11 security audit
(`rls_hardening` migration):

- **`artwork` had no DELETE policy.** `removeArtwork()` silently deleted 0
  rows on every call (no error thrown — that's how RLS denial behaves) since
  Milestone 5. Fixed by adding the missing policy. No orphaned rows existed
  yet at the time of the fix (verified against real Storage objects).
- **Excess write grants** on `order_garments`, `garment_quantities`,
  `order_services`, `print_specs` — these are only ever written by
  `upsert_order` (a `security definer` RPC that bypasses RLS), never
  directly by the frontend, so their direct INSERT/UPDATE/DELETE policies
  were dead surface area. Dropped.

`get_advisors` (Supabase's security/performance linter) was run after every
migration and came back clean as of the last check.

## 6. Data-access architecture

```
src/lib/supabase.ts          Supabase client singleton
src/api/*.ts                 One file per domain area — the only files that
                              call supabase.from()/.rpc()/.storage directly
  orders.ts                  listOrders/listDraftOrders/getOrder/
                              getOrderFormValues/upsertOrder/
                              updateOrderWithActivity/status updates/
                              activity feeds/diffOrderForActivity (pure)
  customers.ts                customer CRUD + linking
  artwork.ts                  upload/remove/signed-URL fetch
  settings.ts                  catalog CRUD (garment types/brands/services),
                                business_settings, mockup_templates
  search.ts                    global search (orders + customers, trigram)
src/api/mappers/*.ts          Pure functions, DB row <-> domain type, unit
                              tested (order.ts, artwork.ts, activity.ts)
src/hooks/use*.ts             TanStack Query wrappers — every component-facing
                              read/write goes through one of these, never
                              through src/api/*.ts directly
components/pages              Never import supabase or src/api/*.ts directly
```

Components calling `src/api/*.ts` directly, or Supabase calls appearing
outside `src/api/`, would be a regression of this rule — it was a hard
requirement from the start of the plan.

### Mutation pattern

Every status-change mutation (`useUpdateProductionStatus`, etc.) uses the
same optimistic pattern via a shared generic
(`useOptimisticStatusField` in `useOrders.ts`):

1. `onMutate` — cancel in-flight queries, snapshot current cache, patch the
   list and detail caches immediately (instant UI feedback).
2. `onError` — roll back to the snapshot.
3. `onSettled` — invalidate every query key that could now disagree (list,
   detail, that order's activity feed, dashboard) by key prefix.

This directly fixes Phase 1 gap #5 (Production Board status edits invisible
elsewhere) — there is now exactly one source of truth (the TanStack Query
cache backed by real rows), not three separate in-memory copies.

## 7. Orders: create, draft, edit — one form, three modes

`src/pages/NewOrderForm.tsx` exports `OrderFormEditor`, driven by an explicit
`mode: 'create' | 'edit-active' | 'resume-draft'` prop rather than inferring
behavior from data shape:

- **`create`** — brand new order. Autosaves in the background (debounced,
  1.5s after the first save) as a `Draft` row from the moment the user enters
  a job name or uploads artwork — never shown as an active production order
  until they explicitly click Create Order (`finalize: true`).
- **`resume-draft`** — `/orders/new?draft=<id>`, reached from the Orders
  List's Drafts tab. Same autosave behavior as `create`, hydrated from
  `getOrderFormValues()` (the reverse DB-row → form-values mapper).
- **`edit-active`** — `/orders/:id/edit`. Autosave is deliberately **off**
  here (an active order is already visible elsewhere; a mid-edit
  intermediate state going out via whole-child-set-replace is a real risk a
  Draft never has). Save is explicit only, and logs an `order_activity` row
  for whatever meaningfully changed (`diffOrderForActivity` — pure, unit
  tested — currently covers priority and payment status changes; due-date
  has no matching activity type in the schema's check constraint).

One write path behind all three: the `upsert_order` RPC, called with
`finalize: true` only on explicit Create/Save.

## 8. Artwork storage

- Private Supabase Storage bucket (`artwork`), one object per uploaded file,
  path keyed by a client-generated `crypto.randomUUID()` (needed before
  insert, to construct the storage path) plus the order id.
- 25MB per-file limit, enforced client-side before upload
  (`src/utils/artworkValidation.ts`) — chosen explicitly during planning as
  a sane ceiling for the file types staff actually work with (mockup PNGs,
  vector files), not a real max the bucket enforces.
- Previews are **signed URLs**, generated on demand (`getArtworkSignedUrl`),
  short-lived (1 hour), never persisted — not the same object-URL trick
  Phase 1 used, which didn't survive a refresh and never touched a real file.
- `useArtworkPreviewUrls` (`src/hooks/useArtwork.ts`) fetches signed URLs for
  previewable types (PNG/JPG/WEBP/SVG) on demand for the Artwork & Mockups
  tab and for the New Order form when resuming/editing.

## 9. Verification scripts (not part of CI, not yet run)

Two standalone Node/tsx scripts exist for scenarios better tested against a
real backend than mocked:

- `scripts/verify-order-number-concurrency.ts` — fires concurrent
  `upsert_order` calls and confirms the sequence never produces a duplicate.
- `scripts/verify-artwork-upload.ts` — round-trips a real file through
  Storage.

Both require `SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD` env vars (real
credentials, deliberately never passed through the agent/chat) and **have
not actually been run yet** — worth doing before considering Phase 2 fully
closed out.

## 10. Error handling

Per plan §16: every mutation's `onError` shows a generic, staff-facing toast
(`src/utils/errorMessage.ts`'s `staffErrorMessage(err, fallback)`) — never
raw Postgres/PostgREST error text, which can leak column/constraint/policy
names. The real error still goes to the console for debugging. Applied
across all settings pages, the New Order form, Production Tab, and customer
creation. Two deliberate exceptions: `Login.tsx` (Auth's own messages are
already appropriate) and the artwork upload handler's client-side validation
branch (mixes safe validation text with backend errors — left visible on
purpose).

## 11. Milestones (chronological, one commit each)

1. Backend foundation — Supabase auth + `profiles`
2. Catalog and `business_settings` tables + seed
3. Customers on real data + customer linking restored (closes Phase 1 gap #2)
4. Order core schema, `upsert_order` RPC, `src/api/orders.ts`
5. Artwork storage (bucket, policies, `src/api/artwork.ts`)
6. Full New Order flow wired to real mutations
7. Production Board on real data + optimistic status mutations (closes gap #5)
8. Order editing (`/orders/:id/edit`, reusing the New Order form)
9. Dashboard real metrics + real global search (closes gap #4)
10. Settings persistence — catalogs + business settings CRUD (closes gap #7)
11. Hardening: RLS/performance audit, real artwork previews, real customer
    order stats, drafts view + resume flow, generic error messages

Plus one small follow-up after Milestone 11 shipped: reordered the New Order
form's Garment & Styles section so "Artwork & Files" (the upload widget)
renders above "Print Details" (whose Artwork dropdown selects from files
uploaded there) — the dropdown's own hint text ("from files uploaded above")
now matches the actual visual order.

Every milestone was verified against the live database via Supabase MCP
(`execute_sql`, `get_advisors`) before being committed, in addition to
`npm run build && npm run lint && npm run test`.

## 12. What's still open

- **Two verification scripts never run** (§9) — order-number concurrency and
  artwork upload round-trip. Written for the user to run with their own
  credentials; worth doing before calling Phase 2 fully closed.
- **Full UI click-through regression** — the acceptance tests in
  `PHASE_2_BACKEND_PLAN.md` §16 were verified piecemeal at the data layer via
  MCP for every milestone, but never confirmed end-to-end by clicking through
  the actual deployed UI for Milestones 6–11.
- **`garment_types.active`** — Hoody/Singlet/T-shirt are currently disabled
  in the live catalog. Flagged during the Milestone 11 audit and confirmed
  by the user to be left as-is (not a bug, a real catalog decision).
- **Mockup canvas editor** (Fabric.js or similar) and **garment reference
  photo cleanup** (Phase 1 HANDOVER.md gaps #11 and the "Next development
  phase" note in CLAUDE.md) remain out of scope — not attempted in Phase 2.
- **Bundle size** — `npm run build` warns the main JS chunk is >500kB
  (mostly garment mockup images). Not addressed; candidate for a later pass
  (dynamic import / code-splitting) if load time becomes a real complaint.

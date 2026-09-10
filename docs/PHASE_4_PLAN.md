# SALT PRINTS — Phase 4 Implementation Plan

Companion to `docs/PHASE_4_BRIEF.md`. This document is the engineering-level
detail: exact schema, exact RLS, exact Edge Function boundary, the
COPY/RESET/REGENERATE matrix, and batch/milestone gating. **Planning only —
no migrations, RLS, Edge Functions, or UI were created while writing this.**

---

## 1. Codebase audit findings

Verified live against the current Supabase project and repository (this
session):

**Auth/profiles**
- `profiles(id uuid pk, full_name text, role text not null default 'staff'
  check (role in ('owner','admin','staff')), created_at, updated_at)`.
  No `email`, `is_active`, or `must_change_password`.
- Trigger `on_auth_user_created` (`AFTER INSERT ON auth.users`) calls
  `handle_new_user()`: `insert into profiles (id, full_name) values (new.id,
  new.raw_user_meta_data ->> 'full_name')`. Proves the sync pipeline works;
  doesn't set role or capture email.
- `is_admin_or_owner()` — `SECURITY DEFINER`, `select exists (select 1 from
  profiles where id = auth.uid() and role in ('owner','admin'))`. Already
  the gate for `garment_types`/`garment_brands`/`services`/
  `business_settings`/`mockup_templates` UPDATE policies. Reusable as-is.
- `profiles` RLS: SELECT = own row OR `is_admin_or_owner()`. UPDATE = own
  row only, `using (id = auth.uid()) with check (id = auth.uid())` — **no
  column restriction**. A `staff`-role user can today issue
  `PATCH /profiles?id=eq.<self>` with `{"role":"admin"}` and RLS will allow
  it (same row, same id) — this is a real, currently-live privilege
  escalation gap Phase 4 must close (§6, §28).
- No INSERT/DELETE policy on `profiles` exists for `authenticated` — new
  rows only ever come from the trigger (which runs as the trigger's
  definer, bypassing RLS) or, after Phase 4, the Edge Function using the
  service-role key (also bypasses RLS). Correct as-is, no change needed.
- `auth.users` confirmed columns (live query): `banned_until timestamptz`,
  `email_confirmed_at`, `raw_user_meta_data jsonb`, `encrypted_password`.
  `banned_until` is exactly the mechanism `supabase.auth.admin.updateUserById`
  exposes via `ban_duration` — real, working, no plugin needed.
- Live data: exactly one `profiles` row today (`role = 'admin'`,
  `full_name` null).

**Session/routing**
- `useSession()` — thin wrapper over `getSession()` +
  `onAuthStateChange()`. No `AuthProvider`/`AuthContext` component exists;
  session state is a plain hook, not React context — Phase 4 should keep
  this pattern (add a `useCurrentProfile()`-style hook alongside it, not a
  new context provider, per the brief's "no new architectural layers"
  principle).
- `RequireAuth` (`src/layouts/RequireAuth.tsx`) gates on session existence
  only — no role check, no active-status check, no must-change-password
  check anywhere in the route tree today.
- `useProfile()` (`src/hooks/useProfile.ts`) fetches the current user's
  profile via `getProfile(userId)`; only consumer today is `AppSidebar` (for
  initials/name display) — `role` is fetched but never branches on.
- Settings routes are flat, one page per route, all registered inside the
  same `RequireAuth`-gated route group in `App.tsx`:
  `/settings`, `/settings/garments`, `/settings/services`,
  `/settings/statuses`, `/settings/mockups`, `/settings/business`.
  `/settings/users` slots in identically.

**Assignment / orders**
- No `assigned_to` (or any assignment-shaped) column exists anywhere in
  `orders` or any migration. Confirmed via full-text search across
  `supabase/migrations/*.sql`.

**Production Board**
- `useProductionBoard()` (`src/hooks/useProductionBoard.ts`) is entirely
  client-derived: fetches all orders once (`useOrders()`), then filters/
  sorts in memory via `useMemo`. State (`search`, `view`, `filters`,
  `sortKey`, `sortDir`) is plain `useState` — **not URL-addressable today**
  (no `useSearchParams`). `BoardView` already has 7 preset-shaped filters
  (`all`, `due-today`, `upcoming`, `urgent`, `artwork-attention`,
  `garment-followup`, `completed`) — proves the "derived filter preset"
  pattern already exists and Phase 4 just adds more entries to the same
  enum + switch, not a new mechanism.

**Dashboard**
- Already renders 6 stat cards (Active, Due Today, Urgent, Awaiting
  Artwork, Ready for Production, Completed This Week), an "Orders Requiring
  Attention" table (via `ordersRequiringAttention`, which itself already
  delegates to `getAttentionWarnings` per Batch C), an "Upcoming Deadlines"
  list, and a "Recent Activity" feed. Genuinely missing from this list:
  Overdue as its own count, a production-status breakdown, staff workload,
  average turnaround.

**Customer Detail**
- Already shows Active/Completed/Total stat cards and a recent-orders
  table (order #, job, created, due, production status) plus a notes card
  (Milestone 11). No "Reorder" action, no previous-garment/artwork summary
  yet.

**Activity**
- `order_activity.activity_type` check constraint:
  `'created','priority','artwork','garments','production','mockup','payment'`.
  No `'assignment'` value — needs adding for Milestone 2.
- `order_activity.order_id` is `not null` — genuinely can't host
  account-level events with no order.

**Artwork ownership**
- `artwork.order_id uuid not null` (FK to `orders`). Storage path:
  `orders/{orderId}/artwork/{artworkId}/{fileName}` (from `uploadArtwork` in
  `src/api/artwork.ts`) — the order id is baked into the path itself.
  `print_specs.artwork_id` is `ON DELETE SET NULL`. Conclusion: artwork is
  **exclusively order-owned**, never shared. Reorder must copy the Storage
  object + insert a new `artwork` row (Option B from the audit prompt), not
  reference the original.

**Reporting data availability**
- `orders.completed_at timestamptz` already exists and is trigger-
  maintained: `set_completed_at()` sets it to `now()` whenever
  `production_status` transitions to `'Completed'`, and nulls it if moved
  away — confirmed live in `20260908084613_order_core.sql`. Not yet
  surfaced anywhere in the TypeScript domain model (`Order` type / mappers
  don't carry it) — safe, real data for an average-turnaround metric, just
  needs plumbing through, not a new column.

**Edge Functions / server-side infra**
- Zero Edge Functions deployed (`list_edge_functions` → `[]`, no
  `supabase/functions/` directory). This is genuinely new infrastructure
  for the project, not an extension of something existing.

## 2. Existing functionality to reuse

- `is_admin_or_owner()` — the authorization primitive for every new admin
  RLS policy.
- The `upsert_order`-style pattern (`SECURITY DEFINER` Postgres function,
  re-checks its own authorization, does the whole-child-set-replace) — the
  template for any new privileged Postgres-side function that doesn't need
  the Auth Admin API (e.g., a `set_order_assignment` RPC could follow this
  shape if a plain RLS UPDATE policy isn't precise enough).
  Anything needing the Auth Admin API (create user, set password, ban)
  cannot be a Postgres function at all — it must be an Edge Function, since
  only the Edge Function runtime can hold a service-role key safely.
- `getAttentionWarnings`/`isReadyForProduction`/`productionReadiness.ts`'s
  whole architecture (pure, centralized, unit-tested) — the template for
  `getProductionQueueRank`.
- `useProductionBoard`'s `BoardView` enum/switch — the template for the new
  filter presets (My Orders, Unassigned, etc.) — literally just more enum
  values and filter branches, per the audit's finding that this mechanism
  already exists and works.
- `OrderFormEditor`/`orderFormSchema` — Reorder reuses this whole form
  unchanged, fed different `initialValues`, exactly like `resume-draft` and
  `edit-active` already do (three modes become four).
- `staffErrorMessage` — every new mutation's `onError` uses this unchanged
  (never a raw error to the UI, Plan §16 precedent from Phase 2).
- `StatCard`/`StatusBadge`/`Card`/`Select`/`Drawer` UI primitives — no new
  primitives needed anywhere in Phase 4.

## 3. Actual gaps

- No role-aware routing/authorization anywhere client-side.
- No column-level protection on `profiles` (self-escalation gap, §1).
- No Edge Function infrastructure at all.
- No `assigned_to` concept.
- No account-level audit trail table.
- No `'assignment'` activity type.
- Dashboard doesn't surface Overdue-as-a-metric, status breakdown, staff
  workload, or turnaround time.
- Customer Detail has no Reorder action.
- Production Board filters aren't URL-addressable (relevant only if Phase 4
  wants shareable links to a preset — see §19).

## 4. Current Auth/profile architecture

Covered exhaustively in §1. Summary diagram:

```
auth.users (Supabase-managed)
    │  AFTER INSERT trigger: handle_new_user()
    ▼
profiles (id, full_name, role, created_at, updated_at)
    │  RLS: SELECT own-or-admin, UPDATE own-row-only (no column guard)
    ▼
useProfile() → AppSidebar (display only, role never gates anything)
```

## 5. User-management architecture

New route `/settings/users` (`SettingsUsers.tsx`), registered in `App.tsx`
identically to the other five `/settings/*` routes. New API module
`src/api/adminUsers.ts` wrapping calls to the new Edge Function (creation,
edit, activate/deactivate, role change, password reset) and a plain
`profiles` SELECT (list/search — no privilege needed beyond the existing
admin-can-read-all RLS policy, which already exists). New hooks
`src/hooks/useAdminUsers.ts` (TanStack Query, same shape as every other
hooks file in the app — `useUsers()`, `useCreateUser()`, `useUpdateUser()`,
`useSetUserActive()`, `useResetUserPassword()`).

Route-level gating: `SettingsUsers.tsx` itself checks
`useCurrentProfile().role` and renders a "not authorized" state (or
redirects to `/dashboard`) for non-admins — this is the *convenience* UX
layer. The *actual* security boundary is server-side (§6), so this check
existing or not existing in React changes nothing about whether a Staff
account can actually perform a privileged action.

## 6. Role/RBAC architecture

Two roles, `admin`/`staff`, stored in the existing `profiles.role` column
(the `owner` value stays valid for the one legacy row but is not
selectable in the Add/Edit User UI — treated as admin-equivalent
everywhere via the existing `is_admin_or_owner()`).

Authorization has two independent layers, matching the brief's explicit
"hiding a button is not authorization" requirement:

1. **Server-side, enforced regardless of client**: the Edge Function
   re-derives the caller's role from their JWT + a `profiles` lookup on
   every call, before doing anything privileged. A Postgres RLS policy
   independently prevents a non-admin from writing `profiles.role`,
   `profiles.is_active`, or `profiles.must_change_password` on any row,
   including their own (closes the §1 self-escalation gap) — this holds
   even if someone calls PostgREST directly, bypassing the Edge Function
   and the React app entirely.
2. **Client-side, for UX only**: `/settings/users` and its actions are
   hidden/disabled for non-admins. This layer existing or not changes
   nothing about actual security — it just avoids showing staff a button
   that would 403.

## 7. Privileged Auth operation architecture

One new Edge Function, `admin-users` (or split into
`admin-create-user`/`admin-reset-password`/`admin-set-active` if that reads
cleaner — a planning-time choice, not a security-relevant one, since all
of them share the same admin-check-first structure). Request flow:

```
POST /functions/v1/admin-users  (Authorization: Bearer <caller JWT>)
  body: { action: 'create'|'update'|'setActive'|'resetPassword'|'setRole', ... }
    │
    ▼
1. Verify JWT (automatic — verify_jwt: true on deploy)
2. supabaseAdmin (service-role client, server-side only) .from('profiles')
   .select('role').eq('id', caller.sub).single()
3. if role not in ('admin','owner') → 403, stop.
4. Perform the requested Auth Admin API call:
   - create:        supabaseAdmin.auth.admin.createUser({ email, password:
                     'saltprints', email_confirm: true })
   - resetPassword:  supabaseAdmin.auth.admin.updateUserById(id, { password:
                     'saltprints' })
   - setActive(false): supabaseAdmin.auth.admin.updateUserById(id, {
                     ban_duration: '876000h' })  // ~100 years, i.e. indefinite
   - setActive(true):  ban_duration: 'none'
5. Write/update the profiles row (service-role client bypasses RLS by
   design here — this IS the trusted path) — set full_name/email/role on
   create; is_active + must_change_password on setActive/resetPassword.
6. Insert one admin_activity row (§10) — never the password.
7. Return the updated profile (never the password) to the caller.
```

**Duplicate-email handling**: `createUser` from the Auth Admin API returns a
distinct error for an existing email — the function surfaces
`"An account with this email already exists"` (generic, matching
`staffErrorMessage`'s "never leak raw DB text" precedent) rather than the
raw Auth error.

**Rollback if Auth succeeds but profile write fails**: wrap step 5 in a
try/catch; on failure, call `supabaseAdmin.auth.admin.deleteUser(id)` to
undo the just-created Auth user before returning an error — never leave an
orphaned Auth user with no profile (which would be invisible to every
`profiles`-based query, including RLS's own admin check, and effectively
unmanageable except via the Supabase dashboard).

**Service-role isolation**: the service-role key lives only in the Edge
Function's environment (`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`,
provisioned automatically by Supabase for Edge Functions — never committed,
never in any `.env` shipped to the browser, never in `vite.config.ts` or any
`VITE_`-prefixed variable, since Vite only exposes `VITE_*` vars to client
bundles and this key must never be one of them).

## 8. Temporary-password architecture

`profiles.must_change_password boolean not null default false`. Set to
`true` by the Edge Function on both `create` and `resetPassword`. A new
route `/change-password` (outside the normal app shell, similar in spirit
to `/login`). `RequireAuth` (or a new wrapper composed with it) checks
`useCurrentProfile().mustChangePassword` — if true, every route except
`/change-password` itself redirects there (mirroring exactly how it
already redirects an unauthenticated session to `/login`, just one more
condition in the same guard). The Change Password page calls
`supabase.auth.updateUser({ password: newPassword })` **directly from the
client using the user's own session** — this is safe and requires no
privileged operation, because Supabase Auth's `updateUser` only ever
changes the *currently authenticated* user's own password, never anyone
else's; no service-role key is needed for a user changing their own
password. On success, a plain (non-privileged, RLS-allowed —
`must_change_password` is normally admin-only-writable, so this one write
needs a narrow carve-out: either a `SECURITY DEFINER` RPC
`clear_must_change_password()` that only sets that one column to `false`
for `auth.uid()`, or a distinct RLS policy scoped to only that column
transitioning true→false) clears the flag.

## 9. Deactivation/reactivation architecture

Covered in §7 (Edge Function `setActive` action). Two effects, both
required per the brief's "prefer real enforcement over UI-only":
`profiles.is_active = false` (drives every UI list/selector filter) AND
`banned_until` set far in the future on the Auth user (drives actual
authentication failure — a banned user's `signInWithPassword` fails at the
Supabase Auth layer itself, before the app even loads). Reactivation
reverses both. Historical `orders.assigned_to` references are untouched by
either action — the `profiles` row is never deleted, only flagged.

**Admin-safety guardrail**: the Edge Function's `setActive(false)` action
additionally checks — after resolving the target user's current role —
whether they are the *last remaining active admin/owner*
(`select count(*) from profiles where role in ('admin','owner') and
is_active`) and refuses with a clear error ("Cannot deactivate the last
active admin") if deactivating them would leave zero. This also covers
"an admin accidentally deactivating themselves" as a special case of the
same check, without needing separate logic.

## 10. Admin audit architecture

Proposed (not created) table:

```sql
create table admin_activity (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),         -- who performed it
  target_id uuid references auth.users(id),         -- whose account, if applicable
  activity_type text not null check (activity_type in (
    'user_created', 'user_activated', 'user_deactivated',
    'role_changed', 'password_reset'
  )),
  message text not null,                            -- e.g. "Password reset required for James Smith"
  created_at timestamptz not null default now()
);
alter table admin_activity enable row level security;
create policy "admin/owner can read admin_activity" on admin_activity
  for select to authenticated using (is_admin_or_owner());
-- No insert/update/delete policy for authenticated — only the Edge
-- Function's service-role client ever writes this table.
```

Written exclusively by the Edge Function (service-role, bypasses RLS by
design — same trust boundary as the `profiles` write in the same call).
Never readable by `staff`. Never contains a password, token, or key —
message strings are pre-built by the Edge Function from a fixed set of
templates, never string-interpolating anything from the request body that
could smuggle sensitive data in.

## 11. Exact schema changes proposed

All as new, additive migrations — nothing destructive, nothing renamed.

| Change | Type | Nullable/Default | FK | Index | Backfill | Rollback |
|---|---|---|---|---|---|---|
| `profiles.is_active` | boolean | not null default true | — | none needed at current scale | existing row defaults to true automatically | drop column |
| `profiles.must_change_password` | boolean | not null default false | — | none | defaults false | drop column |
| `profiles.email` | text | nullable initially, backfilled | — | maybe (see below) | one-time backfill via `auth.users.email` for the existing row (requires a one-off admin-context query, done once during Milestone 1 implementation, not during this planning gate) | drop column |
| `orders.assigned_to` | uuid | nullable | `references profiles(id) on delete set null` | `orders_assigned_to_idx` (assignment filters will be common) | null for all existing orders (correct — nothing was ever assigned) | drop column |
| `order_activity.activity_type` check constraint | alter constraint | — | — | — | none | revert constraint (only safe if no `'assignment'` rows exist yet) |
| `admin_activity` (new table) | table | — | `actor_id`/`target_id` → `auth.users(id)` | `created_at` if audit list grows large enough to paginate later | none (new table) | drop table |

**Why `profiles.email` needs backfill via `on delete set null`-style FK
consideration is N/A** — it's a plain denormalized text copy, not a FK.
Kept in sync going forward only by the Edge Function (on create) and never
otherwise editable — Staff cannot change their own email through this
column (email changes, if ever needed, go through Supabase Auth's own
email-change flow, out of scope for Phase 4).

**RLS implications**: `profiles`'s existing UPDATE policy
(`using (id = auth.uid()) with check (id = auth.uid())`) must be narrowed.
Two viable designs, to decide during Milestone 1 implementation (not this
gate):
- **A. Column-guard trigger**: a `BEFORE UPDATE` trigger on `profiles` that
  raises an exception if `role`, `is_active`, `must_change_password`, or
  `email` changed AND the acting role (checked via `is_admin_or_owner()`)
  isn't admin — keeps RLS itself simple, moves the column-level check into
  a trigger (a pattern Postgres supports well and this codebase doesn't yet
  use, but is standard).
- **B. Split policies**: drop the single UPDATE policy; add
  `"staff can update own display fields"` (`with_check` restricted to a
  `full_name`-only diff, awkward to express purely in RLS) and
  `"admin can update any profile"` (`is_admin_or_owner()`, no column
  restriction). RLS alone can't easily express "these specific columns
  only" — column-level SQL privileges (`GRANT UPDATE (full_name) ON
  profiles TO authenticated`) combined with RLS is the actually-correct
  Postgres mechanism for this, since RLS operates on rows, not columns.

**Recommendation**: **Option B combined with column-level GRANTs** —
`GRANT UPDATE (full_name) ON profiles TO authenticated` (self-service
display-name changes only) plus the existing admin RLS policy for
everything else, is the standard, well-understood Postgres primitive for
"some columns self-editable, others admin-only" and doesn't require a new
trigger pattern this codebase has never used. Final call happens during
Milestone 1 implementation, informed by testing both against the actual
staff-cannot-escalate test matrix (§28).

## 12. Migration strategy

One migration per logical unit, matching this project's existing
convention (each Phase 3 batch was 1–2 migrations, descriptive filenames,
full `CREATE OR REPLACE FUNCTION` bodies rather than `ALTER FUNCTION`
fragments — same style continues):
1. `profiles` new columns + updated RLS/GRANTs.
2. `orders.assigned_to` + index.
3. `order_activity` check-constraint extension.
4. `admin_activity` table + RLS.

Applied via `mcp__supabase__apply_migration` during implementation, each
independently reviewable and revertible per the table in §11.

## 13. API changes

New: `src/api/adminUsers.ts` (Edge Function client calls + plain `profiles`
list/search query), `src/api/assignment.ts` or an addition to
`src/api/orders.ts` (whichever existing file's convention fits — orders.ts
already owns `diffOrderForActivity`-style order-mutation logic, so
assignment likely belongs there as one more field in the same update
surface, not a new file). Existing `src/api/orders.ts` gains
`assignedTo`/`assigned_to` passthrough in `mapDatabaseOrderToDomain`/
`mapOrderFormToUpsertPayload` and one more `activity_type: 'assignment'`
case in `diffOrderForActivity`.

## 14. Edge Function/server-side changes

One new Edge Function (`admin-users`, §7). No changes to existing Edge
Function infrastructure (there is none yet — this is the first). Deployed
with `verify_jwt: true` (the default, and correct here — every call must
carry a real authenticated session).

## 15. Hook changes

New: `useAdminUsers.ts` (`useUsers`, `useCreateUser`, `useUpdateUser`,
`useSetUserActive`, `useResetUserPassword` — TanStack Query mutations
matching `useOrders.ts`'s existing shape exactly), `useCurrentProfile.ts`
(a thin rename/extension of `useProfile` adding `isActive`/
`mustChangePassword`/`isAdmin` derived fields, or `useProfile` itself
extended in place — implementation-time call). Existing: `useOrders.ts`
gains an `assignedTo` field in relevant mutations;
`useProductionBoard.ts` gains new `BoardView` entries.

## 16. UI/component changes

New: `SettingsUsers.tsx`, `AddUserDialog`/`EditUserDialog` (or a single
`UserFormDialog` handling both, matching how `GarmentCard` handles
add/edit-in-place elsewhere), `ChangePassword.tsx` page,
`AssigneeSelector.tsx` (reusable across New/Edit Order, Order Detail,
Production Board — one component, not three copies). Existing:
`RequireAuth.tsx` gains the must-change-password redirect;
`ProductionToolbar.tsx` gains the new filter presets;
`Order Detail`/`New Order`/`Edit Order` gain an assignee field;
`CustomerDetail.tsx` gains a Reorder button per order row; `Dashboard.tsx`
gains Overdue/status-breakdown/turnaround cards.

## 17. Assignment architecture

`orders.assigned_to → profiles.id`. Read side: `mapDatabaseOrderToDomain`
joins `profiles(full_name)` the same way it already joins
`customers(name, company)` — one more field in the existing `ORDER_SELECT`
string in `src/api/orders.ts`. Write side: assignment change goes through
the existing `upsertOrder`/`updateOrderWithActivity` path (one more field
in the payload, one more `diffOrderForActivity` case) — no new mutation
plumbing needed, reusing the exact save path every other order field
already uses.

## 18. Queue-ranking architecture

```ts
// src/utils/productionQueue.ts (new, mirrors productionReadiness.ts's shape)
export type QueueTier = 'overdue' | 'same-day' | 'urgent-or-due-today' | 'due-tomorrow' | 'upcoming'
export function getProductionQueueRank(order: Order): QueueTier { /* pure, deterministic */ }
export function compareQueueRank(a: Order, b: Order): number { /* stable sort helper */ }
```

Consumed by `useProductionBoard`'s existing sort mechanism as one more
`SortKey` option (`'queue'`) — additive, doesn't replace `dueDate`/
`priority`/`quantity`/`createdAt` sorting. Never blocks opening any order
(the brief's explicit "must not rigidly block staff" requirement) — it's a
sort/filter input only, exactly like `priority` already is.

## 19. Operational-attention architecture

No new table. New `BoardView` entries (`my-orders`, `unassigned`,
`ready-for-production`, `garments-needed`, `due-soon` — `awaiting-approval`
and `overdue`/`urgent` already exist in some form as `artwork-attention`/
`urgent`) each add one filter branch to `useProductionBoard`'s existing
switch statement. **Recommendation: derived filter presets (Option A from
the requirements), not URL-addressable views (Option B) for Phase 4** —
the current `useProductionBoard` state is plain `useState`, and while
adding `useSearchParams` sync is a reasonable future improvement, nothing
in the current codebase or this audit demonstrates staff need to *share a
link* to a filtered view today; Option A is strictly less work and fully
reversible/extensible to Option B later without a data-model change (it's
purely a state-persistence question, not an architecture one). No
persisted custom saved views (Option C) — not justified.

## 20. Duplicate/reorder architecture

New pure function `buildReorderFormValues(order: Order, printSpecs:
PrintSpec[]): OrderFormValues` (lives near `defaultValues.ts`, same layer).
Feeds `OrderFormEditor` in `mode="create"` — no new form component, no new
save path. The **COPY / RESET / REGENERATE matrix**:

| Field | Behavior | Rationale |
|---|---|---|
| `id` | RESET (new) | New order, new identity |
| `orderNumber` | REGENERATE (DB trigger assigns on save, same as any new order) | Sequence-generated, never client-set |
| `createdAt`/`updatedAt` | RESET (new, set on save) | New row |
| `dueDate` | RESET (blank, staff must choose) | Old due date is almost certainly wrong for a new job |
| `orderState` | RESET (Draft, same as any new order) | Standard creation flow |
| `paymentStatus` | RESET (`Unpaid`, the schema default) | New order, no payment made yet |
| `artworkStatus`/`garmentStatus`/`productionStatus` | RESET (schema defaults) | New workflow lifecycle |
| `previewStoragePath` (per PrintSpec) | RESET (cleared) | Keyed by (orderId, printSpecId), both new — see §13 |
| `order_activity` history | RESET (none copied; one new `"Order created from reorder of {orderNumber}"` entry) | Old history belongs to the old order |
| `completed_at`/`staffCompleted` | RESET | New order hasn't been completed |
| **`priority`** | **COPY** | Same customer/job type likely has the same urgency profile; staff can change it |
| **`turnaround`** | **COPY** | Same reasoning; staff reviews before saving anyway |
| **`deliveryMethod`** | **COPY** | Usually stable per customer |
| **`assignedTo`** | **RESET (unassigned)** | A repeat job isn't automatically the same staff member's responsibility — admin/staff assigns explicitly |
| **`approvalNote`** (per PrintSpec) | **RESET (cleared)** | Notes were feedback on the *previous* mockup's specific approval cycle, not evergreen |
| **`notes`/`productionNotes`** | **RESET (cleared)** | Old notes usually reference the completed job's specific circumstances; staff re-enters if still relevant (avoids stale/misleading carry-over) |
| **customer, services, garments (type/brand/colour/sizing/quantities), PrintSpecs (position/colour/widthMm/heightMm/garmentType/garmentColour/offsetX/offsetY/rotationDeg), artwork associations** | **COPY** (artwork via the copy-not-reference strategy, §13) | This is the actual point of Reorder — recreate the production spec |

PrintSpecs get **new stable UUIDs** on copy (never reuse the original
order's PrintSpec ids) — generated the same way `emptyPrintSpec()` already
does (`crypto.randomUUID()`), consistent with Milestone 1's original
stable-id fix requiring ids to be assigned once, client-side, before first
save.

## 21. COPY/RESET/REGENERATE matrix

See §20 (kept as one table rather than duplicated).

## 22. Artwork-reuse decision

**Decision: Option B — copy the Storage object, create a new `artwork`
row.** Justified by §1's ownership audit: `artwork.order_id not null`, the
Storage path embeds the order id, and Batch B's preview-cleanup logic
already assumes single-order ownership. Copying means:
`supabase.storage.from('artwork-originals').copy(oldPath, newPath)`
(Supabase Storage supports server-to-server copy without re-uploading
through the browser) followed by inserting a new `artwork` row with a new
id, new `order_id`, and the new `storage_path`. This preserves the
original order's artwork completely untouched (§20's "original order
remains untouched" acceptance criterion) and gives the duplicated order
its own independent artwork lifecycle (deleting the reorder's artwork can
never affect the original).

## 23. Preview-duplication strategy

**Do not copy.** `preview_storage_path` is reset to null on every
duplicated PrintSpec (§20). Since Batch B's `syncMockupPreviewsForOrder`
already regenerates every current PrintSpec's preview on every explicit
save, the very first save of a reordered order naturally produces fresh,
correctly-keyed previews under the new `(orderId, printSpecId)` pair — no
special-case duplication code needed, this is just the existing save path
doing what it already does for any new order.

## 24. Customer-history architecture

Additive only: a "Reorder" button per row in `CustomerDetail.tsx`'s
existing recent-orders table, calling `buildReorderFormValues` and
navigating to `/orders/new` with the built values passed via router state
(matching how `EditOrderForm`/`ResumeDraftForm` already hydrate
`OrderFormEditor` with `initialValues` — router state or a query param are
the two options; router state avoids putting a large form payload in the
URL). No new customer-level queries beyond what `useOrders()` already
fetches (client-side filtered via `ordersForCustomer`, exactly as today).

## 25. Reporting architecture

Extend `src/utils/dashboard.ts` with a few more pure selectors
(`overdueOrders`, `ordersByProductionStatus`, `averageTurnaroundDays` —
the last one only over orders where `completedAt` is non-null, using
`completedAt - createdAt`, both already real timestamps). Extend the
`Order` domain type + `mapDatabaseOrderToDomain` to carry `completedAt`
(currently dropped by the mapper — a one-line addition, not a schema
change, since the column already exists). Add corresponding `StatCard`s to
`Dashboard.tsx`. Staff-workload breakdown (`ordersByAssignee`) depends on
Milestone 2 and is deferred if Batch A were ever skipped (§23 of the
brief).

## 26. Activity architecture

`order_activity` gains `'assignment'` as a valid `activity_type` (one
constraint migration) and one more case in `diffOrderForActivity`:
`if (previous.assignedTo !== values.assignedTo) → "Order assigned to
{name}" / "Order unassigned"`. `admin_activity` (§10) is entirely separate,
written only by the Edge Function. Neither table logs filter changes, queue
sorting, preview opens, warning reads, or customer-history views — matching
the brief's explicit "avoid activity noise" instruction and the existing
`diffOrderForActivity` precedent of only logging fields that have a
matching, meaningful `activity_type`.

## 27. Query/cache strategy

No change to the existing TanStack Query conventions — `useUsers()` etc.
follow the same `queryKey`/`invalidateQueries` pattern every other hook in
`useOrders.ts`/`useCustomers.ts`/`useSettings.ts` already uses. Assignment
and queue-rank data ride along on the existing `orders` query (one more
selected column, one more derived client-side value) rather than a
separate fetch — consistent with how `productionReadiness.ts`'s functions
already operate purely on the already-fetched `Order` object.

## 28. Security/RLS implications — the staff-cannot-X test matrix

To be proven (via live Supabase calls, not just code review) before
Milestone 1 is considered done:

| Attempted action, as a `staff`-role JWT | Expected result |
|---|---|
| `PATCH /profiles?id=eq.<self>` with `{"role":"admin"}` | Rejected — column-level GRANT (§11) doesn't include `role` for `authenticated` |
| `PATCH /profiles?id=eq.<self>` with `{"is_active":true}` (already true, no-op attempt) or `{"must_change_password":false}` | Rejected for the same reason, even as a no-op-looking value |
| `PATCH /profiles?id=eq.<other-user>` with anything | Rejected — RLS `using (id = auth.uid())` still applies underneath the column grant |
| `POST /functions/v1/admin-users` (create/resetPassword/setActive/setRole) with a Staff JWT | 403 from the Edge Function's own admin check, regardless of request body contents |
| Direct Auth Admin API call from the browser | Impossible by construction — no service-role key ever reaches the browser bundle (verified the same way Phase 3's Fabric-isolation check was: grep the built bundle) |
| `PATCH /orders?id=eq.<x>` with `{"assigned_to": "<inactive-staff-id>"}` | Allowed at the DB level (RLS doesn't need to know "active" — it's a UI-selector-only filter) but never offered as a UI option; if a test needs a hard server-side guard too, add a `CHECK`-via-trigger validating the target is active at assignment time — flagged as an implementation-time decision, not required by the brief's letter (which only requires exclusion from *selectors*) |

## 29. Index changes

`orders_assigned_to_idx` on `orders(assigned_to)` (new — assignment-based
filters like "My Orders"/"Unassigned" will scan this regularly).
`admin_activity`'s `created_at` only if/when its row count grows enough to
paginate (not needed at launch). No changes to existing indexes
(`orders_due_date_idx`, `orders_production_status_idx`, etc. — already
adequate per Batch D's performance audit).

## 30. Performance implications

Negligible at current scale (§19 of the brief). The one new join
(`profiles` on `orders.assigned_to`) is the same shape as the existing
`customers` join in `ORDER_SELECT` — no measurable cost difference.

## 31. Responsive implications

None beyond what's already handled — every new UI surface reuses existing
responsive primitives (`Card`, `Select`, `Drawer`, the `/settings/*` page
shell) rather than introducing new layout patterns.

## 32. Test strategy

Pure-logic unit tests (matching `productionReadiness.test.ts`'s density)
for: `getProductionQueueRank`/`compareQueueRank`, `buildReorderFormValues`
(the COPY/RESET matrix, field by field), the extended `dashboard.ts`
selectors, and `diffOrderForActivity`'s new `'assignment'` case. The
security matrix in §28 must be verified via live Supabase calls (the same
MCP-driven approach used throughout Phase 3's hardening), not unit tests
alone, since it's fundamentally about server-side enforcement. Full
acceptance checklists (verbatim from the Phase 4 requirements) to check off
during implementation:

**User Management**: Admin can view/search/add users; Auth user created
correctly; profile created/synchronized correctly; default role Staff;
initial temporary password `saltprints`; plaintext password never
persisted; new staff must change password; password change updates
Supabase Auth; password-change requirement clears; password-change route
cannot be bypassed; Admin can edit user details; Admin can change
Staff/Admin role; Admin can deactivate user; deactivated user cannot use
CRM; historical assignments remain intact; inactive users excluded from
new assignments; Admin can reactivate user; Admin can initiate password
reset; reset restores temporary-password workflow; Staff cannot access
privileged operations; Staff cannot promote themselves; privileged Auth
operations remain server-side; service-role credentials never reach the
browser; user-management actions appropriately audited.

**Staff Assignment**: active staff assignable; inactive staff excluded from
selector; historical inactive assignee still displays; assignment
persists; appears on Order Detail; appears usefully on Production Board;
My Orders works; Unassigned works; assignment changes create meaningful
activity; no secondary assignment model introduced.

**Smart Queue**: overdue/same-day/urgent/due-today/due-tomorrow prioritized
correctly; upcoming remains visible; ranking deterministic and tested;
staff can still manually work any order; existing status workflow remains
canonical; Ready for Production/Awaiting Approval/Garments Needed/My
Orders/Unassigned filters work.

**Reorder**: new order/order-number/PrintSpec UUIDs; services/garments/
quantities/production specs copy correctly; workflow statuses reset;
due date resets; preview paths don't copy; previews regenerate; artwork
lifecycle handled safely; original order and its previews remain
untouched; staff reviews before saving; reorder activity is meaningful.

**Reporting**: Active/Completed-This-Week/Overdue/Urgent/Awaiting-Approval/
Ready-for-Production/In-Production counts; production-status breakdown;
due-window breakdown; staff workload where reliable; no fabricated
historical metrics; Dashboard remains performant.

## 33. Batch structure

**Confirmed as proposed, with one adjustment.** The requirements' Batch
A/B/C/D grouping is verified sound against the actual codebase:

- **Batch A (Milestones 1+2)** — correct as the first batch: Milestone 2
  (Assignment) genuinely depends on Milestone 1's active-staff list
  existing, confirmed by the audit (no `assigned_to` exists yet, and it
  needs `profiles.is_active` to filter selector options).
- **Batch B (Milestones 3+4)** — correct: both are pure client-derived
  logic layered onto data Batch A and Phase 3 already provide
  (`getAttentionWarnings` for §4, `orders`/`assigned_to` for the My-
  Orders/Unassigned presets in §3). No new backend infrastructure needed in
  this batch at all — confirmed by the audit finding these can be built
  entirely as pure functions + `BoardView` enum extensions.
- **Batch C (Milestone 5)** — correct as its own batch given how much
  cross-cutting investigation Reorder required (artwork ownership,
  preview-path semantics, the full COPY/RESET matrix) — it deserves
  isolated verification before Batch D's hardening pass, not bundled with
  reporting.
- **Batch D (Milestone 6 + hardening)** — correct as the closing batch,
  mirroring Phase 3's own Batch D structure (reporting + responsive/
  performance/security hardening + final UAT + handover).

**One adjustment recommended**: within Batch A, implement and *fully
security-test* Milestone 1 (§28's matrix) before writing a single line of
Milestone 2 — Assignment's UI needs `is_active`-filtered staff lists, and
building that against an unverified/unhardened User Management backend
risks having to redo the assignment selector's data-fetching once Milestone
1's RLS design is finalized. This is a sequencing note within Batch A, not
a change to the batch boundaries themselves.

## 34. Milestone gates

Each milestone within a batch gets its own brief-confirmation checkpoint
before implementation starts (matching Phase 3's batch-gate discipline),
even though milestones are implemented together within a batch — i.e.,
Batch A's report should distinguish "Milestone 1 complete + security-tested"
from "Milestone 2 complete" as two sub-sections, not one merged summary,
so the security matrix (§28) is unambiguously checked off before Assignment
work is reported as done.

## 35. Risks

- **Column-level RLS/GRANT design (§11) is the highest-risk single piece**
  of Phase 4 — getting it subtly wrong (e.g., a GRANT that's broader than
  intended) directly enables the privilege-escalation scenario the whole
  brief is centered on preventing. Mitigate by testing §28's matrix live
  against Supabase before considering Milestone 1 done, not just reviewing
  the SQL.
- **Edge Function is genuinely new infrastructure** for this project — no
  prior Edge Function exists to pattern-match against within this
  codebase; the design in §7 leans on Supabase's documented Auth Admin API
  patterns rather than existing project precedent, so extra care/testing is
  warranted here specifically.
  - **Reorder's artwork-copy step** touches Storage server-to-server copy,
  an operation this codebase hasn't exercised before (existing code only
  ever uploads new objects or deletes them, never copies) — worth an
  isolated smoke test before wiring it into the full Reorder flow.
- **Phase 3's browser UAT is still outstanding** — Phase 4 adds more
  surface area (User Management UI, assignment pickers, queue sorting, a
  Reorder flow) that will also need eventual browser verification; the gap
  compounds if it's never closed. Flagged, not solved, here.

## 36. Rollback considerations

Every proposed migration (§11) is additive (new columns/table, one
constraint extension) — each has a documented, safe rollback (drop
column/table, revert constraint) with no data-loss risk to existing rows,
since nothing existing is renamed, retyped, or made newly `not null`
without a safe default. The Edge Function can be un-deployed independently
of any schema change (it calls existing/new tables but owns no schema
itself). No migration in this plan requires a backfill that could fail
partway except the one-time `profiles.email` backfill for the single
existing row (§11), which is small enough to verify by hand during
implementation.

## 37. Phase 3 UAT carry-forward

Unchanged from `PHASE_3_HANDOVER.md`: A1–A10, B1–B13, C1–C12, and the full
end-to-end workflow remain `NOT PERFORMED — no browser access`. This plan
does not change that status. If browser tooling becomes available during
Phase 4 implementation, running Phase 3's backlog alongside Phase 4's own
new acceptance tests (§32) is the recommended combined UAT pass — not two
separate efforts.

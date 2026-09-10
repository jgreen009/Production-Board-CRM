# SALT PRINTS — Phase 4 Brief: User Management + Operational Automation + Advanced CRM

**Status: PLANNING ONLY.** No application code, migrations, RLS changes, or
Edge Functions were created while writing this brief. This document and its
companion, `docs/PHASE_4_PLAN.md`, are the two deliverables of the Phase 4
Planning Gate. Implementation begins only after these are reviewed and
Batch A is explicitly approved.

## 1. Background

Phases 1–3 built SALT PRINTS into a working internal production CRM:
customer/order management, a garment/service/print-spec data model, an
interactive Fabric.js Mockup Studio, generated mockup previews, an artwork
approval workflow, and a centralized production-readiness/attention-warning
model driving the Dashboard and Production Board. All of that is real,
Supabase-backed, and RLS-protected. Phase 3's own browser UAT is still
outstanding (see §24) — that gap is carried forward, not resolved here.

Phase 4 does not add a new product surface — it makes the *existing* CRM
better for the staff who use it every day: knowing who's on the team and
what they can do (User Management), who owns which job (Assignment), what
to work on next (Smart Queues), what needs attention (Operational
Attention), how to handle a repeat job quickly (Reorder), what a customer's
history looks like (Customer History), and a lightweight operational
reporting view (Reporting).

## 2. Phase objective

Ship six milestones, batched as four gated batches (§22), each following
the same brief → plan → implement → report → gate discipline Phases 2–3
used. Milestone 1 (User Management) is the foundation everything else in
Phase 4 assumes exists.

## 3. Current-state architecture (see `docs/PHASE_4_PLAN.md` §1 for full detail)

- **Auth**: Supabase Auth, email/password only, no public sign-up (`Login.tsx`
  already states "Accounts are created by an admin"). Session via
  `useSession()` (`getSession` + `onAuthStateChange`). `RequireAuth` gates
  every non-login route on session existence only — no role or active-status
  check anywhere today.
- **profiles**: `id (=auth.users.id), full_name, role ('owner'|'admin'|'staff',
  default 'staff'), created_at, updated_at`. No `email`, no `is_active`, no
  `must_change_password`. One row exists today (`role='admin'`).
- **Sync**: a `handle_new_user()` trigger on `auth.users` inserts a bare
  `profiles` row (id + full_name from signup metadata) on every new Auth
  user — this already proves the "Auth user → profile" pipeline works, it
  just doesn't carry email or set a role deliberately today.
- **RLS**: `profiles` — SELECT is own-row-or-`is_admin_or_owner()`; UPDATE is
  own-row-only (no column-level restriction — a `staff` role can currently
  update its own `role` column via a direct PostgREST call, since RLS only
  checks row identity, not which columns changed). `is_admin_or_owner()` is
  an existing `SECURITY DEFINER` function already used to gate
  `garment_types`/`garment_brands`/`services`/`business_settings`/
  `mockup_templates` admin-only writes — this is the established, reusable
  authorization primitive for Phase 4.
- **No admin UI exists anywhere.** `role` is fetched (`useProfile`) but only
  ever used for sidebar initials — never for gating a route or an action.
- **No Edge Functions are deployed** (`supabase/functions/` doesn't exist).
  All privileged writes so far go through `SECURITY DEFINER` Postgres
  functions (`upsert_order`) called via RPC — a viable, already-proven
  pattern, but it can't create Auth users or set passwords (that requires
  the Auth Admin API, which only works with a service-role key — never
  exposed to Postgres functions or the browser).
- **`orders` has no `assigned_to` column.** Nothing today models "who owns
  this job."
- **`order_activity`** is real, used, and semantically order-scoped
  (`order_id uuid not null references orders`) — not a fit for
  account-level events (user created, role changed) that have no order.

## 4. User Management

Add `/settings/users` (matches the existing flat `/settings/*` convention —
see `PHASE_4_PLAN.md` §5). Admin can view, search, add, edit, activate/
deactivate staff, change roles, and reset a password to a temporary value.
Staff cannot reach any of this — enforced server-side, not just hidden in
React (see §6).

## 5. Role model

Two roles for Phase 4: **Admin**, **Staff**. The `profiles.role` check
constraint already technically allows a third historical value, `owner`
(treated as admin-equivalent everywhere via `is_admin_or_owner()`) — Phase 4
doesn't remove it, doesn't expose it as choosable in the Add/Edit User UI,
and doesn't add any further roles (Manager/Artwork/Production/Designer). No
part of the current codebase or this brief's audit demonstrates a need for
more than two staff-facing roles.

## 6. Authentication/security model

Every privileged action (create user, set/reset password, change role,
activate/deactivate) is a call to one new Supabase Edge Function, which:
1. Reads the caller's JWT (Edge Functions receive it automatically when
   `verify_jwt` is on) and re-derives their `profiles.role` server-side —
   never trusts a role claim from the request body.
2. Rejects with 403 if the caller isn't `admin`/`owner`.
3. Only then uses the Auth Admin API (via a service-role key that exists
   only in the Edge Function's server-side environment, never shipped to
   the browser) to create/update the target Auth user.
4. Writes/updates the corresponding `profiles` row.

This directly satisfies "hiding the button in React is not authorization" —
the Edge Function re-checks admin status itself, and Postgres RLS
independently prevents a `staff`-role JWT from writing another user's
`profiles.role`/`is_active` even if someone bypassed the Edge Function
entirely and called PostgREST directly (see `PHASE_4_PLAN.md` §6 for the
exact policy design, including the column-level self-escalation gap noted
in §3 above, which Phase 4 must close).

## 7. Temporary-password workflow

Admin-created and admin-reset accounts get the fixed temporary password
`saltprints`, set via the Auth Admin API inside the Edge Function — never
persisted anywhere in application tables, logs, or the frontend. A new
`profiles.must_change_password boolean not null default false` column
drives a hard client-side redirect (a route guard sitting inside
`RequireAuth`, before any other route renders) to a new Change Password
page whenever true. Successfully changing the password calls a second
privileged operation (Auth Admin API `updateUserById` with the new
password, or the user's own `supabase.auth.updateUser()` if a Staff
session can call it directly for changing *their own* password — see plan
§8 for which is actually necessary) and clears the flag.

## 8. User activation/deactivation

`profiles.is_active boolean not null default true`. Deactivating a user:
- Sets `is_active = false`.
- Also bans the corresponding Auth user (`banned_until`, a column that
  already exists on `auth.users` — confirmed live) via the Auth Admin API,
  so deactivation is real authentication enforcement, not UI-only.
- Excludes them from `orders.assigned_to` selectors going forward.
- Never touches any existing `orders.assigned_to` reference — historical
  assignments keep displaying the person's name (a profile row is never
  deleted on deactivation).

Reactivation reverses both (`is_active = true`, clear the ban).

## 9. Staff assignment

`orders.assigned_to uuid references profiles(id) on delete set null`. One
owner per order (no `artwork_assigned_to`/`production_assigned_to` — not
justified by anything in the current workflow). Surfaced on New/Edit Order,
Order Detail, and the Production Board (compact, alongside the existing
`AttentionBadge`-style treatment, not a new column-heavy redesign). Only
`is_active = true` staff appear in the picker; a picker showing an inactive
current assignee (for an already-assigned historical order) still shows
their name, just not as a selectable option for a *new* assignment.

## 10. Production queues

No new scheduling table. A pure `getProductionQueueRank(order)` helper,
architected the same way `productionReadiness.ts` already is (pure,
centralized, unit-tested, single source of truth — Dashboard and Production
Board both consume it, never duplicate its rules). Ranks by: Overdue → Same
Day turnaround → Urgent priority/Due Today → Due Tomorrow → Upcoming. It
informs sort order and filter presets; it never blocks staff from opening
any order regardless of rank.

## 11. Operational attention

Reuse `getAttentionWarnings(order)` as-is — it already exists, is correct,
and Phase 3's own Batch C work made it the single shared source for
Dashboard and Board. Phase 4 adds **derived filter presets** (My Orders,
Unassigned, Ready for Production, Awaiting Approval, Garments Needed, Due
Soon, Overdue) as one more `BoardView` entry each in the existing
`useProductionBoard` hook — no new rules engine, no notifications table.
In-app only; no email/SMS/push (explicit non-goal, §13).

## 12. Repeat orders

A "Reorder" action from Customer Detail's order history creates a
pre-filled **New Order form** (not a silent duplicate) so staff review
before saving. Uses the existing `OrderFormEditor` exactly as-is —
`initialValues` populated from the source order via a new pure
`buildReorderFormValues(order)` mapper, `mode="create"` (a genuinely new
order, new id, new order number, new PrintSpec UUIDs). See the full
COPY/RESET/REGENERATE field matrix in `PHASE_4_PLAN.md` §20.

## 13. Artwork reuse

Audited: artwork is **exclusively order-owned**. `artwork.order_id` is
`not null`, its Storage path is literally `orders/{orderId}/artwork/
{artworkId}/{fileName}`, and Batch B's mockup-preview cleanup logic already
assumes one artwork row belongs to exactly one order. Reorder must **copy**
the Storage object into a new path under the new order and insert a new
`artwork` row with a new id — never reference or reuse the original
`artwork_id` in the new order's `print_specs`. Mockup previews are never
copied — Batch B's `preview_storage_path` is keyed by `(orderId,
printSpecId)`, both of which are new on a duplicated order, so previews
regenerate naturally on first save exactly like any new order.

## 14. Customer history

Customer Detail already shows Active/Completed/Total stat cards, a recent
orders table (order #, job, created, due, production status), and a notes
card (Milestone 11). Phase 4 adds a "Reorder" action per row and,
budget-permitting, a compact previous-garments/artwork summary — no new
metrics beyond what real order data already supports (no fabricated
"customer lifetime value" or similar).

## 15. Reporting

Dashboard already covers 6 of the ~9 candidate metrics (Active, Due Today,
Urgent, Awaiting Artwork, Ready for Production, Completed This Week) plus
an Attention table and Upcoming Deadlines. Genuine additions: an explicit
Overdue count, a Production-Status breakdown, and — since `orders.completed_at`
is already trigger-maintained (set automatically whenever
`production_status` transitions to `Completed`, confirmed live) — an
average-turnaround-time metric, the one number Phase 4 can add that isn't
already on the Dashboard in some form. No separate BI dashboard.

## 16. Activity/audit behavior

- **Order-scoped events** (assignment changed, reorder created) extend the
  existing `order_activity` table — add `'assignment'` to its
  `activity_type` check constraint (the smallest possible schema touch).
- **Account-scoped events** (user created, activated, deactivated, role
  changed, password reset) get a new, small `admin_activity` table —
  proposed, not created, in `PHASE_4_PLAN.md` §10. `order_activity` is
  semantically order-specific (`order_id not null`) and is not overloaded
  with events that have no order.
- Never logged, anywhere: passwords, access/refresh tokens, service-role
  credentials. A reset logs `"Password reset required for {name}"`, never
  the password value.

## 17. Data model (see plan §11 for exact DDL)

New columns: `profiles.is_active`, `profiles.must_change_password`,
`profiles.email` (denormalized copy — `auth.users.email` isn't queryable
from RLS-scoped client reads, and the User Management list needs to show
it without a service-role call from the browser), `orders.assigned_to`. New
table: `admin_activity` (proposed). Extended check constraint:
`order_activity.activity_type` gains `'assignment'`.

## 18. Security/RLS

Every privileged mutation is server-side (Edge Function or a
`SECURITY DEFINER` Postgres function that itself re-checks
`is_admin_or_owner()`), matching `upsert_order`'s existing pattern.
`profiles` RLS gets a proper UPDATE policy split: staff can update only
their own non-protected fields (name, and — for the password-change flow
specifically — nothing in `profiles` at all, since password lives in Auth,
not `profiles`); `role`, `is_active`, `must_change_password`, `email` become
admin-only-writable columns, enforced via a trigger or a narrower RLS
`with_check`, not just "authenticated can update their own row." Full
design and the specific staff-cannot-X test matrix live in
`PHASE_4_PLAN.md` §28.

## 19. Performance

Current scale (a handful of orders/customers, one profile) means every
audited hot path (Production Board's in-memory filter/sort, Dashboard's
per-render recomputation) is fine as-is. Phase 4 adds nothing that changes
this materially — a staff list of a few dozen rows, a queue-rank sort over
the same already-fetched `orders` array. No pagination, no server-side
aggregation is justified yet; flagged as a future concern only if order
volume grows by an order of magnitude.

## 20. Responsive requirements

Extend existing pages/patterns only: `/settings/users` follows the same
card/table conventions as `/settings/garments` etc.; assignment picker
reuses the existing `Select`; queue/filter presets extend the existing
`ProductionToolbar`. No new responsive breakpoints or layout systems.

## 21. Non-goals

Public registration, customer accounts, organizations/workspaces/
multi-tenancy, subscription billing, external invitation infrastructure, a
separate admin application, inventory/stock/supplier/purchase-order
management, accounting/invoicing/Stripe, a customer-facing approval portal,
native mobile app, AI features, third-party integrations (Monday.com,
WhatsApp, SMS, email campaigns), advanced workforce scheduling, payroll,
time tracking, persisted custom saved views (derived/URL presets are
sufficient for Phase 4), more than one assignee per order, more than two
staff-facing roles.

## 22. Acceptance criteria

The full checklists (User Management, Staff Assignment, Smart Queue,
Reorder, Reporting) from the Phase 4 requirements are carried into
`PHASE_4_PLAN.md` §32 verbatim, to be checked off batch-by-batch as
implemented — not reproduced twice in both documents.

## 23. Known dependencies

- Milestone 2 (Assignment) depends on Milestone 1's `profiles` model
  (active-staff list) existing first — this is why they're batched together
  (Batch A).
- Milestone 3's queue ranking benefits from, but does not require,
  Milestone 2's assignment data (My Orders/Unassigned presets need it;
  Overdue/Urgent/Due-Soon ranking doesn't).
- Milestone 5's Reorder depends on nothing new from Milestones 1–4.
- Milestone 6's reporting benefits from Milestone 2 (staff workload) but
  degrades gracefully without it (that one metric is simply deferred if
  Batch A were ever skipped).

## 24. Phase 3 deferred UAT

**Phase 3 implementation is complete; browser acceptance is deferred.**
No part of Phase 3's UI has been click-through verified in an actual
browser by an agent, in this session or any prior one — browser tooling has
not been available. This is not being marked passed via unit tests, code
inspection, or database verification, and it is not resolved by Phase 4
planning. If browser tooling becomes available during Phase 4
implementation, Phase 3's outstanding acceptance tests (A1–A10, B1–B13,
C1–C12, and the end-to-end workflow from `PHASE_3_HANDOVER.md` §33) should
be executed alongside Phase 4's own validation, not deferred indefinitely.
Phase 3 is not being redesigned as part of Phase 4 unless that UAT
identifies an actual defect.

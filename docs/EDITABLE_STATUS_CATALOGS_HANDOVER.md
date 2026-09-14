# Editable Status Catalogs — Handover

## What changed

Payment, Artwork, Garment, Production, Priority, and Turnaround statuses
were fixed TypeScript unions + DB `CHECK` constraints. They're now a
database-backed catalog (`status_options`) that admins/owners can add to,
rename, recolour, disable, or delete from Settings → Statuses. Regular
staff see the same page read-only.

## Key design decision: `value` vs `label`

Every row has:
- `value` — immutable technical key, set once at creation, stored on
  `orders` rows, and what business logic compares against (queue ranking,
  production readiness, dashboard counts, `ARTWORK_ATTENTION`/
  `GARMENT_FOLLOWUP`-style inclusion lists, a DB trigger that sets
  `completed_at`). Never changes after creation.
- `label` — the admin-editable display text. Renaming a status only ever
  changes `label`.

This is what makes "rename" safe: every existing `=== 'Completed'`-style
comparison scattered across `productionQueue.ts`, `productionReadiness.ts`,
`dashboard.ts`, `status.ts`, `customers.ts`, `useProductionBoard.ts`,
`ProductionTimeline.tsx`, `OrdersList.tsx`, and the `order_core.sql`
trigger keeps working even after an admin renames "Completed" to
"Finished" for display — those comparisons are against `value`, which
never moves.

For every seeded status, `value` starts out equal to `label`. Only a later
rename diverges them.

## `is_system` protection

Every status seeded by the migration is `is_system = true`. Almost every
seeded value across Artwork/Garment/Production/Priority/Turnaround is
referenced by at least one piece of business logic — Payment was the only
dimension with zero hardcoded comparisons — so it wasn't safe to cherry-pick
which seeded statuses are "safe" to fully free.

`is_system = true` blocks **delete** (client-side guard in
`assertDeletable()`, `src/api/statusOptions.ts`) but still allows rename
and recolour, since those are provably safe under the value/label split.
A custom status an admin adds later is never `is_system` and can be freely
disabled or deleted.

Delete is refused for two reasons, checked in `deleteStatusOption()`:
1. `is_system` is true.
2. At least one `orders` row currently has that dimension's column equal
   to the status's `value` (checked live against `orders`, not against
   `active` — an order can be using a status you're trying to delete even
   if it's already been disabled).

There is no DB-side trigger enforcing either rule — `deleteStatusOption()`
is the only enforcement, so any future delete entry point must go through
it rather than calling Supabase directly.

## Database

`supabase/migrations/20260915000000_editable_status_catalogs.sql`:
- `status_options` table: `dimension` (payment/artwork/garment/production/
  priority/turnaround), `value`, `label`, `color` (neutral/danger/warning/
  success/info), `is_system`, `active`, `sort_order`. Unique on
  `(dimension, value)`.
- RLS: any `authenticated` user can `select`; `insert`/`update`/`delete`
  require `is_admin_or_owner()` — mirrors the existing
  `garment_types`/`garment_brands`/`services` pattern. **Verified live**
  against real staff/admin accounts (see below) — staff insert is rejected
  with `42501`, admin insert/read succeed.
- The old fixed `CHECK` constraints on `orders` (`orders_payment_status_check`,
  etc.) are dropped and replaced by a `BEFORE INSERT OR UPDATE` trigger,
  `validate_order_statuses()`, since a plain `CHECK` can't reference
  another table. It validates against `value` regardless of `active` — an
  order already set to a since-disabled status must remain valid; disabling
  only hides it from being newly selected.
- `validate_order_statuses()` has `execute` revoked from `public`, `anon`,
  and `authenticated` — it should only ever fire implicitly as a row
  trigger, never be callable directly via `/rest/v1/rpc/validate_order_statuses`.
  Confirmed via `supabase db advisors --type security --linked` returning to
  exactly the 4 pre-existing baseline findings after the revoke.

**Known limitation carried over from earlier work in this project**:
`supabase db push` is not usable in this environment (remote migration
history has entries not mirrored in this repo's `supabase/migrations/`).
This migration was applied directly via `supabase db query --linked --file`,
with the `.sql` file still committed to `supabase/migrations/` for
documentation/history.

## Frontend

- `src/api/statusOptions.ts` — `listStatusOptions`, `createStatusOption`,
  `updateStatusOption`, `deleteStatusOption` (+ the pure `assertDeletable`
  guard, exported for direct unit testing without mocking Supabase).
- `src/hooks/useStatusOptions.ts` — `useStatusOptions()` (everything, one
  query, `['catalog', 'status-options']`), `useStatusOptionsByDimension(dim)`
  (active-only, this dimension, shaped as `StatusConfig<string>[]` for
  `StatusSelect`), `useAllStatusOptionsByDimension(dim)` (includes inactive,
  used by `StatusBadge` so a since-disabled status on an existing order
  still renders correctly), plus create/update/delete mutations.
- `StatusSelect` (`src/components/domain/StatusSelect.tsx`) needed **zero**
  changes — it was already fully generic/presentational over
  `StatusConfig<T>[]`. Only its callers' data source changed, from the
  static arrays in `src/data/mockStatuses.ts` to
  `useStatusOptionsByDimension`.
- `StatusBadge` now resolves via `useAllStatusOptionsByDimension` instead
  of the static `getXStatusConfig` functions, with a neutral fallback
  (`{label: value, className: neutral}`) while the query is loading or if
  a value is somehow missing from the catalog.
- Every direct consumer of the old static arrays/`getXStatusConfig`
  functions (`ProductionTable.tsx`, `ProductionToolbar.tsx`,
  `ProductionTab.tsx`, `PaymentAndNotesSection.tsx`,
  `TurnaroundDeliverySection.tsx`) now pulls from
  `useStatusOptionsByDimension` instead.
- `src/data/mockStatuses.ts` is **not deleted** — `TURNAROUND_DESCRIPTIONS`
  (a fixed copy block, unrelated to editability) and the `StatusConfig<T>`
  type are still used from there. The static arrays and `getXStatusConfig`
  functions are now dead code, kept only because nothing references them
  anymore (safe to delete in a follow-up if desired).
- `src/schemas/orderFormSchema.ts` — `turnaround`, `priority`, and
  `paymentStatus` loosened from `z.enum([...])` to `z.string().min(1)`,
  since the valid set is now dynamic. `ArtworkStatus`/`GarmentStatus`/
  `ProductionStatus` were never on this form schema, so no change needed
  there.
- `src/types/index.ts` — `PaymentStatus`/`ArtworkStatus`/`GarmentStatus`/
  `ProductionStatus`/`Priority`/`Turnaround` widened from fixed unions to
  `KnownLiteral | ... | (string & {})`, so a custom admin-added status
  still type-checks everywhere while known values keep IDE autocomplete.
- `src/pages/settings/SettingsStatuses.tsx` rebuilt as a full CRUD UI
  (add/rename/recolour/enable/disable/delete), now including **Turnaround**
  as a 6th group (it was missing from the old read-only page's `GROUPS`
  array). Edit controls (Add, rename pencil, Disable/Enable, delete) only
  render when `useProfile().role` is `admin`/`owner`; staff see the same
  page with the badges only, no controls — same admin-gating pattern used
  by the Delete Order button in `OrderDetail.tsx` and the User Management
  card in `SettingsIndex.tsx`.

## Testing

- `src/api/statusOptions.test.ts` — `assertDeletable` guard (is_system
  refusal / non-system allowed).
- `src/hooks/useStatusOptions.test.ts` — `toStatusConfig` mapping,
  including a case demonstrating the value/label split survives a rename.
- Full suite: `npm run build`, `npm run lint`, `npm run test` all pass
  (360 tests).
- Live-verified against the real database with disposable test data,
  cleaned up afterward in every case:
  - `validate_order_statuses()` trigger rejects an invalid status value on
    a real order and accepts/restores a valid one (tested against order
    `SP-1160` in an earlier session, restored to `New` afterward).
  - RLS: a real staff account's `insert` into `status_options` is rejected
    with Postgres error `42501` (row-level security violation); a real
    admin account's `insert`/`select` succeed. Both run inside a
    transaction and rolled back — no permanent rows left behind.
  - Security advisor (`supabase db advisors --type security --linked`)
    confirmed back to exactly the 4 pre-existing baseline findings after
    the `validate_order_statuses()` execute-revoke fix.

## Known limitations / follow-ups not done

- `TurnaroundDeliverySection.tsx`'s turnaround button row still only ever
  offers the three system values (`Same Day`, `Rush`, `Standard`) by design
  — a custom turnaround an admin adds isn't offered as a pickable button
  there (it would need a UX decision on where custom turnarounds should
  surface on the order form, which wasn't asked for).
- `src/data/mockStatuses.ts`'s static arrays/`getXStatusConfig` functions
  are now unused dead code — not deleted, since nothing broke by leaving
  them and deleting wasn't explicitly requested.
- `src/data/mockOrders.ts` (demo/mock orders) still uses the original
  hardcoded literal status strings; this is fine since the seed data
  matches those literals exactly, but a newly admin-added custom status
  will never appear on a demo order.

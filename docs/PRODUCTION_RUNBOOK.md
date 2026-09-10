# Production Runbook

For a developer or technical administrator maintaining the SALT PRINTS
Production Board / CRM after handover. Written from the actual repository
and live Supabase project as of the close of Phase 5 — not aspirational.

## 1. System overview

- **Frontend**: React 19 + TypeScript, built with Vite, styled with
  Tailwind CSS v4 (config lives in `src/index.css` under `@theme`, not a
  `tailwind.config.js`). Routing via React Router v7 (`src/App.tsx`).
  Forms via React Hook Form + Zod. Server state via TanStack Query.
- **Supabase**: Postgres (schema in `supabase/migrations/`), Auth (email/
  password only), Storage (two private buckets), one Edge Function
  (`admin-users`).
- **Mockup Studio**: Fabric.js v6, lazy-loaded — never in the main bundle
  (see §Deployment → Performance).
- **Hosting**: Netlify. Build command `npm run build`, publish directory
  `dist`. SPA redirect (`/* -> /index.html 200`) is configured both in
  `public/_redirects` (ships with the build) and in the Netlify site's own
  settings (`.netlify/netlify.toml`, UI-managed).

## 2. Local development

```
npm install
cp .env.example .env.local
npm run dev       # http://localhost:5173, HMR
npm run build     # tsc -b && vite build — the only command that actually
                   # type-checks; `npx tsc --noEmit` at the repo root does
                   # NOT (root tsconfig.json is a solution file, files: [])
npm run lint      # oxlint
npm run test      # vitest run
```

Required env vars (`.env.local`, never committed — see `.gitignore`'s
`*.local` pattern):

| Variable | Where used | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts` | Project API URL |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` | Publishable/anon key — safe to expose client-side; RLS is the real boundary |

No other client env var exists in the codebase (verified by reading
`src/lib/supabase.ts` directly, not assumed). **Never** add a service-role
key or any `SUPABASE_SERVICE_ROLE_KEY`-named variable to a `VITE_*`
variable or to Netlify's client build environment — it would ship to
every browser. The service-role key exists only inside the `admin-users`
Edge Function's own Supabase-managed secret environment.

No Node version is currently pinned (no `.nvmrc` / `.node-version` /
`engines` field in `package.json`) — flagged in the Phase 5 handover as a
minor deployment-hardening item; Netlify will use its platform default
unless one is set in the Netlify UI's build settings.

## 3. Database

### Migration structure

All schema changes live in `supabase/migrations/`, one file per change,
named `<timestamp>_<description>.sql`. Applied to the live project via
`mcp__supabase__apply_migration` during development in this project's
history; going forward, use the Supabase CLI:

```
supabase link --project-ref <project-ref>
supabase db push          # applies any migration not yet recorded as applied
```

**Known discrepancy** (harmless, but worth knowing before trusting `supabase
migration list` blindly): the six Phase 4 migrations
(`fix_upsert_order_bare_delete` through
`phase4_m2_lock_down_assignment_trigger_function`) were applied directly
via the Supabase MCP tool, which assigns its own version timestamp at
apply time. The local filenames in `supabase/migrations/` for that batch
were written afterward for readability and do **not** exactly match the
live-recorded version numbers (content and order are identical — verified
by comparing `mcp__supabase__list_migrations` against
`supabase/migrations/` directory contents; same 18 names, same order,
just different timestamp digits for that one batch). If you ever run
`supabase db pull` or `supabase migration repair`, expect this mismatch
and reconcile by name, not by assuming timestamp equality.

### Important tables

| Table | Purpose |
|---|---|
| `profiles` | One row per Auth user. `role` (`owner`/`admin`/`staff`), `is_active`, `must_change_password`, `email` (synced from `auth.users` by `handle_new_user()`), `full_name`. |
| `orders` | Core order record. `order_number` (`SP-XXXX`, sequential — see below), `assigned_to` (FK to `profiles`), five independent status dimensions (payment/artwork/garment/production/priority), `completed_at` (trigger-maintained), `order_state` (`Draft`/`Active`). |
| `order_garments` / `garment_quantities` | Per-order garment line items and per-size quantities. |
| `order_services` | Many-to-many join to `services`. |
| `artwork` | Uploaded files, one row per file, `storage_path` into the `artwork-originals` bucket. Order-owned — never shared across orders (Reorder copies rows, never references). |
| `print_specs` | One row per print position on an order (position, colour, physical width/height mm, offset, rotation, artwork reference, `preview_storage_path`, approval note). |
| `order_activity` | Append-only activity timeline per order (status changes, assignment changes, etc.). |
| `admin_activity` | Append-only audit log for privileged account actions (user created/activated/deactivated/role-changed/password-reset). Never contains a password, token, or credential — only a human-readable message naming the actor/target. |
| `admin_activity` | See above. |
| `business_settings` | Single-row business config (name, contact, order-number prefix, standard turnaround). |
| `garment_types` / `garment_brands` / `services` / `mockup_templates` | Configurable catalogs, editable under Settings. |

### RLS

Every table has Row Level Security enabled. The general pattern used
throughout this app: `orders`, `customers`, `profiles` (SELECT) use
`using(true)` — any authenticated staff member can read them, matching the
"one shop, one team" trust model — while writes are the actually
security-critical boundary and are locked down per-column (see next
section) or per-business-rule (trigger-enforced).

### Column-level GRANTs (profiles hardening)

`profiles` is the one table where RLS alone was judged insufficient.
Beyond RLS, explicit Postgres column GRANTs restrict which columns the
`authenticated` role can write via PostgREST at all:

- `full_name` — writable by the row's own owner (self-service rename).
- `role`, `is_active`, `must_change_password`, `email` — **not** grantable
  to `authenticated` at all. Only the `admin-users` Edge Function (running
  with the service-role key, which bypasses PostgREST/RLS/grants
  entirely) can change these.

This is why a staff member's attempt to `PATCH` their own `role` returns
`403 permission denied for table profiles` (Postgres `42501`), not a
silent no-op — verified live in Phase 4 and again in Phase 5 (see
`PHASE_5_HANDOVER.md` §5).

### SECURITY DEFINER functions (intentional — do not "fix" these)

Three functions are `SECURITY DEFINER` and RPC-exposed to `authenticated`.
The Supabase Security Advisor flags all three every time it runs; this is
expected and has been reviewed and accepted, not overlooked:

- **`upsert_order(payload, p_order_id, p_finalize)`** — the one write path
  for creating/editing an order. Needs `SECURITY DEFINER` to write across
  several RLS-protected tables in one transaction and re-validates every
  business rule itself (assignment, garment quantities, etc.) — it is not
  a trusted-input passthrough.
- **`is_admin_or_owner()`** — an RLS-policy helper. Must be `SECURITY
  DEFINER` or it recurses infinitely (it queries the very table its own
  result gates the RLS policy on). This was a real bug found live in
  Phase 4, fixed by adding `SECURITY DEFINER` — see
  `20260910061500_phase4_m1_fix_is_admin_or_owner_recursion.sql`. It only
  ever returns a boolean derived from the caller's own row.
- **`clear_must_change_password()`** — narrow and self-scoped: no
  parameters, operates only on `auth.uid()`, and can only ever clear the
  flag (never set it to `true`). A staff member cannot use it to affect
  any other account.

**Do not revoke EXECUTE or switch these to SECURITY INVOKER "to clean up
the advisor list."** That would either break order creation entirely, or
reintroduce the exact recursion bug that was fixed. If a future advisor
run flags these, cross-check against this section before touching
anything.

One function that legitimately needed EXECUTE revoked:
`validate_order_assignment()` (the `BEFORE UPDATE` trigger function
enforcing "no assignment to inactive/unknown staff" on direct `.update()`
calls) was found improperly callable directly via
`/rest/v1/rpc/validate_order_assignment` by any authenticated caller. Fixed
in `20260910065500_phase4_m2_lock_down_assignment_trigger_function.sql`
(`REVOKE EXECUTE ... FROM anon, authenticated`) — the trigger itself still
fires correctly on real `orders` updates; only the standalone RPC call was
removed.

### Order numbering

`order_number` (`SP-XXXX`) is assigned inside `upsert_order` at finalize
time, sequentially, using the `business_settings.order_number_prefix`.
Concurrency-safe by construction (verified via
`scripts/verify-order-number-concurrency.ts` in an earlier phase) — do not
attempt to assign order numbers from the client or any other code path.

### Assignment validation (defense-in-depth)

"Cannot assign an order to an inactive or unknown staff member" is
enforced in **two** places, deliberately:

1. Inside `upsert_order` (covers the New/Edit Order form save path).
2. A `BEFORE INSERT OR UPDATE OF assigned_to` trigger,
   `validate_order_assignment()`, on `orders` directly (covers every other
   write path — status quick-changes, the Production Board's quick-
   reassign, anything that calls `.update()` directly instead of going
   through `upsert_order`). `orders`' UPDATE RLS policy is `using(true) /
   with check(true)`, so without this trigger those other paths would have
   no server-side enforcement at all.

If you ever add a new direct-`.update()` write path against
`orders.assigned_to`, it is automatically covered by the trigger — no new
code needed. Do not add a third, separate validation copy.

## 4. Auth

- **profiles.role**: `owner` / `admin` / `staff`. `admin` and `owner` are
  treated identically everywhere in code (`ADMIN_ROLES` set in the Edge
  Function, `is_admin_or_owner()` in SQL) — `owner` exists as a reserved
  higher tier but has no additional capability implemented yet.
- **Temporary-password onboarding**: every admin-created account and every
  password reset sets the account's password to a fixed literal
  (`'saltprints'`, defined once as `TEMPORARY_PASSWORD` inside
  `supabase/functions/admin-users/index.ts`) and sets
  `must_change_password = true`. `RequireAuth` (`src/layouts/RequireAuth.tsx`)
  redirects to `/change-password` whenever that flag is true and blocks
  every other route until it's cleared. `ChangePassword.tsx` rejects the
  literal temporary password as a new-password choice via a SHA-256 hash
  comparison (`dcfff244cffa15a44bb0c4f11b1d41597ba1f5f8bca469aff7f368c6b0a92e9`)
  — the plaintext itself is never present in any client-side file; this
  has been verified by grepping the built `dist/assets/*.js` output in
  every phase since it was introduced, most recently at the close of
  Phase 5.
- **Activation/deactivation**: `admin-users`'s `setActive` action both
  flips `profiles.is_active` and calls
  `supabase.auth.admin.updateUserById(id, { ban_duration })` — a ~100-year
  ban is Supabase's own documented pattern for "indefinite." This is real
  Auth-level enforcement, not just a UI flag: a deactivated account cannot
  sign in again (existing already-issued JWTs remain valid until their own
  natural expiry, which is normal for any bearer-token system, not a gap
  specific to this app).
- **Last-admin protection**: `countOtherActiveAdmins()` in the Edge
  Function blocks demoting or deactivating the last active admin/owner.
  This has a permanent, structural verification limitation: as long as
  the real production admin account exists and is active, the count can
  never organically reach zero via any other account's actions — which is
  itself the point (test/other-admin activity can never accidentally lock
  out the real admin). See `PHASE_5_HANDOVER.md` §5 for how this was
  verified as safely as possible.

## 5. Edge Functions

### `admin-users`

The one Edge Function in the project. Actions: `create`, `update`,
`setRole`, `setActive`, `resetPassword`. Every request re-derives the
caller's identity from their JWT and re-checks `profiles.role`/`is_active`
fresh from the database — nothing in the request body is trusted for
authorization.

**Deploy/update**:
```
supabase functions deploy admin-users
```
(or via the Supabase Dashboard → Edge Functions → admin-users → redeploy,
if the CLI isn't linked to this machine).

**Required secrets** (Supabase provisions `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` automatically for every Edge Function — no
manual secret configuration is required for this function specifically).
Never print or log the actual secret value anywhere, including in this
document.

**Troubleshooting**:
- A `401 Unauthorized` from the function means the caller's JWT didn't
  verify — check the client is actually passing a live session
  (`supabase.functions.invoke` does this automatically for a signed-in
  user).
- A `403` (`Unauthorized` / `Account inactive` / `Forbidden`) means the
  caller authenticated fine but isn't an active admin/owner — this is
  correct behavior for a staff account, not a bug.
- A `500` means something failed server-side after authorization passed —
  check `supabase functions logs admin-users` (or the Dashboard's Edge
  Function logs) for the `console.error(err)` output.
- Verify deployed source matches the repo at any time by comparing
  `mcp__supabase__get_edge_function` output (or the Dashboard's function
  source view) against `supabase/functions/admin-users/index.ts` — they
  were confirmed byte-for-byte identical at the close of Phase 5.

## 6. Storage

Two buckets, both **private** (`public = false`, reconfirmed at the close
of Phase 5 via `select public from storage.buckets`):

- **`artwork-originals`** — one object per uploaded artwork file, path
  embeds the order id (`orders/<order_id>/artwork/<artwork_id>/<filename>`
  pattern). Artwork is exclusively order-owned; never referenced across
  orders.
- **`mockup-previews`** — one PNG per finalized PrintSpec
  (`orders/<order_id>/print-specs/<print_spec_id>/preview.png`), generated
  client-side by the Mockup Studio and uploaded on save/finalize.

Both are accessed exclusively via short-lived signed URLs generated
server-side-equivalent (via the authenticated client SDK, which respects
Storage RLS) — never a public URL. Anon (unauthenticated) list/read
requests to either bucket are rejected (verified live: `400` with just an
`apikey` header, no session).

**Reorder copies**: `copyReferencedArtworkForReorder` uses Supabase
Storage's server-side `.copy()` under the existing authenticated-role
bucket policies — no new trusted mechanism was needed for this (confirmed
via an isolated smoke test before Reorder was built, per the Phase 4
Batch C plan). Copies are deduplicated by source artwork UUID: two
PrintSpecs referencing the same source artwork produce exactly one new
artwork row and one new Storage object, not two.

**Preview integrity**: run this bidirectional check periodically (a
one-off manual query — no scheduled job exists for this):

```sql
-- DB says a preview exists — does the Storage object?
select ps.id, ps.preview_storage_path from print_specs ps
where ps.preview_storage_path is not null
  and not exists (select 1 from storage.objects so
    where so.bucket_id = 'mockup-previews' and so.name = ps.preview_storage_path);

-- Storage has an object — does any current PrintSpec still reference it?
select so.name from storage.objects so
where so.bucket_id = 'mockup-previews'
  and not exists (select 1 from print_specs ps where ps.preview_storage_path = so.name);
```

At the close of Phase 5: zero missing objects, one orphaned object found
(a stale preview left behind by a regeneration, attached to a real-looking
order — not deleted; see `PHASE_5_HANDOVER.md` §9 for the specific path
and reasoning). Orphaned preview objects are harmless (unreferenced
storage, no broken UI) but worth periodically clearing once you're
confident a given object is truly orphaned and not, e.g., a preview
mid-regeneration.

`orders` has **no client-side DELETE RLS policy** at all, by design
("deactivate, don't delete"). This means a disposable test order created
during any future live-testing session cannot be cleaned up via the
normal client SDK — it must be deleted via direct SQL access (Dashboard
SQL editor or an MCP/service-role connection), same as every prior phase's
test cleanup in this project's history.

## 7. Deployment

- **Build**: `npm run build` (`tsc -b && vite build`).
- **Publish directory**: `dist`.
- **Host**: Netlify, already linked (`.netlify/netlify.toml` reflects the
  live site's UI-configured build settings: command `npm run build`,
  publish `dist`).
- **SPA redirects**: `public/_redirects` contains `/*  /index.html  200`,
  which ships into every build — direct navigation to any client route
  (`/dashboard`, `/orders/:id`, `/settings/users`, etc.) resolves
  correctly rather than 404ing, because Netlify serves `index.html` for
  any unmatched path and React Router takes over from there client-side.
- **Environment variables** (set in Netlify's site build environment, not
  committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Nothing else
  is required for the frontend build. **Never** add a service-role key
  here.
- **Rollback**: Netlify keeps every previous deploy; roll back via the
  Netlify Dashboard → Deploys → select a prior deploy → "Publish deploy."
  This is a Netlify platform capability, not something built into this
  repo — verified as available by inspecting the linked Netlify
  configuration, not independently tested end-to-end in this session (no
  destructive deploy/rollback action was performed against the real site).

## 8. Operations

**Create an Admin safely**: sign in as an existing admin → Settings →
Users → Add User → set Role to Admin. Never edit `profiles.role` via raw
SQL for this — it bypasses the audit log (`admin_activity`) that the Edge
Function writes.

**Reset a password**: Settings → Users → find the user → Reset Password.
Sets `must_change_password = true` and the account's password to the
onboarding temporary password; they'll be forced through
`/change-password` at next sign-in.

**Deactivate / reactivate a user**: Settings → Users → Deactivate/
Activate. Deactivating the last active admin is blocked server-side (see
§4).

**Investigate a failed order save**: check the browser console/toast for
the generic staff-facing message (raw Postgres errors are deliberately
never shown to staff — see `src/utils/errorMessage.ts`), then check
Supabase Postgres logs for the actual `upsert_order` RPC call and its
error. The most common historical cause of "every order save fails" was a
bare `DELETE` statement missing a `WHERE` clause tripping this project's
write-safety guard — already fixed
(`20260910042913_fix_upsert_order_bare_delete`), but worth knowing the
symptom if a similar guard trips on a future migration.

**Investigate a failed artwork upload**: check Postgres/Storage logs for
the `artwork` insert and the Storage object write; confirm the
`artwork-originals` bucket policies haven't changed; confirm the uploading
user's session hasn't expired mid-upload.

**Investigate a missing preview**: run the bidirectional preview-integrity
query in §6. If the DB has a `preview_storage_path` but the Storage object
is missing, the most likely cause is a preview-generation step that
updated the DB before the Storage upload actually completed (or failed
partway) — check `order_activity`/console logs around the save time in
question.

## 9. Recovery

- **Frontend rollback**: use Netlify's deploy history (§7). This is the
  fastest recovery path for a bad frontend deploy — no rebuild needed,
  just republish a prior deploy.
- **Migration considerations**: this project has no automated migration
  rollback tooling. Every migration in `supabase/migrations/` was written
  forward-only. If a migration needs undoing, write and apply a new
  forward migration that reverses the specific change — do not attempt to
  "undo" by editing history or resetting the live database.
- **Database backup guidance**: Supabase provides automated daily backups
  and point-in-time recovery on paid plans (exact retention depends on the
  project's plan tier — check the Supabase Dashboard → Database → Backups
  for what this specific project actually has enabled; this was not
  independently verified in this session, so do not assume a specific
  retention window without checking).
- **Storage safety**: Storage objects are not covered by Postgres backups.
  There is no automated Storage backup configured in this codebase as of
  Phase 5 — if artwork/preview loss protection beyond Supabase's platform
  durability is required, that would need to be set up separately (e.g. a
  periodic export) and is not currently in place.

## 10. Security — common mistakes to avoid

- Do not add a service-role key to any `VITE_*` variable, to Netlify's
  client build environment, or to any file that ends up in the client
  bundle. Verify with `grep -ri "service_role\|SUPABASE_SERVICE_ROLE" dist/assets/*.js`
  after any build that touches auth/admin code.
- Do not revoke or alter the three intentional `SECURITY DEFINER`
  functions listed in §3 based on an advisor warning alone — read this
  document's reasoning first.
- Do not add a cross-table CHECK constraint for the assignment rule — it
  was explicitly rejected during Phase 4 planning in favor of the
  trigger + RPC defense-in-depth pattern in §3, which correctly covers
  every write path including future ones.
- Do not display a raw caught error (`err.message`) directly to a staff
  user for anything that touches Postgres/Storage — route it through
  `staffErrorMessage()` (`src/utils/errorMessage.ts`), which logs the real
  error to the console and returns a safe generic fallback. Two places
  that violated this were found and fixed during Phase 5 hardening
  (`ArtworkSection.tsx`, `AddCustomerDialog.tsx`) — Supabase Auth error
  messages (Login, Change Password) and the `admin-users` Edge Function's
  own curated error strings (Settings → Users) are the two deliberate
  exceptions, both already reviewed and safe to show as-is.
- Do not use `git add -A`/`.` when committing — this repo has untracked
  local artifacts (`.agents/`, `skills-lock.json`, and a stray
  `src/Mockup images/` folder of unreferenced exec-* PNGs of unknown
  origin) that should not be swept into a commit without deliberate
  review.

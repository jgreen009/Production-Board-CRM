# Final UI/UX Audit — Brand Fanatix Refinement Pass

Read before implementing. Based on inspecting the actual current codebase
(all shared UI primitives, the app shell, Login/Change Password, and a
representative sample of feature pages), not assumption.

## Global design system findings

1. **A token layer already exists (`src/index.css` `@theme`) but is barely
   used.** `--color-brand-accent: #2563eb` is defined and never referenced
   anywhere in `src/`. Every component hardcodes raw Tailwind `zinc-*`/
   `red-*`/`amber-*`/`emerald-*` classes directly instead of theme tokens.
   Result: there is effectively no brand identity anywhere in the UI today
   — it's a monochrome zinc palette with ad hoc semantic colors sprinkled
   per component. **Fix**: extend the token layer with real semantic
   tokens (danger/warning/success/info) and a deliberate brand accent, and
   have primitives consume them.
2. **Radius/shadow are already consistent** — `rounded-md` for inputs/
   buttons, `rounded-lg` for cards, `shadow-sm` uniformly on `Card`. This
   is a strength; preserve it rather than inventing a new scale.
3. **Button touch targets are under the 44px mobile guideline.**
   `sm` = `h-8` (32px), `md` = `h-9` (36px). Fine on desktop with a mouse,
   tight on mobile. Fix: bump `md` height and keep `sm` for genuinely
   secondary/dense contexts (table row actions), per the instruction's
   "~44px where practical."
4. **Focus rings are inconsistent and colorless** — `Button` uses
   `outline-zinc-400`, `Field` inputs use `ring-zinc-900/10`. Neither
   reflects a brand identity. Fix: one consistent focus treatment, tinted
   with the new accent token.
5. **Typography has no documented scale** but is already reasonably
   consistent in practice (page titles `text-xl font-semibold`, card
   titles `text-sm font-semibold`, body `text-sm`, helper/caption
   `text-xs text-zinc-400`). Fix: document the scale explicitly (so future
   pages don't drift) rather than redesign sizes that already read fine.
6. **PageHeader, EmptyState, StatCard are solid, reusable, and already
   used everywhere they should be** — a real strength to preserve, not
   rebuild. Their only gap is the same token/accent absence as everything
   else.
7. **Badges/status colors** (`src/data/mockStatuses.ts`, not fully read
   here but referenced via `StatusBadge`) already centralize status→color
   mapping in one place — good. Confirm during implementation that the
   palette isn't excessively wide (the brief warns against "too many
   colours"); consolidate only if a genuine excess is found, don't
   redesign a working, centralized mapping wholesale.

## Rebrand findings

Exact locations of every user-facing `SALT PRINTS` reference (`src/`):
`AppSidebar.tsx` (wordmark + profile-role fallback text, the latter is
actually a pre-existing minor bug — it falls back to the business name
instead of a role label), `Login.tsx` (heading), `SettingsIndex.tsx` /
`SettingsUsers.tsx` (PageHeader descriptions), `NewOrderForm.tsx` (one
descriptive sentence), `types/index.ts` (a code comment, not user-facing —
harmless to update for consistency but not required).

`index.html`'s `<title>` is currently the generic `production-board-crm`
placeholder — never branded at all, in any phase. `public/favicon.svg` is
still Vite's default bolt icon — also never customized.

`business_settings.business_name` (live DB row) = `'SALT PRINTS'` — this
is **data**, not code; update via a live `UPDATE`, not a migration edit
(the migration that inserted it has already been applied historically and
must not be rewritten). `business_email`/`business_phone` are real
contact data, not branding text — left untouched pending a client
decision (see handover "known limitations"); changing an email domain is
a business decision, not a UI rebrand task.

**Intentionally NOT changed** (confirmed technical/historical, not
user-facing):
- `supabase/functions/admin-users/index.ts`'s `TEMPORARY_PASSWORD =
  'saltprints'` literal — an already-deployed server-side secret. Renaming
  it would require redeploying the Edge Function AND updating every
  existing account's actual password expectation and the client-side
  SHA-256 hash comparison in `ChangePassword.tsx` — a security-relevant
  change with real migration cost, explicitly out of scope for a
  UI/UX pass ("preserve all existing... Auth" per this task's own
  constraints).
- `supabase/migrations/*.sql` file contents/filenames (immutable history).
- `docs/PHASE_*` historical documents (a record of what happened when,
  not live product surface).
- Any `saltprints.com.au` / `saltprints.test` email addresses that are
  data, not UI chrome.

## Mobile-specific usability issues

- Button touch targets (above).
- `AppHeader`'s icon-only buttons (search, notifications) have
  `aria-label`s already (good) but no visible tooltip — acceptable for
  icon-only mobile chrome, not a blocker.
- Sidebar mobile drawer already exists and is full-height with a
  backdrop-close — solid pattern, just needs the rebrand + polish, not a
  rebuild.
- Production Board, Orders, Customers already have card-based mobile
  fallbacks per Phase 3/4 work — confirmed in the Phase 4 handover audit
  trail. This pass should refine their visual density/hierarchy, not
  invent mobile layouts from scratch.

## Business-critical — do not touch

Confirmed unchanged in this pass: RLS policies, Edge Function logic,
`upsert_order`/assignment/queue/readiness/attention SQL and TypeScript
logic, order numbering, Reorder's copy semantics, Storage paths, React
Query hooks/cache keys, route paths, form validation *rules* (only their
visual presentation changes).

## Implementation plan

1. Extend `src/index.css` tokens (brand accent + semantic danger/warning/
   success/info), keep the existing neutral scale.
2. Update `Button`, `Field`, `Badge`, `Card`, `StatCard`, `PageHeader`,
   `EmptyState`, `Tabs`, `ConfirmDialog` to consume tokens and fix the
   touch-target/focus-ring gaps — small, additive changes, not rewrites.
3. Rebrand sweep: all 6 `src/` UI-text locations, `index.html` title,
   `favicon.svg` (custom mark using the new brand accent), a live
   `business_settings.business_name` data update.
4. AppSidebar/AppHeader: rebrand wordmark, give the active-nav state real
   brand presence, fix the profile-role fallback-text bug, polish spacing.
5. Login/ChangePassword: full visual pass with the new identity.
6. Page-by-page visual refinement (Dashboard, Production Board + toolbar,
   Orders/Customers/Customer Detail, New/Edit Order + all sections,
   Order Detail + tabs + Mockup Studio framing, Settings pages) — applying
   the same token/spacing/component vocabulary consistently, mobile-first,
   without touching business logic or Fabric mechanics.
7. Build/lint/test, bundle-size check, write `docs/FINAL_UI_UX_HANDOVER.md`.

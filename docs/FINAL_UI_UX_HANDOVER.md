# Final UI/UX Refinement Handover — Brand Fanatix

This is a presentation-only refinement pass on top of an already
engineering-complete, functionally-verified application (Phase 5). No
business logic, database schema, RLS, Auth, Edge Functions, routes,
React Query hooks, or validation rules were changed. See
`docs/FINAL_UI_UX_AUDIT.md` for the audit that preceded implementation.

## 1. Objective

Rebrand the application from SALT PRINTS to **Brand Fanatix**, introduce a
deliberate, centralized visual design system, and make the app
mobile-first across every core surface — without touching any working
functionality — ahead of the Manual Browser UAT pass that follows this
one.

## 2. Brand Fanatix rebrand

Every user-facing "SALT PRINTS"/"Salt Prints" string in `src/` was
replaced with "Brand Fanatix": sidebar wordmark, Login heading, Settings
page descriptions (Settings hub, User Management), a New Order
descriptive sentence, and a code comment in `types/index.ts`. `index.html`
now titles the page "Brand Fanatix — Production Management" (previously
the un-branded Vite placeholder `production-board-crm`). `public/favicon.svg`
was replaced with a custom mark (a rounded-square "F" monogram in the new
brand-accent orange) — previously Vite's default bolt icon, never
customized in any prior phase. The live `business_settings.business_name`
database row was updated to "Brand Fanatix" via a direct SQL `UPDATE`
(data, not a migration edit — the migration that originally inserted the
row is immutable history and was left untouched). A pre-existing display
bug was also fixed in passing: the sidebar's profile-role fallback text
read `profile?.role ?? 'SALT PRINTS'` (a copy/paste artifact) — it now
falls back to `'Staff'`.

**Intentionally not changed** (confirmed technical/historical, not
user-facing — see the audit doc for full reasoning): the Edge Function's
`TEMPORARY_PASSWORD = 'saltprints'` server-side literal (an
already-deployed Auth secret; changing it is a security-relevant change
with real migration cost, out of scope for a presentation pass),
`business_email`/`business_phone` (real contact data, not branding text —
left for a client decision), migration file contents/filenames
(immutable), and every `docs/PHASE_*` historical document (a record of
what happened, not live product surface).

## 3. Global design system

`src/index.css`'s existing (but almost entirely unused) `@theme` token
layer was extended and, for the first time, actually consumed by the
shared primitives:

- **Brand accent** (`--color-brand-accent: #f2540b`, a vivid orange) —
  used deliberately and sparingly: the sidebar logo mark, the active nav
  item, focus rings app-wide, selected/active states (tabs, toggle
  buttons, selected garment-sizing/turnaround/print-position choices),
  and small highlight moments. Never used to paint whole sections. A
  soft tint (`--color-brand-accent-soft: #fef1e9`) backs selected
  rows/chips. A restrained `--color-secondary-accent` (indigo) exists but
  was deliberately left unused this pass — one accent was enough.
- **Semantic tokens** — `danger`/`warning`/`success`/`info`, each with a
  `-soft` background tint, replacing dozens of scattered raw
  `red-600`/`amber-600`/`emerald-600`/`blue-600` classes throughout the
  app with one centralized, reusable set.
- **Status badge consolidation** (`src/data/mockStatuses.ts`) — the
  single biggest coherence fix: status badges previously used **11
  different hues** (red, amber, orange, emerald, sky, purple, indigo,
  teal, blue, cyan, zinc) across ~35 status values. Consolidated to
  exactly **5 tokens** (zinc/danger/warning/success/info), each meaning
  one consistent thing everywhere in the app: neutral/not-started,
  needs-attention/blocked, in-progress/partial, done/good, and
  informational/queued. Every status still shows its own text label —
  colour is never the only signal.

## 4. Typography

No new type scale was invented — the existing, already-reasonably-
consistent sizes were documented and enforced rather than redesigned:
Page Title `text-xl font-semibold`; Section/Card Title `text-sm
font-semibold`; Body `text-sm`; Label `text-sm font-medium`; Helper/
Caption `text-xs text-zinc-400`. This avoided the "giant marketing-site
typography" failure mode explicitly called out in the brief — this is
operational software, not a landing page.

## 5. Spacing

No new spacing scale was introduced. Existing `gap-2`/`gap-3`/`gap-4`
conventions and `CardBody`'s default `p-4` were preserved and applied
consistently in every restyled section; several previously-uneven gaps
(e.g. inconsistent form-group spacing in New Order sections, cramped
mobile stat-card icon treatment) were tightened as part of each file's
individual pass rather than via a global spacing rewrite.

## 6. Buttons

`Button` (`src/components/ui/Button.tsx`): sizes changed from `sm=h-8
(32px)/md=h-9 (36px)` to **`sm=h-9 (36px)/md=h-10 (40px)`**, closing the
gap toward the ~44px mobile touch-target guideline without making every
desktop toolbar button oversized. Focus ring changed from plain zinc to
brand-accent-tinted. Variants (primary/secondary/ghost/danger) are
unchanged in meaning — primary stays near-black/confident rather than
accent-colored, keeping the brand accent reserved for selection/active
states rather than every call-to-action.

## 7. Forms

`Field.tsx`: `Input`/`Select` are now a fixed `h-10` (40px, matching
Button's `md` size so an input+button row lines up); `Textarea` was fixed
to grow with `rows` again (a height-sharing bug introduced mid-pass — the
shared `fieldBase` no longer bakes in a fixed height, each field type sets
its own). Focus rings and the `error` state now use `brand-accent`/
`danger` tokens respectively instead of raw colors. `Checkbox`/`Toggle`
checked-states use the brand accent. `FormField`'s required-asterisk is
now `text-danger`. The most mobile-significant fix: `SizeQuantityGrid.tsx`
(garment quantity matrix) was a single horizontally-scrolling row of
~32px-tall inputs — on a 390px screen with 8 adult sizes, later sizes
required scrolling *inside the card* to reach, and inputs were under the
touch-target guideline. It's now a wrapping 4-column grid (2 rows, no
scroll) with 44px-tall inputs on mobile, widening to one row from `sm` up.

## 8. Navigation / App Shell

`AppSidebar`: rebranded wordmark and logo mark (now brand-accent), active
nav item now uses a soft brand-accent background instead of plain
near-black, fixed the role-fallback-text bug (§2). `AppHeader`: the
mobile search icon button previously had **no `onClick` handler at all** —
a dead button, since `GlobalSearch` was simply hidden below `sm` with no
replacement. It now toggles the same `GlobalSearch` component full-width
below the header — no new search functionality, just making an
already-broken affordance actually work. Icon-button touch targets
bumped from `p-1.5` to `p-2.5`.

## 9. Dashboard

Reporting cards (Production Status Breakdown, Staff Workload, Average
Turnaround) were reordered to sit directly after the headline stat grid,
ahead of "Orders Requiring Attention"/"Upcoming Deadlines" — matching the
brief's stated priority order more closely than the previous layout.
Overdue-styled text switched to semantic tokens. No metric was added or
removed.

## 10. Production Board

The single most important screen received the most attention:
`ProductionTable.tsx` gained a small colored **queue-priority dot** (a new
`QueueDot` export, driven by the existing pure `getProductionQueueRank`
logic — purely additive, no column removed) plus semantic-token due-date
coloring and tighter row alignment. `ProductionToolbar.tsx`'s active-
filter-count badge now uses brand-accent for visibility; the mobile layout
stacks search full-width with filters/sort wrapping below it rather than
forcing horizontal scroll; touch targets bumped to 40px. The mobile
`OrderCard` fallback now surfaces the queue indicator and attention badge
up front, with Production/Artwork status prominent and Payment/Garment
status demoted to a muted second row — exposing every field the brief
asked for without cramming the card. `OrderQuickView.tsx` drawer already
had Escape-to-close, a proper header, and mobile-appropriate sizing
(confirmed, not rebuilt); its status badges were reordered by importance
and its readiness/warning banners moved to semantic tokens.

## 11. Orders

`OrdersList.tsx` gained a sort control (Due Date/Order #/Customer, with
direction toggle), an Assignee column/mobile badge, and its Job/Customer
columns were combined into one stacked cell so the desktop table isn't
overloaded — Qty/Created are hidden below `lg` rather than removed.

## 12. Customers

`CustomersList.tsx`'s 7-column table previously had **no mobile
fallback** at all (it would horizontally scroll on a 390px screen — a
genuine violation of the "no critical horizontal overflow" requirement).
It now hides the table below `md` and shows a card list instead, leading
with name/company and surfacing open/total order counts and last-order
date. `AddCustomerDialog.tsx` standardized on the same
Escape-to-close/aria-label dialog pattern used elsewhere, and its error
display now routes through the safe `staffErrorMessage()` token-styled
treatment.

## 13. Customer Detail

Same table-with-no-mobile-fallback issue existed in the 9-column order-
history table — fixed the same way (hidden below `md`, replaced by a card
list emphasizing job name, due date, production status, and a full-width
Reorder button). Customer info → Stats → Recent Orders → Notes hierarchy
was already sound and is preserved; the Reorder action's visibility is now
also guaranteed on mobile (previously it existed only as a table-row
button, unreachable without horizontal scroll).

## 14. New/Edit Order

All eight section components (Customer/Job, Turnaround & Delivery,
Services, Garments, Garment Styles, Print Details, Artwork,
Payment/Notes) were reviewed. Grids changed from fixed `grid-cols-2/3` to
mobile-first `grid-cols-1 sm:grid-cols-2/3`. Selected-state buttons
(turnaround, delivery method, garment sizing toggle) switched from plain
near-black to brand-accent-soft, giving the form's interactive choices a
consistent, branded selected-state language. The hand-rolled
staff-completion checkbox in Payment/Notes was replaced with the shared
`Checkbox` component (identical `register()` wiring, just visually
consistent now). Required-field asterisks and error text use the danger
token throughout. `ArtworkSection.tsx`'s upload logic and error handling
(hardened in Phase 5) were left completely untouched — only spacing
around the empty/uploading/uploaded states was tightened.

## 15. Mockup Studio

Restyled the chrome only — **zero changes to Fabric.js mechanics,
transform math, or `MockupCanvas.tsx`** (verified: that file was not
touched by any part of this pass). Position/print-location buttons now
use brand-accent for the active selection instead of near-black. The
canvas's surrounding container was enlarged and cleaned up (more padding,
a calmer background) without touching the mounting logic. Error and
overflow banners moved to `danger`/`warning` tokens respectively — the
overflow warning specifically uses `warning`, not `danger`, since overflow
must warn but never block saving. Mobile stacking order was reordered via
explicit `order-*` classes to match the brief's required sequence
(PrintSpec tabs → position/artwork controls → canvas → approval note),
while preserving the two-column desktop layout via `lg:row-span-2` on the
canvas.

## 16. Order Detail

`OverviewTab.tsx` received the most substantial restructure: a single
readiness banner (colored by severity — success/warning/danger) now leads
the tab, followed by a "Customer & Dates" card that answers who/when/who-
owns-it/contact info at a glance plus the mockup preview alongside it, then
a status-dimensions grid, then Production Notes/Services. Every other tab
(Order Form, Garments, Artwork & Mockups, Production, Files, Activity)
was restyled for consistency — semantic tokens replacing raw colors,
mobile-first grids, an added `CardHeader` on Activity (previously a bare
headerless card) — with every existing field/section preserved, nothing
removed.

## 17. Settings

All six sub-pages (Garments, Services, Statuses, Mockups, Business, Users)
were reviewed for a consistent page shell; several gained an `EmptyState`
for the zero-items case where one was missing, and ad hoc colors (an
amber badge in Mockups, a black toggle in Garments) were migrated to the
shared tokens/`Toggle` component.

## 18. User Management

`SettingsUsers.tsx`'s table previously had no mobile alternative beyond
`overflow-x-auto` (which still forces horizontal scroll at 390px). It now
shows stacked cards below `md` (name/email, role/status badges up top,
actions in a compact row) and the standard table at `md+` — identical
data and handlers, no logic duplicated. Role/Active badges now use the
`info-soft`/`success-soft` tokens instead of ad hoc indigo/emerald.
Deactivate got a subtler danger-toned treatment (bordered danger text)
distinct from Edit/Reset Password's neutral secondary styling, without
using the full "danger" button variant (reserved for an actual
irreversible-feeling action) — visually distinct but not alarming for a
reversible toggle. The Add/Edit User dialog's existing aria-label/
Escape-close (from Phase 5) is unchanged; confirmed mobile-safe at 390px.

## 19. Login / Change Password

Both rebranded with the new identity (accent-colored logo badge, "BRAND
FANATIX" wordmark, "Production Management" subtitle on Login) and given a
slightly more deliberate, secure feel — a filled danger-soft error
message block instead of plain red text, a visible password-length hint
on Change Password, and explicit copy ("You need to change your temporary
password before continuing.") matching the brief's suggested wording. No
internal security detail is exposed on either page.

## 20. Empty / Loading / Error states

`EmptyState`, `TableSkeleton`, and the Phase-5-hardened `staffErrorMessage`
pattern were all reused as-is (they were already solid and centralized —
see the audit). Several pages gained an `EmptyState` where one was
missing (Settings Garments/Services/Mockups for a zero-catalog state).
Error text styling was standardized to `bg-danger-soft`/`text-danger`
wherever a raw red class previously appeared, including two genuine raw-
error-message-leak-adjacent style inconsistencies fixed along the way
(`ArtworkFileCard.tsx`'s remove-button hover state,
`AddCustomerDialog.tsx`'s error text) — no error-handling *logic* changed,
only its visual presentation, and the Phase 5 safe-error-message
architecture itself was left completely intact.

## 21. Responsive behavior

**No browser tool was available for this pass either** (confirmed by
checking the available toolset before starting — same limitation as
Phase 5). Every mobile-first claim in this document was verified by
reading the actual JSX/className output at each breakpoint's logic (390/
430/768/1024/1280/1440 via Tailwind's `sm`/`md`/`lg`/`xl`/`2xl` prefixes),
by every implementing agent running `npx tsc -b` to confirm no structural
JSX errors, and by cross-checking against the app's existing established
patterns (several pages already had correct mobile card fallbacks before
this pass; those were used as the reference implementation for pages that
didn't). **This is a structural/code-review verification, not a
click-tested one.** Two genuine, previously-unfixed horizontal-overflow
gaps were found and fixed: `CustomersList.tsx` and `CustomerDetail.tsx`
had no mobile card fallback at all for their tables (confirmed by reading
the pre-existing code, not assumed).

## 22. Accessibility

Preserved every Phase 5 accessibility fix (the Add/Edit User dialog's
aria-label/Escape-close). Additional touches applied opportunistically
during this pass: `role="switch"`/`aria-checked`/`aria-label` added to a
raw toggle in `SettingsGarments.tsx` that lacked them; icon-only buttons
retain their existing `aria-label`s; focus rings are now visually
consistent (brand-accent) everywhere instead of some being colorless.
**This is not a WCAG audit** — no automated scanner or screen reader was
run, consistent with the same honest limitation stated in the Phase 5
handover.

## 23. Performance impact

No new dependencies were added anywhere in this pass (verified: no
`package.json` change). `src/components/domain/mockup-studio/
MockupCanvas.tsx` was not touched by any implementing agent — Fabric.js
remains lazy-loaded and isolated exactly as before.

## 24. Bundle sizes

| Chunk | Before this pass | After this pass |
|---|---|---|
| Main (`index-*.js`) | 823.38 kB / gzip 229.24 kB | 829.91 kB / gzip 230.30 kB |
| Fabric (`index.min-*.js`) | 289.01 kB / gzip 87.88 kB | 289.01 kB / gzip 87.88 kB (unchanged) |
| `SettingsUsers-*.js` (lazy) | 9.40 kB / gzip 3.26 kB | 10.63 kB / gzip 3.44 kB |
| `MockupCanvas-*.js` | 4.48 kB | 4.48 kB (unchanged) |

The ~6 kB main-chunk increase is new icons (lucide-react imports for the
mobile card layouts, queue-priority dot, etc.) and additional JSX across
dozens of restyled files — expected for a visual pass of this scope, not
a regression pattern. Fabric isolation is fully intact.

## 25. Tests

`npm run build` — pass, no TypeScript errors. `npm run lint` — pass,
oxlint clean. `npm run test` — pass, **182 tests**, 16 files (unchanged
count — this was a presentation-only pass; no new business logic was
added that would warrant new unit tests, and no existing test needed
updating since no function signature or business rule changed).

## 26. Known limitations

- No browser tool was available, so nothing in this document has been
  visually confirmed by rendering the app — see §21/§27.
- The main bundle remains above Vite's 500 kB advisory threshold, as
  explicitly accepted going into this pass ("do NOT refactor broadly
  merely to get under 500 kB").
- `business_email`/`business_phone` were left as `saltprints.com.au`/
  the existing phone number — a client decision, not made unilaterally.
- The `TEMPORARY_PASSWORD = 'saltprints'` server-side literal is
  unchanged (see §2) — this is intentional, not an oversight.
- Three pre-existing untracked artifacts in the repo (`.agents/`,
  `skills-lock.json`, `src/Mockup images/` — a folder of unreferenced
  `exec-*.png` files of unknown origin, not created by any Phase of this
  work) remain untouched and uncommitted, as in every prior phase.

## 27. Manual Browser UAT still required

> **Superseded notice (pre-UAT correction pass):** `docs/CURRENT_UAT_PLAN.md`
> is now the authoritative final browser-UAT checklist for this build,
> replacing the page-attention list in §28 below and the historical
> Phase 3/4/5 checklists for final-acceptance purposes. It was written
> after two functional fixes made in that pass — an Edge Function CORS
> bug that broke User Management for every real browser user, and a
> mockup-placement product change (artwork is no longer draggable) — so
> use it instead of testing this document's items in isolation. This
> section and §28 are left intact as the historical record of what this
> pass itself covered.

Every visual/interaction claim in this document — the rebrand actually
rendering correctly, the mobile card layouts actually being usable at
390px, the brand-accent selected states actually looking coherent, the
Mockup Studio's restyled chrome not interfering with real Fabric.js
interaction, the Production Board's queue dot actually being legible —
needs to be confirmed by an actual person in an actual browser. This
pass does not change the Phase 5 conclusion that **USER ACCEPTANCE STATUS:
NOT YET VERIFIED**; if anything, it makes the eventual UAT pass more
important, since a large volume of JSX/className changed across nearly
every page in a single pass without a chance to visually confirm any of
it along the way.

## 28. Pages requiring extra visual attention during UAT

In priority order, given the volume of change and/or importance of the
surface:

1. **Mockup Studio** — the most surgically constrained change (chrome
   only, Fabric untouched) but also the most complex layout; confirm the
   canvas still renders correctly, the mobile stacking order feels right,
   and no restyled control accidentally overlaps the canvas.
2. **Production Board** (table + mobile cards + toolbar + quick view) —
   the most important operational screen; confirm the new queue-priority
   dot is legible and not confusing, and that the mobile card's two-row
   status layout (primary row + muted second row) reads clearly rather
   than looking cluttered.
3. **New Order form** (all eight sections) — the highest business-risk
   surface if a mobile grid change introduced an unexpected wrap/overlap;
   confirm the garment quantity-matrix's new wrapping layout is genuinely
   easier to use on a real phone, not just structurally non-overflowing.
4. **Settings → User Management** — confirm the new mobile card layout's
   action buttons are comfortably tappable and the Deactivate/Edit visual
   distinction reads as intended (subtle, not alarming).
5. **Customers / Customer Detail** — brand-new mobile card layouts with
   no prior mobile fallback to fall back on if something's off; these are
   the least "proven" surfaces in this pass since they had no prior
   mobile pattern to build from.
6. Every page's **favicon/title** and the **Login/Change Password**
   screens — quick, low-risk, but worth a first-glance confirmation since
   they're the very first thing anyone sees.

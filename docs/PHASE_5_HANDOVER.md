# Phase 5 Handover — Final UAT, Production Hardening, Deployment Readiness

Phase 5 is the final major development phase: Final UAT + Production
Hardening + Deployment Readiness + Client Configuration + Documentation +
Handover. This document is the closing record.

## 1. Phase 5 objective

Close the outstanding gap from Phase 4 (no real-browser UAT was ever
performed, across Phase 3 or Phase 4), harden the product for production,
verify the real Supabase/Netlify deployment configuration, audit
production data/configuration, and produce final client and developer
documentation.

## 2. Baseline state (start of Phase 5)

- `npm run build`: pass. Main chunk `829.87 kB` / gzip `230.22 kB`. Fabric
  chunk (`index.min-*.js`) `289.01 kB` / gzip `87.88 kB`. `MockupCanvas`
  chunk `4.48 kB`.
- `npm run lint`: clean (oxlint, no warnings).
- `npm run test`: 182 tests passing, 16 files.
- Supabase Security Advisor: 3 `SECURITY DEFINER`-executable WARNs
  (pre-existing accepted, see §12) + 1 leaked-password-protection WARN
  (pre-existing accepted).
- Supabase Performance Advisor: 2 unindexed-FK INFO + 17 unused-index INFO
  (all pre-existing/expected on this dataset size).
- `git status`: clean tree aside from three untracked, unrelated items
  (`.agents/`, `skills-lock.json`, `src/Mockup images/` — a folder of
  unreferenced `exec-*.png` files not imported anywhere in `src/`, origin
  unknown, not created by this work and left untouched).

## 3. UAT result

> **Superseded notice (post-Final-UI-UX-refinement + pre-UAT correction
> pass):** the 20-flow checklist in §4 below was written against the
> product as it existed at the close of Phase 5, before the Brand Fanatix
> rebrand, the Final UI/UX refinement, and a mockup-placement product
> change (artwork is no longer manually draggable — the print position is
> now authoritative for placement). Several items below (free-drag
> testing, Center/Reset position controls) describe behavior this build
> no longer has. **`docs/CURRENT_UAT_PLAN.md` is now the authoritative
> final browser-UAT checklist** for this build — use it instead. This
> section is left intact as a historical record of Phase 5's own state.

**BROWSER UAT NOT PERFORMED.** No browser automation tool (Playwright,
Puppeteer, or equivalent) was available in this session — confirmed by
searching the available toolset before starting, not assumed. Every UAT
flow in §4 below is documented as a manual checklist for a human (or a
future session with browser tooling) to execute; none of the 20 flows has
been click-tested. This is the single largest remaining item before
Phase 5 can be called user-accepted — see §37 (final status).

Everything technically verifiable **without** a browser was executed: live
HTTP/SQL security and integrity testing, automated unit tests, database
audits, advisor runs, bundle inspection, and configuration review.

## 4. Manual UAT checklist (to be executed with real browser access)

Each flow below carries its severity classification per the Phase 5
defect-severity rubric (BLOCKER / HIGH / MEDIUM / LOW) as *guidance for
whatever the tester finds*, not a claim that anything was found — nothing
in this section has been executed.

### Flow 1 — Auth + User Management
1. Admin: Login → Settings → Users → Create Staff User. Verify name,
   email, role (Staff), active, visible in list, no password ever shown
   in UI or console.
2. Logout. Login as the new staff account with the temporary password.
   Verify forced redirect to `/change-password`, that no other route is
   reachable until it's cleared, that the temporary password itself is
   rejected as a new password, and that a valid new password saves and
   grants normal access.
3. Admin edits the staff member's name; changes their role (where safe —
   not self); resets their password (confirm `must_change_password`
   returns); deactivates them (confirm login is rejected); reactivates
   them (confirm login is restored).
4. Confirm the staff account cannot reach any User Management action
   (button absence and, if attempted directly, a server-side rejection).
   *(BLOCKER if a staff account can perform any privileged action;
   HIGH if User Management itself is broken for admins.)*

### Flow 2 — Customer + Standard Order
1. Create/select a test customer. Create an order: T-shirt, Black,
   multiple sizes/quantities, at least one service, turnaround, delivery,
   priority, due date, assignee.
2. Verify totals are correct, required fields are enforced only on
   Save/Create (not while filling in unrelated fields), Save Draft and
   Resume Draft work, Create Order assigns an `SP-XXXX` number, and the
   order appears on Customer Detail and the Production Board.
   *(BLOCKER if an order cannot be created or saved at all.)*

### Flow 3 — Artwork Upload
1. Upload a PNG/JPG — confirm a preview appears.
2. Upload a PDF/AI if safe test files are available — confirm it's stored
   without crashing and shows a graceful "preview unavailable" state
   where applicable.
3. Confirm upload doesn't block unrelated form fields, signed URLs
   resolve, and a page refresh doesn't lose already-uploaded artwork.
   *(BLOCKER if artwork is lost; HIGH if upload blocks the rest of the
   form.)*

### Flow 4 — Mockup Studio
1. Create: T-shirt, Black, Left Chest, 100mm, PNG artwork.
2. Verify garment and artwork are visible, the print-zone guide is
   correct, artwork position/selection align, controls don't overlap, and
   the canvas is usable.
3. Test drag, resize, rotate, Center Horizontal, Center Vertical, Reset
   Position, Reset Rotation, Reset Size. Confirm canvas changes only sync
   back to form state after a completed interaction (not mid-drag).
   *(HIGH if the editor is unusable; MEDIUM for control-overlap/spacing
   issues.)*

### Flow 5 — Physical Size
1. Set width to 100mm manually — confirm height follows proportionally.
2. Resize visually — confirm `widthMm`/`heightMm` update and reconstruct
   correctly after a save/reload.
3. Change Left Chest → Full Front — confirm physical width is unchanged;
   only the rendered scale relative to the new zone changes.
   *(HIGH if physical dimensions silently change when switching zones.)*

### Flow 6 — Multiple Prints
1. Create Left Chest, Full Back, Left Sleeve using at least two artwork
   files.
2. Confirm only one PrintSpec is active at a time, switching between them
   doesn't leak state, and each retains its own artwork/position/colour/
   dimensions/offset/rotation/approval note independently.
3. Remove one PrintSpec — confirm the remaining ones are unaffected.
   *(BLOCKER if PrintSpecs overwrite each other's data.)*

### Flow 7 — Overflow
1. Make artwork larger than its print zone — confirm a warning appears
   but save remains possible, and artwork is never forcibly clipped,
   snapped, or silently resized.
   *(HIGH if overflow silently corrupts the saved size/position.)*

### Flow 8 — Garment Colours
1. Switch Black → White → Navy — confirm the garment visual updates while
   artwork placement and physical dimensions remain stable.
   *(MEDIUM unless placement/dimensions actually shift, which would be
   HIGH.)*

### Flow 9 — Draft / Reconstruction
1. Create a multi-print mockup, Save Draft, refresh the browser, Resume
   Draft. Confirm garment, artwork, PrintSpecs, width/height, offset,
   rotation, and approval notes all reconstruct exactly.
2. Resize the browser window — confirm this never alters production
   dimensions or saved placement (it's a viewport change, not a data
   change).
   *(BLOCKER if a draft loses or corrupts data on reload.)*

### Flow 10 — Preview Generation
1. Explicitly save/finalize — confirm clean PNG previews are generated
   containing only the garment and artwork, with no selection handles,
   zone guides, editor controls, or other UI chrome baked in.
2. Confirm the same clean preview appears in Order Detail, the Production
   Board, and Quick View.
   *(BLOCKER if previews are broken/corrupt; HIGH if editor chrome leaks
   into the saved image.)*

### Flow 11 — Artwork Approval / Readiness
1. Walk artwork status through Mockup Required → Awaiting Approval →
   Approved → Completed; confirm per-PrintSpec approval notes save
   correctly.
2. Create a ready order (Artwork Approved, Garments Received, Production
   not Completed) — confirm it shows as Ready for Production.
3. Create a blocked combination — confirm the correct blocker/warning
   appears.
   *(HIGH if readiness is computed incorrectly.)*

### Flow 12 — Assignment
1. Create Order A → current user, Order B → another staff user, Order C →
   unassigned. Confirm My Orders and Unassigned filter correctly.
2. Deactivate the staff user assigned to Order B — confirm their name and
   an "inactive" indicator still show on that historical order, and that
   they can no longer be newly assigned to anything.
   *(HIGH if assignment is wrong or an inactive user remains assignable.)*

### Flow 13 — Smart Queue
1. Create orders representing Overdue, Same Day, Urgent, Due Today, Due
   Tomorrow, and Upcoming. Sort by Queue Priority and confirm that exact
   ordering.
2. Confirm Completed orders always rank lowest regardless of due date; On
   Hold orders follow ordinary due-date tiering (no special case exists by
   design); an order with no due date falls through to the lowest tier
   rather than crashing.
3. Confirm queue rank never blocks opening or working any order.
   *(HIGH if ordering is wrong; BLOCKER if the queue ever blocks
   interaction with an order.)*

### Flow 14 — Operational Views
1. Verify My Orders, Unassigned, Ready for Production, Awaiting Approval,
   the artwork-attention view, the garment follow-up view, Due Today,
   Upcoming, Urgent, and Completed all show coherent, non-contradictory
   results against the same test data.
   *(MEDIUM unless two views actively contradict each other — HIGH in
   that case.)*

### Flow 15 — Reorder
1. Use a completed test order with a customer, services, garments,
   quantities, multiple PrintSpecs, artwork, previews, notes, an
   assignee, and completed statuses. Click Reorder.
2. Confirm the new form contains the copied values (customer, garments,
   services, quantities) and resets: new order identity, new PrintSpec
   IDs, due date, workflow statuses, assignment, notes, production notes,
   approval notes, and preview paths.
3. Save. Confirm a new `SP-XXXX` number, new artwork rows, new Storage
   paths, shared source artwork copied only once where multiple specs
   reference it, and new previews generated.
4. Open the source order. Confirm its id, number, statuses, assignee,
   artwork, PrintSpecs, previews, notes, and activity are completely
   unchanged.
   *(BLOCKER if Reorder corrupts or modifies the source order in any
   way.)*

### Flow 16 — Dashboard
1. Cross-check every metric (Active Orders, Due Today, Urgent, Awaiting
   Artwork, Ready for Production, Completed This Week, Overdue,
   Production Status breakdown, Average Turnaround, Staff Workload,
   Orders Requiring Attention, Upcoming Deadlines, Recent Activity)
   against known counts from your test orders.
   *(HIGH if a headline metric is materially wrong.)*

### Flow 17 — Mobile (~390px)
1. Walk through Login, User Management, New Order, Artwork upload,
   Mockup Studio, PrintSpec tabs, transform controls, AssigneeSelector,
   Production Board, Queue controls, Quick View, Customer History,
   Reorder, and Dashboard at a narrow viewport. No critical control should
   be unreachable; no important workflow should require accidental
   horizontal scrolling.
   *(HIGH if a critical control is unreachable on mobile.)*

### Flow 18 — Tablet (~768px)
1. Focus on Order form grids, Mockup Studio, Production Board, Customer
   Detail, and Dashboard at this width.
   *(MEDIUM unless a workflow is actually broken, which would be HIGH.)*

### Flow 19 — Accessibility
1. Practical check (not a WCAG audit): keyboard navigation, dialog Escape
   behavior, focus handling, labels, button names, form error text,
   warnings conveyed with text (not colour alone), dropdown accessibility,
   Reorder action accessibility, User Management action accessibility.
   *(MEDIUM for most gaps found this way; treat a fully keyboard-
   unreachable critical action as HIGH.)*

### Flow 20 — Session / Refresh
1. Refresh while authenticated; logout/login; direct route navigation to
   a deep link; expired/invalid session behavior where practical; the
   change-password guard; inactive-user behavior. Confirm persisted
   server state reconstructs correctly in every case.
   *(HIGH if refresh or direct navigation loses session state
   unexpectedly.)*

## 5. Defects discovered (this Phase 5 pass, via code review — not browser UAT)

Two real defects were found during the Part 4 production-hardening code
review (not via browser UAT, which was not performed):

1. **HIGH — Raw error message leak in artwork upload failure**
   (`src/pages/new-order/sections/ArtworkSection.tsx`). On upload failure,
   the raw caught error's `.message` was shown directly in a staff-facing
   toast, instead of going through `staffErrorMessage()` like every other
   catch block in the app (an established Phase 3 pattern specifically
   meant to prevent raw Postgres/Storage error text — which can expose
   internal details — from reaching staff). **Fixed**: now routes through
   `staffErrorMessage(err, ...)`.
2. **HIGH — Raw error message leak in Add Customer dialog**
   (`src/components/domain/AddCustomerDialog.tsx`). The TanStack Query
   mutation's raw `error.message` was rendered directly in the dialog,
   unconditionally, for any customer-creation failure. **Fixed**: now
   routes through `staffErrorMessage()`.

Both are classified HIGH rather than BLOCKER: they don't corrupt data or
block a workflow, but they could leak internal schema/constraint/storage
details to a staff user on failure — a real information-disclosure risk
worth fixing before launch, which is exactly what Part 4's hardening pass
is for.

One additional gap was found and closed (not a "defect" in the strict
sense, since nothing was broken, but a genuine production-hardening
improvement):

3. **No app-root error boundary** — an uncaught render error anywhere in
   the tree would previously unmount the entire app to a blank white
   screen with no recovery path. `src/App.tsx` now wraps the whole route
   tree in the existing `ErrorBoundary` component with a friendly
   "Something went wrong" fallback (Try Again / Reload Page). The
   Mockup Studio's existing Fabric-specific boundary is untouched and
   remains the only other one — deliberately not wrapping every
   individual route, per the instruction not to over-apply boundaries.

## 6. Defects fixed

All three items in §5 above. No BLOCKER-severity defects were found by any
technically-available verification method in this phase.

## 7. Remaining defects

None known from technical verification. **The 20 UAT flows in §4 have not
been executed** — it is possible a real click-through would surface a
BLOCKER or HIGH issue that static review, unit tests, and live API/SQL
testing cannot catch (visual/interaction bugs specifically, since those
by definition require rendering the actual UI). This is the honest
residual risk carried into launch if UAT is skipped.

## 8–17. Final architecture summary

Unchanged from `docs/PHASE_4_HANDOVER.md` §1 (Milestones 1–6) with the two
Phase 5 additions noted above (app-root error boundary, lazy-loaded
Settings Users route). See that document, `docs/PHASE_4_BRIEF.md`, and
`docs/PHASE_4_PLAN.md` for the full milestone-by-milestone architecture
record (Auth/User Management, Staff Assignment, Order workflow, Mockup
Studio, Production Board, Smart Queue, Operational Attention, Reorder,
Customer History, Dashboard Reporting) — none of that architecture changed
in Phase 5; this phase was verification and hardening, not redesign, per
its explicit scope.

## 18. Responsive result

**Structural code review only — no browser tool available, same
limitation as Phase 4.** Reviewed for fixed-pixel-width anti-patterns,
missing `overflow-x-auto` on tables, and non-wrapping control clusters
across every Phase 4/5 surface named in the UAT flows above; none found
beyond what Phase 4's equivalent pass already covered. **This is not a
substitute for Flow 17/18 (Mobile/Tablet UAT) above.**

## 19. Accessibility result

Focused review (not a WCAG audit). One real gap found and fixed in Phase
4 (missing `aria-label`/Escape-close on the Add/Edit User dialog); no new
gaps found in this phase's review. **Flow 19 (browser-based accessibility
walkthrough) has not been executed.**

## 20. Performance result

Main bundle: `821.70 kB` / gzip `228.52 kB` (down from `829.87 kB` /
`230.22 kB` at baseline — Settings Users is now a separate `9.40 kB` /
gzip `3.27 kB` chunk, lazy-loaded, per the Part 4 instruction's own
named example). Fabric chunk unchanged: `289.01 kB` / gzip `87.88 kB`.
`MockupCanvas` chunk unchanged: `4.48 kB`. No broader refactor was
attempted — per explicit instruction not to chase the 500kB advisory
threshold at the cost of unrelated risk.

## 21. Final bundle sizes

| Chunk | Size | Gzip |
|---|---|---|
| Main (`index-*.js`) | 821.70 kB | 228.52 kB |
| Fabric (`index.min-*.js`) | 289.01 kB | 87.88 kB |
| `SettingsUsers-*.js` (new, lazy) | 9.40 kB | 3.27 kB |
| `MockupCanvas-*.js` | 4.48 kB | 1.63 kB |
| `mockupPreviewSync-*.js` | 1.68 kB | 0.88 kB |
| `mockupPreviewRenderer-*.js` | 0.89 kB | 0.54 kB |
| CSS | 36.82 kB | 7.65 kB |

## 22. Security result

Re-ran the full critical security matrix live against the real Supabase
project using disposable test accounts (created, exercised, and fully
cleaned up within this session):

| Check | Result |
|---|---|
| Staff JWT: own `role` write | REJECTED (403, `42501`) |
| Staff JWT: own `is_active` write | REJECTED (403, `42501`) |
| Staff JWT: own `must_change_password` write | REJECTED (403, `42501`) |
| Staff JWT: own `email` write | REJECTED (403, `42501`) |
| Staff JWT: own `full_name` write | ALLOWED (200) |
| Staff JWT: other profile's row write | REJECTED (0 rows affected — RLS row filter; confirmed via direct SQL that the target row was unchanged) |
| Staff JWT: `admin-users` `create`/`setRole`/`setActive`/`resetPassword` | REJECTED (403) on all four |
| Admin JWT: `create` | ALLOWED (200) |
| Admin JWT: `resetPassword` | ALLOWED (200) |
| Admin JWT: `setActive` (deactivate/reactivate) | ALLOWED (200) on both |
| Assignment: to an inactive staff member | REJECTED (400, trigger fired: `Cannot assign this order to an inactive or unknown staff member`) |
| Assignment: to an unknown id | REJECTED (400, same trigger) |
| Assignment: unassignment (`null`) | ALLOWED (204) |

All disposable accounts and the one test order created for this pass were
deleted afterward; confirmed 0 rows remaining matching the test email
pattern, and confirmed the real production admin account (id
`781898b7-eba9-4377-8b2d-ca855b23a1e0`) was untouched throughout (same
role, same active state, before and after).

## 23. Storage result

Both buckets (`artwork-originals`, `mockup-previews`) confirmed `public =
false` via direct query. Anon (unauthenticated) list requests to both
rejected live (`400`). Authenticated staff access behaves per RLS
policies (unchanged since Phase 4, not modified this phase).

## 24. Preview integrity result

Bidirectional check run live against production data:
- **DB → Storage** (every `print_specs.preview_storage_path` has a
  matching Storage object): **0 missing** objects.
- **Storage → DB** (every Storage object in `mockup-previews` is
  referenced by a current PrintSpec): **1 orphan** found —
  `orders/cfdc2100-47ce-44e4-a99e-d152a46c6ae0/print-specs/052b92e1-45fe-43c8-8b2e-f36fd62571ae/preview.png`,
  belonging to order `SP-1036` ("Tabitha"), an Active order with a
  real-looking customer email. **Not deleted** — this order is not
  clearly disposable test data, per the explicit instruction not to
  delete ambiguous or possibly-real data. Left as a documented item for
  manual confirmation; harmless as-is (an unreferenced file, no broken
  reference).

## 25. Artwork integrity result

Every `artwork.storage_path` was confirmed to resolve to an existing
Storage object in `artwork-originals` — **0 missing** objects.

## 26. Database integrity result

Nine integrity checks run live, all clean (0 issues each): orders with an
invalid assignee reference, orders assigned to a currently-inactive
profile, duplicate order numbers, PrintSpecs referencing a nonexistent
artwork row, orphaned artwork rows (no parent order), orphaned
`order_garments` rows, `order_activity` rows referencing a nonexistent
profile, `admin_activity` rows referencing a nonexistent profile, and
`auth.users` rows with no matching `profiles` row.

## 27. Advisor result

**Security** (4 findings, unchanged from Phase 4 baseline):
| Finding | Classification |
|---|---|
| `clear_must_change_password` SECURITY DEFINER + RPC-exposed | PRE-EXISTING ACCEPTED — narrow, self-only, cannot set the flag true (see runbook §3) |
| `is_admin_or_owner` SECURITY DEFINER + RPC-exposed | PRE-EXISTING ACCEPTED — required to avoid RLS recursion (see runbook §3) |
| `upsert_order` SECURITY DEFINER + RPC-exposed | PRE-EXISTING ACCEPTED — the intended one write path, re-validates everything itself |
| `auth_leaked_password_protection` disabled | PRE-EXISTING ACCEPTED — a Supabase Auth project setting unrelated to app code; recommend enabling in the Dashboard when convenient, out of scope for this codebase |

**Performance** (19 findings, all INFO, unchanged from Phase 4 baseline):
2 unindexed FKs on `admin_activity` (low-traffic audit table, low
priority) + 17 unused indexes (expected on this small development/
pre-launch dataset — not evidence they're unnecessary). No NEW ACTIONABLE
findings from Phase 5 changes.

## 28. Deployment configuration

Host: **Netlify**, already linked (`.netlify/netlify.toml` reflects the
live site's UI-managed build settings). Build command: `npm run build`.
Publish directory: `dist`. SPA redirect (`/* -> /index.html 200`)
confirmed present in both `public/_redirects` (ships with every build)
and the linked Netlify site config — direct navigation to any client
route will resolve correctly. No Node version is currently pinned (no
`.nvmrc`/`.node-version`/`engines` field) — a minor gap, flagged as a
launch recommendation (§35).

## 29. Edge Functions

`admin-users` — status `ACTIVE`, version 1, `verify_jwt: true`. Deployed
source compared line-by-line against `supabase/functions/admin-users/index.ts`
in the repo: **byte-for-byte identical**. No redeploy was necessary.

## 30. Migrations

18 migrations recorded live, 18 files present in `supabase/migrations/`,
same names in the same order. **One discrepancy documented, not silently
ignored**: the six Phase 4 migrations were applied via the Supabase MCP
tool, which assigned its own version timestamps at apply time — the local
filenames for that batch were written afterward with different (but
correctly ordered) timestamps for readability. Content and sequence match
exactly; only the raw timestamp digits differ for that batch. Documented
in full in `docs/PRODUCTION_RUNBOOK.md` §3 so a future `supabase db pull`/
`migration repair` isn't run blind.

## 31. Environment variables

Confirmed by reading `src/lib/supabase.ts` directly (not assumed): exactly
two client variables, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
No other `VITE_*` variable exists anywhere in the codebase. Server-side
Edge Function secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are
provisioned automatically by Supabase for every Edge Function and were
never placed in any client-reachable configuration — reconfirmed via the
final client bundle secret scan (§34).

## 32. Production configuration

Business settings (`business_settings` table): fully populated with real
SALT PRINTS details — business name "SALT PRINTS", a real contact email
and phone, order number prefix "SP", standard turnaround 7–10 days.
Catalogs: 12 garment types, 6 garment brands, 8 services, 22 mockup
templates (all active). **No missing production configuration found** —
this system is populated for real use, not left on placeholder data.

## 33. Test-data cleanup

All disposable accounts and test orders created during this Phase 5
session (three `phase5-test-*` accounts, one `phase5-test-created@...`
account created via the admin flow, one test order "Phase5 Assignment
Test") were deleted after use; confirmed 0 rows remain matching that
pattern. The live dataset audited beforehand showed only one pre-existing
test-labeled order (from the Phase 4 session, already cleaned up in that
session) and no ambiguous test customers. Current live data: 6 orders, 2
customers — a small, real, pre-launch dataset, not synthetic bulk test
data.

## 34. Automated tests

`npm run build` — pass (no type errors). `npm run lint` — pass (oxlint
clean). `npm run test` — pass, **182 tests**, 16 files. Final client
bundle secret scan (`grep -ri "saltprints\|SUPABASE_SERVICE_ROLE\|service_role" dist/assets/*.js`)
— clean, no matches.

## 35. Browser UAT mapping

| UAT Flow | Status |
|---|---|
| 1–20 (all flows in §4) | NOT PERFORMED — no browser tool available |

Every acceptance criterion described in §4 remains an open manual action.
No flow has been marked passed based on unit tests, SQL tests, HTTP tests,
or bundle inspection — per explicit instruction, none of those count as
browser UAT.

## 36. Known limitations

- No browser UAT has ever been performed on this application, across
  Phase 3, Phase 4, or Phase 5.
- One orphaned preview Storage object exists (§24), left in place pending
  manual confirmation it's safe to delete.
- No Node version is pinned for the Netlify build.
- No automated Storage backup exists beyond Supabase's own platform
  durability (no independent export/backup job is configured).
- The true "zero active admins" rejection path cannot be exercised
  end-to-end via a live API call without deactivating the real production
  admin account, which was correctly never attempted — the positive path
  (an admin deactivation succeeding while others remain active) was
  verified live, and the rejection branch's query logic was verified via
  a direct, read-only SQL simulation. This is a structural limitation of
  testing safely against a live single-admin production system, not a
  gap in the underlying protection itself.
- Only one real Admin account exists in production (see §46).

## 37. Remaining manual actions

1. Execute the 20-flow manual UAT checklist in §4 in a real browser.
2. Decide whether to delete the one orphaned preview object identified in
   §24 (safe to delete, but left for a human decision since the parent
   order is not obviously test data).
3. Create a second real Admin account (see §46).
4. Consider pinning a Node version for the Netlify build (`.nvmrc` or
   Netlify's site-level Node version setting).
5. Consider enabling Supabase Auth's leaked-password-protection setting
   (Dashboard → Auth → Policies) — outside this codebase's scope to
   enable directly.

## 38. Client acceptance requirements

Before SALT PRINTS accepts this system as launch-ready, a staff member (or
the client) should walk through UAT Flows 1, 2, 3, 4, 15, and 16 at
minimum (auth, order creation, artwork, mockups, reorder, dashboard) as
the highest-value subset of the full checklist, using their own real
garment/artwork data rather than synthetic test data, before the first
real customer order is entered.

## 39. Rollback guidance

**Frontend**: Netlify retains prior deploys — republish any earlier deploy
from the Netlify Dashboard's deploy history in seconds. This is the
fastest path to recover from a bad frontend release.
**Database**: no automated rollback tooling exists in this repo; every
migration is forward-only. Reverting a bad migration means writing and
applying a new migration that undoes the specific change — never editing
migration history after the fact.
**Storage**: no independent backup exists beyond Supabase's platform
durability — see §36.

## 40. Launch checklist

- [x] Build passes
- [x] Lint passes
- [x] Automated tests pass (182/182)
- [x] No known BLOCKER defects
- [x] No known HIGH defects (two found and fixed this phase; see §5)
- [x] Critical Auth security passes (live-verified, §22)
- [x] Role escalation blocked (live-verified, §22)
- [x] Inactive users enforced (live-verified, §22)
- [x] Assignment integrity passes (live-verified, §22)
- [x] Storage security passes (live-verified, §23)
- [x] Database integrity passes (live-verified, §26)
- [x] No client secrets exposed (verified, §34)
- [x] Required migrations applied (verified, §30)
- [x] Required Edge Functions deployed (verified, §29)
- [x] Production configuration understood (verified, §32)
- [x] Handover documentation complete (this document + runbook + user
      guide)
- [ ] **Real browser UAT executed** — outstanding, see §4/§35

## Final Readiness Report

1. **Phase 5 commit**: see the commit created immediately after this
   document (final commit of this phase — hash available via `git log`
   after commit).
2. **UAT environment**: this development session, live Supabase project,
   no browser tool.
3. **Browser tooling available**: **NO**.
4. **Browser UAT result**: NOT PERFORMED.
5. **Phase 3 deferred UAT result**: still NOT PERFORMED (never executed
   in any phase to date).
6. **Phase 4 deferred UAT result**: still NOT PERFORMED (same).
7. **Blockers found**: 0.
8. **High issues found**: 2 (raw error message leaks, §5) — both fixed.
9. **Medium issues found**: 0 found via technically-available methods.
10. **Low issues found**: 0 found via technically-available methods.
11. **Issues fixed**: 2 HIGH + 1 hardening improvement (app-root error
    boundary).
12. **Remaining issues**: 0 known; residual risk is unexecuted browser
    UAT (§7).
13. **Auth/User Management result**: PASS (live-verified server-side).
14. **Change Password result**: verified by code/hash inspection only —
    not browser-clicked.
15. **Assignment result**: PASS (live-verified, §22).
16. **Mockup Studio result**: NOT BROWSER-TESTED.
17. **Preview generation result**: DB/Storage integrity PASS (§24); visual
    "clean preview, no chrome" claim NOT BROWSER-TESTED.
18. **Artwork workflow result**: integrity PASS (§25); upload UX NOT
    BROWSER-TESTED.
19. **Production Board result**: NOT BROWSER-TESTED.
20. **Queue result**: unit-test PASS (unchanged since Phase 4, 11 tests);
    NOT BROWSER-TESTED.
21. **Reorder result**: unit-test PASS (unchanged since Phase 4, 33
    tests) + prior live artwork-copy verification (Phase 4 Batch C); NOT
    RE-BROWSER-TESTED this phase (no code changed).
22. **Customer History result**: NOT BROWSER-TESTED.
23. **Dashboard result**: unit-test PASS (13 tests, unchanged); NOT
    BROWSER-TESTED.
24. **Mobile result**: structural code review only (§18); NOT
    BROWSER-TESTED.
25. **Accessibility result**: focused review only (§19); NOT
    BROWSER-TESTED.
26. **Performance result**: main bundle reduced to `821.70 kB` / gzip
    `228.52 kB` (§20/§21).
27. **Main bundle**: `821.70 kB` / gzip `228.52 kB`.
28. **Fabric chunk**: `289.01 kB` / gzip `87.88 kB` (unchanged).
29. **Total automated tests**: 182, all passing.
30. **Build**: PASS.
31. **Lint**: PASS.
32. **Supabase Security Advisor**: 4 findings, all PRE-EXISTING ACCEPTED
    (§27).
33. **Supabase Performance Advisor**: 19 findings, all INFO ONLY (§27).
34. **Profile privilege verification**: PASS, live (§22).
35. **Last-admin verification**: positive path PASS live; true
    zero-admin rejection verified via safe query-logic simulation only
    (§36).
36. **Storage security**: PASS, live (§23).
37. **Preview integrity**: PASS with one documented orphan, not deleted
    (§24).
38. **Artwork integrity**: PASS (§25).
39. **Database integrity**: PASS, 9/9 checks clean (§26).
40. **Client secret scan**: PASS, clean (§34).
41. **Edge Function deployment status**: ACTIVE, byte-for-byte matches
    repo (§29).
42. **Migration status**: all applied; one filename/version-timestamp
    discrepancy documented (§30).
43. **Deployment status**: Netlify linked and configured; SPA redirects
    confirmed present in the repo; rollback capability documented but not
    independently exercised in this session (§28/§39).
44. **Production environment configuration**: understood and documented
    (§28/§31/§32).
45. **Test-data cleanup**: complete, verified 0 residual test rows (§33).
46. **Real Admin account count/recommendation**: **1** real Admin account
    currently exists in production. **Recommend creating a second real
    Admin account before launch** to prevent operational lockout — this
    requires a client/user decision on who that second admin should be
    and is not something this session can act on unilaterally.
47. **`PHASE_5_HANDOVER.md` status**: this document, complete.
48. **`PRODUCTION_RUNBOOK.md` status**: complete
    (`docs/PRODUCTION_RUNBOOK.md`).
49. **`CLIENT_USER_GUIDE.md` status**: complete
    (`docs/CLIENT_USER_GUIDE.md`).
50. **Remaining manual/client actions**: see §37.

---

## Final status

**ENGINEERING STATUS: PRODUCTION READY**

Every item on the Production-Ready checklist in §40 that is technically
verifiable without a browser is satisfied: build/lint/tests pass, no known
Blocker or High defects remain, critical Auth security, role-escalation
prevention, inactive-user enforcement, assignment integrity, Storage
security, and database integrity have all been verified live against the
real Supabase project (not from static review alone), no client secrets
are exposed, required migrations are applied, the required Edge Function
is deployed and matches source, production configuration is understood,
and handover documentation is complete.

**USER ACCEPTANCE STATUS: NOT YET VERIFIED**

No browser tool was available in this session, so real UAT (§4) has not
been executed — this is stated plainly, not glossed over. Unit tests,
database tests, HTTP tests, and bundle inspection do not count as browser
UAT and are not being represented as such.

**DEPLOYMENT STATUS: READY TO DEPLOY**

The Netlify site is already linked and configured with the correct build
command, publish directory, and SPA redirect handling; the Edge Function
is deployed and verified in sync; all required migrations are applied to
the live project. Nothing technical blocks a deployment. This status
reflects deployment *readiness*, not that a new deployment was performed
in this session (none was).

**CLIENT HANDOVER STATUS: READY WITH OUTSTANDING ACTIONS**

The three deliverable documents are complete and the system is otherwise
production-ready, but launch should not proceed until: (1) the manual
browser UAT checklist in §4 has been executed by a human, (2) a second
real Admin account is created, and (3) the orphaned preview object and
Node-version-pinning items in §37 are addressed or consciously accepted.

PHASE 5 COMPLETE.

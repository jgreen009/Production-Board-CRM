# Phase 4 Handover — User Management + Operational Automation

Covers Batches A–D. See `PHASE_4_BRIEF.md` / `PHASE_4_PLAN.md` for the
original architecture reasoning; this document is the closing record of
what was built, what was verified, how, and what remains open.

## 1. Scope delivered

- **Milestone 1 — User Management + Roles**: `profiles` hardening (email,
  is_active, must_change_password columns with column-level GRANT
  protection, not just RLS), `admin-users` Edge Function (create / update /
  setRole / setActive / resetPassword), Settings → User Management UI,
  forced password change flow (`/change-password`), `RequireAuth` gating on
  active status and must-change-password.
- **Milestone 2 — Staff Assignment + Ownership**: `orders.assigned_to`,
  `AssigneeSelector`, assignment surfaces on New/Edit Order, Order Detail
  (Overview + Production tabs), Production Board (table + mobile card),
  server-side inactive-assignment enforcement in both `upsert_order` and a
  `BEFORE UPDATE` trigger (defense-in-depth for direct `.update()` paths).
- **Milestone 3 — Smart Production Queues**: `productionQueue.ts` (pure,
  centralized tier ranking: Overdue > Same Day > Urgent/Due Today > Due
  Tomorrow > Upcoming), a `queue` sort option on the Production Board, new
  derived board views (My Orders, Unassigned, Ready for Production,
  Awaiting Approval).
- **Milestone 4 — Operational Attention**: reused `getAttentionWarnings` as
  the single source of truth for both the Dashboard's attention list and
  the Production Board — no second rule set.
- **Milestone 5 — Reorder + Customer History**: `buildReorderFormValues`
  (pure COPY/RESET/REGENERATE), artwork copy-on-reorder with UUID
  deduplication (`copyReferencedArtworkForReorder`), a single unified
  `performSave` path in `NewOrderForm.tsx` used by every save entry point,
  Reorder entry points on Order Detail and Customer Detail, live-verified
  Storage-copy behavior via `scripts/verify-reorder-artwork-copy.ts`.
- **Milestone 6 — Reporting + Hardening (Batch D, this closing pass)**:
  `completedAt` threaded through the domain model; `overdueOrders`,
  `ordersByProductionStatus`, `averageTurnaroundDays`, `ordersByAssignee`
  selectors + Dashboard UI; responsive/performance/security/assignment/
  queue/reorder re-validation; advisor re-classification; a focused
  accessibility pass; cleanup; final automated test run.

## 2. Part 1 — Reporting (new this batch)

- `Order.completedAt?: string` added, sourced from `orders.completed_at`
  (trigger-maintained: set on transition into `Completed`, cleared on
  transition out — confirmed by reading `set_completed_at()`'s live
  source, not assumed).
- `src/utils/dashboard.ts`:
  - `overdueOrders` — active (non-Completed) orders past their due date.
    Same "finished work is never urgent" exclusion as
    `getProductionQueueRank`/`getAttentionWarnings`.
  - `ordersByProductionStatus` — counts grouped by status, sorted
    descending by count; only statuses actually present are returned.
  - `averageTurnaroundDays` — `(completedAt - createdAt)` in fractional
    days, averaged across orders that have a `completedAt`, rounded to 1
    decimal place. Returns `null` (not `0`) when there are no completed
    orders, so the UI can distinguish "no data" from "same-day average."
    Incomplete orders are never included in the average.
  - `ordersByAssignee` — active-order counts grouped by assignee, with a
    single `Unassigned` bucket for orders with no `assignedTo`. Completed
    orders are excluded (workload = current work, not history).
- Dashboard UI: new "Overdue" stat card, and a three-card Reporting row
  (Production Status Breakdown, Average Turnaround, Staff Workload).
- Tests: `src/utils/dashboard.test.ts` (13 new tests) — overdue
  active/completed/future-due cases, status grouping incl. empty input,
  turnaround for one order / multiple orders / fractional rounding /
  mixed complete+incomplete / zero-completed-orders, workload grouping /
  unassigned bucket / completed-exclusion.

## 3. Part 2 — Responsive hardening

**No browser tool was available at any point in this session or any prior
Phase 4 batch.** This pass is a structural code review, not a
breakpoint-by-breakpoint visual/click test at 1440/1280/1024/768/390px —
stated explicitly per the instruction not to claim UI acceptance from
static review alone.

What was checked and found already sound, using only patterns already
established (and presumably visually verified) elsewhere in the app:
- Every new/changed table (`SettingsUsers`, `CustomerDetail`,
  `Dashboard`) is wrapped in `overflow-x-auto`, matching the pre-existing
  pattern.
- `Tabs` (used for the new board views) already scrolls horizontally
  (`overflow-x-auto` + `whitespace-nowrap`) rather than wrapping or
  overflowing the viewport.
- Dialogs (`UserFormDialog`, `ConfirmDialog`) use `w-full max-w-sm` with
  `p-4` outer padding — safe down to narrow phone widths.
- No new fixed pixel widths were introduced by Phase 4 work (grepped for
  `w-[<number>` / `min-w-[<number>` across the codebase; the few existing
  hits are pre-existing and in code not touched this phase).
- `AssigneeSelector` is a plain native `<select>` via the shared `Select`
  primitive — full width by default, no custom sizing.

**Residual gap**: none of this was verified by actually rendering the app
in a browser at the specified breakpoints. If a genuine layout regression
exists, it wasn't caught by this pass.

## 4. Part 3 — Performance

- `npm run build` output (final, this batch): main chunk `829.87 kB` /
  gzip `230.22 kB` (baseline before Batch D reporting UI: `826.75 kB` /
  `229.50 kB` — the ~3 kB increase is the new Dashboard selectors/UI and
  two new lucide icons, not a regression).
- Fabric.js chunk (`index.min-*.js`) unchanged at `289.01 kB` / gzip
  `87.88 kB` — confirms Fabric isolation was not disturbed.
- `MockupCanvas-*.js` (4.48 kB) and `mockupPreviewRenderer-*.js` /
  `mockupPreviewSync-*.js` remain separate lazy chunks.
- Grepped the whole `src/` tree for `from 'fabric'` — only
  `MockupCanvas.tsx` and `mockupPreviewRenderer.ts` import it, both
  already lazy-loaded and untouched by any Phase 4 surface (Dashboard,
  Settings Users, Production Board, Customer Detail, Order Detail
  Overview/Production tabs never import either file).
- No admin-only heavy dependency exists in this codebase to begin with
  (the `admin-users` Edge Function runs server-side, not bundled; the
  client-side admin UI is plain React + existing primitives) — nothing to
  isolate further.

## 5. Part 4 — Security re-validation (live-tested)

Re-ran the Batch A security matrix live against the real Supabase project
using three disposable, fully cleaned-up test accounts (two `admin`-role,
one `staff`-role — created via direct SQL with `pgcrypto` password hashing
and matching `auth.identities` rows, signed in via the real Auth REST API
to obtain real JWTs, exercised via `curl` against PostgREST/Edge
Function/RPC endpoints, then deleted). **Do not confuse this with static
review** — every result below is an actual HTTP response from the live
project.

| # | Check | Result |
|---|-------|--------|
| 1 | Staff cannot set own `role` via direct PATCH `profiles` | **PASS** — `403`, Postgres `42501 permission denied for table profiles` (column GRANT, not just RLS) |
| 2 | Staff cannot set own `is_active` | **PASS** — same `403`/`42501` |
| 3 | Staff cannot set own `must_change_password` | **PASS** — same `403`/`42501` |
| 4 | Staff cannot call `admin-users` `create` | **PASS** — `403` |
| 5 | Staff cannot call `admin-users` `setRole` | **PASS** — `403` |
| 6 | Staff cannot call `admin-users` `setActive` | **PASS** — `403` |
| 7 | Staff cannot call `admin-users` `resetPassword` | **PASS** — `403` |
| 8 | `validate_order_assignment` RPC not directly callable by any authenticated caller | **PASS** — `404` (EXECUTE revoked) |
| 9 | Staff CAN read `profiles` (broadened SELECT, by design) | **PASS** — `200` |
| 10 | `clear_must_change_password` has no id-style parameter (self-only by construction) | **PASS** — `404` when called with an unexpected param, confirming no such parameter exists |
| 11 | Admin CAN call `admin-users` `create` | **PASS** — `200`, user created with `must_change_password` semantics intact |
| 12 | Admin CAN call `admin-users` `setRole` | **PASS** — `200` |
| 13 | Admin CAN deactivate another admin when other active admins remain | **PASS** — `200` |
| 14 | Deactivation bans the real Auth account, not just a UI flag | **PASS** — profile `is_active=false` + `updateUserById({ban_duration})` both applied (existing already-issued JWTs remain valid until natural expiry, as expected for any bearer-token system; new sign-ins would be blocked) |
| 15 | Admin CAN reset another user's password | **PASS** — `200` |
| 16 | Assignment: direct `.update()` of `orders.assigned_to` to an **inactive** staff member is rejected | **PASS** — `400`, Postgres `P0001 Cannot assign this order to an inactive or unknown staff member` (trigger fired on a direct-update path, not just inside `upsert_order`) |
| 17 | Assignment: direct `.update()` of `orders.assigned_to` to an **active** staff member succeeds | **PASS** — `200` |
| 18 | Client bundle contains no plaintext onboarding password | **PASS** — `grep -ri saltprints dist/assets/*.js` clean on the freshly rebuilt bundle |
| 19 | Client bundle contains no service-role key/reference | **PASS** — `grep -ri SUPABASE_SERVICE_ROLE dist/assets/*.js` clean |
| 20 | Real production admin account untouched by any of the above | **PASS** — confirmed via SQL before/after: same id, `role=admin`, `is_active=true` throughout |

**Last-admin (zero-admin) rejection — residual gap, same as Batch A**:
`countOtherActiveAdmins()` counts *all* active admins/owners globally, not
scoped to test data — so as long as the real production admin exists and
is active, no test-account manipulation can ever organically drive the
count to zero (which is itself a reassuring property: test activity can
never accidentally lock out the real admin). Exercising the true rejection
branch end-to-end would require deactivating the real admin, which was
explicitly forbidden. Positive path (an admin deactivation succeeding
while other admins remain, item 13) was verified live. The rejection
branch's query logic was additionally verified by directly running the
same `SELECT count(*) ... WHERE role IN ('admin','owner') AND is_active
... AND id != excludeId` query the Edge Function uses, confirming it
correctly returns 0 in a simulated single-admin scenario. **This remains a
documented residual verification gap, not a fabricated pass.**

All disposable test accounts, their profiles, and one disposable test
order were deleted after testing; verified 0 rows remaining matching the
test email pattern.

## 6. Part 5 — Assignment re-validation

Covered live above (items 16–17). Additionally confirmed by code
inspection (unchanged since Batch B, no regressions from Batch D work):
`AssigneeSelector` never offers a deactivated current assignee as a
reselectable option, only displays them disabled with an "Inactive"
suffix; unassignment (`assigned_to: null`) has no active/inactive
constraint to violate; "My Orders" and "Unassigned" board views filter on
`assignedTo === currentUserId` / `!assignedTo` respectively; assignment
changes append an `'assignment'`-typed `order_activity` row via
`diffOrderForActivity`.

## 7. Part 6 — Smart queue re-validation

`getProductionQueueRank` or­dering re-confirmed by the existing 11-test
suite (`productionQueue.test.ts`, unchanged, still passing). Documented
behaviors:
- **Completed** orders always rank `upcoming` (lowest priority) regardless
  of how overdue their due date technically is — deliberate, matches
  `getAttentionWarnings`'s same short-circuit.
- **On Hold** has no special-cased rank; it falls through to the same
  due-date-driven tiering as any other non-Completed status. This was a
  deliberate simplicity choice in the Batch B plan (no separate "paused"
  tier) — not an oversight.
- **No/blank due date**: `daysUntil('')` parses to `NaN` via
  `parseLocalDate` on an empty string, so `diff < 0` /
  `diff === 0` / `diff === 1` all evaluate `false` and the order falls
  through to `upcoming`. Not a crash, but also not a deliberately designed
  case — there is currently no order-creation path that leaves `dueDate`
  blank for a finalized order, so this is a theoretical edge rather than
  an observed one.
- "Garments Needed" / "Due Soon" from the original brief map to existing
  Dashboard helpers (`awaitingArtworkOrders`-equivalent logic doesn't
  cover garments specifically; `isDueSoon` exists in `date.ts` but has no
  dedicated board view) — intentionally not built as new board presets in
  Batch B per that batch's "prefer derived filter presets over persisted
  saved views, don't add scope beyond the plan" instruction. This is
  unchanged in Batch D.

## 8. Part 7 — Reorder re-validation

No Reorder code was touched in Batch D. Re-confirmed by inspection rather
than re-running the live script (no functional change to re-verify):
`reorder.ts`, `copyReferencedArtworkForReorder`, and the unified
`performSave` path in `NewOrderForm.tsx` are unmodified since Batch C.
The 33 pure unit tests (`reorder.test.ts`) and the live artwork-copy
verification script (`scripts/verify-reorder-artwork-copy.ts`, 10/10
assertions passing per Batch C's run) remain the verification record for
this milestone. Source-order immutability is structurally guaranteed by
`performSave` only ever creating a new shell order and copying into it —
nothing in the reorder path issues an `.update()` against the source
order's id.

## 9. Part 8 — Storage/RLS/Advisor classification

Re-ran both advisors this batch (`2026-09-10`); output is byte-for-byte
consistent with the pre-Batch-D baseline, as expected since Batch D
applied no migrations.

**Security (4 findings):**
| Finding | Classification | Reasoning |
|---|---|---|
| `clear_must_change_password` is `SECURITY DEFINER` and RPC-exposed | **PRE-EXISTING ACCEPTED** | Intentional by design (Batch A amendment #2) — narrow, self-only (`auth.uid()`), no id parameter, cannot set the flag to `true`. |
| `is_admin_or_owner` is `SECURITY DEFINER` and RPC-exposed | **PRE-EXISTING ACCEPTED** | Required to avoid the RLS-recursion bug fixed in Batch A; it only returns a boolean derived from the caller's own row, nothing sensitive to leak via direct RPC call. |
| `upsert_order` is `SECURITY DEFINER` and RPC-exposed | **PRE-EXISTING ACCEPTED** | By design since Phase 2 — the whole point of the RPC is to be the client's one write path; it re-validates everything server-side (including the Batch A/B assignment rule). |
| `auth_leaked_password_protection` disabled | **PRE-EXISTING ACCEPTED** | A Supabase Auth project setting, unrelated to any Phase 4 code; flagged in every prior batch's baseline. Recommend enabling in Supabase Dashboard → Auth → Policies when convenient; out of scope for this codebase-side handover. |

No NEW ACTIONABLE security findings from Phase 4.

**Performance (19 findings, all INFO):**
| Finding | Classification | Reasoning |
|---|---|---|
| `admin_activity_actor_id_fkey` / `admin_activity_target_id_fkey` unindexed | **NEW, LOW PRIORITY, ACCEPTED FOR NOW** | Introduced in Batch A. `admin_activity` is a low-volume audit log; not queried by any list/filter UI yet. Worth an index if the table grows large or a "recent admin activity" view is added later. |
| 17× `unused_index` (incl. new `orders_assigned_to_idx`) | **PRE-EXISTING/EXPECTED PATTERN** | Consistent with every prior batch's baseline — this is a low-traffic development dataset; Postgres hasn't had query volume to exercise these indexes yet. Not evidence they're unnecessary; expected on this dataset size. |

No NEW ACTIONABLE performance findings requiring action before Phase 5.

## 10. Part 9 — Combined Browser UAT

**BROWSER UAT NOT PERFORMED.** No browser automation tool was available
in this session, or in any prior Phase 4 batch. No UI acceptance
criterion below has been click-tested — all engineering verification was
either (a) live API/SQL testing against the real Supabase project (Parts
4–7 above), or (b) automated unit tests, or (c) static code review.

The four flows that would need to be walked through manually before
calling Phase 4 user-acceptance-verified:
1. **User Management** — sign in as a fresh user with the temp password,
   confirm forced redirect to Change Password, confirm the temp password
   itself is rejected as a new password, confirm normal use afterward;
   as an admin, create/edit/deactivate/reactivate/reset-password a user
   through the Settings UI.
2. **Assignment + Queues** — assign/reassign/unassign an order from New
   Order, Order Detail, and the Production Board; confirm inactive staff
   never appear as a selectable option but a historical inactive assignee
   still displays; switch through the new board views and the Queue
   Priority sort.
3. **Reorder** — reorder from both Order Detail and Customer Detail,
   confirm the COPY/RESET/REGENERATE field behavior visually, confirm
   artwork thumbnails appear on the new order and the original order's
   artwork/mockup is untouched.
4. **Phase 3 Mockup Backlog** — confirm the artwork dropdown selector,
   auto-fill-to-print-zone sizing, drag-only repositioning (no
   resize/rotate handles), and that artwork upload still works end-to-end
   in a real browser.

## 11. Part 10 — Accessibility (focused pass)

- `UserFormDialog` (`SettingsUsers.tsx`) was missing an `aria-label` and
  Escape-to-close handling that `ConfirmDialog` already had — fixed this
  batch (now `aria-label={isEdit ? 'Edit User' : 'Add User'}` +
  `keydown` listener for `Escape`, mirroring `ConfirmDialog`'s pattern
  exactly).
- `ConfirmDialog` (used for Deactivate/Reset Password confirmations) was
  already correct: `role="dialog"`, `aria-modal="true"`, `aria-label`,
  Escape-to-close.
- All new form fields (`SettingsUsers`, `ChangePassword`) use the existing
  `FormField`/`htmlFor`/`id` pairing convention — labels are properly
  associated with their inputs.
- `AssigneeSelector` is a native `<select>`, inheriting standard
  keyboard/screen-reader behavior for free; the disabled "Inactive"
  option is marked `disabled` (not just styled), so assistive tech
  correctly announces it as unselectable.
- Not exhaustively audited (no automated accessibility scanner or screen
  reader was run) — this is a targeted review of the new Phase 4 surfaces
  only, not a full WCAG pass.

## 12. Part 11 — Cleanup

- Grepped `src/` for `saltprints`, `service_role`, `console.log`, `TODO`,
  `FIXME` — no real matches (the handful of substring hits were false
  positives from function names like `mapDatabaseOrderToDomain`
  containing "ToDo").
- Grepped `supabase/functions/` for the same — the only hits are the
  Edge Function's own server-side `TEMPORARY_PASSWORD` constant and its
  `SUPABASE_SERVICE_ROLE_KEY` env-var read, both correct and intentional
  (never present in the client bundle, re-verified this batch).
- No duplicate queue/attention logic found — `productionQueue.ts` and
  `productionReadiness.ts` remain the single source of truth each, with
  no parallel reimplementation anywhere.
- No dead prototype files or orphaned components found from earlier
  Phase 4 batches.
- All disposable test data (accounts, profiles, one test order) created
  for this batch's live security re-validation was deleted; confirmed via
  SQL that 0 rows remain.

## 13. Part 12 — Final automated tests

```
npm run build   → tsc -b && vite build — PASS (no type errors)
npm run lint    → oxlint — PASS (clean)
npm run test    → vitest run — PASS (16 files, 182 tests)
```

Bundle sizes (final): main `829.87 kB` / gzip `230.22 kB`; Fabric chunk
unchanged `289.01 kB` / gzip `87.88 kB`; `MockupCanvas` chunk `4.48 kB`.

## 14. Exit criteria checklist

**Reporting**
- [x] `completedAt` threaded through domain model + mapper
- [x] Overdue, Production Status Breakdown, Average Turnaround, Staff
      Workload implemented and unit-tested
- [x] Turnaround never fabricated for incomplete orders (returns `null`
      with zero completed orders; excludes incomplete orders from any
      non-empty average)

**Security**
- [x] Batch A matrix re-run live, all 20 items passing or explicitly
      documented as a residual gap (last-admin true-zero case)
- [x] No new plaintext secrets in the client bundle
- [x] Advisors re-run and classified (0 NEW ACTIONABLE)

**Assignment / Queue**
- [x] Inactive-assignment enforcement re-confirmed live on the
      direct-update path (not just `upsert_order`)
- [x] Queue tier ordering re-confirmed (existing test suite, unchanged)
- [x] On Hold / no-due-date / Completed queue behavior documented

**Reorder**
- [x] Source-order immutability structurally reconfirmed (no code
      changed since Batch C's live-verified artwork-copy path)

**Quality**
- [x] Build, lint, test all passing
- [x] Cleanup pass complete, no stray secrets/logs/TODOs
- [x] Focused accessibility pass complete (one real gap found and fixed)

**UAT**
- [ ] Combined Browser UAT — **NOT PERFORMED** (no browser tool
      available); see Part 9 for the four flows still needing a manual
      walkthrough before this box can be checked.

---

## Final conclusion

**ENGINEERING STATUS: READY FOR PHASE 5**

All server-side security boundaries (column GRANTs, RLS, trigger-based
defense-in-depth, Edge Function re-verification of caller identity) have
been live-tested against the real project this batch, not assumed from
static review. All automated tests pass. No new schema drift, no new
actionable advisor findings, no secrets in the client bundle. The one
residual gap (true zero-admin rejection path) is the same
structurally-unavoidable gap documented since Batch A, safely
substituted with a live positive-path test plus a verified query-logic
simulation — not a fabricated pass.

**USER ACCEPTANCE STATUS: NOT YET VERIFIED**

No browser tool was available in this or any prior Phase 4 session, so no
UI has been click-tested. The four Combined UAT flows in Part 9 need a
manual walkthrough by a human (or a future session with browser tooling)
before Phase 4 can be called user-accepted. This status is deliberately
reported separately from ENGINEERING STATUS and must not be read as
"Phase 4 is fully done" — the server-side work is solid and verified; the
UI experience built on top of it has not been visually confirmed.

**Then STOP. Phase 5 has not been started.**

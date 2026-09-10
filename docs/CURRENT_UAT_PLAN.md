# Current UAT Plan — Brand Fanatix Production CRM

**This document is the authoritative manual browser-UAT checklist for the
current build.** It supersedes every scattered UAT backlog from Phase 3,
Phase 4, and Phase 5 for final acceptance purposes — see §0 below. It
reflects the actual product as it exists today, including the two
corrections made in this pass (the admin-users Edge Function CORS fix,
and the mockup placement model change). It has not itself been executed —
see the Final Report accompanying this document.

## 0. Supersession notice

`docs/PHASE_3_HANDOVER.md`, `docs/PHASE_4_HANDOVER.md`,
`docs/PHASE_5_HANDOVER.md` §4, and `docs/FINAL_UI_UX_HANDOVER.md` §27–28
each contain their own browser-UAT flow lists, written against the
product as it existed at that point in time. Several of those items no
longer apply — most importantly, every reference to dragging artwork
around the garment, and to Center Horizontal/Vertical/Reset
Position/Rotation/Size controls, describes a placement model this build
no longer has (see §5 below). **Those historical checklists are
SUPERSEDED FOR FINAL ACCEPTANCE BY this document.** They remain in place
as a historical record of what was tested/expected at each phase and are
not deleted.

## 1. Scope and format

**~10 primary end-to-end flows**, each combining multiple related
acceptance criteria rather than testing them as dozens of disconnected
cases. Functional, security, responsive, and persistence concerns are
called out within each flow where relevant, with a dedicated security
section (§13) for checks that are properly script/HTTP/database-level
verification, not manual UI clicking.

For every flow, record: **PASS / FAIL / PARTIAL / NOT APPLICABLE**. For
every FAIL or PARTIAL, capture: page, action, expected result, actual
result, severity (**BLOCKER / HIGH / MEDIUM / LOW**), and a screenshot or
reference if available. **Release requires 0 BLOCKER and 0 HIGH** —
Medium/Low may remain as a documented polish backlog if they don't
interfere with normal operation.

Mobile-first: test at **390px first**, then 430px, 768px, 1024px, 1440px.

---

## Flow 1 — Login + Session

1. Sign in with a valid admin account — confirm redirect to Dashboard,
   Brand Fanatix branding visible (logo mark, wordmark, page title,
   favicon).
2. Sign in with an invalid password — confirm a safe, generic error (not
   a raw Supabase message) and no blank screen.
3. Refresh the page while authenticated — confirm the session persists
   and the app reconstructs the current route correctly.
4. Log out — confirm redirect to `/login` and that protected routes
   (e.g. typing `/dashboard` directly) redirect back to login rather than
   rendering.
5. Where practical, test an expired/invalid session (e.g. revoke the
   session server-side and retry an action) — confirm a safe re-auth
   prompt, not a raw error or blank page.

*Expected: correct access control, safe errors, no blank screens, Brand
Fanatix branding consistent throughout.*

## Flow 2 — User Management (Edge Function)

This flow directly re-verifies the fix made in this pass — see the Final
Report for the root cause (a missing CORS handler on the `admin-users`
Edge Function, which made every browser-based user-management action fail
with "Failed to send a request to the Edge Function" even though the
same calls succeeded via direct HTTP tooling).

1. Admin: Settings → Users → **Add User** → create a Staff account.
   Confirm: the user appears in the list immediately, no raw/ugly error
   appears, the password is never shown anywhere in the UI.
2. Edit the new user's name. Confirm it updates.
3. Change their role to Admin, then back to Staff (not on your own
   account). Confirm each change reflects immediately.
4. Deactivate the user — confirm a specific, useful message if this is
   ever blocked (e.g. last-admin protection), not a generic failure.
5. Reactivate the user.
6. Reset their password — confirm a clear success message.
7. Log out, log in as the newly created Staff account using the
   temporary password. Confirm forced redirect to **Change Password**,
   that the temporary password itself is rejected as a new password
   choice, and that after setting a real password the full CRM is
   reachable.
8. As that Staff account, confirm Settings → Users is not reachable /
   shows a "not authorized" state, and that no privileged action can be
   triggered from the UI.

*Expected: every admin action succeeds with a clear success/failure
message; Staff is fully blocked from privileged actions; the temporary
password is never exposed in any UI text beyond generic references to
"the onboarding temporary password."*

## Flow 3 — Customer + Order Creation

1. Create a new customer (or select an existing one) from either the
   Customers page or inline from New Order.
2. Create an order: job/contact details, turnaround, delivery method,
   priority, due date, at least one service, at least one garment line
   with quantities, an assignee, payment status, and internal notes.
3. Confirm: filling in one field never blocks interacting with an
   unrelated field; totals (quantity, sub-total) update correctly as
   quantities change; required-field validation only triggers on
   **Create Order**, not while filling in the form.
4. Click **Create Order**. Confirm an `SP-XXXX` order number is assigned,
   the order appears on the Production Board, and the customer's order
   history updates.

## Flow 4 — Draft / Edit / Persistence

1. Start a new order, fill in a few fields, and let it autosave (or click
   **Save Draft** explicitly).
2. Refresh the browser. Resume the draft from the Drafts view. Confirm
   every entered value — including any mockup/print-spec data already
   entered — reconstructs exactly.
3. Finalize the order (**Create Order**).
4. Open the now-active order for editing. Make a change. Confirm the
   active order does not silently autosave a partial/incomplete edit —
   an explicit save action is required, and refreshing before saving
   should not show a half-edited state as if it were persisted.
5. Save the edit, refresh, and confirm it persisted correctly.

## Flow 5 — Artwork + Mockup

**This flow directly verifies the placement-model change made in this
pass.** The product decision as of this build: **the artwork is never
manually draggable.** The selected print position is authoritative —
artwork always renders centered within that position's print zone, sized
automatically to fit it (a "contain" fit), and stays that way regardless
of garment colour or viewport size.

1. Upload a previewable artwork file (PNG/JPG). Confirm a thumbnail
   preview appears and the upload doesn't block other fields.
2. In the Mockup Studio, select a print position (e.g. Left Chest).
   Confirm: the garment renders, the artwork renders automatically
   centered within that position's zone (no manual placement step), and
   there is **no way to drag the artwork elsewhere** — clicking and
   dragging on the artwork does nothing.
3. Switch print position (e.g. to Full Front). Confirm the artwork
   re-centers automatically in the new zone, and the underlying front/back
   garment view switches correctly if the new position is on the other
   side.
4. Change the garment colour. Confirm the artwork's placement is
   unaffected — only the garment colour changes.
5. Resize the browser window. Confirm this never shifts the artwork's
   placement or the print's physical size — it's a viewport change, not
   a data change.
6. If the artwork is large relative to its zone, confirm a visible
   overflow warning appears but saving remains possible — the artwork is
   never force-clipped or silently resized beyond what the automatic fit
   already does.
7. If a PDF/AI file is uploaded, confirm it's stored safely with a
   "preview unavailable" state rather than a broken image or a crash.
8. Save/finalize the order. Confirm a clean preview image (garment +
   artwork only, no zone guides, no editor chrome) appears in Order
   Detail and on the Production Board.

*Expected: artwork placement is 100% determined by the selected print
position; there is no drag gesture, no Center/Reset button, and no manual
resize control anywhere in this flow — their absence is correct, not a
bug.*

## Flow 6 — Multiple Print Locations

1. On one order, add three print positions (e.g. Left Chest, Full Back,
   and one more), each with its own artwork.
2. Switch between them using the position tabs. Confirm each retains its
   own artwork, position, size, and approval note independently —
   switching never leaks one spec's data into another.
3. Remove one print position. Confirm the remaining ones are unaffected.
4. Save, refresh, reopen. Confirm all remaining print specs reconstruct
   exactly (position, artwork, size, approval note).

## Flow 7 — Production Workflow

1. Walk one order through representative states: Artwork Awaiting
   Approval → Approved; Garments Needed → Received; Production New →
   Ready → In Production → Completed.
2. At each step, confirm the Production Board, Quick View drawer, Order
   Detail (Overview tab's readiness banner), and Dashboard all agree with
   each other — no surface shows a contradictory status.
3. Confirm an order with Artwork Approved + Garments Received (or not
   required) + Production not yet Completed shows as **Ready for
   Production**.
4. Set up one Overdue order, one Urgent-priority order, and one due
   today. Confirm each is flagged correctly everywhere it's surfaced.

## Flow 8 — Board Views + Assignment

Verify each of the board's current views actually behaves as named — do
not test any view not in this list, it doesn't exist in this build:

**All Orders, My Orders, Unassigned, Due Today, Upcoming, Urgent, Ready
for Production, Awaiting Approval, Artwork Attention, Garment Follow-Up,
Completed.**

1. Confirm **My Orders** shows only orders assigned to the signed-in
   user, and **Unassigned** shows only orders with no assignee.
2. Assign an order to a staff member, then deactivate that staff member
   (Settings → Users). Confirm the order still shows their name (marked
   inactive) rather than blanking out, and that they no longer appear as
   an option when assigning a *different* order.
3. Sort by **Queue Priority**. Confirm the order is Overdue → Same Day →
   Urgent/Due Today → Due Tomorrow → Upcoming, and that Completed orders
   always sort last regardless of due date. Confirm sorting never
   prevents opening or working any order.

## Flow 9 — Reorder

1. From a completed order's Order Detail or from Customer Detail's order
   history, click **Reorder**.
2. Confirm the new form is pre-filled with the source order's customer,
   garments, quantities, services, and print specs (artwork included).
3. Confirm these are **reset**, not copied: due date, all status fields,
   assignee, notes, production notes, approval notes, and preview images
   (a fresh preview generates on save).
4. Save. Confirm a new `SP-XXXX` number, new artwork rows (verify via
   Order Detail — the artwork should be present and viewable, not
   missing), and new preview images.
5. Open the **original** source order. Confirm every field, its artwork,
   its previews, its status, and its activity history are completely
   unchanged.

## Flow 10 — Dashboard Reporting

Verify only the metrics actually present in this build — do not expect
any metric not listed here:

**Active Orders, Due Today, Overdue, Urgent Orders, Ready for Production,
Completed This Week, Awaiting Artwork**, plus **Production Status
Breakdown**, **Staff Workload**, **Average Turnaround**, **Orders
Requiring Attention**, **Upcoming Deadlines**, and **Recent Activity**.

1. Cross-check each count against a small set of known test orders you
   create specifically for this check (e.g. 2 overdue, 1 urgent, 1
   completed this week).
2. Confirm Average Turnaround shows a dash/empty state (not a fabricated
   number) if there are zero completed orders in the data set you're
   testing against.

## Flow 11 — Mobile-First

Test at **390px first**, then 430/768/1024/1440px, walking through: Login,
User Management, Customers, Customer Detail, New Order, Artwork upload,
Mockup Studio, Production Board, Quick View, Reorder, Dashboard.

Confirm at every breakpoint: no critical horizontal page overflow, no
overlapping fields or controls, every dialog/drawer fits the viewport and
is closeable (tap outside, Escape, or an explicit close button), primary
actions (Create Order, Save Draft, Add User, Reorder) are reachable
without excessive scrolling, and touch targets are comfortably tappable
(not tiny icon-only hit areas).

## Flow 12 — Error / Failure States

Where practical, exercise: an invalid login, creating a user with a
duplicate email, an artwork upload failure (e.g. disconnect network
mid-upload), a missing/broken preview image, and an unauthorized Staff
action attempted directly (not just hidden in the UI).

*Expected in every case: a safe, staff-facing message — never a raw
backend error, stack trace, or Supabase-internal detail — no blank white
page, and no loss of unrelated form state.*

---

## 13. Security verification (not manual UI testing)

The flows above confirm the *user experience* of security boundaries —
they do not replace the technical verification already performed live
against the real Supabase project (see `docs/PHASE_5_HANDOVER.md` §5/§22
and the Final Report accompanying this document for the current-state
re-verification). Keep these as script/HTTP/database-level checks, not
manual clicking:

- Staff cannot modify their own `role`, `email`, `is_active`, or
  `must_change_password` via a direct API call (column-level GRANT,
  independent of the UI hiding the controls).
- Staff cannot successfully invoke any `admin-users` Edge Function action
  (create/setRole/setActive/resetPassword) even when called directly.
- An inactive user cannot authenticate at all (real Auth-level
  enforcement, not just a UI flag).
- An inactive staff member cannot be newly assigned to an order (trigger-
  enforced on every write path, not just the form).
- The service-role secret and the literal onboarding temporary password
  are absent from the built client bundle.

## 14. Release rule

Final acceptance requires **0 BLOCKER and 0 HIGH** findings across every
flow above. MEDIUM/LOW findings may be logged as a polish backlog and
carried past release if they don't interfere with normal operation.

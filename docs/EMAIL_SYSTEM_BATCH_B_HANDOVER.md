# Email System — Batch B Handover (Customer Review & Confirmation)

**Status: deployed (Supabase + Netlify) and live-verified for every backend and data path (37 checks). Email visual QA in a real mail client has NOT been done. See §22.**

## 1. Objective

When staff create an order, the customer receives the order summary with a secure **Review & Confirm Order** link. The customer reviews the details without logging in and confirms. Staff then see **Customer Confirmed** in the CRM. Confirmation is informational: it is not a production blocker.

## 2. Batch A dependency

Batch B builds on Batch A and does not change its guarantees:
- Staff order saves first; the summary email follows; an email failure never affects the order.
- Public-form orders: the order commits first; a receipt follows; a receipt failure never affects the order or the link.
- Delivery history stays in `order_emails`. It is not used for approval state.

## 3. Architecture

```
Staff creates order ─▶ order saved ─▶ send-order-email (staff_order_summary)
                                         │ plan confirmation (read-only)
                                         │ create/rotate PENDING confirmation  (order_confirmations)
                                         │ queue email attempt (order_emails, confirmation_id)
                                         ▼ Resend (email carries the raw token in the link only)

Customer ─▶ /order-confirmation/<token> (public page, no CRM shell)
          ─▶ order-confirmation {action: review}   → customer-safe summary + fresh previews
          ─▶ order-confirmation {action: confirm}  → atomic pending→confirmed + activity entry

Staff edit ─▶ save ─▶ order-confirmation {action: reconcile} (staff JWT)
                      └─ confirmed + customer-visible change → superseded
Order Detail opens ─▶ reconcile (same)
```

Two separate records, deliberately:
- `order_emails` — did an email go out, and when. Unchanged meaning.
- `order_confirmations` — did the customer approve this version. Never written by email code.

## 4. `order_confirmations` schema

Migration `supabase/migrations/20260918000000_order_confirmations.sql`:

| Column | Notes |
|---|---|
| `id` | pk |
| `order_id` | FK, cascade |
| `token_hash` | SHA-256 hex, unique. The raw token is never stored. |
| `customer_email` | recipient at time of send |
| `status` | `pending` / `confirmed` / `superseded` (no rejected or changes-requested) |
| `summary_hash` | SHA-256 of the customer-visible summary (see §6) |
| `created_at`, `sent_at`, `confirmed_at`, `superseded_at`, `updated_at` | timestamps |
| `expires_at` | **null** (see §7) |

Indexes:
- `order_confirmations_one_active_per_order` — unique on `order_id` where status is pending or confirmed. At most one active confirmation per order.

RLS: staff may SELECT. No insert/update/delete policy exists for any client role. Anonymous users have no policy at all.

Additive changes in the same migration:
- `order_emails.confirmation_id` (nullable FK). The live-send guard is now unique on `(order_id, email_type, coalesce(confirmation_id, zero-uuid))`. A reconfirmation email is not blocked by the earlier one. Receipts keep a null confirmation, so their guard is unchanged.
- `order_activity` gains the activity type `customer_confirmation`.

## 5. Token security

- 32 random bytes from `crypto.getRandomValues`, base64url-encoded (43 characters, 256 bits).
- Only `SHA-256(rawToken)` is stored. Lookups hash the incoming token and compare.
- The raw token appears only in the email link. It is not logged, not written to `order_activity`, `order_emails`, or error output, and not sent to any client analytics.
- Malformed or wrong-length tokens are rejected before any database lookup.

**Deviation from the brief, deliberate:** the brief asks that a retry reuse the same pending token. A token cannot be recovered from its hash, and the brief forbids storing it. So each send that needs a link gets a **new token on the same pending confirmation row**. This is only possible because a token that was never delivered replaces nothing. The unique live-send guard stops a retry of a successful send, so a delivered link is never replaced by a retry. The residual risk is a send that timed out but was in fact delivered: its link would then stop working. The customer would get the latest email. See §25.

## 6. Summary hash

`customerFingerprint(summary)` in `_shared/email/confirmation.ts`:
- Input: the `CustomerOrderSummary` the customer sees, with preview URLs removed (they are signed and change on every call).
- Canonical JSON (keys sorted at every depth), then SHA-256 hex.

Covered: order number, names, company, email, phone, job title, required date, delivery method, garments/brand/colour/sizes/quantities, services, print positions/artwork names/widths/colours/garment labels, customer notes.

Not covered (so changing these never supersedes): assigned staff, all statuses, priority, production/approval notes, `staff_completed`, timestamps, internal ids, signed URLs, email statuses.

Tested: the same summary gives the same hash; each customer-facing field changes it; internal-only fields and preview URLs do not.

## 7. Expiry

`expires_at` is **null**: links stay valid until the order is confirmed or superseded. The review path already enforces an expiry if one is ever set, but none is set. Adding expiry later is an explicit policy change and must be documented as such.

## 8. Confirmation creation timing

- **Staff-created orders:** the first `staff_order_summary` send creates the pending confirmation, then sends. Creation happens after the order saves, never before.
- **Failed send:** the pending row remains with `sent_at` null. Retry reuses the pending row and rotates its token (see §5). Only one pending row can exist (partial unique index).
- **Configuration check first:** `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_PUBLIC_URL` are all checked before any token is created. A missing setting records a failure and creates no confirmation.
- **Public-form orders:** nothing is created automatically. Staff may send a confirmation explicitly from Order Detail ("Send Confirmation"), using the same path.

## 9. Staff email CTA

Only `staff_order_summary` gets the CTA. Button text: **Review & Confirm Order**, linking to `{APP_PUBLIC_URL}/order-confirmation/{rawToken}`. Intro wording: "Please review the order details below. If everything looks correct, use the button below to confirm the order." Updated orders: "We've updated the order details below…" with subject "Updated, Please Review". The plain-text version carries the same link.

The copy describes approval only. It does not mention payment or production.

## 10. Public receipt behaviour

`customer_order_receipt` is unchanged in meaning. It has no CTA and no confirmation. It is never linked to a confirmation. Tested that a CTA URL passed by mistake is ignored, and that the receipt says "Thanks for submitting your order request."

## 11. Public confirmation route

- Route: `/order-confirmation/:token`, a top-level sibling of `/order-request/:token`. Outside `RequireAuth` and `AppShell`.
- Page: `src/pages/PublicOrderConfirmation.tsx`. Brand Fanatix header, no CRM navigation, no internal fields.
- States shown: loading; review (pending); already confirmed (read-only summary, with the original date); confirmed (success, with order number and time); invalid; superseded ("no longer current — use the latest confirmation email"); expired (unused today); a generic error; and a "changed" notice that reloads the latest details.
- Confirm uses a dialog ("Confirm this order?"), then the Confirm Order action.

## 12. Customer-safe review data and mockups

`review` returns `CustomerOrderSummary` built by the shared loader, the same allow-list used in Batch A. Shown: order number, name, company, email, phone, job title, required date, delivery, garments (type, colour, brand where meaningful, sizes, quantities), services, print positions, artwork filenames, widths, print colour, garment label, customer notes.

Not returned: assigned staff, statuses, priority, queue rank, internal/production/approval notes, activity, readiness, staff identities, storage paths, Supabase ids, token hash. A live check confirmed none of these appear in the review response.

Mockups: fresh signed URLs with a **15-minute** lifetime, minted on each review request. The 7-day lifetime is for email only. `mockup-previews` stays private. Caveat: the live test order had no print spec with a preview, so image freshness was not exercised live (§24).

## 13. Confirmation endpoint

`supabase/functions/order-confirmation/index.ts`, deployed with `--no-verify-jwt`.

| Action | Auth | Behaviour |
|---|---|---|
| `review` | token | Returns `pending`, `already_confirmed` (with summary), or `invalid` / `superseded` / `expired` (no summary). Compares hashes itself, so a confirmed row whose order has since changed is shown as superseded, never as current. |
| `confirm` | token + `expectedSummaryHash` | Rejects with `changed` (409) if the hash the customer saw is no longer current. Otherwise performs an atomic `pending → confirmed` update. |
| `reconcile` | staff JWT | Supersedes a confirmed row whose hash no longer matches. Verifies the JWT and an active profile itself. |

Any unknown or malformed input gets a safe response. Errors never reveal whether an order id exists.

## 14. Idempotency

- A repeat confirm on a confirmed row returns `already_confirmed` with the original `confirmed_at`. It writes nothing.
- The confirm update is conditional on `status = 'pending'`. If two clicks race, only one update succeeds. The loser re-reads and reports the winner's timestamp.
- The activity entry is written only after a successful transition, so there is exactly one per confirmation.

Live-verified: two confirms → one activity row, same timestamp.

## 15. CRM status

Staff-facing labels (`src/utils/orderConfirmation.ts`):
- **Not Sent** — no active confirmation and none ever superseded, or only an unsent pending row
- **Awaiting Confirmation** — pending and sent
- **Customer Confirmed** — confirmed (shows who and when)
- **Needs Reconfirmation** — the last approval was superseded and nothing active replaced it

"Superseded" is never shown to staff.

## 16. Orders integration

`OrderConfirmationBadge` appears on each Orders list row, next to the source badge. Public-form orders show nothing until a confirmation has been requested, so they never look like they are waiting for approval.

The list reads stored state. It is accurate after any edit made through the app (the edit flow reconciles before navigating) and after any Order Detail visit. An order changed by some other route would show stale state until it is next reconciled. See §25.

## 17. Order Detail integration

Overview tab, next to the Customer Email card:
- **Customer Confirmation** card: state badge, then per state:
  - Confirmed: "Confirmed by {email} · {date time}"
  - Awaiting: "Confirmation email sent {date time}. Waiting for the customer to review."
  - Needs Reconfirmation: explanation, plus **Send Updated Confirmation**
  - Not Sent: **Send Confirmation Email** (for public-form orders, the wording asks whether staff want approval)
- Opening the page runs reconcile, so the state is current.
- Customer Email card (Batch A) remains the delivery history, with Resend for a failed attempt. Delivery and approval are shown separately.

## 18. Public-form behaviour

Public-form orders never get an automatic confirmation. Staff can request one from Order Detail if they want approval after reviewing a customer-submitted order. Live-verified: the public order had no confirmation row, and its receipt was not linked to one.

## 19. Edit supersession

- **Customer-facing change** (any field in §6 coverage) on a confirmed order: the next reconcile marks the confirmation `superseded`. The Order Detail edit flow reconciles immediately after a save.
- **Old link:** `review` shows "no longer current" with no data. `confirm` returns `superseded`. Live-verified.
- **Internal-only edit** (assignment, production status, priority, internal notes): no supersession. Live-verified.
- Changing the customer's email address counts as customer-facing (it is part of the summary and appears in what they approve).

## 20. Reconfirmation

Staff explicitly send an updated confirmation. This creates a new pending row, sends it, and records a new email attempt linked to that row. The wording says the order was updated. Live-verified: the new email is sent and linked, and it is not blocked by the earlier send.

No automatic reconfirmation is ever sent on an edit.

## 21. Activity

One entry per confirmation: "Customer confirmed the order ({customer email})." `user_id` is null. The token and confirmation id are never included. Supersession and reconfirmation do not write activity entries (they are visible in the Confirmation card instead).

## 22. RLS / security

- `order_confirmations`: staff SELECT only. Anonymous: no policy. Live-verified: anon SELECT returns 0 rows; anon UPDATE changes nothing; staff INSERT is rejected (403); staff SELECT works.
- Public functions: `review` and `confirm` are reachable without a session. The token is the only authorization. A wrong or missing token returns `invalid`, indistinguishable from a nonexistent order.
- `reconcile`: staff JWT plus active profile. Without one: 401. Live-verified.
- Client bundle scan: no `RESEND_API_KEY`, `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_FROM`, `APP_PUBLIC_URL`, or confirmation field names. One unrelated match: the existing Batch A link column name `token_hash` in `public_order_links`, which holds only a hash.

## 23. APP_PUBLIC_URL

Set as a Supabase Edge Function secret: `APP_PUBLIC_URL=https://globalteez.com`. It is used only server-side, to build the link inside the email. It is not in the client bundle. `buildConfirmationUrl` rejects anything that is not an absolute http(s) URL, so a bad setting fails the send rather than emailing a broken link. A trailing slash is tolerated.

## 24. Tests

Automated, all passing (`npm run test`):
- `supabase/functions/_shared/email/confirmation.test.ts` — 41 tests: token generation and storage, URL building, summary-hash rules (each customer-facing field changes it; internal fields and preview URLs don't), review states, confirm decisions (including idempotency), supersession, planner, CTA in staff email, no CTA in receipt, escaping.
- `supabase/functions/_shared/email/email.test.ts` — 40 tests (updated for the new idempotency key format and wording).
- `src/utils/orderConfirmation.test.ts` — 7 tests: staff-facing display mapping.
- `src/api/clientSecrets.test.ts` — 1 test (no server-only secret names in `src/`).

Total: **449 tests passing** (401 before Batch B, plus 48 new).

Live checks (`production`, disposable data, all cleaned up) — **37 passed**:
- A: staff summary sent with a pending confirmation; only a hash stored; email linked to the confirmation.
- D: retry of a sent confirmation email refused; still one confirmation row.
- Review: pending token returns a customer-safe summary; no internal fields; random and malformed tokens → `invalid`.
- Confirm: stale hash → 409 `changed`; confirm → `confirmed` with timestamp; duplicate click → `already_confirmed`, same timestamp; one activity entry with the customer email and no token.
- Supersession: staff edit + reconcile → superseded; old link shows no data and cannot confirm; updated confirmation sent and linked to the new row.
- Internal edit: no supersession; still confirmed.
- Reconcile without a staff JWT → 401.
- Public order: submitted; no automatic confirmation; receipt sent with no confirmation link.
- RLS: anon cannot read or update; staff cannot insert; staff can read.

Not live-verified: a real customer clicking the email link in a browser (the link's route was checked for 200 only); mockup image freshness on the review page (test order had no preview).

## 25. Known limitations and deviations

- **Token rotation, not reuse** (§5). A send that timed out but was delivered would have its link invalidated by the retry. The customer then receives the newer email.
- **Stale list badge after non-app edits.** Edits made through the app reconcile immediately. Any change made some other way shows stale state in the list until the order is opened.
- **No rate limiting** on public `review`/`confirm`. Tokens are 256-bit, so guessing is not practical, but there is no request throttling yet.
- **Email visual QA not performed** (§26).
- **Deno type-check** of the Edge Functions has not been run (Deno is not installed here). Their logic is covered by the Vitest suite and the live checks.
- **Idle confirmations never expire** (§7). A customer can confirm an order weeks later. This is intended, but staff should know it.
- **Customer email change** counts as a customer-facing change and will require reconfirmation.
- **Confirmation is not visible on the Production Board.** This is deliberate: no blocker, no clutter.

## 26. Email visual QA

**Not done.** This session has no mail client, and no way to view the Resend-delivered messages (the sends went to Resend's sandbox address, `delivered@resend.dev`, which has no inbox). To finish this check, send a staff-created order summary to a real address you control, then check on desktop and phone:
- layout and text order
- the Review & Confirm button, and that it links to `https://globalteez.com/order-confirmation/…`
- mockup images render
- the plain-text fallback reads sensibly

## 27. Future options

- Confirmation expiry (explicit policy, §7).
- Delivered/bounced tracking via the Resend webhook (deferred since Batch A).
- Optional customer comment field, if a changes-requested flow is ever wanted (not in scope).
- Batch-reconcile on the Orders list, to remove the stale-badge limitation (§25).
- Rate limiting on the public function.
- Reconfirmation reminders once delivery tracking exists.

## 28. Production readiness

Confirmation is **not** a production blocker. `isReadyForProduction`, `getProductionBlockers`, queue ranking, and attention warnings were not modified.

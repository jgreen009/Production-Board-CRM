# Public Customer Order Link — Handover

Status: implementation complete, build/lint/test clean, live security-verified against the real database with disposable test data, **stopped at PUBLIC CUSTOMER ORDER LINK GATE**.

---

## 1. Objective

Let staff generate a secure, shareable link a customer can open without logging into the CRM, fill out an order-intake form on, and submit — creating exactly one new internal order, with the same `SP-XXXX` numbering and internal workflow defaults a staff-created order gets, for staff to then review and process normally.

## 2. Architecture

```
Staff (authenticated browser)
  → generates a random token client-side (Web Crypto), hashes it (SHA-256)
  → INSERT into public_order_links (token_hash only — raw token never sent to a server)
  → shows/copies the raw token embedded in a URL, once

Customer (anonymous browser, /order-request/:token)
  → "validate" call to the public-order Edge Function (read-only pre-check + reference catalogs)
  → fills out the form, uploads artwork (kept as local File objects/blob previews — no upload yet)
  → "submit": one multipart/form-data POST to the public-order Edge Function
       → Edge Function validates every field itself (strict allow-list, never trusts the browser)
       → uploads artwork files to Storage (service-role) at the real final path
       → calls the create_public_order_submission Postgres RPC (service-role only), which
         atomically consumes the link and creates the order + every child row in one transaction
       → returns {orderId, orderNumber}
  → success screen shows the order number
```

This is the first intentionally anonymous-facing surface in this project. Every privileged write is concentrated in the `public-order` Edge Function using the service-role key — the anonymous browser never has direct table or Storage access, and no new `anon` RLS policy was added anywhere.

## 3. Public-Order-Link Model

`public_order_links` (migration `20260912000000_public_order_links.sql`):

```sql
create table public_order_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  created_by uuid references profiles(id),
  is_active boolean not null default true,
  expires_at timestamptz,
  max_submissions integer not null default 1 check (max_submissions > 0),
  submission_count integer not null default 0 check (submission_count >= 0),
  resulting_order_id uuid references orders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Matches the brief's suggested shape closely, with one addition: `resulting_order_id`, set automatically the moment a submission succeeds, so staff can click straight from the link list to the order it produced — judged a small, clearly useful, low-risk addition (a nullable FK, no behavior change) rather than scope creep.

RLS: `authenticated` can SELECT/INSERT/UPDATE (no per-row ownership check, matching the `orders` table's own pattern), no DELETE policy (revoked links are kept, `is_active = false`, never hard-deleted), and **no `anon` policy at all** — anonymous customers never query this table directly.

## 4. Token Security

- Generated **client-side**, in the staff browser, via `crypto.getRandomValues` (32 random bytes, base64url-encoded) — `src/utils/publicOrderLink.ts`.
- Hashed **client-side** too, via `crypto.subtle.digest('SHA-256', ...)`, before ever touching the network — only `token_hash` is sent in the `INSERT`.
- The raw token is shown to staff exactly once, in a Drawer immediately after generation (`src/pages/PublicOrderLinks.tsx`), with a copy button and an explicit "won't be shown again" warning. It is never stored, never logged, never recoverable after that point.
- The public-order Edge Function re-hashes an incoming token with the identical SHA-256 algorithm (Deno's own `crypto.subtle.digest`) to look up `public_order_links.token_hash` — the two sides can never disagree about what a given token hashes to, since both use the same Web Crypto API.
- Public URL: `/order-request/{token}`.

## 5. Staff Link-Generation UX

A "Customer Order Links" button in the Orders page header (`src/pages/OrdersList.tsx`) opens `src/pages/PublicOrderLinks.tsx` (route `/orders/links`, authenticated + inside `AppShell`, per the existing routing pattern). Any authenticated staff member can generate a link (not admin-only — matches the brief's own recommendation and the existing "signed in is the trust boundary" pattern used throughout this schema for orders/customers/catalogs). The list shows status (Active/Used/Expired/Revoked as a colored badge), created date, usage count, expiry if set, and a "View resulting order" link once a submission has happened. Active links can be revoked with a confirm dialog; used/expired/revoked links show no revoke action (nothing left to revoke).

## 6. Public Route

`/order-request/:token` — added as a **top-level sibling to `/login`** in `src/App.tsx`, outside both `RequireAuth` and `AppShell`, exactly mirroring how `/login` is already the one existing precedent for a chrome-free, no-session page. No changes to `RequireAuth` or `AppShell` were needed.

## 7. Public Form Fields

`src/pages/PublicOrderForm.tsx`, organized into labeled sections (Your Details, Job Details, Garments, Services, Artwork & Print, Additional Instructions, then a Review & Submit step): customer name/company/email/phone, job title, required date, delivery method (Pick Up/Delivery), one or more garment lines (type/brand/colour/sizing/per-size quantities, reusing the existing `SizeQuantityGrid` component), the business's active services as toggle buttons, artwork upload (client-side validated against the same rules as staff uploads), one or more print locations (garment, position — filtered through `isPrintPositionSupported` so an anatomically invalid combination can't be selected — print size presets, artwork assignment), a live `GarmentMockup` preview per print location, and free-text additional instructions. A review screen summarizes everything before the customer can submit.

## 8. Excluded Staff Fields

**Never defined anywhere in the public schema, form state, or payload shape** — not hidden, not defaulted quietly, simply absent as a concept: Payment Status, Artwork Status, Garment Status, Production Status, Assigned To, Priority, Internal Notes / Production Notes, Approval Note, Readiness/Attention warnings, Queue Priority, Activity, Order State, staff-only mockup controls (drag/reposition, offsetX/offsetY), admin actions, customer history, reorder controls, User Management, supplier-management fields, staff status controls. `buildPublicOrderSubmissionPayload` (`src/api/publicOrder.ts`) is directly tested (12 tests) to confirm none of these fields leak into the payload even when maliciously present on the input object (`values.priority = 'Urgent'` etc. — the output is verified to never contain the field or its value at all). The Edge Function independently re-derives every value it writes from its own strict allow-list (`sanitizeSubmission` in `supabase/functions/public-order/index.ts`) rather than trusting anything in the request body — priority is hardcoded to `'Normal'` inside the `create_public_order_submission` SQL function itself, not merely omitted from the JS payload.

## 9. Artwork Upload

No new Storage bucket, no anon Storage policy. Artwork files are held as in-memory `File` objects in the customer's browser (with a local `URL.createObjectURL` preview for image types, mirroring the existing internal app's own `pendingFile` pattern for a not-yet-created order) until the final Submit, at which point they're sent as `multipart/form-data` fields (`artwork_<localFileId>`) in the single submission POST. The Edge Function validates each file server-side (extension allow-list, 25MB limit, MIME-vs-extension cross-check — an exact mirror of `src/utils/artworkValidation.ts`, since a public endpoint can be hit directly with arbitrary bytes regardless of what the form's own client-side JS checked) and uploads it, using the service-role key, to the **same bucket and path scheme** staff uploads already use (`artwork-originals`, `orders/{orderId}/artwork/{artworkId}/{fileName}`) — a public order's artwork is indistinguishable in Storage from a staff-uploaded one. The order id and every artwork id are generated in the Edge Function itself (not by the database) specifically so the Storage upload — which needs the final order id for its path — can happen *before* the single atomic database transaction that creates every row.

## 10. Mockup Preview

`GarmentMockup` (Mockup System V2's lightweight, non-Fabric renderer) is the only mockup renderer this page ever imports — Fabric is never loaded on the public form. Print position is authoritative (no drag/reposition anywhere in this component), matching the internal app's own "artwork placement is deterministic from garment + view + position" rule exactly. `isPrintPositionSupported` gates which positions are even selectable for a given garment type, so the public form can never construct an anatomically invalid combination (e.g. "Left Chest" on a Beanie) — mirrored server-side in the Edge Function's own small, explicit copy of the same calibration tiers (documented in the function's own comment as needing to stay in sync with `src/config/garmentGeometry.ts`).

## 11. Submission Architecture

One dedicated Edge Function, `supabase/functions/public-order/` (`verify_jwt: false`, since this function implements its own token-based authorization and anonymous customers have no Supabase session/JWT at all — the one deliberate exception to this project's otherwise-universal "every Edge Function requires a valid JWT" pattern, compensated entirely by the function's own strict token-hash validation). Two actions, dispatched by request shape: a JSON body with `{action: 'validate', token}` for the read-only pre-check, or a `multipart/form-data` body (detected via `Content-Type`) for the actual submission.

The atomicity requirement ("one link creates at most one order," safe against double-click/parallel-request races) is met by a single Postgres `UPDATE ... WHERE ... RETURNING` statement inside `create_public_order_submission` — this is the *only* place that actually enforces it; the Edge Function's own pre-check (a plain `SELECT`) exists purely to fail fast with a friendly message before uploading any files, and is not itself race-safe. Doing customer resolution, order creation, every child-table insert, and the token consumption all inside one `SECURITY DEFINER` PL/pgSQL function body means the whole database side commits or rolls back together — a validation failure partway through can never leave a half-created order behind, and (since token consumption is inside the same transaction) a failed attempt never burns the customer's one-time link. The one thing that can't be made atomic with the rest is the Storage upload (Storage isn't reachable from SQL) — it happens *before* the RPC call, so a failure after upload but before the RPC commits can leave an orphaned Storage object; it can never leave an orphaned/partial order row. Documented as a known limitation (§21).

## 12. Customer Matching

Exact, case-insensitive email match reuses an existing `customers` row; anything else (no email supplied, or no match found) creates a new one. Implemented inside `create_public_order_submission` (`lower(email) = lower(trim(...))`), never on name alone — the audit that preceded this feature found the current New Order flow doesn't do *any* customer matching today (it leaves `customer_id` null and stores contact details directly on the order), so this is new logic, not a reuse of an existing pattern, and is scoped no wider than what the brief explicitly asked for.

## 13. Order Creation / Defaults

A public order gets **exactly the same internal starting state** as a normal staff-created order: `payment_status = 'Unpaid'`, `artwork_status = 'Not Started'`, `garment_status = 'Not Required'`, `production_status = 'New'` — all via the same table `DEFAULT`s a staff order relies on (the RPC doesn't set these columns at all, deliberately, so there's no way for them to drift from whatever a staff order gets). `priority` is hardcoded to `'Normal'` regardless of anything in the payload — there is no "urgency" field on the public form at all; `dueDate` (Required Date) is the customer-facing way to express timing pressure, exactly as the brief specified. `assigned_to` and `created_by` are both `NULL` (no authenticated staff user exists for an anonymous request). `order_state = 'Active'` immediately (not staged as `'Draft'`, since artwork is already safely in Storage by the time the RPC runs — see §11). `orders.source = 'public_form'` (new column, `default 'staff'` for every existing/normal row) distinguishes it for future staff-facing UI (e.g. a "Submitted by Customer" badge) without needing a separate "public orders" subsystem — it appears in every normal order list/detail query already, via the existing `select('*')` wildcard.

`print_specs.offset_x`/`offset_y` are never accepted from the public payload at all (not merely defaulted to 0 — there is no field in the sanitized submission shape that could populate them), consistent with this project's existing "legacy ignored" rule for those columns, extended here to "never even offered."

## 14. Activity Behavior

One `order_activity` row per submission, `activity_type = 'created'`, `message = 'Order submitted via customer order form'`, `user_id = null` (no staff user to attribute it to). No per-field activity spam, no exposure of the token anywhere in the message.

## 15. Link Lifecycle

Active → Used (submission_count reaches max_submissions, currently always 1) → shows "This order link has already been used" to any later visitor. Active → Revoked (staff action, `is_active = false`) → shows "This order link has no longer available." Active → Expired (`expires_at` in the past, optional — supported by the schema and the validate/submit checks, but no UI was built for staff to *set* an expiry on link creation this pass, since the brief's own "optional expiry" language and the "very small diff" spirit of scoping made the simpler always-no-expiry default the pragmatic first cut — `createPublicOrderLink` already accepts an `expiresAt` parameter, so adding an expiry-date picker to the generation UI is a small, contained follow-up, not a schema change). None of these states ever expose internal record details — the public page only ever sees one of four safe, generic messages (`INVALID_MESSAGES` in `PublicOrderForm.tsx`).

## 16. RLS / Security

- `public_order_links`: `authenticated` SELECT/INSERT/UPDATE, no `anon` policy at all (verified live — see §21).
- `create_public_order_submission`: `SECURITY DEFINER`, `revoke ... from public, anon, authenticated`, `grant execute ... to service_role` only — verified live that an anon PostgREST call to this RPC returns `401 permission denied` (§21).
- No RLS policy on `orders`/`order_garments`/`garment_quantities`/`order_services`/`print_specs`/`artwork` was changed or widened — anon still cannot insert into any of them directly (verified live).
- `garment_types`/`garment_brands`/`services`/`business_settings` were **not** given new `anon` SELECT policies — the public form gets this reference data from the Edge Function (service-role, bypassing RLS entirely for a read-only fetch), so the existing staff-only RLS surface on those tables is completely untouched.
- Storage: no anon policy added to the `artwork-originals` bucket. All public uploads go through the Edge Function's service-role Storage client.

## 17. Edge Functions

One new function, `supabase/functions/public-order/index.ts`, deployed with `verify_jwt: false` (see §11 for why this is the correct, deliberate choice here specifically). Structured after the existing `admin-users` function's pattern (service-role client factory, CORS handling, sanitized `logStep` logging — never a secret, a raw token, or PII beyond an error category) but inverted in one fundamental way: `admin-users` re-authorizes every request from a real Supabase JWT; `public-order` has no JWT to check at all and instead authorizes purely via the opaque per-link token, re-validated server-side on every call.

## 18. Rate Limiting / Abuse

At minimum, per the brief's own floor: one token allows a limited number of submissions (1, by default), uploads are capped at 25MB per file with server-side extension/MIME validation, all input is length-capped and type-checked (`sanitizeString` truncates every string field, `isUuid`/`Number.isFinite` guard every id/number), and there is no anonymous listing of links or catalogs beyond what `validate` intentionally returns for a *specific, already-known* token. No third-party anti-bot platform or CAPTCHA was added — judged disproportionate for this pass given the existing floor already meaningfully limits blast radius (a spammer needs a *valid, unused* link per attempted order, which only a staff member ever generates and shares). No honeypot field was added either, for the same proportionality reason. **This is the area most worth revisiting if real abuse is observed** — see §21.

## 19. Mobile UX

Single-column layout throughout (`PublicShell`'s `max-w-2xl` centered container), the same `SizeQuantityGrid` component already tuned for mobile touch targets (44px-plus, no horizontal scroll) elsewhere in the app, large tap-friendly buttons for delivery method/sizing/services/print-size-preset selection (matching the existing internal app's own button-group pattern), and a native `<input type="file" multiple>` for artwork upload (works correctly on mobile Safari/Chrome, including opening the camera roll). Not verified in an actual browser at 390/430/768/1024px (see §22 — no browser tooling available to this session, consistent with every other UI-heavy batch in this project's history).

## 20. Tests

26 new tests (281 → 307):
- `src/utils/publicOrderLink.test.ts` (7) — SHA-256 correctness against a published test vector, determinism, uniqueness, base64url safety, and that `generateOrderLinkToken`'s returned hash matches independently re-hashing its own token (the same invariant the Edge Function relies on for lookup).
- `src/api/publicOrder.test.ts` (12) — `buildPublicOrderSubmissionPayload`: correct field mapping for customer/garments/services/print specs, notes routed only to `order.notes`, and — the security-critical ones — that `priority`, `paymentStatus`, `artworkStatus`, `garmentStatus`, `productionStatus`, `assignedTo`, `staffCompleted`, `productionNotes`, and `approvalNote` never appear anywhere in the output even when present on the input object, and that no print spec ever carries `offsetX`/`offsetY`.
- `src/utils/publicOrderLinkStatus.test.ts` (7) — `getPublicOrderLinkStatus`'s priority ordering (Revoked > Expired > Used > Active) and each individual condition.

No tests exist for the Edge Function's own `sanitizeSubmission`/`isPrintPositionSupported` copies, since Deno Edge Functions run in a separate runtime this project's Vitest suite doesn't execute — those were verified by direct live testing instead (§21), and by careful code review mirroring the already-tested client-side logic field-for-field.

## 21. Live Verification

Performed against the real database with disposable test data (a real link, a real submission, then full cleanup) — not simulated:

| Check | Result |
|---|---|
| Anonymous PostgREST `INSERT` into `orders` | **Rejected** — `401`, `new row violates row-level security policy` |
| Anonymous `SELECT` on `public_order_links` | **Returns zero rows** (RLS default-deny, no error leaked) |
| Anonymous direct RPC call to `create_public_order_submission` | **Rejected** — `401`, `permission denied for function` |
| `validate` action with a garbage token | `{valid:false, reason:'not_found'}` |
| `validate` action with a real, unused link | `{valid:true, garmentTypes:[...], garmentBrands:[...], services:[...], businessName:'Brand Fanatix'}` |
| Full `submit` (customer + garment + service + one artwork file + one print spec) | **Succeeded** — real order created (`SP-1214`), verified `source='public_form'`, `order_state='Active'`, `payment_status='Unpaid'`, `artwork_status='Not Started'`, `garment_status='Not Required'`, `production_status='New'`, `priority='Normal'`, `assigned_to=null`, `created_by=null`; garments/quantities, artwork row + real Storage upload, print spec, and one `order_activity` row (`user_id=null`, "Order submitted via customer order form") all confirmed by direct query |
| `validate` on the now-used link | `{valid:false, reason:'used'}` |
| A second `submit` attempt with the same (used) token | **Rejected** — `410`, "This order link has already been used." (no second order created) |
| `validate` on a revoked link (`is_active=false`) | `{valid:false, reason:'revoked'}` |
| `public_order_links.submission_count`/`resulting_order_id` after the successful submission | Correctly `1`/pointing at the real order |

All test rows (the link, the order and its children, the test customer) were deleted afterward. One inert artifact remains: the tiny (68-byte) test artwork file's Storage *blob* — its DB row/reference was deleted along with the order, but the underlying object in the private `artwork-originals` bucket wasn't separately removed (no Storage-delete tool was available to this session outside the app itself). It is private, harmless, and orphaned under a path tied to a since-deleted order id — flagged honestly rather than left unmentioned.

Supabase security and performance advisors were run after all schema changes: **zero new findings attributable to this feature** — the three pre-existing `SECURITY DEFINER`-callable-by-authenticated warnings are unrelated legacy functions, and `create_public_order_submission` correctly does **not** appear in that list at all (confirming its `authenticated`/`anon` execute grants really are revoked). The only new performance-advisor line is `public_order_links_created_by_idx` showing as "unused" — expected for a brand-new table with no query history yet.

Client bundle was scanned for secrets: no `SUPABASE_SERVICE_ROLE_KEY`/`service_role` string appears anywhere in `dist/assets/*.js`. The only JWT-shaped string present is the pre-existing, intentionally-public `anon` key (already embedded for the whole app before this feature).

## 22. Known Limitations

- No expiry-date picker in the link-generation UI yet (the schema/API support it; only the "always no expiry" default path was wired into the Generate button this pass — see §15).
- No rate-limiting or CAPTCHA beyond the existing floor (one-use-by-default links, size/type validation, input sanitization) — worth revisiting if real abuse is observed (§18).
- Customer matching is email-only; a customer without an email always creates a new `customers` row even if they've ordered before under a different contact method.
- The Edge Function's `isPrintPositionSupported`/calibration-tier copy is a small, manually-kept-in-sync mirror of `src/config/garmentGeometry.ts`, not a shared import (Deno Edge Functions and the Vite/Node build are separate runtimes/deployment artifacts) — a future geometry change that isn't mirrored here could let an unsupported garment/position combination through server-side even though the client-side form already blocks it via the real, current `garmentGeometry.ts`.
- One orphaned (harmless, private, tiny) Storage test object remains from live verification (§21).
- No browser-based UAT has been performed (§19/§23) — everything above was verified via direct HTTP/SQL, not by actually using the form in a browser.

## 23. Manual UAT Checklist

1. Generate a link from Orders → Customer Order Links → New Customer Order Link.
2. Copy the link from the one-time reveal drawer.
3. Open the link in a private/incognito window (logged out) — confirm no sidebar/dashboard is visible, only the order form.
4. Check the layout at 390px, 430px, 768px, and 1024px+ widths.
5. Fill in customer details (name + at least one of email/phone).
6. Select a garment type, brand, colour, and enter quantities across a few sizes.
7. Confirm quantities update correctly (Adult vs Youth sizing toggle).
8. Select one or more services.
9. Upload an artwork file (try a PNG and a PDF); confirm both appear with a preview or file-name chip.
10. Add a print location, choose a garment + position, confirm an anatomically invalid combination (e.g. a Beanie's positions) cannot be selected.
11. Confirm the mockup preview renders and updates as position/artwork change.
12. Add a second print location and confirm both are tracked independently.
13. Click Review Order — confirm the summary matches everything entered, with an Edit option back to the form.
14. Submit — confirm the button disables/shows progress and cannot be double-clicked into a second submission.
15. Confirm the success screen shows a real `SP-XXXX` order number.
16. In the CRM (as staff), confirm the new order appears in Orders/Production Board/Customer Detail with all the entered data, no staff-only fields incorrectly populated, and workflow statuses at their normal starting defaults.
17. Re-open the same link — confirm it now shows "already been used."
18. Generate a second link, revoke it immediately, then open it — confirm it shows "no longer available."
19. Open a completely made-up `/order-request/not-a-real-token` URL — confirm a safe "invalid link" message, no stack trace or internal detail.
20. On a slow/throttled connection, confirm the artwork upload and submission show a clear in-progress state rather than appearing frozen.

---

## PUBLIC CUSTOMER ORDER LINK GATE

Stopped here per instructions. No further feature work has been started automatically.

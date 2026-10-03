# Email System — Batch A Handover (Transactional Order Email)

**Status: code complete, unit-tested, build/lint/test green. NOT yet deployed and NOT yet live-verified.**
Blocked on two external prerequisites (see §0). Nothing in this batch has been applied to the production database or deployed to Supabase.

## 0. Blockers and what is needed to finish

1. **Supabase access.** During this batch the Supabase CLI was logged into a different account (`supabase projects list` no longer shows the Brand Fanatix project `pphzbtqfttfkaphmwutr`, and DB/secrets calls return 403). Migration `20260917000000_order_emails.sql` has therefore **not** been applied, and the two Edge Functions have **not** been deployed. Fix: re-authenticate the CLI with the account that owns `pphzbtqfttfkaphmwutr`.
2. **Resend.** No Resend API key exists in the repo or the local environment, and I have no Resend API access, so the `globalteez.com` domain's verification status is **unverified**. Required before live sends work: set the secrets (§5) and confirm the sender's domain shows *Verified* in the Resend dashboard.
3. **Deno type-check.** Deno is not installed here and `npx deno` produced no output, so the Edge Function sources were checked only indirectly (they import the same pure modules the Vitest suite covers). Run `supabase functions deploy` and a function smoke test before relying on them.

Remaining after those three: apply migration → deploy `send-order-email` (default JWT verification) and `public-order` (keep `--no-verify-jwt`) → set secrets → run §19 live verification → run Supabase security + performance advisors.

## 1. Objective

Send transactional order emails from the CRM without ever letting email failure affect an order:
- **Flow A (staff-created order):** after the order saves, the customer gets an order summary. Staff can see the result and retry.
- **Flow B (public order form):** after the public submission creates the order, the customer gets a receipt ("We received your order request"). It never asks them to approve.

Batch B (customer confirmation / approval) is **not** included.

## 2. Architecture

```
Browser (staff)  ──create order──▶ upsert_order RPC  ──committed──┐
      │                                                           │
      └─ after save succeeds ──▶ send-order-email (JWT, staff only)
                                     │  loads order from DB, derives recipient + body
                                     ▼
                            sendOrderEmail (shared)  ──▶ order_emails (queued)
                                     │                    │
                                     ▼                    ▼
                                 Resend API  ──▶  order_emails (sent | failed)

Anonymous customer ──submit──▶ public-order Edge Function
                                     │  create_public_order_submission RPC  (committed)
                                     ▼
                       sendOrderEmail in-process (customer_order_receipt)
                                     │  failure is logged and swallowed
                                     ▼
                              response to customer unchanged
```

The order is always committed before any email work starts. Email code never writes to `orders`, so no email outcome can roll back or delete an order.

## 3. Sending domain

- Intended sender: `Brand Fanatix <orders@globalteez.com>`, the form the brief recommended.
- **Verification status: unverified** (see §0). Do not treat live sends as working until the domain shows *Verified* in Resend.
- DNS was not changed by this batch.

## 4. Edge Function architecture

| File | Role |
|---|---|
| `supabase/functions/send-order-email/index.ts` | Staff entry point. Verifies the JWT, requires an active profile, accepts `{orderId, emailType, retry?}` only. |
| `supabase/functions/public-order/index.ts` | Existing public function. After the RPC succeeds, it calls `sendOrderEmail` in-process for the receipt. |
| `supabase/functions/_shared/email/policy.ts` | Pure rules: allowed types per order source, send decision, idempotency keys, failure categories, subjects. |
| `supabase/functions/_shared/email/summary.ts` | Customer-safe summary: `buildCustomerOrderSummary` plus the raw-row shape it reads. |
| `supabase/functions/_shared/email/render.ts` | HTML (table layout, inline styles) and plain-text templates. |
| `supabase/functions/_shared/email/resend.ts` | Resend REST client. Key passed in, categorized results out. |
| `supabase/functions/_shared/email/sendOrderEmail.ts` | Orchestration: load → decide → queue row → render → send → record outcome. |
| `supabase/functions/_shared/email/email.test.ts` | 40 Vitest tests for all of the above (runs under the normal `npm run test`). |

Deploy commands (not yet run):
```
supabase functions deploy send-order-email --project-ref pphzbtqfttfkaphmwutr
supabase functions deploy public-order --project-ref pphzbtqfttfkaphmwutr --no-verify-jwt
```

Client calls:
- `src/api/orderEmails.ts` — `requestOrderEmail` (sends only orderId/type/retry), `listOrderEmails`, `orderEmailErrorMessage`.
- `src/hooks/useOrderEmails.ts` — React Query hooks.
- `src/components/domain/OrderEmailStatus.tsx` — Order Detail card.

## 5. Server-side secrets

| Name | Used by | Required | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | both functions | yes | Set with `supabase secrets set`. Never committed, never in `VITE_*`, never in the bundle. |
| `EMAIL_FROM` | both functions | yes | e.g. `Brand Fanatix <orders@globalteez.com>`. Only after domain verification. |
| `APP_PUBLIC_URL` | — | **not used** | Not needed in Batch A (no links in emails). Add it in Batch B for the confirmation link. |

If `RESEND_API_KEY` or `EMAIL_FROM` is missing, the attempt is recorded as `failed` with `sender_not_configured`, and the order is unaffected. This is the safe failure mode and is how the failure path can be verified before the key exists.

Secret values are never written into this document, the repo, or logs.

## 6. `order_emails` schema

Migration `supabase/migrations/20260917000000_order_emails.sql`:

```sql
create table order_emails (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  email_type text not null check (email_type in ('staff_order_summary', 'customer_order_receipt')),
  recipient text not null,
  resend_email_id text,
  status text not null check (status in ('queued', 'sent', 'delivered', 'failed', 'bounced')),
  error_message text,
  sent_at timestamptz, delivered_at timestamptz, failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index order_emails_one_live_per_type
  on order_emails (order_id, email_type) where status in ('queued','sent','delivered');
```

- `on delete cascade` matches every other order child table, so deleting an order removes its email history. This is consistent with the order-delete fix shipped earlier.
- `error_message` holds a **category** only (see §17), never raw provider text.

## 7. RLS

- RLS enabled. One policy: `staff can read order_emails` (`for select to authenticated using (true)`), matching the rest of the order data.
- No insert/update/delete policy for any client role, so the browser cannot write or change delivery status.
- No `anon` policy. Writes come from the service-role key inside the Edge Functions only.

## 8. Staff-created order flow (Flow A)

- **Trigger:** `NewOrderForm.tsx`, the **create** branch only. It runs immediately after `performSave(values, true, true)` resolves successfully, then calls `requestOrderEmail(id, 'staff_order_summary', false)`.
- **Not triggered by:** Edit Order (`updateOrderWithActivity` branch), and nothing else. The brief's "Draft" case does not exist in this app (no drafts are persisted), so there is no draft-save path to exclude.
- **Failure handling:** `.catch(() => null)` on the email call. The order is always reported as created. Toasts:
  - sent → "Order created and customer email sent."
  - otherwise → "Order created successfully, but the customer email could not be sent. You can resend it from the order."
- **Recipient:** `orders.email`, falling back to `customers.email`. If neither is plausible, a `failed` row is written with `no_valid_recipient`, and the order is still created.

## 9. Public-order receipt flow (Flow B)

- **Trigger:** in `public-order/index.ts`, after `create_public_order_submission` returns successfully, `sendOrderEmail(... 'customer_order_receipt', isRetry: false)` runs inside its own try/catch.
- **Why in-process, not an endpoint:** no anonymous caller can reach the receipt path. `send-order-email` also refuses receipts unless the order's `source` is `public_form`.
- **Response:** unchanged. A receipt failure never produces an error response, and the link stays consumed, because the order exists.
- **Latency:** the receipt is awaited before the response, bounded by the 10-second Resend timeout (`TIMEOUT_MS` in `resend.ts`). This is a real cost of the simple design. If it proves too slow in practice, move the await to `EdgeRuntime.waitUntil`. Not done in this batch.

## 10. Customer-safe summary

`buildCustomerOrderSummary` (in `summary.ts`) is the only path from order data to a template. It reads an explicit allow-list:

- order number, job title, required date, delivery method, customer notes
- customer name, company, email, phone
- garments: type, brand (omitted when `Customized`), colour, sizes and quantities (zero rows dropped, sorted)
- services (names only)
- print specs: position (form-facing label), artwork file name, width, print colour, garment label, mockup image URL

Excluded by construction (never read, so they cannot appear): assigned staff, all four status dimensions, priority, production notes, approval notes, staff-completed flag, activity, storage paths (only the signed URL, see §11), and any internal id beyond the order number.

Position labels follow the form's display text. `POSITION_LABELS` mirrors `getPrintPositionLabel()` in `src/config/garmentGeometry.ts`, including the Left/Right Chest swap. A Vitest check fails if the two drift apart. This check already caught a real drift (`Left Side`, `Right Side`) during this batch.

## 11. Templates and mockup strategy

- **Templates** (`render.ts`): table layout, inline styles only, 600px max width, a restrained orange accent, no external CSS, no JavaScript, no flex/grid. Every customer value passes through `escapeHtml`. A row whose value is empty is omitted entirely. A plain-text alternative is always included.
- **Mockups — option B (signed URLs with a deliberate lifetime).** Each print spec's preview gets a signed URL from the private `mockup-previews` bucket, valid for **7 days** (`EMAIL_PREVIEW_URL_TTL_SECONDS`). A fresh URL is minted on every send and every retry.
  - Trade-off: images in emails older than 7 days will be broken. Retry (or a future regeneration) restores them.
  - The bucket stays private. Nothing was made public and no Storage policy changed.
  - Option A (no images) was the fallback. Option C (a public image endpoint) was rejected because it would widen Storage access.

## 12. Idempotency

Three layers, from strongest to weakest:

1. **Database:** partial unique index `order_emails_one_live_per_type`. Two concurrent sends for the same order and type cannot both insert a live row. The second gets `23505` and is reported as `in_progress`.
2. **Decision (`decideSend`):** an automatic send happens only when no prior attempt exists. An explicit retry is allowed only when no live attempt exists. A `sent` or `delivered` email is never resent.
3. **Provider:** Resend `Idempotency-Key` = `order:{orderId}:{emailType}:attempt{n}`, where `n` is the attempt number. Each retry gets a new key, because Resend caches a key for 24 hours and a retry reusing a key would receive the cached failure instead of sending.

Stuck rows: a `queued` row older than 10 minutes (`STALE_QUEUED_MS`) is marked `failed` with `timed_out` at the start of the next send, so it can no longer block a retry.

## 13. Retry behavior

- Staff retry from Order Detail → Customer Email card → **Resend Email**. Shown only when the latest attempt is `failed` or `bounced`, or when no attempt exists yet for the staff summary (so older orders can be sent).
- Retry is allowed for `customer_order_receipt` only when the order is a public-form order (enforced server-side).
- A retry after a `sent` email is refused (`already_sent`). The UI shows no button in that state.

## 14. Order Detail email status

Card "Customer Email" in the Overview tab, shown for real orders only (demo orders have no rows). For each email type it shows the latest attempt:
- `Sent to {recipient} · {date time}`
- `Failed to send … {safe message}` with a Resend button
- `Sending…` while queued
- `Not sent yet.` with a Send button (staff summary only)

Public orders show the receipt row first. The Orders list has no email indicator, as the brief allowed.

## 15. Activity behavior

**Decision: no `order_activity` rows for email.** `order_emails` is the record and already shows every attempt with status and timestamps. Adding email events to the activity log would also require changing the `order_activity_activity_type_check` constraint, which is more churn than this batch justifies. The Order Detail card covers operational visibility. If an activity entry is wanted later, add the activity types with a migration and write from `sendOrderEmail`.

## 16. Webhook decision

**Deferred.** Delivery and bounce events need a Resend webhook plus signature verification (Svix). That needs a new signing secret, which is not provisioned, and it would expand this batch materially. The schema already supports `delivered`, `bounced`, and `delivered_at`, so the webhook can be added later without a migration. Batch A status lifecycle: `queued → sent` or `queued → failed`.

## 17. Error handling

Provider and environment failures are mapped to these categories and are the only error text stored or shown:

| Category | Meaning | Staff-facing message |
|---|---|---|
| `no_valid_recipient` | Missing or malformed customer email | Add an email to the order, then resend |
| `sender_not_configured` | `RESEND_API_KEY` or `EMAIL_FROM` missing | Email sending is not configured yet |
| `resend_sender_rejected` | HTTP 401/403 (bad key or unverified sender) | generic "could not be sent" |
| `resend_rejected_request` | HTTP 400/422 (e.g. invalid recipient) | generic |
| `resend_rate_limited` | HTTP 429 | Too many emails recently; try later |
| `resend_unavailable` | HTTP 5xx or malformed response | generic |
| `network_error` | fetch threw | generic |
| `timed_out` | 10-second timeout, or a stale queued row | The previous send timed out |

Never exposed: Resend response bodies, stack traces, the key, or internal ids. Covered by a unit test asserting the raw provider text is absent from the result.

## 18. Tests

Added this batch (all passing):

- `supabase/functions/_shared/email/email.test.ts` — **40 tests**:
  - customer-safe summary (13): order number, customer details, garments, quantities, services, print specs, required date, delivery, notes, and exclusion of assigned staff, statuses, priority, internal notes, approval notes, and storage paths
  - templates (7): subjects, staff vs receipt wording, receipt never asks for approval or confirmation, HTML escaping, empty optional fields, image only where a preview exists, plain text
  - position-label sync with the form (1)
  - date formatting (2)
  - authorization policy (2)
  - send decisions and idempotency (8)
  - recipient and failure categories (2)
  - Resend client: idempotency header sent, raw provider body never returned, network failure categorized (3)
- `src/api/clientSecrets.test.ts` — **1 test**: no `src/` file contains a server-only secret name (`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_FROM`, `APP_PUBLIC_URL`, `service_role`). Asserts it scanned more than 50 files so it cannot pass vacuously.

**Total: 401 tests passing** (360 before this batch, +41 new). The new `src/` test adds 1 and the shared-email suite adds the rest.

Not covered by automated tests: the database layer (the unique index, RLS, and the `order_emails` writes against a real Postgres) and the Deno runtime. Those need the live verification in §19.

## 19. Live verification

**Not performed.** Blocked by §0. The planned checks, to run once unblocked:

- **A. Staff-created order.** Create a test order with a disposable address → order exists → `staff_order_summary` row is `sent` with a `resend_email_id` → Order Detail shows "Sent to …".
- **B. Public order.** Submit through a test link with a disposable address → order exists → `customer_order_receipt` row is `sent`.
- **C. Forced failure.** With `RESEND_API_KEY` unset, create an order → order exists → row is `failed` with `sender_not_configured`. Set the key and use Resend Email → row becomes `sent`. This proves the failure path and retry without a real send failure, and it is the check that can run before the key exists.
- **D. Duplicate guard.** Call `send-order-email` twice for one order with `retry: false` → second call returns `skipped`, and no second Resend call is made.
- **E. Authorization.** Call `send-order-email` with no token (expect 401), with a non-staff token (expect 403), and with `customer_order_receipt` for a staff-created order (expect `skipped` / `not_allowed`).

Test data must be deleted afterward. Do not send to real customer addresses.

## 20. Known limitations

- Not deployed, not migrated, not live-tested (§0).
- Resend domain verification is unverified (§0, §3).
- Mockup links in email expire after 7 days (§11).
- The public receipt adds up to one Resend round-trip (≤10 s) to the customer's wait (§9).
- A crash between a successful Resend send and the DB status update leaves a `queued` row, which is then marked `timed_out` after 10 minutes. The customer may already have the email, and a retry would send a second copy. Rare, and accepted for Batch A.
- No delivery or bounce tracking (§16).
- No Deno runtime type-check of the Edge Function sources (§0).
- The customer-facing staff email intentionally omits the brief's sentence "A future customer confirmation action will be added in Batch B." That line describes internal plans and should not be sent to customers. The CTA slot is not rendered and no placeholder URL exists, as the brief required.
- Left/Right Chest labels in emails must be kept in sync with `garmentGeometry.ts` by hand. The Vitest check covers this, and it runs under `npm run test`.

## 21. Prerequisites for Batch B (customer confirmation)

- Verified Resend domain and a working `RESEND_API_KEY` / `EMAIL_FROM` (§0).
- `APP_PUBLIC_URL` secret for building confirmation links.
- A confirmation token design (hash at rest, like `public_order_links`), with its own table or columns and RLS. The `order_emails` table can gain a link to it.
- A public confirmation route that works without login and exposes only the customer-safe summary.
- Decision on whether a pending confirmation blocks production (the brief says it must not, in Batch B's scope).
- A Resend webhook (§16) would let Batch B distinguish delivered from merely sent, which matters for confirmation reminders.

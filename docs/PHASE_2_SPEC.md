# SALT PRINTS — Phase 2 Spec: Backend Integration

Source of truth for Phase 2 of the SALT PRINTS CRM. Read this alongside `CLAUDE.md` and `HANDOVER.md` (`HANDOVER.md` wins on any conflict with older planning docs). This phase turns the existing Phase 1 frontend into a persistent, Supabase-backed application. **Do not rebuild the frontend or redesign the UI** — only adjust UI where a backend requirement genuinely forces it.

## 1. Scope

**In scope:** Supabase Postgres, Supabase Auth, Supabase Storage, RLS, TanStack Query, and wiring all of the below into the existing UI so data survives refresh, navigation, logout/login, and browser restart.

**Explicitly out of scope for this phase:** Stripe/payments processing, invoicing, accounting, supplier ordering, email/SMS campaigns, AI features, subscription billing, a customer-facing portal, advanced analytics, Monday.com sync, complex inventory. Payment is status-tracking only — never a transaction.

**Product shape:** one shared company dataset for internal SALT PRINTS staff. This is **not** multi-tenant. Do not add `organization_id`, tenants, tenant switching, or SaaS billing anywhere in the schema, RLS, or code.

## 2. Before Touching Code

1. Read `CLAUDE.md` and `HANDOVER.md` in full.
2. Inspect: `src/types/index.ts`, `src/schemas/orderFormSchema.ts`, `src/data/`, `src/hooks/useProductionBoard.ts`, `src/pages/new-order/`, `src/pages/order-detail/`, `src/components/domain/` (incl. `production/`), `src/layouts/AppShell.tsx`, `src/utils/`.
3. Run the app. Run `npm install && npm run build && npm run lint`.
4. Confirm whether Supabase is a local CLI stack or an existing hosted project, and get real `.env` values from the user — never invent placeholder credentials and build against them as if real.

**Deliverable before any implementation:** `docs/PHASE_2_BACKEND_PLAN.md`, covering: current frontend architecture; Supabase architecture; DB schema; relationships; auth model; profiles/roles; RLS strategy; storage strategy; data-access architecture; TanStack Query architecture; mock-data migration; customer-linking strategy; order create/edit flow; artwork upload flow; PrintSpec persistence; production-board sync; settings persistence; order-number generation; draft strategy; date handling; error/loading states; testing strategy; milestones. Get this reviewed before broad implementation.

## 3. Stack

Preserve: React 19, TypeScript, Vite 8, Tailwind v4, React Router v7, React Hook Form, Zod, Lucide React.
Add: `@supabase/supabase-js`, `@tanstack/react-query`.
Do not add Redux/Zustand unless TanStack Query + normal React state genuinely can't solve something. Do not change frameworks.

## 4. Core Workflow (unchanged)

```
Online order form → Order record → Garments → Artwork → Print specs/mockups
→ Production board → Status tracking → Completion
```

The **order** is the source of truth; the **production board** is an operational view of orders; **order detail** shows the full job spec. Customer, garments, artwork, print specs, services, notes, and statuses all relate back to one order.

## 5. Architecture

- **Supabase client:** one centralized `src/lib/supabase.ts`. Never initialize Supabase inside page components. Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.example` (no real credentials committed).
- **Data-access layer:** a real service/API layer (e.g. `src/api/{auth,orders,customers,artwork,settings,dashboard,search}.ts`), not Supabase calls scattered through components.
- **Domain mapping:** explicit mapping functions (`mapDatabaseOrderToDomain`, `mapOrderFormToCreatePayload`, `mapOrderFormToUpdatePayload`, `mapGarmentRowsToDomain`, `mapPrintSpecRowToDomain`, etc.) so snake_case DB shape never leaks into frontend domain types.
- **TanStack Query:** one `QueryClient` near the root. Queries for orders, order detail, customers, customer detail, services, garment types/brands, artwork, settings, dashboard, production board, global search. Mutations for create/update/status-change/upload/settings-update. Invalidate carefully so related screens stay in sync.

Suggested hooks: `useSession`, `useProfile`, `useOrders`, `useOrder`, `useCreateOrder`, `useUpdateOrder`, `useSaveDraft`, `useCustomers`, `useCustomer`, `useCreateCustomer`, `useUpdateCustomer`, `useProductionOrders`, `useUpdateProductionStatus`, `useUpdateArtworkStatus`, `useUpdateGarmentStatus`, `useUpdatePaymentStatus`, `useUpdatePriority`, `useArtwork`, `useUploadArtwork`, `useRemoveArtwork`, `useServices`, `useGarmentTypes`, `useGarmentBrands`, `useBusinessSettings`, `useDashboard`.

## 6. Auth & Authorization

- Supabase Auth: login, logout, session persistence, protected routes on `/dashboard`, `/production`, `/orders`, `/orders/new`, `/orders/:id`, `/orders/:id/edit`, `/customers`, `/customers/:id`, `/settings*`. Unauthenticated → redirect to login. No customer-facing auth.
- `profiles` table: `id uuid PK references auth.users(id)`, `full_name text`, `role text`, `created_at timestamptz`, `updated_at timestamptz`. Roles: `owner | admin | staff`. No organizations/tenant-membership tables.
- RLS on every table. Anonymous: deny all operational data. Authenticated staff: full standard order/customer operations. Settings writes optionally restricted to `owner|admin`; reads open to all authenticated staff. **RLS is the real boundary — frontend route guards are not sufficient on their own.**

## 7. Database Schema

> UUID PKs for domain records. `created_at timestamptz` / `updated_at timestamptz` where appropriate. No `organization_id` anywhere.

**customers** — `id`, `name` (required), `company`, `email`, `phone`, `notes`, timestamps. Indexed for search on name/company/email/phone. Never auto-merge on fuzzy similarity.

**orders** — `id`, `customer_id` (nullable FK), `order_number` (unique, DB-generated), `job_name` (required), `phone`, `email`, `due_date`, `turnaround_type`, `payment_status`, `artwork_status`, `garment_status`, `production_status`, `priority`, `delivery_method`, `rush_fee` bool, `supplies_garments` bool, `graphic_design_services` bool, `specialised_application` bool, `specialised_application_details`, `notes`, `production_notes`, `staff_completed` bool, `order_state` (`Draft | Active`), `completed_at` nullable, `created_by` (FK auth.users), timestamps. Never rely on client-calculated IDs.

**order_garments** — `id`, `order_id` (FK, cascade), `garment_type_id` (nullable FK), `garment_type_label`, `garment_brand_id` (nullable FK), `garment_brand_label`, `colour`, `sizing_type`, `sort_order`, timestamps. One order → many garment lines.

**garment_quantities** — `id`, `order_garment_id` (FK, cascade), `size text`, `quantity int (>= 0)`, timestamps. One row per size, **not** one column per size — supports adult (S–5XL) and youth (2–18) sizing and future sizes without schema changes.

**garment_types** — `id`, `name`, `active bool default true`, `sort_order`, timestamps. Seed: T-shirt, Polo, Shirt, Hi-Viz vest, Singlet, Crew neck (jumper), Hoody, Shorts, Pants, Bennie, Hats, Customized.

**garment_brands** — same shape. Seed: AS colour, Gildan, Bocini, Sportage, Aussie pacific, Customized.

**services** — same shape. Seed: Screen Printing, Sublimation, Embroidery, Custom School, Direct To Film, Custom Sports, Direct To Garment, Vinyl/Digital Transfer.

**order_services** — `id`, `order_id` (FK, cascade), `service_id` (FK), `created_at`. Never store services as a serialized/comma field.

**artwork** — `id`, `order_id` (FK, cascade), `file_name`, `file_type`, `mime_type`, `file_size_bytes`, `storage_path`, `preview_storage_path` (nullable), `uploaded_by` (nullable FK), timestamps. Never store blob URLs, signed URLs, or base64 as canonical data — only `storage_path`.

**print_specs** — one unified entity covering print details *and* mockup config (do **not** split into `print_details` + `mockups`): `id`, `order_id` (FK, cascade), `artwork_id` (nullable FK), `position` (required — see §8 for the preserved list), `colour`, `width_mm`, `height_mm`, `garment_type` (nullable), `garment_colour` (nullable), `offset_x`/`offset_y` (nullable), `sort_order`, timestamps.

**order_activity** — `id`, `order_id` (FK, cascade), `user_id` (nullable FK), `activity_type`, `message`, `metadata jsonb` (nullable), `created_at`. Categories: created, priority, artwork, garments, production, mockup, payment. Log meaningful events only (order created; priority/payment/artwork/garment/production status changes; artwork uploaded/removed/replaced; due date changed; order completed) — never log every keystroke.

**business_settings** — single row: `id`, `business_name`, `business_email`, `business_phone`, `standard_turnaround_min_days`, `standard_turnaround_max_days`, `order_number_prefix default 'SP'`, timestamps.

**mockup_templates** — `id`, `garment_type_id` (nullable FK), `name`, `view`, `image_storage_path` (nullable), `active bool default true`, `sort_order`, timestamps. Create the table now; it's fine for the current local mockup image assets to keep being used in the UI for now — don't let this block the rest of Phase 2.

## 8. Preserved Vocabulary (do not collapse or rename)

| Concern | Values |
|---|---|
| Payment | Unpaid, Deposit Paid, Part Paid, Paid, On Account |
| Artwork | Not Started, Artwork To Do, Artwork Supplied, Need Artwork, Need Vectored, Mockup Required, Awaiting Approval, Approved, Completed |
| Garment | Not Required, Need Ordering, Ordered, Follow Up, Part Received, Supplied, Received, Completed |
| Production | New, Ready, Queued, In Production, Quality Check, Ready for Collection, Out for Delivery, Completed, On Hold |
| Priority | Normal, High, Urgent |
| Turnaround | Standard, Rush, Same Day, Custom |
| Delivery | Pick Up, Delivery |

Payment/Artwork/Garment/Production are **separate concerns** — never collapse into one generic status field.

Print positions come from `src/data/printPositions.ts` (Left Chest, Right Chest, Across Chest, Full Front, Left Sleeve, Right Sleeve, Full Back, Top Back, Bottom Back) — don't invent a second vocabulary. Print size presets come from `src/data/printSizes.ts` (A5, A6, A4, A3, Oversize) but the DB always stores resolved `width_mm`/`height_mm`.

## 9. Business Logic

- **Order numbers:** `SP-1001`, `SP-1002`, … generated **by the database** (sequence, counter table, or RPC) — concurrency-safe, never a frontend scan of existing orders.
- **Order quantity:** derived from `garment_quantities`, not a manually entered field. If a cached total is kept for perf, document exactly how it stays in sync with the underlying rows.
- **Turnaround:** Standard → normal business turnaround from `business_settings`; Rush → `rush_fee = true`; Same Day → due date defaults to today, priority defaults to Urgent; Custom → staff picks the due date manually. Priority can still be overridden manually after the automatic suggestion. Don't hard-code "7–10 days" anywhere — read it from `business_settings`.
- **Draft vs Active:** `order_state` distinguishes them. A draft survives refresh, is resumable, may be incomplete, must not look production-ready, and should have its own view/tab. Completing a draft **updates** the same row — never creates a duplicate.
- **Specialised application:** restore the Yes/No control (currently missing from the New Order form even though the domain model supports it) with a details field (e.g. Puff, Metallic) shown when Yes, and persist/round-trip it on edit.
- **Customer linking (currently broken — priority fix):** New Order's customer field must search existing customers by name/company/email/phone, let staff pick an existing one (setting `customer_id` and populating name/email/phone, which can then be edited per-order without mutating the customer master record) or create a new one (insert customer first, then use the real UUID on the order). Never generate fake customer IDs, never create a duplicate customer per order, never fuzzy-match/merge server-side.

## 10. Artwork & Storage

- Private bucket `artwork-originals`, path `orders/{orderId}/artwork/{artworkId}/{filename}`.
- Accepted: PNG, JPG, JPEG, WEBP, SVG, PDF, AI. Validate extension **and** MIME type where available **and** size, against one centralized size-limit config — never trust extension alone.
- Preview: PNG/JPG/JPEG/WEBP → signed-URL preview. SVG → handle safely. PDF → store original, preview if practical, never block order creation if preview generation fails. AI → store original + metadata, show "Preview unavailable" rather than attempting unreliable in-browser AI rendering.
- Never persist a signed URL — only `storage_path`; generate signed URLs on demand via centralized helpers.
- Preserve the existing `ArtworkUploader` UI/workflow; make it real (progress, success, failure, retry, remove, replace). Local object URLs for immediate preview are fine but must be revoked properly. Files must survive refresh.

## 11. Frontend Integration (preserve existing UI/structure)

- **New Order form** keeps its current section order: Customer/Job → Turnaround & Delivery → Services Required → Garment & Styles (Garments / Print Details & Mockups / Artwork & Files) → Payment Status → Internal Notes → Summary.
- **Order creation** replaces `buildOrderFromForm()` / `addOrder()` / `mockOrders.unshift()` with real inserts (customer resolve → order number → order → garments → quantities → services → artwork records → print specs → activity). Use a transactional approach (Postgres RPC, or a controlled multi-step create with cleanup/recovery, or draft-first-then-attach) — document whichever you choose. Never leave a partially-inconsistent order.
- **Order editing** at `/orders/:id/edit` reuses the New Order form architecture (no second parallel editing system). Covers customer, contact info, due date, turnaround, delivery, priority, services, garments/quantities, artwork, print specs, all four statuses, specialised application, notes, staff-completed. Meaningful changes get activity entries.
- **Order Detail** queries real data (order, customer, garments, quantities, services, artwork, print specs, activity) without N+1 queries, across all 7 existing tabs: Overview, Order Form, Garments, Artwork & Mockups, Production, Files, Activity.
- **Production Board** drops its local `mockOrders` copy entirely and becomes the one source of truth for status changes, flowing: user changes status → Supabase mutation → TanStack Query cache update/invalidation → Board, Order Detail, Orders List, and Dashboard all reflect it. Use optimistic updates with rollback on failure. Keep existing search/filters/tabs/sort/desktop-table/mobile-cards/quick-view-drawer. At minimum, real updates for Production, Artwork, Garment, and Payment status, and Priority.
- **Orders List / Customers List / Customer Detail / Dashboard**: replace mock arrays with real queries, keep existing UI (tabs, search, filters, sorting, responsive layouts). Dashboard keeps its existing metrics (Active Orders, Due Today, Urgent, Awaiting Artwork, Ready for Production, Completed This Week, Requiring Attention, Upcoming Deadlines, Recent Activity) computed from real data — don't over-build analytics beyond this.
- **Global Search** (currently decorative) becomes real: searches order number/job name/customer name/company/email/phone, debounced, grouped Orders/Customers results popover, click-through to `/orders/:id` or `/customers/:id`.
- **Settings**: Garments, Brands, Services become real CRUD (create/edit/enable-disable; soft-delete via `active=false`, never hard-delete anything referenced historically). Business Settings gets a real form for the fields in §7. Mockup Templates gets persistence plumbing without forcing an asset migration now.

## 12. Error, Loading, Empty States

Every network op handles loading/success/failure via the existing toast system — never swallow errors or show raw DB error text to staff (log details in dev). Use the existing `LoadingSkeleton` rather than flashing stale mock data while real data loads. Design real empty states for Dashboard, Production Board, Orders, Customers, Artwork, Activity, Services, Garment settings — don't assume seed data exists.

## 13. Mock Data & Seeding

Once a screen is integrated, remove its runtime dependency on mock arrays — don't run two sources of truth. Mock files may stick around as dev references/seed sources. Seed data lives separately from schema migrations and production never depends on it.

## 14. Dates

`date` for business concepts (`due_date`); `timestamptz` for `created_at`/`updated_at`/activity/uploads/`completed_at`. Centralize date helpers; be deliberate about not shifting a due date via UTC conversion.

## 15. Milestones

1. **Backend foundation** — Supabase client, env vars, TanStack Query, migrations, `profiles`, RLS, auth, login/logout, protected routes. Verify login, refresh-persistence, logout, unauth redirect before moving on.
2. **Catalogs + settings** — `garment_types`, `garment_brands`, `services`, `business_settings`, seeded.
3. **Customers** — real table, list, detail, create/edit, restored `CustomerSelector`. Verify select-existing, create-new, search.
4. **Order core** — `orders`, numbering, `order_garments`, `garment_quantities`, `order_services`, `print_specs`, `order_activity`. It's fine to get an order created without artwork working first. Verify refresh-survival + visibility on Orders/Board/Detail.
5. **Artwork storage** — bucket, `artwork` table, signed URLs, upload/remove/replace, preview states. Verify PNG/PDF/AI behavior.
6. **Full New Order flow** — every section wired end-to-end, including Create Order and Save Draft.
7. **Production Board** — real data + mutations replacing the mock-state hook; verify sync across Board/List/Detail/Dashboard/refresh.
8. **Order editing** — `/orders/:id/edit` functional, persists, generates activity.
9. **Dashboard + search** — real metrics, real activity, functional global search.
10. **Settings persistence** — Garments/Brands/Services/Business/Mockup metadata all real.
11. **Hardening** — RLS, auth, storage, validation, error/loading/empty states, mobile+desktop layouts, build, lint; fix regressions.

## 16. Acceptance Tests

These are largely manual/browser QA — plan to run them yourself after each relevant milestone, not just trust that the code compiles. Where a check is really about backend logic (order-number concurrency, mapping correctness, validation rules), write and run an automated test for it instead.

1. **Auth** — logged out `/production` redirects to login; login loads the app; refresh keeps the session; logout blocks protected routes again.
2. **Existing-customer order** — pick a customer, add a T-shirt (AS colour / Black, S=5 M=10 L=10 XL=5, total 30), a service, a due date; create; expect a real `SP-xxxx`, correct relations, board/detail visibility, refresh-survival.
3. **New customer** — create one inline from New Order; customer inserted exactly once; order references the real UUID; shows on Customer Detail.
4. **Multiple garments** — one order, T-shirt + Hoody, different sizes; both lines and correct totals persist and redisplay after refresh.
5. **Youth sizing** — sizes 2–18 persist, total, and render correctly.
6. **Artwork PNG** — stored in Storage, row created, signed preview works, survives refresh.
7. **Artwork AI** — stored safely, metadata persists, no crash, "Preview unavailable" shown if needed.
8. **Artwork PDF** — stored, metadata persists, preview handled gracefully either way.
9. **Print spec** — Left Chest / White / preset size / uploaded artwork / T-shirt preview / manually offset; save; reload; mockup reconstructs exactly.
10. **Production status** — Queued → In Production; reflected on Board, Detail, Orders List, after refresh, and in Activity.
11. **Artwork status** — Need Vectored → Completed; same persistence/visibility/activity expectations.
12. **Garment status** — Ordered → Received; same expectations.
13. **Payment status** — Unpaid → Deposit Paid → Paid persists with activity history; confirm no payment gateway/transaction/Stripe code exists anywhere.
14. **Edit order** — change due date, priority, a garment quantity, production notes; same row updates (no duplicate), visible everywhere, survives refresh.
15. **Draft** — start New Order, save partial as draft, refresh (still there), resume, complete → same order becomes Active, no duplicate.
16. **Custom turnaround** — pick Custom, set a manual due date, confirm it persists and displays consistently everywhere.
17. **Specialised application** — enable, enter "Puff", save; Order Detail shows it; Edit Order pre-populates it.
18. **Global search** — searching an order number and a customer name both return correct grouped results that navigate to the right detail route.
19. **Order-number concurrency** — create two orders back-to-back; both get unique sequential numbers, never a duplicate. (Good candidate for an automated test.)
20. **Security** — logged-out requests can't read orders/customers/artwork/production/settings; private artwork isn't retrievable without a valid signed URL.

## 17. Code Quality, Build, Docs

- Clear separation: UI / domain types / API-data-access / React Query hooks / DB mapping / validation / utils. No giant Supabase query blocks inside JSX-heavy pages. Avoid unnecessary `any`.
- Run `npm run build` and `npm run lint` at every milestone and before calling anything done — `npm run build` is the real TypeScript check for this repo, not a bare `tsc --noEmit` at the root.
- Search the codebase for the string `"arrives with backend integration."` and replace every one of those placeholder actions with real behavior, or explicitly disable/remove/document the ones staying out of scope — no button that looks functional but only fires a toast.
- On completion, write `docs/PHASE_2_HANDOVER.md` (overview; what shipped; stack; tables; relationships; migrations; auth; profiles/roles; RLS policies; storage buckets/policies; data-access architecture; TanStack Query hooks; create/draft/edit flows; artwork upload flow; PrintSpec persistence; order-number generation; board sync; settings persistence; env vars; local + Supabase setup; seed process; testing performed; known limitations; deferred features; recommended next phase) and update the README wherever setup instructions changed.

## 18. Definition of Done

Staff can log in → see a real dashboard → start a New Order → find-or-create a customer → add garments with per-size quantities → pick services → set turnaround/due date → upload artwork → build print specs and position artwork on the mockup → set payment status → add notes → create the order and get a real `SP-xxxx` → see it on the Production Board → update Artwork/Garment/Payment/Production status with every screen reflecting it immediately → open Order Detail and see the full spec → edit the order with changes persisting and activity recorded → have artwork and the order both survive a refresh and a logout/login cycle → and unauthenticated users can reach none of this. One persistent source of truth for the whole order workflow, on top of the existing Phase 1 UI.

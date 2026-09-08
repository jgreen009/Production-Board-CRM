# SALT PRINTS — Phase 2 Backend Plan

Implementation plan for `docs/PHASE_2_SPEC.md`. This is the deliverable required by spec §2 before any application code changes — **for review, not yet approved for implementation.**

Environment: **existing hosted Supabase project** (confirmed with the user — not a local CLI stack), project ref `pphzbtqfttfkaphmwutr` ("Brand Fanatix", `eu-west-1`, Postgres 17.6). `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are in `.env.local` (gitignored; `.env.example` documents the empty shape). Migration delivery: **CLI linked to the project** (§2) — the user ran `supabase login` / `supabase link` themselves in their own terminal, so no access token or DB password ever passed through this session; verified working via `supabase migration list --linked`. The Supabase MCP is also connected to the same project, for read-only inspection (`list_tables`, `get_advisors`, logs) alongside the CLI.

---

## 1. Current frontend architecture (condensed — full detail in `docs/HANDOVER.md`)

React 19 + TS + Vite, React Router v7 flat routes under one `AppShell`, React Hook Form + Zod for the New Order form only. All data today is either a module-level mock array (`src/data/mock*.ts`) mutated in place, or local component/hook state (`useProductionBoard`). No network calls exist anywhere. Three concrete gaps this phase must fix, already flagged in `HANDOVER.md`:

1. **Customer linking is dead** — `CustomerSelector.tsx` exists, isn't imported anywhere; the New Order form's Name field always sets `customerId: null`.
2. **Production Board doesn't share state with the rest of the app** — `useProductionBoard` copies `mockOrders` into its own `useState`; status changes there are invisible on Order Detail/Orders List.
3. **Order Detail is fully read-only** — "Edit Order" / "More actions" are toast stubs; several buttons (Files tab View/Download) have no handler at all, not even a stub.

Everything in this plan is written against the codebase as of commit `b704403` (the "Garment & Styles" merge / unified `PrintSpec` work) and `ae84caa` (this spec's own addition).

## 2. Supabase architecture

```
src/lib/supabase.ts        # single createClient() call — nowhere else calls it
.env.example                # VITE_SUPABASE_URL=, VITE_SUPABASE_ANON_KEY= (empty)
.env.local                   # real values, gitignored (add to .gitignore if not already)
```

`src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing Supabase env vars — check .env.local against .env.example')
}

export const supabase = createClient(url, anonKey)
```

**Resolved:** CLI linked (`supabase/config.toml` + `supabase/.temp/project-ref` already scaffolded via `supabase init`). Each migration is a versioned file under `supabase/migrations/`, applied with `supabase db push --linked` — no raw DB password needed per-push, only at the one-time `link` step the user ran themselves.

## 3. Database schema

Full DDL, in migration order. Every table gets RLS enabled (policies in §6) and an `updated_at` auto-touch trigger via one shared function:

```sql
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- customer search

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

### profiles
```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('owner','admin','staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- auto-create a profile row for every new auth user
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```
New users default to `staff`. The first real user needs manually promoting to `owner` via one SQL statement after they sign up — there's no in-app "become owner" flow, deliberately (see §5).

### customers
```sql
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_name_trgm on customers using gin (name gin_trgm_ops);
create index customers_company_trgm on customers using gin (company gin_trgm_ops);
create index customers_email_trgm on customers using gin (email gin_trgm_ops);
create index customers_phone_trgm on customers using gin (phone gin_trgm_ops);
create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();
```
Trigram indexes (not full-text) because the UI does partial substring typeahead ("kel" matching "Kelston"), not whole-word search.

### garment_types / garment_brands / services (identical shape)
```sql
create table garment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger garment_types_updated_at before update on garment_types
  for each row execute function set_updated_at();
-- repeat verbatim for garment_brands, services
```
Seed (separate seed script, not a migration — see §10):
- `garment_types`: T-shirt, Polo, Shirt, Hi-Viz vest, Singlet, Crew neck (jumper), Hoody, Shorts, Pants, Bennie, Hats, Customized
- `garment_brands`: AS colour, Gildan, Bocini, Sportage, Aussie pacific, Customized
- `services`: Screen Printing, Sublimation, Embroidery, Custom School, Direct To Film, Custom Sports, Direct To Garment, Vinyl/Digital Transfer

### business_settings (singleton)
```sql
create table business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'SALT PRINTS',
  business_email text,
  business_phone text,
  standard_turnaround_min_days int not null default 7,
  standard_turnaround_max_days int not null default 10,
  order_number_prefix text not null default 'SP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index business_settings_singleton on business_settings ((true));
create trigger business_settings_updated_at before update on business_settings
  for each row execute function set_updated_at();
```
The `((true))` unique index is the standard Postgres singleton-table trick — a second insert will fail, so there's exactly one row, ever.

### orders + order number generation
Status/enum-like columns are `text` + `check`, not Postgres `enum` types — easier to extend later (no `ALTER TYPE` migration dance) and maps 1:1 to the existing TS string-literal unions without enum introspection.
```sql
create sequence order_number_seq start 1001;

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  order_number text unique,                       -- set by trigger below, never by the client
  job_name text not null,
  phone text,
  email text,
  due_date date,
  turnaround_type text not null default 'Standard'
    check (turnaround_type in ('Standard','Rush','Same Day','Custom')),
  payment_status text not null default 'Unpaid'
    check (payment_status in ('Unpaid','Deposit Paid','Part Paid','Paid','On Account')),
  artwork_status text not null default 'Not Started'
    check (artwork_status in ('Not Started','Artwork To Do','Artwork Supplied','Need Artwork',
      'Need Vectored','Mockup Required','Awaiting Approval','Approved','Completed')),
  garment_status text not null default 'Not Required'
    check (garment_status in ('Not Required','Need Ordering','Ordered','Follow Up',
      'Part Received','Supplied','Received','Completed')),
  production_status text not null default 'New'
    check (production_status in ('New','Ready','Queued','In Production','Quality Check',
      'Ready for Collection','Out for Delivery','Completed','On Hold')),
  priority text not null default 'Normal' check (priority in ('Normal','High','Urgent')),
  delivery_method text not null default 'Pick Up' check (delivery_method in ('Pick Up','Delivery')),
  rush_fee boolean not null default false,
  supplies_garments boolean not null default false,
  graphic_design_services boolean not null default false,
  specialised_application boolean not null default false,
  specialised_application_details text,
  notes text,
  production_notes text,
  staff_completed boolean not null default false,
  order_state text not null default 'Draft' check (order_state in ('Draft','Active')),
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_id_idx on orders(customer_id);
create index orders_due_date_idx on orders(due_date);
create index orders_production_status_idx on orders(production_status);
create index orders_order_state_idx on orders(order_state);
create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

create or replace function set_order_number()
returns trigger language plpgsql as $$
declare
  prefix text;
begin
  if new.order_number is null then
    select order_number_prefix into prefix from business_settings limit 1;
    new.order_number := coalesce(prefix, 'SP') || '-' || nextval('order_number_seq');
  end if;
  return new;
end;
$$;
create trigger orders_set_order_number before insert on orders
  for each row execute function set_order_number();
```
A sequence is non-locking and guaranteed unique under concurrent inserts (Postgres's standard answer to exactly this problem) — gaps on rollback are possible and acceptable; duplicates are not possible. This is what acceptance test #19 needs to hold, and it's testable without touching frontend code at all (see §21).

`completed_at` is set when `production_status` transitions to `'Completed'` (a small trigger, added in the milestone that wires production-status updates) — it is **not** related to draft→active finalization, which is a separate concept (`order_state`).

### order_garments + garment_quantities
```sql
create table order_garments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  garment_type_id uuid references garment_types(id),
  garment_type_label text not null,
  garment_brand_id uuid references garment_brands(id),
  garment_brand_label text not null,
  colour text not null,
  sizing_type text not null check (sizing_type in ('Adult','Youth')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_garments_order_id_idx on order_garments(order_id);
create trigger order_garments_updated_at before update on order_garments
  for each row execute function set_updated_at();

create table garment_quantities (
  id uuid primary key default gen_random_uuid(),
  order_garment_id uuid not null references order_garments(id) on delete cascade,
  size text not null,
  quantity int not null check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_garment_id, size)
);
create index garment_quantities_order_garment_id_idx on garment_quantities(order_garment_id);
create trigger garment_quantities_updated_at before update on garment_quantities
  for each row execute function set_updated_at();
```
`garment_type_label`/`garment_brand_label` are denormalized copies of the catalog name at the time the line was created — so an order keeps reading correctly even if a catalog entry is later renamed or soft-deleted. One row per size (not one column per size) is what makes adult (S–5XL) and youth (2–18) sizing — and any future size — free, per spec §7. `unique(order_garment_id, size)` prevents duplicate size rows per line (my addition, not explicitly in the spec, but a correctness constraint worth having).

### order_services
```sql
create table order_services (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  service_id uuid not null references services(id),
  created_at timestamptz not null default now(),
  unique (order_id, service_id)
);
create index order_services_order_id_idx on order_services(order_id);
```

### artwork
```sql
create table artwork (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  file_name text not null,
  file_type text not null check (file_type in ('PNG','JPG','WEBP','SVG','PDF','AI')),
  mime_type text,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  storage_path text not null,
  preview_storage_path text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index artwork_order_id_idx on artwork(order_id);
create trigger artwork_updated_at before update on artwork
  for each row execute function set_updated_at();
```

### print_specs (one unified table — never split)
```sql
create table print_specs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  artwork_id uuid references artwork(id) on delete set null,
  position text not null check (position in
    ('Left Chest','Right Chest','Across Chest','Full Front','Left Sleeve','Right Sleeve',
     'Full Back','Top Back','Bottom Back')),
  colour text not null,
  width_mm numeric not null check (width_mm > 0),
  height_mm numeric not null check (height_mm > 0),
  garment_type text,       -- preview hint only, not an FK — "any catalog type" per the UI
  garment_colour text,
  offset_x numeric,
  offset_y numeric,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index print_specs_order_id_idx on print_specs(order_id);
create trigger print_specs_updated_at before update on print_specs
  for each row execute function set_updated_at();
```
The `position` check list is copy-pasted verbatim from `src/data/printPositions.ts`'s `PRINT_POSITIONS` — that file stays the single frontend source of truth for labels/coordinates/max-print-area, this constraint is just the DB-side mirror of the same 9 values.

### order_activity (append-only)
```sql
create table order_activity (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  user_id uuid references auth.users(id),
  activity_type text not null check (activity_type in
    ('created','priority','artwork','garments','production','mockup','payment')),
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index order_activity_order_id_idx on order_activity(order_id, created_at desc);
```
Nothing ever updates or deletes a row here — only inserts, from application code when a meaningful event happens (see §12 for exactly which events).

### mockup_templates
```sql
create table mockup_templates (
  id uuid primary key default gen_random_uuid(),
  garment_type_id uuid references garment_types(id),
  name text not null,
  view text not null check (view in ('Front','Back')),
  image_storage_path text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger mockup_templates_updated_at before update on mockup_templates
  for each row execute function set_updated_at();
```
Table exists and gets a settings CRUD surface (Milestone 10), but per spec §7 the current local image assets in `src/assets/mockups/` keep being used in the UI for now — no asset migration forced this phase.

## 4. Relationships

```
customers 1───* orders *───1 (nullable) — orders.customer_id
orders 1───* order_garments 1───* garment_quantities
orders 1───* order_services *───1 services
orders 1───* artwork
orders 1───* print_specs *───0..1 artwork   (print_specs.artwork_id, on delete set null)
orders 1───* order_activity
garment_types ───0..* order_garments (nullable FK; label denormalized)
garment_brands ───0..* order_garments (nullable FK; label denormalized)
garment_types ───0..* mockup_templates (nullable FK)
business_settings — singleton, read by the order_number trigger and the Turnaround business
  logic; not FK-related to orders
```

## 5. Auth model

- Supabase Auth, email/password (simplest fit for "internal staff tool"; magic-link/OAuth can be added later without a schema change).
- **No public sign-up screen.** Accounts are created by inviting a user from the Supabase Dashboard (Auth → Users → Invite), which fires `handle_new_user()` and gives them a `staff` profile automatically. The very first `owner` account is promoted with one manual SQL statement (`update profiles set role = 'owner' where id = '<uuid>'`) — there's no in-app "make me owner" button, deliberately, since that would be a privilege-escalation hole.
- New route `/login` (outside `AppShell`, its own minimal layout) — email+password form, calls `supabase.auth.signInWithPassword`.
- `useSession()` hook: wraps `supabase.auth.getSession()` on mount + subscribes to `supabase.auth.onAuthStateChange`, exposes `{ session, loading }`.
- `useProfile()` hook: `useQuery(['profile', session.user.id], ...)` once a session exists, fetches the matching `profiles` row (for role-gating owner/admin-only UI, e.g. Settings write actions).
- `<RequireAuth>` wrapper component around the existing `<AppShell>` route in `App.tsx` — if `!session` (and not still loading), redirect to `/login`; this covers every route currently nested under `AppShell` in one place, matching spec §6's protected-route list exactly since that list *is* every existing `AppShell` route plus the new `/orders/:id/edit`.
- Logout: a real handler wired to the existing sidebar/header (need to check exactly where the current placeholder "User/Profile" UI lives and give it a working sign-out action + display the logged-in user's name via `useProfile`).

## 6. RLS strategy

Enabled on every table, no exceptions. Pattern: **`authenticated` role gets full read/write on operational tables** (this is a single shared company dataset, not per-user-owned data, so there's no per-row ownership filter beyond "must be logged in"); **catalogs and business settings are read-open to `authenticated`, write-restricted to `owner`/`admin`**; **no DELETE policy anywhere** (RLS defaults to deny when no policy exists for an action — I'm treating "no delete in the UI today" as "no delete at the DB layer either," soft-delete via `active=false` for catalogs, full stop for orders/customers/artwork). `anon` gets zero policies on every table — an unauthenticated request reads nothing, matching acceptance test #20 directly.

Helper function to avoid repeating the role check:
```sql
create or replace function is_admin_or_owner()
returns boolean language sql stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('owner','admin'));
$$;
```

Example — operational table (repeat this shape for `customers`, `orders`, `order_garments`, `garment_quantities`, `order_services`, `artwork`, `print_specs`):
```sql
alter table orders enable row level security;

create policy "staff can read orders" on orders
  for select to authenticated using (true);
create policy "staff can insert orders" on orders
  for insert to authenticated with check (true);
create policy "staff can update orders" on orders
  for update to authenticated using (true) with check (true);
```

Example — catalog table (repeat for `garment_types`, `garment_brands`, `services`, `business_settings`, `mockup_templates`):
```sql
alter table garment_types enable row level security;

create policy "staff can read garment_types" on garment_types
  for select to authenticated using (true);
create policy "admin/owner can insert garment_types" on garment_types
  for insert to authenticated with check (is_admin_or_owner());
create policy "admin/owner can update garment_types" on garment_types
  for update to authenticated using (is_admin_or_owner()) with check (is_admin_or_owner());
```

`order_activity`: `authenticated` can `select` and `insert` (never `update`/`delete` — no policy for those, so RLS blocks them even for admins, preserving the append-only guarantee at the DB level, not just by application convention).

`profiles`: a user can `select`/`update` their own row (`using (id = auth.uid())`); `owner`/`admin` can additionally `select` every row (needed for a future "manage staff" screen, out of scope to build this phase but the policy costs nothing to add now).

## 7. Storage strategy

- Private bucket `artwork-originals` (not public — every read goes through a signed URL).
- Path: `orders/{orderId}/artwork/{artworkId}/{filename}` exactly as spec §10 specifies.
- Storage RLS (on `storage.objects`, filtered `bucket_id = 'artwork-originals'`): `authenticated` can `select`/`insert`/`update`/`delete` — same "shared company dataset" reasoning as the DB tables.
- Upload order (deliberate choice): **insert the `artwork` row first** (with the id and computed `storage_path` already known — `id` generated client-side via `crypto.randomUUID()`), **then** upload the file to Storage. If the upload fails, delete the just-inserted row. This makes the only possible inconsistent state "a row with no file," which is trivially detectable (try to fetch a signed URL, get 404, show "Preview unavailable" / offer retry) — the alternative order risks orphaned storage objects with no row pointing at them, which are invisible to the app and pile up silently.
- Preview strategy by type:
  - PNG/JPG/JPEG/WEBP: signed URL directly, rendered via `<img>`.
  - SVG: signed URL via `<img>` **only** — never `<object>`, `<iframe>`, or `dangerouslySetInnerHTML`. Loading an SVG through `<img>` rasterizes it without executing any embedded `<script>`, which matters because these files come from customers, not staff.
  - PDF: store original, no thumbnail generation this phase (no server-side rendering pipeline) — same "Preview unavailable" file card the UI already has for non-previewable types.
  - AI: store original + metadata only, always "Preview unavailable" — matches current `ArtworkFileCard` behavior exactly, just backed by a real file now.
- Never persist a signed URL anywhere (not in the DB, not in a long-lived client cache) — only `storage_path` is canonical; `getArtworkSignedUrl(storagePath)` in `src/api/artwork.ts` generates one on demand, short expiry (1 hour is plenty for a preview render).
- Validation, centralized in one place (`src/utils/artworkValidation.ts`) and checked client-side before any upload attempt: extension **and** MIME type (where the browser provides one — not all do for `.ai`) **and** size. Proposed limit: **25 MB per file** — flag if you want this different.
- Local preview during upload: keep the current `URL.createObjectURL()` immediate-preview behavior for the in-progress upload (nice UX, zero cost), but revoke it (`URL.revokeObjectURL`) once the real signed URL is available or the component unmounts — the current code never revokes, which is a small leak worth fixing while touching this.

## 8. Data-access architecture

```
src/lib/supabase.ts                 # client singleton (§2)
src/lib/queryClient.ts              # TanStack QueryClient instance + defaults
src/api/
  auth.ts                           # signIn, signOut, getSession
  customers.ts                      # list/search/get/create/update
  orders.ts                         # list/get/create-or-update (upsert_order RPC wrapper)/
                                     # status mutations/activity
  artwork.ts                        # upload/remove/replace/getSignedUrl
  settings.ts                       # catalogs + business_settings CRUD
  dashboard.ts                      # metrics queries
  search.ts                         # global search across orders+customers
src/api/mappers/
  order.ts    mapDatabaseOrderToDomain, mapOrderFormToUpsertPayload
  garment.ts  mapGarmentRowsToDomain (joins order_garments + garment_quantities → GarmentItem[])
  printSpec.ts mapPrintSpecRowToDomain / mapPrintSpecFormToRow
  artwork.ts  mapArtworkRowToDomain
  customer.ts mapCustomerRowToDomain
```
Rule enforced throughout: **no file under `src/pages/` or `src/components/` ever imports `src/lib/supabase.ts` directly.** Everything goes through `src/api/*`, and everything crossing that boundary is already in domain shape (camelCase, `Order`/`Customer`/`PrintSpec` types from `src/types/index.ts`) by the time a component sees it. This is what makes the mapping functions unit-testable in isolation (§21) and is the literal ask in spec §5.

## 9. TanStack Query architecture

`src/main.tsx` gets one `QueryClientProvider` wrapping `<App />`, default `staleTime` short (e.g. 30s) since this is a small internal team where freshness matters more than request-shaving.

Query keys, hierarchical so targeted invalidation is possible:
```
['session']
['profile', userId]
['orders']                    # list (Production Board, Orders List both read this)
['orders', orderId]           # detail
['orders', 'draft', orderId]  # a draft, if we end up wanting to separate its cache entry — TBD, see open question below
['customers']
['customers', 'search', query]
['customers', customerId]
['catalog', 'garment-types']
['catalog', 'garment-brands']
['catalog', 'services']
['settings', 'business']
['artwork', orderId]
['dashboard']
['search', query]
```
Every hook named in spec §5 (`useOrders`, `useOrder`, `useCreateOrder`, `useUpdateOrder`, `useSaveDraft`, etc.) is a thin wrapper: `useQuery`/`useMutation` + one `src/api/*` call + the matching mapper. `useUpdateProductionStatus` (and the equivalent Artwork/Garment/Payment/Priority mutations) use `onMutate` to optimistically patch the `['orders']` and `['orders', id]` cache entries, `onError` to roll back to the previous cache snapshot, `onSettled` to invalidate `['orders']`, `['orders', id]`, and `['dashboard']` — this is what makes Production Board / Order Detail / Orders List / Dashboard agree with each other immediately, which is the exact failure mode `HANDOVER.md` flagged in the current code.

## 10. Mock data & seeding

- `src/data/mockGarments.ts` (types/brands) and `mockServices.ts` become the **source content** for a one-time seed script (`supabase/seed.sql` or a small Node script using the service-role key, run manually — not part of the app's runtime, not part of CI). The mock files themselves stay in the repo as dev reference per spec §13; nothing imports them at runtime once a screen's milestone lands.
- `mockOrders.ts` / `mockCustomers.ts` (the 14 demo orders / 9 demo customers) are **not** migrated verbatim into the real schema — they're presentation fixtures (e.g. dates computed relative to "today"), not real business records. Instead: an optional, clearly-labeled dev-seed script inserts a small handful of representative orders (one overdue, one same-day, one completed, etc.) into whichever Supabase project is being used for development, purely so the UI isn't staring at empty states while building — the app must still render correctly with **zero** seed data (spec §12), and production must never depend on this script having been run.
- Once a screen's milestone lands, its runtime import of the corresponding mock array is deleted in the same commit — not deferred, not left as dead code "just in case."

## 11. Customer-linking strategy

Fixes the gap flagged in `HANDOVER.md` §8.2. `CustomerSelector.tsx` is kept almost as-is visually, but its data source changes: today it does `mockCustomers.find/filter` directly inside the component; it needs to instead take `results: Customer[]` + `loading: boolean` as props, driven by a new `useCustomerSearch(query)` hook (debounced ~250ms, calls `searchCustomers(query)` in `src/api/customers.ts`, which does an `ilike`/trigram query across `name, company, email, phone`).

- **Select existing**: sets `customerId` on the form, pre-fills `phone`/`email` from the selected `Customer` — those pre-filled values are then just normal editable form fields (per spec §9: "can then be edited per-order without mutating the customer master record"); saving the order never writes back to the `customers` row.
- **Create new**: `useCreateCustomer` mutation inserts into `customers` first, returns the real UUID, *then* that UUID is what gets used as `orders.customer_id` — never a client-generated fake ID (`generateId('cust')` in current `buildOrder.ts` goes away entirely).
- **Never** fuzzy-match or auto-merge — an exact duplicate name creating a second customer row is an accepted outcome per spec §9, not a bug to solve this phase.

## 12. Order create / draft / edit flow

**Chosen transactional approach: draft-first, single upsert RPC, whole-child-set replace.** Reasoning below, then the concrete shape.

The spec requires drafts to be first-class (survive refresh, resumable, same row on completion) *and* requires edit to reuse the New Order form architecture. Building a separate "one-shot transactional create" path and a separate "draft save" path would mean two ways to write an order — exactly what spec §11 says not to do. Instead there is **one** RPC, called by Save Draft, Create Order, and Edit Order alike:

```sql
create or replace function upsert_order(payload jsonb, p_order_id uuid default null, p_finalize boolean default false)
returns uuid
language plpgsql
security definer
as $$
declare
  v_order_id uuid;
begin
  if p_order_id is null then
    insert into orders (job_name, customer_id, phone, email, due_date, turnaround_type,
      delivery_method, priority, rush_fee, supplies_garments, graphic_design_services,
      specialised_application, specialised_application_details, notes, production_notes,
      payment_status, staff_completed, order_state, created_by)
    select
      payload->>'jobName', nullif(payload->>'customerId','')::uuid, payload->>'phone',
      payload->>'email', nullif(payload->>'dueDate','')::date, payload->>'turnaroundType',
      payload->>'deliveryMethod', payload->>'priority', (payload->>'rushFee')::boolean,
      (payload->>'suppliesGarments')::boolean, (payload->>'graphicDesignServices')::boolean,
      (payload->>'specialisedApplication')::boolean, payload->>'specialisedApplicationDetails',
      payload->>'notes', payload->>'productionNotes', payload->>'paymentStatus',
      (payload->>'staffCompleted')::boolean,
      case when p_finalize then 'Active' else 'Draft' end, auth.uid()
    returning id into v_order_id;

    insert into order_activity (order_id, user_id, activity_type, message)
    values (v_order_id, auth.uid(), 'created', 'Order created');
  else
    v_order_id := p_order_id;
    update orders set
      job_name = payload->>'jobName', customer_id = nullif(payload->>'customerId','')::uuid,
      phone = payload->>'phone', email = payload->>'email',
      due_date = nullif(payload->>'dueDate','')::date, turnaround_type = payload->>'turnaroundType',
      delivery_method = payload->>'deliveryMethod', priority = payload->>'priority',
      rush_fee = (payload->>'rushFee')::boolean,
      supplies_garments = (payload->>'suppliesGarments')::boolean,
      graphic_design_services = (payload->>'graphicDesignServices')::boolean,
      specialised_application = (payload->>'specialisedApplication')::boolean,
      specialised_application_details = payload->>'specialisedApplicationDetails',
      notes = payload->>'notes', production_notes = payload->>'productionNotes',
      payment_status = payload->>'paymentStatus', staff_completed = (payload->>'staffCompleted')::boolean,
      order_state = case when p_finalize then 'Active' else order_state end
    where id = v_order_id;
  end if;

  -- whole-child-set replace: the form always holds its full current state,
  -- so delete-then-reinsert is correct and simple, not a diff/patch
  delete from order_garments where order_id = v_order_id;   -- cascades garment_quantities
  delete from order_services where order_id = v_order_id;
  delete from print_specs where order_id = v_order_id;       -- artwork rows untouched

  -- garments + quantities
  insert into order_garments (order_id, garment_type_label, garment_brand_label, colour, sizing_type, sort_order)
  select v_order_id, g->>'type', g->>'brand', g->>'colour', g->>'sizing', ordinality - 1
  from jsonb_array_elements(payload->'garments') with ordinality as g;
  -- (a second statement inserts garment_quantities per garment from the same jsonb — omitted here for brevity,
  --  joins back to the just-inserted order_garments by matching sort_order)

  insert into order_services (order_id, service_id)
  select v_order_id, s.id from jsonb_array_elements_text(payload->'services') svc
  join services s on s.name = svc;

  insert into print_specs (order_id, artwork_id, position, colour, width_mm, height_mm,
    garment_type, garment_colour, offset_x, offset_y, sort_order)
  select v_order_id, nullif(p->>'artworkId','')::uuid, p->>'position', p->>'colour',
    (p->>'widthMm')::numeric, (p->>'heightMm')::numeric, p->>'garmentType', p->>'garmentColour',
    (p->>'offsetX')::numeric, (p->>'offsetY')::numeric, ordinality - 1
  from jsonb_array_elements(payload->'printSpecs') with ordinality as p;

  return v_order_id;
end;
$$;
```
(This is the shape, not a copy-paste-ready final file — the garment_quantities insert and a couple of jsonb null-handling edge cases still need writing out in full during Milestone 4; shown abbreviated here so the *approach* is reviewable without 200 lines of SQL.)

Client-side flow:
1. Fresh `/orders/new`: no order id yet, pure RHF state, exactly like today.
2. First "Save Draft" *or* first time the Artwork uploader needs somewhere to attach a file *or* "Create Order": call `upsertOrder(formValues, existingOrderId, finalize)` — `existingOrderId` is `undefined` the very first time, so this inserts; every call after that passes the id it got back, so it updates the same row. `finalize` is `false` for Save Draft, `true` for Create Order.
3. The returned id is kept in the form's local state (and reflected in the URL as `/orders/new?draft=<id>` so a refresh mid-draft can rehydrate — `useOrder(id)` fetch on mount when that query param is present).
4. `/orders/:id/edit` is the **same form component**, mounted with `existingOrderId` already set from the route param and `finalize` always `true` — no second editing system, per spec §11.
5. Edit-specific activity logging: before calling the RPC, diff the incoming payload against the currently-cached order (`useOrder(id)`'s data) for the fields that map to `order_activity` categories (priority, the four statuses, due date) and insert one activity row per meaningfully-changed field — this diff happens in `src/api/orders.ts`, not inside the SQL function, so it's plain, testable TypeScript (§21).

Artwork is deliberately **outside** this RPC (Storage calls can't participate in a SQL transaction) — see §7 for its own upload/remove flow, which only requires `order_id` to already exist. Because artwork rows persist independently of the whole-child-set-replace above, and `print_specs.artwork_id` is just a value in the payload, re-running `upsert_order` after an artwork upload is safe and doesn't touch the `artwork` table at all.

**Resolved:** auto-create on first meaningful input — `jobName` becoming non-empty, or an artwork upload being attempted before that (whichever happens first) — then autosave silently in the background from that point on. The row stays `order_state = 'Draft'` and is not surfaced anywhere as an active production order (Production Board, dashboards, Orders List's default view all filter `order_state = 'Active'`) until the user explicitly clicks Create Order, which sets `p_finalize := true`.

## 13. Production Board sync

`useProductionBoard.ts`'s existing filter/search/sort/view-tab logic is **pure and correct** — it stays exactly as-is. Only its data source changes: `useState<Order[]>(mockOrders)` becomes `const { data: orders = [] } = useOrders()`, and `updateProductionStatus` becomes `useUpdateProductionStatus().mutate(...)` (optimistic, per §9) instead of a local `setOrders` call. This is the minimum-touch fix for the exact inconsistency `HANDOVER.md` §8.5 flagged.

## 14. Settings persistence

`garment_types`/`garment_brands`/`services`: `useGarmentTypes()` etc. (list, includes inactive so staff can re-enable), `useCreateGarmentType`, `useUpdateGarmentType` (name and/or `active` toggle — toggling `active=false` **is** the delete action, nothing is ever hard-deleted). `business_settings`: `useBusinessSettings()` (always exactly one row) + `useUpdateBusinessSettings()`. `mockup_templates`: same CRUD shape, `image_storage_path` left null/unused until a later phase actually migrates the image assets.

## 15. Dates

- `due_date`: Postgres `date`, frontend keeps sending/receiving plain `'YYYY-MM-DD'` strings exactly as the current `<input type="date">` already does — zero timezone conversion anywhere in that path, which is what avoids the "shifted by a day" bug class.
- `created_at` / `updated_at` / `order_activity.created_at` / `artwork` timestamps / `completed_at`: `timestamptz`, ISO strings round-trip through `supabase-js` untouched; existing `src/utils/date.ts` formatters (`formatDate`, `formatDateShort`, `daysUntil`, etc.) already just do `new Date(iso)` and need no changes.
- `"Standard turnaround 7–10 business days"` currently hard-coded in `TurnaroundDeliverySection.tsx`'s description text — becomes a read from `useBusinessSettings()` (`standard_turnaround_min_days`/`max_days`) per spec §9.

## 16. Error, loading, empty states

Every mutation's `onError` shows a toast via the existing `useToast()` — generic staff-facing message ("Couldn't save the order — try again"), full error `console.error`'d for dev debugging, never the raw Postgres/PostgREST error text shown to a user. Every list/detail query's loading state renders the existing `LoadingSkeleton` component instead of the old pattern of just rendering whatever mock data happened to be in scope. Every screen gets a real empty state via the existing `EmptyState` component once seed data isn't guaranteed present — Dashboard, Production Board, Orders List, Customers List, Order Detail's Artwork/Activity tabs, Settings catalogs all need a specific empty-state message (not a generic "No data").

## 17. Testing strategy

No test runner exists in this repo yet (`package.json` has none). Adding **Vitest** — pairs directly with the existing Vite config, near-zero setup, fast enough to run after every milestone as the spec asks.

What gets an actual automated test, per the spec's own instruction to verify rather than assume:
- **Mapping functions** (`src/api/mappers/*`): pure functions, DB row shape in → domain type out and back. Straightforward unit tests, no network needed — e.g. `mapDatabaseOrderToDomain` given a realistic row + child arrays produces exactly the `Order` shape components expect; `mapOrderFormToUpsertPayload` given `OrderFormValues` produces the exact jsonb shape the RPC expects.
- **Validation rules**: Zod schema edge cases (e.g. a print spec missing a position, a garment with all-zero quantities) and the new artwork file validation (extension/MIME/size boundary cases).
- **Order-number concurrency** (acceptance test #19) is fundamentally a *database* guarantee, not frontend logic, so it can't be a pure Vitest unit test — it needs a real Postgres connection. Since we're on a hosted project rather than local CLI, this becomes a standalone script (`scripts/verify-order-number-concurrency.ts`, not part of `npm run build`/lint/CI) that fires N concurrent `upsert_order` RPC calls against the actual dev project and asserts every returned `order_number` is unique. I'll run this manually once the RPC exists (end of Milestone 4) and show you the output — flagging now that this is a different mechanism from the mapping-function unit tests, for exactly the reason above.

Everything else in spec §16 (the 20 acceptance tests) is genuinely UI/browser QA — I'll tell you specifically which ones apply after each milestone, as you asked, rather than claim they pass myself.

## 18. Milestones (spec §15, unchanged — this is the execution checklist)

| # | Milestone | Primary new/changed files | Acceptance tests to click through |
|---|---|---|---|
| 1 | Backend foundation | `src/lib/supabase.ts`, `.env.example`, migrations for `profiles` + trigger, RLS scaffold, `/login`, `RequireAuth`, `queryClient.ts` | #1 |
| 2 | Catalogs + settings tables | migrations + seed for `garment_types`/`garment_brands`/`services`/`business_settings` | — (no UI yet, verify via SQL editor / a quick script) |
| 3 | Customers | `customers` table, `src/api/customers.ts`, restored `CustomerSelector` wiring, Customers List/Detail on real data | select-existing / create-new / search portions of #2, #3 |
| 4 | Order core | `orders` + children tables, `upsert_order` RPC, `src/api/orders.ts`, order-number trigger | #2 (minus artwork), #4, #5, #19 |
| 5 | Artwork storage | bucket + policies, `artwork` table, `src/api/artwork.ts`, real `ArtworkUploader` | #6, #7, #8 |
| 6 | Full New Order flow | wire every section to real mutations, Save Draft + Create Order both real | #2 (full), #9 |
| 7 | Production Board | `useProductionBoard` on real data, optimistic status mutations | #10, #11, #12, #13 |
| 8 | Order editing | `/orders/:id/edit` route + reused form | #14, #16, #17 |
| 9 | Dashboard + search | real metrics, real global search | #18 |
| 10 | Settings persistence | catalogs + business settings CRUD screens | (manual CRUD click-through, no numbered test) |
| 11 | Hardening | RLS audit, error/loading/empty states everywhere, drafts view/tab (§12), regression pass | #15, #20, full re-run of #1–19 |

Per your instruction: after each milestone I run `npm run build && npm run lint`, fix anything I broke, commit that milestone alone, and stop for your review before starting the next one.

## 19. Still needed from you before Milestone 1 starts

1. ~~Real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`~~ — done, in `.env.local`.
2. ~~Migration delivery method~~ — done, CLI linked (§2).
3. ~~Sign-off on this plan~~ — done. All three called-out decisions confirmed as written: auto-create the draft on first meaningful input (§12), 25MB artwork limit (§7), email/password invite-only auth (§5).

**Plan approved — starting Milestone 1.**

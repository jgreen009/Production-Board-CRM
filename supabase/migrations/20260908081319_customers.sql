-- Milestone 3: customers table. Trigram indexes (not full-text) because the
-- UI does partial substring typeahead ("kel" matching "Kelston"), not
-- whole-word search.

create extension if not exists pg_trgm;

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

create trigger customers_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- Operational table: this is one shared company dataset, not per-user-owned
-- data, so any signed-in staff member has full read/write. No delete policy
-- anywhere in this schema (per the RLS strategy) — RLS denies by default
-- when no policy exists for an action, so deletes are blocked at the DB
-- layer even for admins, matching "no delete in the UI today."
alter table customers enable row level security;

create policy "staff can read customers" on customers
  for select to authenticated using (true);
create policy "staff can insert customers" on customers
  for insert to authenticated with check (true);
create policy "staff can update customers" on customers
  for update to authenticated using (true) with check (true);

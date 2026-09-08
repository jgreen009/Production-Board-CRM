-- Milestone 2: catalog tables (garment_types, garment_brands, services) and
-- the singleton business_settings row. No app code reads these yet —
-- verified via SQL/MCP this milestone, wired into the UI in later ones.

create table garment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger garment_types_updated_at
  before update on garment_types
  for each row execute function set_updated_at();

create table garment_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger garment_brands_updated_at
  before update on garment_brands
  for each row execute function set_updated_at();

create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger services_updated_at
  before update on services
  for each row execute function set_updated_at();

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
-- Postgres's standard singleton-table trick: a unique index on a constant
-- expression means a second insert always violates uniqueness.
create unique index business_settings_singleton on business_settings ((true));
create trigger business_settings_updated_at
  before update on business_settings
  for each row execute function set_updated_at();

-- RLS: every catalog/settings table is read-open to any signed-in staff
-- member, but only owner/admin can write (add a new garment type, disable
-- a service, change turnaround defaults, etc.).
alter table garment_types enable row level security;
alter table garment_brands enable row level security;
alter table services enable row level security;
alter table business_settings enable row level security;

create policy "staff can read garment_types" on garment_types
  for select to authenticated using (true);
create policy "admin/owner can insert garment_types" on garment_types
  for insert to authenticated with check (is_admin_or_owner());
create policy "admin/owner can update garment_types" on garment_types
  for update to authenticated using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy "staff can read garment_brands" on garment_brands
  for select to authenticated using (true);
create policy "admin/owner can insert garment_brands" on garment_brands
  for insert to authenticated with check (is_admin_or_owner());
create policy "admin/owner can update garment_brands" on garment_brands
  for update to authenticated using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy "staff can read services" on services
  for select to authenticated using (true);
create policy "admin/owner can insert services" on services
  for insert to authenticated with check (is_admin_or_owner());
create policy "admin/owner can update services" on services
  for update to authenticated using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy "staff can read business_settings" on business_settings
  for select to authenticated using (true);
create policy "admin/owner can insert business_settings" on business_settings
  for insert to authenticated with check (is_admin_or_owner());
create policy "admin/owner can update business_settings" on business_settings
  for update to authenticated using (is_admin_or_owner()) with check (is_admin_or_owner());

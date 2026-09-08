-- Milestone 1: backend foundation — profiles, shared updated_at trigger,
-- auto-provisioning of a profile row for every new auth user, and RLS.

create extension if not exists pgcrypto; -- gen_random_uuid(), used by every later table

-- Shared updated_at trigger function, reused by every table added in later
-- migrations — defined once here rather than repeated per-table.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a `staff` profile row for every new auth user. There is no
-- in-app "become owner" flow, deliberately — the first owner is promoted
-- with one manual SQL statement after they sign up:
--   update profiles set role = 'owner' where id = '<their-auth-uid>';
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Shared role-check helper, reused by RLS policies on every table added in
-- later migrations (catalogs/settings are write-restricted to owner/admin).
create or replace function is_admin_or_owner()
returns boolean language sql stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'admin'));
$$;

alter table profiles enable row level security;

-- A user can read/update their own profile row.
create policy "users can read own profile" on profiles
  for select to authenticated using (id = auth.uid());

create policy "users can update own profile" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- owner/admin can additionally read every profile (needed for a future
-- "manage staff" screen — out of scope this phase, but the policy is free
-- to add now and avoids a later migration just for this).
create policy "owner/admin can read all profiles" on profiles
  for select to authenticated using (is_admin_or_owner());

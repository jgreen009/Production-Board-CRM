-- Phase 4 Milestone 1 — profiles hardening for User Management.
--
-- Pre-migration audit (recorded here, verified live before writing this):
-- `profiles` had table-level INSERT/UPDATE/DELETE/SELECT granted to BOTH
-- `authenticated` AND `anon` (Supabase's default auto_expose_new_tables
-- behavior). `anon` has no matching RLS policy so it was already
-- effectively blocked, but `authenticated`'s existing UPDATE RLS policy
-- (`using (id = auth.uid()) with check (id = auth.uid())`) had NO column
-- restriction — meaning a `staff`-role user could `PATCH
-- /profiles?id=eq.<self>` with `{"role":"admin"}` today and RLS would
-- allow it (same row, same id). This migration closes that gap with
-- column-level GRANTs, not just RLS, per the approved plan amendment
-- ("do not rely on row-level RLS alone to protect columns").

-- 1. New columns for User Management.
alter table profiles
  add column email text,
  add column is_active boolean not null default true,
  add column must_change_password boolean not null default false;

-- 2. Backfill the existing profile(s) with their real Auth email.
update profiles p set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- 3. handle_new_user() now also captures email on every future signup.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  return new;
end;
$$;

-- 4. is_admin_or_owner() now also requires the caller's own profile to be
-- active — an inactive admin/owner must not be treated as an authorized
-- caller anywhere this function gates (every existing admin-only RLS
-- policy in the app, plus every new one this migration/Batch A adds).
create or replace function is_admin_or_owner()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('owner', 'admin') and is_active
  );
$$;

-- 5. Column-level privilege hardening — the actual fix, independent of
-- RLS. Browser clients (authenticated) may only ever UPDATE full_name on
-- their own row; role/email/is_active/must_change_password become
-- unwritable by any authenticated PostgREST call, full stop. Only
-- service-role code (the admin-users Edge Function) or a narrow
-- SECURITY DEFINER RPC (clear_must_change_password, below) can change
-- them. `anon` gets no table privileges at all — this is a
-- staff-only-authenticated internal app, never a public one.
revoke insert, update, delete on profiles from authenticated;
revoke all on profiles from anon;
grant update (full_name) on profiles to authenticated;

-- 6. Narrow RPC for the one self-service write must_change_password ever
-- needs: clearing itself after a successful password change. Cannot set
-- it true, cannot target another user's row, cannot be used to escalate
-- anything else.
create or replace function clear_must_change_password()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set must_change_password = false
  where id = auth.uid() and must_change_password = true;
end;
$$;

revoke execute on function clear_must_change_password() from public, anon;
grant execute on function clear_must_change_password() to authenticated;

-- 7. admin_activity — account-level audit trail, separate from
-- order_activity (which is order-scoped, order_id not null). Written only
-- by the admin-users Edge Function's service-role client (bypasses RLS by
-- design, the one trusted write path). Never contains a password, token,
-- or key — message strings are fixed templates built server-side.
create table admin_activity (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_id uuid references auth.users(id) on delete set null,
  activity_type text not null check (activity_type in (
    'user_created', 'user_activated', 'user_deactivated',
    'role_changed', 'password_reset'
  )),
  message text not null,
  created_at timestamptz not null default now()
);

alter table admin_activity enable row level security;

create policy "admin/owner can read admin_activity" on admin_activity
  for select to authenticated using (is_admin_or_owner());

-- No INSERT/UPDATE/DELETE policy for `authenticated` — deliberate. Only
-- the Edge Function's service-role client (which bypasses RLS entirely)
-- ever writes this table.
revoke insert, update, delete on admin_activity from authenticated;
revoke all on admin_activity from anon;

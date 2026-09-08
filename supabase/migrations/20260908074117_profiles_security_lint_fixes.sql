-- Fixes for warnings raised by Supabase's security advisor right after the
-- profiles migration:
--   1. function_search_path_mutable — pin search_path on every function so
--      it can't be hijacked by a session with a different search_path.
--   2. anon/authenticated_security_definer_function_executable —
--      handle_new_user() is only ever meant to run via the
--      on_auth_user_created trigger, never as a direct RPC call. Triggers
--      don't need EXECUTE granted to fire, so revoking it just closes off
--      `/rest/v1/rpc/handle_new_user` without affecting sign-up.

create or replace function set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function is_admin_or_owner()
returns boolean language sql stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'admin'));
$$;

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

revoke execute on function handle_new_user() from public, anon, authenticated;

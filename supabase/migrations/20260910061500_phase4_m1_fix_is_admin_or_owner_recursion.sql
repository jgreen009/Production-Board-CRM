-- Critical live fix, found only by testing against real Supabase rather
-- than trusting static review: is_admin_or_owner() was SECURITY INVOKER
-- (its original definition, unchanged since Phase 2, never had SECURITY
-- DEFINER either — this bug was latent in the codebase before Phase 4).
-- Its internal `select ... from profiles` re-triggered profiles' own
-- SELECT RLS policy (`id = auth.uid() OR is_admin_or_owner()`), which
-- calls the same function again — unbounded recursion, confirmed live as
-- "stack depth limit exceeded" on something as basic as a staff user
-- reading their own profile row.
--
-- Fix: SECURITY DEFINER makes the function's internal query run as the
-- function owner, bypassing RLS on that one internal lookup entirely —
-- the standard, correct pattern for an RLS helper function that queries
-- the same table its own result gates.

create or replace function is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('owner', 'admin') and is_active
  );
$$;

revoke execute on function is_admin_or_owner() from public, anon;
grant execute on function is_admin_or_owner() to authenticated;

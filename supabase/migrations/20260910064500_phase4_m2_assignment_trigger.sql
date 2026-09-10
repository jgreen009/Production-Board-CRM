-- Defense in depth for the inactive-assignment rule: upsert_order already
-- validates assignedTo server-side, but `orders` UPDATE RLS is
-- `using (true) with check (true)` (the same permissive pattern every
-- other status-change mutation in this app already relies on — see
-- updateOrderStatus in src/api/orders.ts, which does a plain
-- `.update({production_status: ...})` call, not upsert_order). Without a
-- table-level guard, a direct client update to `orders.assigned_to`
-- (bypassing upsert_order entirely, e.g. a raw PATCH) would skip the
-- validation. A BEFORE trigger closes this for every write path
-- universally, including the future quick-assign control on Order
-- Detail's Production tab, which follows the exact same direct-`.update()`
-- pattern as the existing status controls and needs the same protection
-- they don't otherwise get from RLS alone.
create or replace function validate_order_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null and not exists (
    select 1 from profiles where id = new.assigned_to and is_active
  ) then
    raise exception 'Cannot assign this order to an inactive or unknown staff member';
  end if;
  return new;
end;
$$;

create trigger orders_validate_assignment
  before insert or update of assigned_to on orders
  for each row execute function validate_order_assignment();

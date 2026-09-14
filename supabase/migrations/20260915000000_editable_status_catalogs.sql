-- Editable status catalogs — Payment, Artwork, Garment, Production,
-- Priority, and Turnaround statuses become admin-manageable (add/rename/
-- recolor/deactivate/delete) instead of a fixed, code-only list.
--
-- KEY DESIGN DECISION: each row has a `value` (immutable technical key,
-- stored on `orders` and compared against by business logic — queue
-- ranking, production readiness, dashboard counts) separate from `label`
-- (the admin-editable display text). Renaming a status only ever changes
-- `label` — `value` is set once at creation and never changes, which is
-- what keeps every existing `=== 'Completed'`-style comparison in
-- src/utils/productionQueue.ts, productionReadiness.ts, dashboard.ts,
-- status.ts, customers.ts, useProductionBoard.ts, ProductionTimeline.tsx
-- working correctly even after an admin renames "Completed" to "Finished"
-- for display. For every status seeded below, `value` starts out equal to
-- `label` (matching today's behavior exactly); only a later rename
-- diverges them.
--
-- `is_system = true` is set on every seeded status below (all of them are
-- referenced by at least one piece of business logic, directly or via a
-- list like the production-board's ARTWORK_ATTENTION/GARMENT_FOLLOWUP
-- sets) — RLS/application logic prevents deactivating or deleting an
-- is_system row (see the API layer), but still allows renaming/recoloring
-- it freely, since that's provably safe under the value/label split above.
-- A brand-new custom status an admin adds later is NOT is_system, and can
-- be freely deactivated or deleted.

create table status_options (
  id uuid primary key default gen_random_uuid(),
  dimension text not null check (dimension in ('payment', 'artwork', 'garment', 'production', 'priority', 'turnaround')),
  value text not null,
  label text not null,
  color text not null default 'neutral' check (color in ('neutral', 'danger', 'warning', 'success', 'info')),
  is_system boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dimension, value)
);

create index status_options_dimension_idx on status_options(dimension, sort_order);

alter table status_options enable row level security;

-- Same trust model as garment_types/garment_brands/services: any signed-in
-- staff member can read (they need the options to work orders), but only
-- admin/owner can write — this table's write policies are the DB half of
-- this feature's explicit "only admin can edit" requirement (the other
-- half is simply not exposing the edit UI to non-admins client-side).
create policy "staff can read status_options" on status_options
  for select to authenticated using (true);

create policy "admin can insert status_options" on status_options
  for insert to authenticated with check (is_admin_or_owner());

create policy "admin can update status_options" on status_options
  for update to authenticated using (is_admin_or_owner()) with check (is_admin_or_owner());

create policy "admin can delete status_options" on status_options
  for delete to authenticated using (is_admin_or_owner());

create trigger status_options_set_updated_at
  before update on status_options
  for each row execute function set_updated_at();

-- Seed every currently-live status value, is_system = true, value = label,
-- colors matching the exact hues src/data/mockStatuses.ts already used
-- (NEUTRAL/DANGER/WARNING/SUCCESS/INFO) so nothing visually changes the
-- moment this ships — only the "editable" capability is new.
insert into status_options (dimension, value, label, color, is_system, sort_order) values
  ('payment', 'Unpaid', 'Unpaid', 'danger', true, 0),
  ('payment', 'Deposit Paid', 'Deposit Paid', 'warning', true, 1),
  ('payment', 'Part Paid', 'Part Paid', 'warning', true, 2),
  ('payment', 'Paid', 'Paid', 'success', true, 3),
  ('payment', 'On Account', 'On Account', 'info', true, 4),

  ('artwork', 'Not Started', 'Not Started', 'neutral', true, 0),
  ('artwork', 'Artwork To Do', 'Artwork To Do', 'warning', true, 1),
  ('artwork', 'Artwork Supplied', 'Artwork Supplied', 'info', true, 2),
  ('artwork', 'Need Artwork', 'Need Artwork', 'danger', true, 3),
  ('artwork', 'Need Vectored', 'Need Vectored', 'warning', true, 4),
  ('artwork', 'Mockup Required', 'Mockup Required', 'warning', true, 5),
  ('artwork', 'Awaiting Approval', 'Awaiting Approval', 'warning', true, 6),
  ('artwork', 'Approved', 'Approved', 'success', true, 7),
  ('artwork', 'Completed', 'Completed', 'success', true, 8),

  ('garment', 'Not Required', 'Not Required', 'neutral', true, 0),
  ('garment', 'Need Ordering', 'Need Ordering', 'danger', true, 1),
  ('garment', 'Ordered', 'Ordered', 'info', true, 2),
  ('garment', 'Follow Up', 'Follow Up', 'warning', true, 3),
  ('garment', 'Part Received', 'Part Received', 'warning', true, 4),
  ('garment', 'Supplied', 'Supplied', 'info', true, 5),
  ('garment', 'Received', 'Received', 'success', true, 6),
  ('garment', 'Completed', 'Completed', 'success', true, 7),

  ('production', 'New', 'New', 'neutral', true, 0),
  ('production', 'Ready', 'Ready', 'info', true, 1),
  ('production', 'Queued', 'Queued', 'info', true, 2),
  ('production', 'In Production', 'In Production', 'warning', true, 3),
  ('production', 'Quality Check', 'Quality Check', 'warning', true, 4),
  ('production', 'Ready for Collection', 'Ready for Collection', 'info', true, 5),
  ('production', 'Out for Delivery', 'Out for Delivery', 'info', true, 6),
  ('production', 'Completed', 'Completed', 'success', true, 7),
  ('production', 'On Hold', 'On Hold', 'danger', true, 8),

  ('priority', 'Normal', 'Normal', 'neutral', true, 0),
  ('priority', 'High', 'High', 'warning', true, 1),
  ('priority', 'Urgent', 'Urgent', 'danger', true, 2),

  ('turnaround', 'Standard', 'Standard', 'neutral', true, 0),
  ('turnaround', 'Rush', 'Rush', 'warning', true, 1),
  ('turnaround', 'Same Day', 'Same Day', 'danger', true, 2),
  ('turnaround', 'Custom', 'Custom', 'info', true, 3);

-- ---------------------------------------------------------------------
-- Replace the fixed CHECK constraints on orders with a trigger-based
-- validation against status_options. A plain CHECK can't reference another
-- table; a trigger is this project's existing pattern for cross-row/
-- cross-table validation (see set_order_number, is_admin_or_owner).
-- Validates against `value` (any value that has EVER existed for that
-- dimension, active or not — an order already set to a since-deactivated
-- status must remain valid; deactivating only hides it from being newly
-- selected, per the API layer), not `label` — this is what makes renaming
-- a status never break existing orders or in-flight writes.
-- ---------------------------------------------------------------------

alter table orders drop constraint orders_turnaround_type_check;
alter table orders drop constraint orders_payment_status_check;
alter table orders drop constraint orders_artwork_status_check;
alter table orders drop constraint orders_garment_status_check;
alter table orders drop constraint orders_production_status_check;
alter table orders drop constraint orders_priority_check;

create or replace function validate_order_statuses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from status_options where dimension = 'payment' and value = new.payment_status) then
    raise exception 'Invalid payment status: %', new.payment_status;
  end if;
  if not exists (select 1 from status_options where dimension = 'artwork' and value = new.artwork_status) then
    raise exception 'Invalid artwork status: %', new.artwork_status;
  end if;
  if not exists (select 1 from status_options where dimension = 'garment' and value = new.garment_status) then
    raise exception 'Invalid garment status: %', new.garment_status;
  end if;
  if not exists (select 1 from status_options where dimension = 'production' and value = new.production_status) then
    raise exception 'Invalid production status: %', new.production_status;
  end if;
  if not exists (select 1 from status_options where dimension = 'priority' and value = new.priority) then
    raise exception 'Invalid priority: %', new.priority;
  end if;
  if not exists (select 1 from status_options where dimension = 'turnaround' and value = new.turnaround_type) then
    raise exception 'Invalid turnaround type: %', new.turnaround_type;
  end if;
  return new;
end;
$$;

create trigger orders_validate_statuses
  before insert or update on orders
  for each row execute function validate_order_statuses();

-- This function only ever needs to fire implicitly as a row trigger — it
-- should never be callable directly via PostgREST RPC by any client role.
-- Revoke the default PUBLIC execute grant that security definer functions
-- get on creation (mirrors is_admin_or_owner / create_public_order_submission).
revoke execute on function validate_order_statuses() from public, anon, authenticated;

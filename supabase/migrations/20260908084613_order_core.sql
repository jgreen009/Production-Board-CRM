-- Milestone 4: order core. Creates `artwork` here (schema only — no bucket
-- or storage policies yet, those are Milestone 5) purely because
-- print_specs.artwork_id needs a real FK target; the plan's milestone
-- table splits "orders + children" from "artwork storage" but the schema
-- itself has this one unavoidable ordering dependency.

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
    check (turnaround_type in ('Standard', 'Rush', 'Same Day', 'Custom')),
  payment_status text not null default 'Unpaid'
    check (payment_status in ('Unpaid', 'Deposit Paid', 'Part Paid', 'Paid', 'On Account')),
  artwork_status text not null default 'Not Started'
    check (artwork_status in ('Not Started', 'Artwork To Do', 'Artwork Supplied', 'Need Artwork',
      'Need Vectored', 'Mockup Required', 'Awaiting Approval', 'Approved', 'Completed')),
  garment_status text not null default 'Not Required'
    check (garment_status in ('Not Required', 'Need Ordering', 'Ordered', 'Follow Up',
      'Part Received', 'Supplied', 'Received', 'Completed')),
  production_status text not null default 'New'
    check (production_status in ('New', 'Ready', 'Queued', 'In Production', 'Quality Check',
      'Ready for Collection', 'Out for Delivery', 'Completed', 'On Hold')),
  priority text not null default 'Normal' check (priority in ('Normal', 'High', 'Urgent')),
  delivery_method text not null default 'Pick Up' check (delivery_method in ('Pick Up', 'Delivery')),
  rush_fee boolean not null default false,
  supplies_garments boolean not null default false,
  graphic_design_services boolean not null default false,
  specialised_application boolean not null default false,
  specialised_application_details text,
  notes text,
  production_notes text,
  staff_completed boolean not null default false,
  order_state text not null default 'Draft' check (order_state in ('Draft', 'Active')),
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_id_idx on orders(customer_id);
create index orders_due_date_idx on orders(due_date);
create index orders_production_status_idx on orders(production_status);
create index orders_order_state_idx on orders(order_state);
create trigger orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

create or replace function set_order_number()
returns trigger language plpgsql
set search_path = public
as $$
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
create trigger orders_set_order_number
  before insert on orders
  for each row execute function set_order_number();

-- `completed_at` is set when production_status transitions to 'Completed' —
-- independent of order_state (draft/active is a different concept).
create or replace function set_completed_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.production_status = 'Completed' and old.production_status is distinct from 'Completed' then
    new.completed_at := now();
  elsif new.production_status is distinct from 'Completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger orders_set_completed_at
  before update on orders
  for each row execute function set_completed_at();

create table order_garments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  garment_type_id uuid references garment_types(id),
  garment_type_label text not null,
  garment_brand_id uuid references garment_brands(id),
  garment_brand_label text not null,
  colour text not null,
  sizing_type text not null check (sizing_type in ('Adult', 'Youth')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_garments_order_id_idx on order_garments(order_id);
create trigger order_garments_updated_at
  before update on order_garments
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
create trigger garment_quantities_updated_at
  before update on garment_quantities
  for each row execute function set_updated_at();

create table order_services (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  service_id uuid not null references services(id),
  created_at timestamptz not null default now(),
  unique (order_id, service_id)
);
create index order_services_order_id_idx on order_services(order_id);

-- Schema only this milestone — bucket + storage policies + API/UI wiring
-- land in Milestone 5. Exists now purely as print_specs' FK target.
create table artwork (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  file_name text not null,
  file_type text not null check (file_type in ('PNG', 'JPG', 'WEBP', 'SVG', 'PDF', 'AI')),
  mime_type text,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  storage_path text not null,
  preview_storage_path text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index artwork_order_id_idx on artwork(order_id);
create trigger artwork_updated_at
  before update on artwork
  for each row execute function set_updated_at();

create table print_specs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  artwork_id uuid references artwork(id) on delete set null,
  position text not null check (position in
    ('Left Chest', 'Right Chest', 'Across Chest', 'Full Front', 'Left Sleeve', 'Right Sleeve',
     'Full Back', 'Top Back', 'Bottom Back')),
  colour text not null,
  width_mm numeric not null check (width_mm > 0),
  height_mm numeric not null check (height_mm > 0),
  garment_type text,
  garment_colour text,
  offset_x numeric,
  offset_y numeric,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index print_specs_order_id_idx on print_specs(order_id);
create trigger print_specs_updated_at
  before update on print_specs
  for each row execute function set_updated_at();

create table order_activity (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  user_id uuid references auth.users(id),
  activity_type text not null check (activity_type in
    ('created', 'priority', 'artwork', 'garments', 'production', 'mockup', 'payment')),
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index order_activity_order_id_created_idx on order_activity(order_id, created_at desc);

-- ============================================================
-- upsert_order: the one RPC behind Save Draft, Create Order, and
-- Edit Order alike (spec §11 — one write path, not several). Whole-child-
-- set replace: the form always holds its full current state, so
-- delete-then-reinsert per child table is correct and simple, not a diff.
-- ============================================================
create or replace function upsert_order(payload jsonb, p_order_id uuid default null, p_finalize boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_garment jsonb;
  v_garment_id uuid;
  v_sort int;
begin
  if p_order_id is null then
    insert into orders (
      job_name, customer_id, phone, email, due_date, turnaround_type,
      delivery_method, priority, rush_fee, supplies_garments, graphic_design_services,
      specialised_application, specialised_application_details, notes, production_notes,
      payment_status, staff_completed, order_state, created_by
    )
    values (
      payload->>'jobName', nullif(payload->>'customerId', '')::uuid, payload->>'phone',
      payload->>'email', nullif(payload->>'dueDate', '')::date, payload->>'turnaroundType',
      payload->>'deliveryMethod', payload->>'priority', (payload->>'rushFee')::boolean,
      (payload->>'suppliesGarments')::boolean, (payload->>'graphicDesignServices')::boolean,
      (payload->>'specialisedApplication')::boolean, payload->>'specialisedApplicationDetails',
      payload->>'notes', payload->>'productionNotes', payload->>'paymentStatus',
      coalesce((payload->>'staffCompleted')::boolean, false),
      case when p_finalize then 'Active' else 'Draft' end, auth.uid()
    )
    returning id into v_order_id;

    insert into order_activity (order_id, user_id, activity_type, message)
    values (v_order_id, auth.uid(), 'created', 'Order created');
  else
    v_order_id := p_order_id;
    update orders set
      job_name = payload->>'jobName',
      customer_id = nullif(payload->>'customerId', '')::uuid,
      phone = payload->>'phone',
      email = payload->>'email',
      due_date = nullif(payload->>'dueDate', '')::date,
      turnaround_type = payload->>'turnaroundType',
      delivery_method = payload->>'deliveryMethod',
      priority = payload->>'priority',
      rush_fee = (payload->>'rushFee')::boolean,
      supplies_garments = (payload->>'suppliesGarments')::boolean,
      graphic_design_services = (payload->>'graphicDesignServices')::boolean,
      specialised_application = (payload->>'specialisedApplication')::boolean,
      specialised_application_details = payload->>'specialisedApplicationDetails',
      notes = payload->>'notes',
      production_notes = payload->>'productionNotes',
      payment_status = payload->>'paymentStatus',
      staff_completed = coalesce((payload->>'staffCompleted')::boolean, false),
      order_state = case when p_finalize then 'Active' else order_state end
    where id = v_order_id;
  end if;

  delete from order_garments where order_id = v_order_id;   -- cascades garment_quantities
  delete from order_services where order_id = v_order_id;
  delete from print_specs where order_id = v_order_id;       -- artwork rows untouched

  -- Garments + per-size quantities. Looped (not a single set-based insert)
  -- so each garment's freshly-generated id is available to attach its own
  -- quantity rows to, one garment at a time.
  for v_garment, v_sort in
    select g, (ord - 1)::int
    from jsonb_array_elements(coalesce(payload->'garments', '[]'::jsonb)) with ordinality as t(g, ord)
    order by ord
  loop
    insert into order_garments (order_id, garment_type_label, garment_brand_label, colour, sizing_type, sort_order)
    values (
      v_order_id,
      v_garment->>'type',
      v_garment->>'brand',
      v_garment->>'colour',
      v_garment->>'sizing',
      v_sort
    )
    returning id into v_garment_id;

    insert into garment_quantities (order_garment_id, size, quantity)
    select v_garment_id, kv.key, kv.value::int
    from jsonb_each_text(
      case when v_garment->>'sizing' = 'Youth'
        then coalesce(v_garment->'youthQuantities', '{}'::jsonb)
        else coalesce(v_garment->'adultQuantities', '{}'::jsonb)
      end
    ) as kv(key, value)
    where kv.value ~ '^\d+$' and kv.value::int > 0;
  end loop;

  insert into order_services (order_id, service_id)
  select v_order_id, s.id
  from jsonb_array_elements_text(coalesce(payload->'services', '[]'::jsonb)) as svc
  join services s on s.name = svc;

  insert into print_specs (
    order_id, artwork_id, position, colour, width_mm, height_mm,
    garment_type, garment_colour, offset_x, offset_y, sort_order
  )
  select
    v_order_id,
    nullif(p->>'artworkId', '')::uuid,
    p->>'position',
    p->>'colour',
    (p->>'widthMm')::numeric,
    (p->>'heightMm')::numeric,
    nullif(p->>'garmentType', ''),
    nullif(p->>'garmentColour', ''),
    (p->>'offsetX')::numeric,
    (p->>'offsetY')::numeric,
    ord - 1
  from jsonb_array_elements(coalesce(payload->'printSpecs', '[]'::jsonb)) with ordinality as t(p, ord);

  return v_order_id;
end;
$$;

revoke execute on function upsert_order(jsonb, uuid, boolean) from public, anon;
grant execute on function upsert_order(jsonb, uuid, boolean) to authenticated;

-- ============================================================
-- RLS — operational tables, same pattern as customers: any signed-in
-- staff member has full read/write, no delete policy anywhere.
-- ============================================================
alter table orders enable row level security;
alter table order_garments enable row level security;
alter table garment_quantities enable row level security;
alter table order_services enable row level security;
alter table artwork enable row level security;
alter table print_specs enable row level security;
alter table order_activity enable row level security;

create policy "staff can read orders" on orders for select to authenticated using (true);
create policy "staff can insert orders" on orders for insert to authenticated with check (true);
create policy "staff can update orders" on orders for update to authenticated using (true) with check (true);

create policy "staff can read order_garments" on order_garments for select to authenticated using (true);
create policy "staff can insert order_garments" on order_garments for insert to authenticated with check (true);
create policy "staff can update order_garments" on order_garments for update to authenticated using (true) with check (true);
create policy "staff can delete order_garments" on order_garments for delete to authenticated using (true);

create policy "staff can read garment_quantities" on garment_quantities for select to authenticated using (true);
create policy "staff can insert garment_quantities" on garment_quantities for insert to authenticated with check (true);
create policy "staff can update garment_quantities" on garment_quantities for update to authenticated using (true) with check (true);
create policy "staff can delete garment_quantities" on garment_quantities for delete to authenticated using (true);

create policy "staff can read order_services" on order_services for select to authenticated using (true);
create policy "staff can insert order_services" on order_services for insert to authenticated with check (true);
create policy "staff can delete order_services" on order_services for delete to authenticated using (true);

create policy "staff can read artwork" on artwork for select to authenticated using (true);
create policy "staff can insert artwork" on artwork for insert to authenticated with check (true);
create policy "staff can update artwork" on artwork for update to authenticated using (true) with check (true);

create policy "staff can read print_specs" on print_specs for select to authenticated using (true);
create policy "staff can insert print_specs" on print_specs for insert to authenticated with check (true);
create policy "staff can update print_specs" on print_specs for update to authenticated using (true) with check (true);
create policy "staff can delete print_specs" on print_specs for delete to authenticated using (true);

-- order_activity: append-only even for admins — no update/delete policy at
-- all, so RLS blocks both regardless of role.
create policy "staff can read order_activity" on order_activity for select to authenticated using (true);
create policy "staff can insert order_activity" on order_activity for insert to authenticated with check (true);

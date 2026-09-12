-- Public Customer Order Link — the first intentionally anonymous-facing
-- surface in this schema. Everything anon-reachable in this migration
-- (only the new RPC's EXECUTE grant to service_role, nothing else) is
-- brand-new attack surface, not a relaxation of anything already proven
-- safe — see docs/PUBLIC_ORDER_LINK_HANDOVER.md for the full design
-- rationale.

-- ---------------------------------------------------------------------
-- 1. orders.source — distinguishes a public-form submission from a
--    normal staff-created order, for the "Submitted by Customer" badge
--    and for staff triage. Additive, defaulted, no backfill needed for
--    existing rows (they're all legitimately 'staff').
-- ---------------------------------------------------------------------
alter table orders
  add column source text not null default 'staff' check (source in ('staff', 'public_form'));

-- ---------------------------------------------------------------------
-- 2. public_order_links — staff-generated, single-use-by-default shareable
--    links. Only a SHA-256 hash of the raw token is ever stored (the raw
--    token is generated and hashed client-side in the staff browser via
--    Web Crypto, and is shown/copyable only once, at creation time — it
--    is never sent to or recoverable from the server after that). No
--    anon policy is added on this table at all: anonymous customers never
--    query it directly — every public interaction goes through the
--    public-order Edge Function using the service-role key, which bypasses
--    RLS entirely. This keeps "can anon list/read this table" a flat NO,
--    not something that has to be reasoned about per-column.
-- ---------------------------------------------------------------------
create table public_order_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  created_by uuid references profiles(id),
  is_active boolean not null default true,
  expires_at timestamptz,
  max_submissions integer not null default 1 check (max_submissions > 0),
  submission_count integer not null default 0 check (submission_count >= 0),
  -- Set once a submission through this link successfully creates an
  -- order — lets staff click straight through from the link list to the
  -- order it produced. Nullable; stays null for an unused/expired/revoked link.
  resulting_order_id uuid references orders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index public_order_links_created_by_idx on public_order_links(created_by);
create index public_order_links_resulting_order_id_idx on public_order_links(resulting_order_id);

alter table public_order_links enable row level security;

-- Staff (any authenticated, active user — same "signed in is the trust
-- boundary" pattern already used for orders/customers/catalogs
-- throughout this schema) can create and view links, and revoke
-- (is_active = false) their own or anyone else's — mirroring orders'
-- own no-per-row-ownership UPDATE policy. No DELETE policy: revoked
-- links are kept, never hard-deleted, matching every other catalog-ish
-- table in this schema.
create policy "staff can read public_order_links" on public_order_links
  for select to authenticated using (true);

create policy "staff can create public_order_links" on public_order_links
  for insert to authenticated with check (true);

create policy "staff can update public_order_links" on public_order_links
  for update to authenticated using (true) with check (true);

create trigger public_order_links_updated_at
  before update on public_order_links
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 3. create_public_order_submission — the ONE privileged, atomic entry
--    point a public order submission uses. Deliberately NOT reachable by
--    anon or authenticated PostgREST callers (see grants at the bottom) —
--    only the public-order Edge Function, using the service-role key,
--    ever calls this. Doing the whole submission (token consumption,
--    customer resolution, order + all child rows, activity) inside one
--    PL/pgSQL function body means it all commits or rolls back together:
--    a validation failure partway through never leaves a half-created
--    order behind, and the token is never "burned" by a failed attempt
--    (the UPDATE that consumes it is part of the same transaction as
--    everything else).
--
--    Artwork file BYTES are uploaded to Storage by the Edge Function
--    itself (Storage isn't reachable from SQL) BEFORE this function is
--    called, using a caller-generated order id and artwork ids threaded
--    through the payload below — the one thing this function can't make
--    atomic with the rest, documented as a known limitation (a failed
--    submission after upload but before this function commits can leave
--    orphaned Storage objects; it can never leave an orphaned/partial
--    order row, since the whole DB side is one transaction).
--
--    The token-consumption UPDATE's WHERE clause (is_active, expiry,
--    submission_count < max_submissions) is the sole source of truth for
--    "is this link still usable" — re-checked here even though the Edge
--    Function also pre-checks it for a fast/friendly error message,
--    because only this atomic UPDATE actually prevents a double-click or
--    parallel-request race from creating two orders off one link.
-- ---------------------------------------------------------------------
create or replace function create_public_order_submission(p_token_hash text, p_order_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
  v_customer_id uuid;
  v_customer jsonb := p_payload->'customer';
  v_order jsonb := p_payload->'order';
  v_order_number text;
  v_garment jsonb;
  v_service text;
  v_artwork jsonb;
  v_spec jsonb;
  v_order_garment_id uuid;
  v_size text;
  v_qty jsonb;
  kv record;
begin
  -- Atomic check-and-consume: the single statement that actually enforces
  -- "one link creates at most one order," race-safe against concurrent
  -- calls (a second concurrent transaction re-evaluates this WHERE clause
  -- against the row this one just locked/updated, and finds
  -- submission_count no longer < max_submissions).
  update public_order_links
  set submission_count = submission_count + 1
  where token_hash = p_token_hash
    and is_active
    and submission_count < max_submissions
    and (expires_at is null or expires_at > now())
  returning id into v_link_id;

  if v_link_id is null then
    raise exception 'This order link is invalid, expired, or has already been used.' using errcode = 'P0001';
  end if;

  -- Customer: exact, case-insensitive email match reuses the existing
  -- record; anything else (no email, or no match) creates a new one.
  -- Deliberately never matches on name alone (too loose — two different
  -- "John Smith"s are not the same customer).
  if v_customer->>'email' is not null and trim(v_customer->>'email') <> '' then
    select id into v_customer_id from customers where lower(email) = lower(trim(v_customer->>'email')) limit 1;
  end if;

  if v_customer_id is null then
    insert into customers (name, company, email, phone)
    values (v_customer->>'name', nullif(v_customer->>'company', ''), nullif(v_customer->>'email', ''), nullif(v_customer->>'phone', ''))
    returning id into v_customer_id;
  end if;

  -- Order: source='public_form', order_state='Active' immediately (the
  -- artwork already safely landed in Storage before this call — see the
  -- header comment — so there's no reason to stage this as 'Draft' the
  -- way the internal shell-order pattern does while artwork is still
  -- pending). created_by/assigned_to stay NULL (no authenticated staff
  -- user exists for this request); priority is always 'Normal' regardless
  -- of anything in the payload — customers never control internal
  -- priority. payment_status/artwork_status/garment_status/production_status
  -- all come from the same table DEFAULTs a normal staff-created order
  -- gets (this function does not set them at all), so a public order
  -- starts in exactly the same internal state as any other new order.
  insert into orders (
    id, job_name, customer_id, phone, email, due_date, turnaround_type, delivery_method,
    priority, rush_fee, supplies_garments, graphic_design_services, specialised_application,
    specialised_application_details, notes, production_notes, order_state, created_by, assigned_to, source
  ) values (
    p_order_id,
    v_order->>'jobName',
    v_customer_id,
    nullif(v_order->>'phone', ''),
    nullif(v_order->>'email', ''),
    nullif(v_order->>'dueDate', '')::date,
    coalesce(v_order->>'turnaroundType', 'Standard'),
    coalesce(v_order->>'deliveryMethod', 'Pick Up'),
    'Normal',
    false, false, false, false, '',
    nullif(v_order->>'notes', ''),
    null,
    'Active',
    null,
    null,
    'public_form'
  )
  returning order_number into v_order_number;

  update public_order_links set resulting_order_id = p_order_id where id = v_link_id;

  -- Garments + per-size quantities — same shape/loop as upsert_order's
  -- own garment handling, so a public order's garments look identical in
  -- the CRM to a staff-created one.
  for v_garment in select * from jsonb_array_elements(coalesce(p_payload->'garments', '[]'::jsonb))
  loop
    insert into order_garments (order_id, garment_type_label, garment_brand_label, colour, sizing_type, sort_order)
    values (
      p_order_id,
      v_garment->>'type',
      coalesce(v_garment->>'brand', 'Customized'),
      v_garment->>'colour',
      v_garment->>'sizing',
      coalesce((v_garment->>'sortOrder')::int, 0)
    )
    returning id into v_order_garment_id;

    for v_size, v_qty in select * from jsonb_each(coalesce(v_garment->'adultQuantities', '{}'::jsonb))
    loop
      if v_qty::text ~ '^\d+$' and v_qty::text::int > 0 then
        insert into garment_quantities (order_garment_id, size, quantity) values (v_order_garment_id, v_size, v_qty::text::int);
      end if;
    end loop;

    for v_size, v_qty in select * from jsonb_each(coalesce(v_garment->'youthQuantities', '{}'::jsonb))
    loop
      if v_qty::text ~ '^\d+$' and v_qty::text::int > 0 then
        insert into garment_quantities (order_garment_id, size, quantity) values (v_order_garment_id, v_size, v_qty::text::int);
      end if;
    end loop;
  end loop;

  -- Services — joined against the real catalog by name, exactly like
  -- upsert_order, so a garbled/unknown service name in the payload is
  -- silently dropped rather than inserted as a dangling label.
  for v_service in select * from jsonb_array_elements_text(coalesce(p_payload->'services', '[]'::jsonb))
  loop
    insert into order_services (order_id, service_id)
    select p_order_id, id from services where name = v_service and active
    on conflict do nothing;
  end loop;

  -- Artwork rows — metadata only; the actual bytes were already uploaded
  -- to Storage by the Edge Function at the real, final path before this
  -- function was ever called (see header comment).
  for v_artwork in select * from jsonb_array_elements(coalesce(p_payload->'artwork', '[]'::jsonb))
  loop
    insert into artwork (id, order_id, file_name, file_type, mime_type, file_size_bytes, storage_path, uploaded_by)
    values (
      (v_artwork->>'id')::uuid,
      p_order_id,
      v_artwork->>'fileName',
      v_artwork->>'fileType',
      nullif(v_artwork->>'mimeType', ''),
      (v_artwork->>'sizeBytes')::bigint,
      v_artwork->>'storagePath',
      null
    );
  end loop;

  -- Print specs — position is constrained by the table's own CHECK
  -- constraint regardless of what the Edge Function already validated;
  -- offset_x/offset_y are never accepted from the public payload at all
  -- (no offsetX/offsetY key is read here), so they fall back to the
  -- columns' own NULL default — consistent with "legacy ignored,"
  -- extended to "never even accepted" for a public submission.
  for v_spec in select * from jsonb_array_elements(coalesce(p_payload->'printSpecs', '[]'::jsonb))
  loop
    insert into print_specs (id, order_id, artwork_id, position, colour, width_mm, height_mm, garment_type, garment_colour, sort_order)
    values (
      (v_spec->>'id')::uuid,
      p_order_id,
      nullif(v_spec->>'artworkId', '')::uuid,
      v_spec->>'position',
      coalesce(v_spec->>'colour', ''),
      (v_spec->>'widthMm')::numeric,
      (v_spec->>'heightMm')::numeric,
      nullif(v_spec->>'garmentType', ''),
      nullif(v_spec->>'garmentColour', ''),
      coalesce((v_spec->>'sortOrder')::int, 0)
    );
  end loop;

  insert into order_activity (order_id, user_id, activity_type, message)
  values (p_order_id, null, 'created', 'Order submitted via customer order form');

  return jsonb_build_object('orderId', p_order_id, 'orderNumber', v_order_number);
end;
$$;

revoke execute on function create_public_order_submission(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function create_public_order_submission(text, uuid, jsonb) to service_role;

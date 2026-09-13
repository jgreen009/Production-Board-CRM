-- Public Customer Order Link — general (persistent, unlimited-use) link.
-- Product decision: instead of staff generating a new single-use link per
-- customer, there is now ONE general link, reusable indefinitely, meant to
-- be copied from multiple places in the app and shared broadly (e.g. on
-- the business's own website). Existing one-time links are untouched
-- (still work exactly as before, still single-use) — this is additive.

alter table public_order_links
  add column is_general boolean not null default false,
  -- Only ever populated for the general link (is_general = true). Every
  -- one-time link still stores ONLY a hash — this column stays null for
  -- them, preserving the original "shown once, never recoverable"
  -- property. The general link is a different trust model on purpose: it
  -- needs to be retrievable by any authenticated staff member from
  -- anywhere in the app, indefinitely, not just at creation time. RLS
  -- already restricts this whole table to `authenticated` (see the
  -- table's own policies) — storing the plaintext token for this one
  -- deliberately-shareable link is not a broader exposure than what
  -- staff can already do (any staff can already mint a fresh one-time
  -- link and see its raw token once).
  add column raw_token text;

-- max_submissions becomes optional — null means "no limit," which is what
-- the general link uses. One-time links keep their existing default of 1.
alter table public_order_links alter column max_submissions drop not null;
alter table public_order_links alter column max_submissions drop default;
alter table public_order_links drop constraint public_order_links_max_submissions_check;
alter table public_order_links add constraint public_order_links_max_submissions_check
  check (max_submissions is null or max_submissions > 0);

-- Enforces "there is only one" at the database level: at most one row can
-- have is_general = true while also is_active = true. Revoking the
-- current general link (is_active = false) frees up the slot for a new
-- one to be created — this is how "regenerate" works.
create unique index public_order_links_one_active_general
  on public_order_links (is_general)
  where is_general and is_active;

-- create_public_order_submission's only change: the atomic consumption
-- UPDATE now treats a null max_submissions as "no limit" — everything else
-- (token consumption is still the sole enforcement point, still one
-- statement, still inside the same all-or-nothing transaction as the rest
-- of the order creation) is unchanged from the original definition in
-- 20260912000000_public_order_links.sql.
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
  update public_order_links
  set submission_count = submission_count + 1
  where token_hash = p_token_hash
    and is_active
    and (max_submissions is null or submission_count < max_submissions)
    and (expires_at is null or expires_at > now())
  returning id into v_link_id;

  if v_link_id is null then
    raise exception 'This order link is invalid, expired, or has already been used.' using errcode = 'P0001';
  end if;

  if v_customer->>'email' is not null and trim(v_customer->>'email') <> '' then
    select id into v_customer_id from customers where lower(email) = lower(trim(v_customer->>'email')) limit 1;
  end if;

  if v_customer_id is null then
    insert into customers (name, company, email, phone)
    values (v_customer->>'name', nullif(v_customer->>'company', ''), nullif(v_customer->>'email', ''), nullif(v_customer->>'phone', ''))
    returning id into v_customer_id;
  end if;

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

  for v_service in select * from jsonb_array_elements_text(coalesce(p_payload->'services', '[]'::jsonb))
  loop
    insert into order_services (order_id, service_id)
    select p_order_id, id from services where name = v_service and active
    on conflict do nothing;
  end loop;

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

-- Fixes a real, currently-live bug: `upsert_order` has been failing on
-- EVERY call (autosave, Save Draft, Create Order, Save Changes, and the
-- new on-demand draft-creation behind artwork upload) with a Postgres
-- "DELETE requires a WHERE clause" error, confirmed live via
-- postgres_logs correlated 1:1 with repeated `POST .../rpc/upsert_order`
-- 400 responses in edge_logs.
--
-- Root cause: `delete from _prev_print_spec_previews;` (added by the
-- Batch B preview-path-preservation migration) has no WHERE clause. This
-- project's role-level safety guard rejects any UPDATE/DELETE without one,
-- regardless of the function being SECURITY DEFINER. Every other
-- delete/update statement in this function already has a WHERE clause —
-- this was the one bare exception, on a temp table that gets recreated
-- and dropped every call, where a WHERE clause was simply never added.
--
-- Fix: add a trivially-true WHERE clause — functionally identical (still
-- deletes every row), just satisfies the guard. No behavior change.

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

  -- Snapshot existing preview references before the whole-child-set
  -- replace wipes them (see migration header comment).
  create temporary table if not exists _prev_print_spec_previews (
    id uuid primary key,
    preview_storage_path text
  ) on commit drop;
  delete from _prev_print_spec_previews where true;
  insert into _prev_print_spec_previews (id, preview_storage_path)
  select id, preview_storage_path from print_specs
  where order_id = v_order_id and preview_storage_path is not null;

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
    id, order_id, artwork_id, position, colour, width_mm, height_mm,
    garment_type, garment_colour, offset_x, offset_y, sort_order,
    rotation_deg, approval_note
  )
  select
    (p->>'id')::uuid,
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
    ord - 1,
    coalesce((p->>'rotationDeg')::numeric, 0),
    nullif(p->>'approvalNote', '')
  from jsonb_array_elements(coalesce(payload->'printSpecs', '[]'::jsonb)) with ordinality as t(p, ord);

  -- Restore any preview reference for print specs that kept the same id
  -- across this replace cycle.
  update print_specs ps set preview_storage_path = pp.preview_storage_path
  from _prev_print_spec_previews pp
  where ps.id = pp.id and ps.order_id = v_order_id;

  return v_order_id;
end;
$$;

revoke execute on function upsert_order(jsonb, uuid, boolean) from public, anon;
grant execute on function upsert_order(jsonb, uuid, boolean) to authenticated;

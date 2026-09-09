-- Phase 3 Milestone 1: architecture-only schema changes for the Mockup
-- Studio (see docs/PHASE_3_PLAN.md §12a, §14, §16 for the amended
-- rationale reviewed and approved before this migration was written).
--
-- Offset semantics (Amendment 1): offset_x/offset_y are NOT altered by this
-- migration. Live-data check confirmed both existing print_specs rows are
-- already (0, 0), which is valid under both the pre-Phase-3 center-point
-- semantics and the new print-zone-relative semantics — this is a
-- documented code-level cutover (Strategy A), not a data migration.
--
-- No artwork_width_pct/artwork_height_pct/orders.artwork_approval_note are
-- added, per Amendment 2/4 — width_mm/height_mm remain the sole canonical
-- print size, and the approval note is per-print-spec, not per-order.

alter table print_specs
  add column rotation_deg numeric not null default 0,
  add column preview_storage_path text,
  add column approval_note text;

alter table print_specs
  add constraint print_specs_rotation_deg_range check (rotation_deg >= 0 and rotation_deg < 360);

-- ============================================================
-- upsert_order: reissued to fix a real defect found during Phase 3
-- Milestone 0 review (plan §12a) — the print_specs insert previously had
-- no `id` column, so every delete+reinsert cycle (which happens on every
-- single order save, by design) assigned every print spec a brand-new
-- random UUID. That would silently orphan any mockup preview stored at
-- mockup-previews/.../print-specs/{printSpecId}/preview.png on the very
-- next save. Fixed by threading the client-generated id (a real UUID from
-- creation time, per defaultValues.ts's emptyPrintSpec) through the insert.
-- rotation_deg and approval_note are also new fields riding the same
-- payload. preview_storage_path is deliberately NOT set here — it's
-- written via a plain UPDATE after a preview PNG is generated and uploaded
-- to Storage (Milestone 7, not this one), the same pattern artwork uploads
-- already use, since Storage operations can't participate in this RPC's
-- transaction.
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

  return v_order_id;
end;
$$;

revoke execute on function upsert_order(jsonb, uuid, boolean) from public, anon;
grant execute on function upsert_order(jsonb, uuid, boolean) to authenticated;

-- ============================================================
-- mockup-previews Storage bucket + policies (Amendment 6) — created via
-- versioned migration, same mechanism the existing artwork_storage
-- migration used for artwork-originals. No manual dashboard step.
-- Private; authenticated staff full CRUD; no anon policy of any kind.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('mockup-previews', 'mockup-previews', false)
on conflict (id) do nothing;

create policy "staff can read mockup-previews" on storage.objects
  for select to authenticated using (bucket_id = 'mockup-previews');
create policy "staff can insert mockup-previews" on storage.objects
  for insert to authenticated with check (bucket_id = 'mockup-previews');
create policy "staff can update mockup-previews" on storage.objects
  for update to authenticated using (bucket_id = 'mockup-previews') with check (bucket_id = 'mockup-previews');
create policy "staff can delete mockup-previews" on storage.objects
  for delete to authenticated using (bucket_id = 'mockup-previews');

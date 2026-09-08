-- Milestone 11 performance advisor findings worth fixing now (skipping
-- "unused index" — that's just today's near-empty dataset, not real
-- bloat; every one of those indexes backs a query the app already runs).

-- auth.uid() was being re-evaluated per row instead of once per query.
-- Also consolidates profiles' two permissive SELECT policies into one
-- (own row OR admin/owner) so only one policy is evaluated per query
-- instead of both.
drop policy "users can read own profile" on profiles;
drop policy "owner/admin can read all profiles" on profiles;
create policy "staff can read own profile, admin/owner can read all" on profiles
  for select to authenticated using (id = (select auth.uid()) or is_admin_or_owner());

drop policy "users can update own profile" on profiles;
create policy "users can update own profile" on profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Missing covering indexes on foreign keys (flagged by the advisor) —
-- cheap now, avoids slow joins/lookups as order volume grows.
create index artwork_uploaded_by_idx on artwork(uploaded_by);
create index mockup_templates_garment_type_id_idx on mockup_templates(garment_type_id);
create index order_activity_user_id_idx on order_activity(user_id);
create index order_garments_garment_brand_id_idx on order_garments(garment_brand_id);
create index order_garments_garment_type_id_idx on order_garments(garment_type_id);
create index order_services_service_id_idx on order_services(service_id);
create index orders_created_by_idx on orders(created_by);
create index print_specs_artwork_id_idx on print_specs(artwork_id);

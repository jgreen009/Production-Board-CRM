-- Milestone 10: mockup_templates. image_storage_path stays unused this
-- phase — the app keeps using the local reference photos in
-- src/assets/mockups/ (per the plan, no asset migration forced yet) — this
-- table just gives staff a real place to toggle a template active/inactive,
-- same CRUD shape as the other catalogs.

create table mockup_templates (
  id uuid primary key default gen_random_uuid(),
  garment_type_id uuid references garment_types(id),
  name text not null,
  view text not null check (view in ('Front', 'Back')),
  image_storage_path text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger mockup_templates_updated_at
  before update on mockup_templates
  for each row execute function set_updated_at();

alter table mockup_templates enable row level security;

create policy "staff can read mockup_templates" on mockup_templates
  for select to authenticated using (true);
create policy "admin/owner can insert mockup_templates" on mockup_templates
  for insert to authenticated with check (is_admin_or_owner());
create policy "admin/owner can update mockup_templates" on mockup_templates
  for update to authenticated using (is_admin_or_owner()) with check (is_admin_or_owner());

-- Seed: one row per (garment type x Front/Back), matching what
-- SettingsMockups.tsx already auto-generates client-side from
-- GARMENT_TYPES today. "Customized" is excluded, same as the current UI.
insert into mockup_templates (garment_type_id, name, view, sort_order)
select gt.id, gt.name || ' — ' || v.view, v.view, gt.sort_order * 2 + v.ord
from garment_types gt
cross join (values ('Front', 0), ('Back', 1)) as v(view, ord)
where gt.name <> 'Customized';

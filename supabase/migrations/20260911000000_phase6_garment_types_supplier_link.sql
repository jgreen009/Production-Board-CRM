-- Mockup System V2 Batch C — minimal supplier-link metadata on the
-- existing garment_types catalog (see docs/MOCKUP_SYSTEM_V2_BATCH_C_HANDOVER.md
-- for the audit that led here: garment_types already has full Settings
-- CRUD and is the entity garment rendering keys off; garment_brands has no
-- management UI at all. All three columns are optional, additive,
-- nullable — no backfill, no rewrite of existing rows, no RLS change
-- (existing garment_types policies already cover these new columns).
alter table garment_types
  add column supplier_name text,
  add column supplier_product_code text,
  add column supplier_url text;

comment on column garment_types.supplier_name is 'Optional: the supplier/manufacturer this garment type is typically sourced from (e.g. "AS Colour"). Free text, not a catalog FK.';
comment on column garment_types.supplier_product_code is 'Optional: the supplier''s own product code/name for this garment (e.g. "Staple Tee 5001").';
comment on column garment_types.supplier_url is 'Optional: a link to the supplier''s product page. Validated as a safe http/https URL at write time by the application; never rendered as raw HTML.';

-- One-time catalog seed, sourced verbatim from src/data/mockGarments.ts and
-- src/data/mockServices.ts (the paper order form's dropdown values). Not a
-- migration — content, not schema. Safe to re-run: each insert is a no-op
-- if the row already exists.

insert into garment_types (name, sort_order) values
  ('T-shirt', 0),
  ('Polo', 1),
  ('Shirt', 2),
  ('Hi-Viz vest', 3),
  ('Singlet', 4),
  ('Crew neck (jumper)', 5),
  ('Hoody', 6),
  ('Shorts', 7),
  ('Pants', 8),
  ('Bennie', 9),
  ('Hats', 10),
  ('Customized', 11)
on conflict (name) do nothing;

insert into garment_brands (name, sort_order) values
  ('AS colour', 0),
  ('Gildan', 1),
  ('Bocini', 2),
  ('Sportage', 3),
  ('Aussie pacific', 4),
  ('Customized', 5)
on conflict (name) do nothing;

insert into services (name, sort_order) values
  ('Screen Printing', 0),
  ('Sublimation', 1),
  ('Embroidery', 2),
  ('Custom School', 3),
  ('Direct To Film', 4),
  ('Custom Sports', 5),
  ('Direct To Garment', 6),
  ('Vinyl/Digital Transfer', 7)
on conflict (name) do nothing;

insert into business_settings (business_name, business_email, business_phone)
select 'SALT PRINTS', 'info@saltprints.com.au', '0468 476 027'
where not exists (select 1 from business_settings);

-- Mockup System V2 — non-upper-body print position vocabulary. Widens
-- print_specs.position's CHECK constraint additively (drop + recreate
-- with every existing value plus the new ones) so Beanie/Hats/Shorts/
-- Pants can have a real, garment-specific position instead of being
-- permanently unsupported. No existing value is removed or renamed, so
-- every historical row keeps validating exactly as before.
alter table print_specs drop constraint print_specs_position_check;

alter table print_specs add constraint print_specs_position_check
  check (position in (
    'Left Chest', 'Right Chest', 'Across Chest', 'Full Front', 'Left Sleeve', 'Right Sleeve',
    'Full Back', 'Top Back', 'Bottom Back',
    'Front', 'Back', 'Left Side', 'Right Side', 'Left Leg', 'Right Leg', 'Left Thigh', 'Right Thigh'
  ));

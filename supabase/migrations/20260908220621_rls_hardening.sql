-- Milestone 11 RLS audit. Two real findings, not just a paper exercise:
--
-- 1. artwork had no DELETE policy at all. removeArtwork() in
--    src/api/artwork.ts calls .from('artwork').delete() directly (not
--    through a SECURITY DEFINER function) after removing the Storage
--    object — with no policy, Postgres RLS silently deletes zero rows
--    (no error), so every "remove artwork" click was leaving an orphaned
--    DB row pointing at an already-deleted file. Confirmed no orphans
--    exist yet (the 2 real artwork rows still match real storage
--    objects) — nobody had hit "remove" yet. Also had an unused UPDATE
--    policy (no code path ever updates an artwork row).
--
-- 2. order_garments, garment_quantities, order_services, and print_specs
--    had INSERT/UPDATE/DELETE policies for `authenticated`, but no
--    client code queries these tables directly at all (grep confirms) —
--    every write to them happens inside upsert_order's whole-child-set-
--    replace, which is SECURITY DEFINER owned by `postgres`
--    (rolbypassrls = true), so it bypasses RLS entirely regardless of
--    what's granted to `authenticated`. Those three write policies per
--    table were pure excess surface: a compromised/malicious client
--    credential could otherwise mutate these rows directly via
--    PostgREST, bypassing upsert_order's consistency guarantees
--    entirely. SELECT stays — getOrder's nested embed still needs it,
--    since PostgREST resource embedding evaluates RLS per embedded
--    table for the calling role even inside one query.

create policy "staff can delete artwork" on artwork
  for delete to authenticated using (true);

drop policy "staff can update artwork" on artwork;

drop policy "staff can insert order_garments" on order_garments;
drop policy "staff can update order_garments" on order_garments;
drop policy "staff can delete order_garments" on order_garments;

drop policy "staff can insert garment_quantities" on garment_quantities;
drop policy "staff can update garment_quantities" on garment_quantities;
drop policy "staff can delete garment_quantities" on garment_quantities;

drop policy "staff can insert order_services" on order_services;
drop policy "staff can delete order_services" on order_services;

drop policy "staff can insert print_specs" on print_specs;
drop policy "staff can update print_specs" on print_specs;
drop policy "staff can delete print_specs" on print_specs;

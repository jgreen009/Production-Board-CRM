-- Product decision: admins/owners can now permanently delete an order
-- (and everything attached to it) from Order Detail. Every child table's
-- order_id FK is already ON DELETE CASCADE (order_garments,
-- garment_quantities via order_garments, order_services, artwork,
-- print_specs, order_activity), so a single DELETE FROM orders cleans up
-- every DB row; the client is responsible for removing the corresponding
-- Storage objects (artwork files, mockup previews) before issuing the
-- delete, since Storage isn't covered by SQL cascade.
--
-- Scoped to admin/owner only (reusing the same is_admin_or_owner() helper
-- used elsewhere) — this is a genuinely irreversible action, unlike every
-- other order mutation in the app, which staff can already do freely.
create policy "admin or owner can delete orders"
on orders
for delete
to authenticated
using (is_admin_or_owner());

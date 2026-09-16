-- Fix: deleting an order that was created via a public order link (or that
-- happens to be a link's resulting_order_id for any other reason) failed
-- with "violates foreign key constraint public_order_links_resulting_order_id_fkey"
-- because that FK (added in 20260912000000_public_order_links.sql) had no
-- ON DELETE behavior, defaulting to NO ACTION/restrict. Every other
-- order-referencing child table cascades (see deleteOrder's own comment in
-- src/api/orders.ts) — this one was missed since it was added in a
-- different migration.
--
-- ON DELETE SET NULL, not CASCADE: the link itself should survive an order
-- deletion (staff may still want to see the link existed/was used), it
-- just loses the now-gone order it pointed to. resulting_order_id is
-- already nullable and already means "no order yet" for an unused link.
alter table public_order_links drop constraint public_order_links_resulting_order_id_fkey;
alter table public_order_links add constraint public_order_links_resulting_order_id_fkey
  foreign key (resulting_order_id) references orders(id) on delete set null;

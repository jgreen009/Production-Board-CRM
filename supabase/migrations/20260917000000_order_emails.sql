-- Transactional order emails (Batch A). One row per send attempt, written
-- only by trusted server-side code (the send-order-email / public-order
-- Edge Functions, using the service-role key). Browsers never insert or
-- update rows here — staff can read them, nothing else.

create table order_emails (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  email_type text not null check (email_type in ('staff_order_summary', 'customer_order_receipt')),
  recipient text not null,
  resend_email_id text,
  status text not null check (status in ('queued', 'sent', 'delivered', 'failed', 'bounced')),
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_emails_order_id_idx on order_emails(order_id);

-- At most one live attempt per order and email type. "Live" = queued, sent,
-- or delivered. A failed or bounced attempt does not count, so a retry can
-- always insert a new row. This is the database-level guard against
-- duplicate sends: two concurrent sends for the same order and type cannot
-- both reach Resend, because the second insert fails with 23505.
create unique index order_emails_one_live_per_type
  on order_emails (order_id, email_type)
  where status in ('queued', 'sent', 'delivered');

create trigger order_emails_updated_at
  before update on order_emails
  for each row execute function set_updated_at();

alter table order_emails enable row level security;

create policy "staff can read order_emails" on order_emails
  for select to authenticated using (true);

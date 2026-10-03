-- Customer confirmation (Batch B). Approval state is kept separate from email
-- delivery state: order_emails tracks sends, order_confirmations tracks what
-- the customer approved. Rows here are written only by trusted Edge Functions
-- (service role). Browsers may read staff-visible state through RLS, and
-- nothing anonymous can touch the table directly.

create table order_confirmations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  -- SHA-256 hex of the raw URL token. The raw token exists only inside the
  -- email link, is never stored, and is never logged.
  token_hash text not null unique,
  customer_email text not null,
  status text not null check (status in ('pending', 'confirmed', 'superseded')),
  -- SHA-256 over the customer-visible summary at the moment it was last
  -- sent (pending) or confirmed (confirmed). Excludes timestamps, ids, preview
  -- URLs, and every internal field, so internal-only edits never change it.
  summary_hash text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  confirmed_at timestamptz,
  -- Deliberately null for now: confirmation links stay valid until the order
  -- is confirmed or superseded. Set only through an explicit, documented
  -- policy change, never silently.
  expires_at timestamptz,
  superseded_at timestamptz,
  updated_at timestamptz not null default now()
);

create index order_confirmations_order_id_idx on order_confirmations(order_id);

-- At most one active (pending or confirmed) confirmation per order. A
-- superseded row never blocks a new one.
create unique index order_confirmations_one_active_per_order
  on order_confirmations (order_id)
  where status in ('pending', 'confirmed');

create trigger order_confirmations_updated_at
  before update on order_confirmations
  for each row execute function set_updated_at();

alter table order_confirmations enable row level security;

create policy "staff can read order_confirmations" on order_confirmations
  for select to authenticated using (true);

-- Lets one email attempt be traced to the confirmation it carried. The live-
-- send guard now includes the confirmation, so a reconfirmation email after
-- a supersession is not blocked by the earlier one. Receipts keep a null
-- confirmation_id, so their guard is unchanged.
alter table order_emails
  add column confirmation_id uuid references order_confirmations(id) on delete cascade;

drop index order_emails_one_live_per_type;

create unique index order_emails_one_live_per_type
  on order_emails (order_id, email_type, coalesce(confirmation_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('queued', 'sent', 'delivered');

-- Additive activity type: one entry per customer confirmation, written only
-- by the confirm action on a real pending -> confirmed transition.
alter table order_activity drop constraint order_activity_activity_type_check;
alter table order_activity add constraint order_activity_activity_type_check
  check (activity_type in (
    'created', 'priority', 'artwork', 'garments', 'production', 'mockup', 'payment', 'assignment',
    'customer_confirmation'
  ));

# Orders Page — Source Visibility Patch

Ensures customer-link-submitted orders appear alongside staff-created orders on the main Orders page, with a clear source label — no separate module, no hidden orders.

## 1. Original issue

The stated concern: public-link-created orders might be hidden, separated, or require a different page to view, instead of appearing in the same operational order list as staff-created orders.

## 2. Root cause

**There was no actual visibility bug.** A full audit of the data path (`OrdersList.tsx` → `useOrders()` → `listOrders()` → Supabase) plus a live disposable-order test found that a customer-link order already satisfies every condition the Orders query checks:

- `listOrders()` filters only `.eq('order_state', 'Active')` — no source-based filter exists anywhere in the query, the hook, or `OrdersList.tsx`'s tab/search logic.
- `create_public_order_submission` (the public RPC) already inserts every order with `order_state = 'Active'` immediately — never `'Draft'` — so it was never excluded by that filter.
- `orders.source` (`'staff' | 'public_form'`) already existed as a column (added in the earlier Public Order Link work), was already selected via `ORDER_SELECT`'s `*`, and was already mapped through to the domain `Order` type in `src/api/mappers/order.ts`.
- Every internal default (payment/artwork/garment/production status, `assigned_to: null`) the public RPC sets matches what a normal new staff order gets — nothing about a public order's shape is structurally different enough to be excluded by any existing UI assumption.

**Live-verified**: submitted a disposable public order (`SP-1221`) through the real Edge Function, then queried the database with `listOrders()`'s exact filter (`order_state = 'Active'`) — the order matched every condition and would have appeared in the list with zero code changes. The actual, sole gap was that **nothing in the UI displayed the `source` value** — the data was already there and already visible in every query, just not rendered anywhere.

## 3. Orders query change

**None.** `listOrders()`, `useOrders()`, `useProductionBoard()`, and the Dashboard's order query were all inspected and confirmed to already include customer-link orders with no source-based exclusion. This patch is UI-only.

## 4. Source-of-truth strategy

Used the existing `orders.source` column directly — no fragile `order_activity` message string parsing was needed or considered, since a real, reliable, already-migrated structured column already existed from the earlier Public Order Link batch.

## 5. Schema change

**None required.** `orders.source text not null default 'staff' check (source in ('staff', 'public_form'))` already existed. This patch's own brief suggested `customer_link` as an example value, but the column already live-uses `'public_form'` — kept as-is rather than introduced a second migration to rename an already-working, already-populated value for cosmetic reasons. The UI label ("Customer Submitted") is what staff actually see; the internal value name is invisible to them either way.

## 6. Source labels

`src/utils/orderSource.ts` — `getOrderSourceLabel(source)`:

| Internal value | Staff-facing label |
|---|---|
| `staff` | Staff Created |
| `public_form` | Customer Submitted |

`src/components/domain/OrderSourceBadge.tsx` renders this as a `Badge` — neutral slate for Staff Created, brand-accent/soft for Customer Submitted (informational distinction, not a warning colour, per the brief). No internal term (`anonymous`, `Edge Function`, `public_order_links`, `token`, `RPC`) is ever rendered — pinned down by a dedicated test.

## 7. Desktop UX

- **Orders list** (`OrdersList.tsx`): a compact `OrderSourceBadge` sits directly beside the order number link in the table (`SP-1221 [Customer Submitted]`) — no new dedicated column, keeping table density unchanged.
- **Order Detail** (`OrderDetail.tsx`): the badge sits in the header row next to the production-status badge, beside the job name.
- **Customer Detail** (`CustomerDetail.tsx`): the badge sits beside the order number in that customer's order-history table.

## 8. Mobile UX

- **Orders list** mobile cards (`OrderCard`'s `extra` slot): the source badge now appears first, before the assignee badge, in the same badge row already used for assignment — visible, not buried in a menu.
- **Customer Detail** mobile cards: the badge sits beside the production-status badge in the existing status row.

## 9. Public order behavior

Unchanged by this patch — `create_public_order_submission` already hardcodes `source = 'public_form'` as a literal in its own `INSERT ... VALUES (...)` statement (never reads it from the JSON payload at all). **Live-verified**: submitted a payload with an explicit spoofing attempt (`order.source: "staff"` and a top-level `source: "staff"` field) — the resulting order (`SP-1222`) still correctly recorded `source: 'public_form'`, proving the field cannot be influenced by the client in any way.

## 10. Staff order behavior

Unchanged — `upsert_order`'s `INSERT` column list has never included `source` at all (confirmed by reading its live function body), so every staff-created order (and every Reorder, which uses the exact same save path) gets `source = 'staff'` purely from the column's own `DEFAULT`, with no code anywhere that could set it otherwise.

## 11. Mockup behavior

Unchanged — `MockupThumbnail`'s saved-preview → live-V2-fallback → icon hierarchy has no source-awareness at all; a customer-submitted order without a saved preview PNG already renders the same live `GarmentMockup` fallback a staff order without one would, since eligibility is keyed only on `isPrintPositionSupported(garmentType, position)`, never on `order.source`.

## 12. Production Board behavior

Unchanged — `useProductionBoard()` calls the same `useOrders()` hook Orders/Dashboard use, then applies its own due-date/priority/assignment/status filters, none of which reference `source`. A customer-submitted order flows into the board under the exact same operational rules as a staff order.

## 13. Customer Detail behavior

A customer-link order now shows its source badge in that customer's order history (§8), appearing identically to a staff order otherwise — same table, same row shape, same Reorder button.

## 14. Reorder source behavior

**Reorder always resolves to `staff`**, regardless of whether the original order it's reordering from was `staff` or `public_form` — confirmed both by code inspection (`mapOrderFormToUpsertPayload`'s output has no `source` key, matching `upsert_order`'s own `INSERT` never reading one) and by a new test (`order.test.ts`, "never includes a source field — staff/reorder saves cannot influence order source"). This is correct by construction: a staff member is always the one clicking Reorder, and the DB default (`'staff'`) is the only thing that ever applies when `source` is absent from a save payload.

## 15. Tests

- `src/utils/orderSource.test.ts` (new) — label mapping for both values, and an explicit check that no internal implementation term ever leaks into a label.
- `src/api/mappers/order.test.ts` (extended) — `mapOrderFormToUpsertPayload` never includes a `source` key; `mapDatabaseOrderToDomain` maps `'staff'` and `'public_form'` correctly and produces an otherwise-identical shape either way; an unassigned public-form order maps the same "unassigned" shape a staff order would.

Search/filter/mockup/Production-Board participation were verified by code inspection (no source-aware branch exists anywhere in those paths to test) plus the live disposable-order check (§2, §20) rather than new unit tests, consistent with this project's established pattern of live-verifying Supabase-side/integration behavior rather than mocking it.

## 16. Live verification

Using disposable test data (created and cleaned up within this session):

1. Submitted a real public order through the live Edge Function (`SP-1221`) — confirmed it satisfies `listOrders()`'s exact filter (`order_state = 'Active'`) via direct SQL.
2. Submitted a second public order with an explicit `source` spoofing attempt (`SP-1222`) — confirmed the stored `source` was still `'public_form'`, unaffected by the malicious field.
3. Ran the Supabase security advisor after all changes — the same 4 pre-existing findings only (three intentional `SECURITY DEFINER` functions, one unrelated auth setting), nothing new introduced.
4. All disposable orders, customers, and public order links were deleted after verification.

Order Detail, mockup rendering, and Customer Detail history for a customer-submitted order were confirmed via the same disposable order before cleanup — the badge appeared correctly in all three surfaces, and the order opened through the normal Order Detail route with no separate page.

## 17. Known limitations

- **Optional source filter** (Orders page "All Sources / Staff Created / Customer Submitted" dropdown) was added since it was low-complexity and directly useful, per the brief's own "optional, add if genuinely useful" allowance — not requested as a hard requirement.
- **Production Board and Dashboard do not show the source badge** — the brief only required they not *exclude* customer-submitted orders (confirmed, §12/§13), not that they display the badge; adding it there was out of this patch's stated scope.
- **The `orders.source` column's second value is named `'public_form'`, not `'customer_link'`** as the brief's own example schema suggested — documented in §5 as a deliberate choice to avoid a needless rename migration of an already-working column; the staff-facing label ("Customer Submitted") is what matters operationally.

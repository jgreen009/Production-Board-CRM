# SALT PRINTS — Frontend Handover

**Purpose of this doc**: a complete, current snapshot of the frontend-only
build, written so it can be handed to whoever (human or AI) drafts the next
prompt for backend + real functionality work. It documents what exists, how
it's structured, what's real vs. decorative, and — most importantly — every
place the current implementation takes a shortcut *because* there's no
backend yet. Those shortcuts are exactly the decisions the backend phase
needs to make deliberately.

This supersedes `docs/UI_PLAN.md` as the "current state" reference —
`UI_PLAN.md` documents the original Phase 1 build plan and is now stale in
several places (New Order form section layout, print position model, print
size handling all changed after that doc was written). Keep `UI_PLAN.md`
around for historical assumptions/rationale; treat this doc as ground truth
for what the code actually does today.

Last verified against the codebase: 2026-09-08.

---

## 1. Tech stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4 (via `@tailwindcss/vite`; theme tokens live in
  `src/index.css` under `@theme`, **not** a `tailwind.config.js`)
- React Router v7 (`BrowserRouter`, all routes flat under one `AppShell`
  layout route — no nested/data routers, no loaders)
- React Hook Form + Zod (`src/schemas/orderFormSchema.ts`) — the New Order
  form's only real client-side validation
- lucide-react for icons
- No TanStack Table, no state management library (Redux/Zustand/etc.), no
  date library, no HTTP client — none of these exist in the dependency tree
  yet and all would plausibly be introduced during backend integration
- No backend, no auth, no real file storage, no payments — see §8

Run/build:
```
npm install
npm run dev      # Vite dev server
npm run build    # tsc -b && vite build (this is the real type-check step —
                  # `npx tsc --noEmit` at the root does NOT type-check
                  # anything, the root tsconfig.json is a solution file)
npm run lint      # oxlint
```

## 2. Directory structure

```
src/
  types/index.ts        All domain types in one file (see §4)
  schemas/
    orderFormSchema.ts   Zod schema + inferred form-value types for the
                          New Order form only — no other form has a schema
  data/                  Mock data + catalog constants + lookup helpers
    mockCustomers.ts      9 customers
    mockOrders.ts         14 orders (+ getOrderById, mockOrders.unshift via orderStore)
    mockGarments.ts       Garment type/brand catalog (matches paper form)
    mockServices.ts       8-service catalog
    mockStatuses.ts       Status enum -> {label, className} + lookup fns for every status dimension
    mockActivity.ts       Activity feed entries keyed by orderId
    orderStore.ts         addOrder() — mutates the mockOrders array in place
    printPositions.ts     PRINT_POSITIONS — the one authoritative print-position list
    printSizes.ts         PRINT_SIZES — the 5 print-size presets (A5/A6/A4/A3/Oversize)
    garmentImages.ts      GarmentType -> {front, back} image URL map
  utils/                 date, quantity, status, dashboard, customers, colour, id helpers
  hooks/
    useProductionBoard.ts  All Production Board state: filters/search/sort/
                            selected-row/status-edit, over the in-memory
                            mockOrders array
  components/
    ui/                  Generic primitives: Button, Card, Field (Input/
                          Select/Textarea/Checkbox/Toggle/FormField), Badge,
                          Tabs, Drawer, Tooltip, EmptyState, LoadingSkeleton,
                          ConfirmDialog, Toast/ToastProvider
    domain/              App-specific: AppSidebar, AppHeader, PageHeader,
                          StatCard, StatusBadge, StatusSelect, OrderCard
                          (mobile card view, shared by OrdersList + Production
                          Board), OrderFormSection, GarmentCard,
                          SizeQuantityGrid, ArtworkUploader, ArtworkFileCard,
                          GarmentMockup, MockupThumbnail, OrderSummary,
                          ActivityTimeline, ProductionTimeline,
                          CustomerSelector (unused, see §8)
    domain/production/   ProductionTable, ProductionToolbar, OrderQuickView
                          — used only by the Production Board; OrdersList and
                          CustomersList render their own plain inline
                          <table> markup instead of a shared table component
  layouts/AppShell.tsx   Sidebar + header + <Outlet/>
  pages/                 One file per route (see §3); large routes split:
    new-order/           New Order form sections + defaultValues.ts + buildOrder.ts
    order-detail/        7 tab panel components
    settings/            5 settings sub-pages
```

## 3. Routes

```
/                       redirect -> /dashboard
/dashboard              Dashboard
/production             Production Board
/orders                 Orders list
/orders/new             New Order form
/orders/:id             Order detail (7 tabs)
/customers              Customers list
/customers/:id          Customer detail
/settings               Settings index (card nav)
/settings/garments      Settings - Garments
/settings/services      Settings - Services
/settings/statuses      Settings - Statuses
/settings/mockups       Settings - Mockup templates
*                       NotFound
```

No auth guard anywhere — every route is open. `public/_redirects` and
`vercel.json` exist so client-side routes resolve correctly on Netlify/Vercel
static hosting (SPA fallback to `index.html`).

## 4. Domain model (`src/types/index.ts`)

This is the section to lean on hardest when designing a database schema —
it's the complete shape of an order today.

### Status/enum types
```ts
PaymentStatus     = Unpaid | Deposit Paid | Part Paid | Paid | On Account
ArtworkStatus     = Not Started | Artwork To Do | Artwork Supplied | Need Artwork
                  | Need Vectored | Mockup Required | Awaiting Approval | Approved | Completed
GarmentStatus     = Not Required | Need Ordering | Ordered | Follow Up
                  | Part Received | Supplied | Received | Completed
ProductionStatus  = New | Ready | Queued | In Production | Quality Check
                  | Ready for Collection | Out for Delivery | Completed | On Hold
Priority          = Normal | High | Urgent
Turnaround        = Standard | Rush | Same Day | Custom   // "Custom" has no
                                                            // form control to
                                                            // set it (see §8)
DeliveryMethod    = Pick Up | Delivery
GarmentType       = T-shirt | Polo | Shirt | Hi-Viz vest | Singlet
                  | Crew neck (jumper) | Hoody | Shorts | Pants | Bennie | Hats | Customized
GarmentBrand      = AS colour | Gildan | Bocini | Sportage | Aussie pacific | Customized
AdultSize         = S | M | L | XL | 2XL | 3XL | 4XL | 5XL
YouthSize         = 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18
ServiceName       = Screen Printing | Sublimation | Embroidery | Custom School
                  | Direct To Film | Custom Sports | Direct To Garment | Vinyl/Digital Transfer
PrintPosition     = Left Chest | Right Chest | Across Chest | Full Front
                  | Left Sleeve | Right Sleeve | Full Back | Top Back | Bottom Back
ArtworkFileType   = PNG | JPG | WEBP | SVG | PDF | AI
```
Payment / Artwork / Garment / Production status are intentionally
independent dimensions — never collapse them into one "status" field.

### Entities
```ts
Customer {
  id, name, company, email, phone, notes?, createdAt
}

GarmentItem {              // one garment line on an order
  id, type: GarmentType, brand: GarmentBrand, colour: string,
  sizing: 'Adult' | 'Youth',
  adultQuantities?: Partial<Record<AdultSize, number>>,
  youthQuantities?: Partial<Record<YouthSize, number>>
}

OrderService { name: ServiceName, enabled: boolean }

Artwork {                  // an uploaded file
  id, fileName, fileType: ArtworkFileType, sizeKb, uploadedAt,
  previewUrl?: string      // browser object-URL for previewable types only —
                            // see §8, this does NOT survive a refresh
}

PrintSpec {                 // one physical print: where + what colour +
                             // what size + (optionally) how to preview it
  id, position: PrintPosition, colour: string, widthMm: number, heightMm: number,
  garmentType?: GarmentType,    // which garment to render the mockup preview on
  garmentColour?: string,       // which colour variant to render
  artworkId?: string,           // FK into Order.artwork[]
  offsetX?: number, offsetY?: number   // manual drag-to-reposition, % of canvas
}

OrderActivityEntry {
  id, orderId, timestamp, message,
  type: created | priority | artwork | garments | production | mockup | payment
}

Order {
  id, orderNumber, customerId, customer: string,   // customer = denormalized display name
  jobName, phone, email, createdAt, dueDate,
  turnaroundType: Turnaround, quantity: number,
  paymentStatus, artworkStatus, garmentStatus, productionStatus, priority,
  deliveryMethod, rushFee: boolean,
  suppliesGarments, graphicDesignServices,
  specialisedApplication: boolean, specialisedApplicationDetails?: string,
  services: OrderService[],
  garments: GarmentItem[],
  printSpecs: PrintSpec[],
  artwork: Artwork[],
  notes: string,               // customer-facing notes (paper form's Notes box)
  productionNotes: string,     // internal/staff-only notes
  staffCompleted: boolean,     // paper form's "Section for staff — Completed" checkbox
}
```

**Important**: `PrintSpec` used to be two separate arrays (`printDetails` +
`mockups`) and was deliberately unified into one during this build, because
a print's position/colour/size and its mockup preview are the same concept.
If a backend design is tempted to split them back into a `print_specs` table
and a `mockups` table, that reintroduces the exact duplication this was
built to remove — keep them as one entity.

## 5. Current "persistence" layer — READ THIS BEFORE DESIGNING THE BACKEND

There is no real persistence. Specifically:

- `mockOrders`, `mockCustomers`, `mockGarments`/`mockServices`/`mockStatuses`
  catalogs are plain exported `const` arrays in TypeScript files, loaded
  once at module init.
- `addOrder()` (`src/data/orderStore.ts`) does `mockOrders.unshift(order)` —
  it mutates the shared array reference in place. Because every page imports
  the *same* module-level array, a newly created order shows up on
  `/orders`, `/production`, etc. for the rest of that browser session — but
  **a page refresh loses everything** (back to the 14 seeded orders).
- `useProductionBoard` copies `mockOrders` into local `useState` and does
  all filtering/search/sort client-side over that in-memory array.
- Order Detail's inline edits (see §8, none currently exist as real edits —
  they're all toast-stubbed) would need an update path once wired to a
  backend; right now nothing in Order Detail writes back to the array.
- Artwork file "upload" is 100% client-side: `ArtworkUploader` reads a
  `File` via `URL.createObjectURL()` for previewable types and just records
  `fileName`/`fileType`/`sizeKb` for everything else. **No file is ever
  transmitted anywhere.** The object URL is only valid for that browser tab
  session and is never revoked, never uploaded, never persisted.
- Customer "search" in the New Order form doesn't exist anymore (see §8) —
  every order is created as if the customer is new.

Anywhere you see `showToast('... arrives with backend integration.', 'info')`
in the code, that's a deliberate stub marking an action that needs a real
endpoint. Search the codebase for that exact string to find every one.

## 6. Page-by-page functional breakdown

### Dashboard (`/dashboard`)
KPI `StatCard`s, "Orders Requiring Attention" table, "Upcoming Deadlines",
"Recent Activity" feed — all computed client-side from `mockOrders` +
`mockActivity` via `src/utils/dashboard.ts`. No interactivity beyond
navigation links.

### Production Board (`/production`)
The most fully-interactive read/write screen pre-backend:
- Search, 5 filter dimensions, 7 view tabs, sort — all client-side over
  `useProductionBoard`'s in-memory copy of `mockOrders` (state is **not**
  shared with other routes; navigating away and back resets it to the
  original 14+created orders, losing any Production-status edits made here).
- Clicking a row opens `OrderQuickView` (drawer/bottom-sheet). Its status
  pill changes call `updateProductionStatus()`, which only updates the local
  `useProductionBoard` state — **does not** write back to `mockOrders`,
  so a Production status change made here is invisible on `/orders/:id` or
  after leaving the board. This is a real inconsistency the backend phase
  needs to resolve (single source of truth + real mutation endpoint).
- Desktop: `ProductionTable`. Mobile (`<md`): card list, same data.

### Orders list (`/orders`) / Customers list (`/customers`)
Search/filter/sort/tabs over `mockOrders`/`mockCustomers` directly (not
through the production-board hook). Row click navigates to detail. No
create/edit/delete actions except "+ New Order" (navigates to `/orders/new`).

### New Order form (`/orders/new`) — the largest, most-iterated piece
See §7 for the full breakdown — it's covered separately because of its size
and because most of this session's work touched it.

### Order Detail (`/orders/:id`)
7 tabs (Overview, Order Form, Garments, Artwork & Mockups, Production,
Files, Activity), each a read-only render of one `Order` object pulled from
`mockOrders` by `id`. **"Edit Order" and "More actions" are stubs** — they
show a toast and do nothing else. No tab currently supports editing.

### Settings (`/settings/*`)
5 sub-pages (Garments, Services, Statuses, Mockup Templates, index). Toggles
and "editable-looking" controls update local component state only — nothing
persists across a refresh, nothing writes back to the catalog files.

## 7. New Order form — detailed breakdown

Single `useForm` (React Hook Form) instance + one Zod schema
(`orderFormSchema.ts`), `mode: 'onSubmit'`. On submit: `buildOrderFromForm()`
maps form values to an `Order`, `addOrder()` unshifts it into `mockOrders`,
shows a success toast, navigates to `/orders/:id`. No network call exists —
"Save Draft" just shows a toast and does nothing else.

Section order in the rendered form (`NewOrderForm.tsx`), with the
`OrderFormSection` step badge shown to the user:

| Step | Section | Component | Notes |
|---|---|---|---|
| 2 | Customer / Job | `CustomerJobSection` | **Just 4 plain fields: Name, Phone, Email, Due Date.** No customer search/link — see §8. |
| 3 | Turnaround & Delivery | `TurnaroundDeliverySection` | 3-button Turnaround picker (Same Day/Rush/Standard) auto-sets `rushFee` and suggests Priority; Pick Up/Delivery toggle; Priority buttons. |
| 4 | Services Required | `ServicesSection` | 8-checkbox catalog (responsive grid: 2 columns below 1024px, 3 columns at `lg+`) + 2 toggles (Supply Garments, Graphic Design Services), side by side at all widths. |
| 5 | Garment & Styles | `GarmentStylesSection` | Merged wrapper around 3 sub-blocks (below) — this used to be 4 separate top-level sections (Garments, Artwork, Mockup Workspace, Print Details); they were consolidated into one card. |
| 5a | — Garments | `GarmentsSection` → `GarmentCard` | Repeating garment cards (`useFieldArray`), each with Type/Brand/Colour row + Adult/Youth toggle + `SizeQuantityGrid`, running Sub Total. |
| 5b | — Print Details & Mockups | `PrintDetailsSection` | **Unified** repeating list (`useFieldArray` on `printSpecs`) — each entry has Position (9-button group, from `PRINT_POSITIONS`), Print Colour, Artwork select, Print Size (5-button group, from `PRINT_SIZES`), Preview Garment/Colour, and an inline live `GarmentMockup` preview (drag-to-reposition, dashed placeholder box when no artwork selected). |
| 5c | — Artwork & Files | `ArtworkSection` → `ArtworkUploader`/`ArtworkFileCard` | One dropzone, multi-file, client-side only (see §5/§8). |
| 6 | Payment Status | `PaymentAndNotesSection` | Single select, 5 values. |
| 7 | Internal Notes | `PaymentAndNotesSection` | Production Notes (internal) + Customer Notes (`notes`, maps to paper form) + staff-completed checkbox. |
| — | Summary | `OrderSummary` | Sticky sidebar (`lg+`) / inline card (mobile), live-derived from `watch()`, plus static terms copy and the Create Order submit button. |

### Business logic / auto-derivations baked into the form
- Turnaround = 'Rush' ⇒ `rushFee = true` (and vice versa when switching away
  from Rush); Turnaround = 'Same Day' ⇒ Priority auto-set to 'Urgent'.
  Staff can still override Priority manually afterward.
- Name field writes to **both** `jobName` and `newCustomerName` and forces
  `customerId = null` on every keystroke (see §8 — there is no path to set
  `customerId` to an existing customer anymore).
- Selecting a Print Position doesn't change Print Size — Size is fully
  independent (5 fixed presets), but the *rendered mockup box* is clamped to
  a per-position max area (`PRINT_POSITIONS[].maxWidthPct/maxHeightPct`) so
  e.g. picking "Oversize" on a sleeve doesn't visually overflow the sleeve.
- Print Spec's mockup preview garment/colour defaults to the order's first
  garment if not explicitly overridden per-spec.
- `view` (Front/Back) for a print spec's mockup render is *derived* from the
  selected Position (`getPrintPositionConfig(position).view`) — there is no
  separate Front/Back toggle in the current UI.

## 8. Known gaps & frontend-only shortcuts — read before writing the backend prompt

This is the most important section for scoping backend work. Everything
here works *because* there's no backend — each one is a decision point.

1. **No real persistence.** Every "create"/"update" mutates an in-memory
   array or local component state. Refresh = data loss beyond the 14 seeded
   orders / 9 seeded customers.
2. **Customer linking is currently broken/removed.** `CustomerSelector.tsx`
   (searchable combobox + "create new customer") exists in the codebase but
   is **unused** — no import references it anywhere. The New Order form's
   Customer/Job section was simplified down to 4 plain fields (Name, Phone,
   Email, Due Date) partway through this build, and the Name field always
   sets `customerId: null`. So today, **every order created via the form is
   an orphan with no real customer link**, even if the name matches an
   existing customer exactly. `buildOrderFromForm()` papers over this by
   generating a fresh `customerId` via `generateId('cust')` for every
   submission. A backend integration needs to decide: resurrect
   `CustomerSelector`, do fuzzy match-or-create server-side by
   name/email/phone, or something else — this is not a small gap.
3. **No file storage.** Artwork "upload" never leaves the browser. Preview
   images are `URL.createObjectURL()` blob URLs, valid only for the current
   tab's lifetime. Non-previewable types (PDF/AI) just record filename/size
   with zero actual file content anywhere.
4. **Global search bar is decorative.** `AppHeader`'s "Search orders,
   customers..." input has no `value`/`onChange` — it does nothing. Actual
   search only exists locally on `/orders`, `/customers`, and `/production`
   (three separate implementations, not shared).
5. **Production Board status edits don't persist across navigation.**
   `useProductionBoard` holds its own copy of `mockOrders`; status pill
   changes there never write back to the shared `mockOrders` array. Visit
   Order Detail or Orders List after changing a status on the board and
   you'll see the old value.
6. **Order Detail is 100% read-only.** "Edit Order" and "More actions" are
   both stubbed with an info toast (`'... arrives with backend
   integration.'`) — no field on an existing order can currently be edited
   post-creation anywhere in the UI.
7. **Settings pages don't persist.** Every toggle/edit-looking control in
   `/settings/*` is local component state, reset on refresh, never written
   back to `mockGarments.ts`/`mockServices.ts`/etc.
8. **`Turnaround = 'Custom'` is unreachable from the UI.** It's a valid
   enum value (kept for badge-rendering completeness / possible future use)
   but no control in the Turnaround picker offers it — only Same
   Day/Rush/Standard are buttons.
9. **`specialisedApplication` / `specialisedApplicationDetails` are
   display-only now.** They're still on the `Order` type and still shown on
   Order Detail (Overview/Order Form tabs) for the 14 seeded orders (one of
   which — SP-1009 — has `specialisedApplication: true` as a demo state),
   but the New Order form has no control to set them anymore (the toggle was
   removed). New orders will always have `specialisedApplication: false`.
10. **No auth, no roles, no multi-tenancy.** Every route is open; there's no
    concept of "logged in as staff member X."
11. **Garment mockup photos have baked-in diagram markup.** All 10 garment
    reference photos in `src/assets/mockups/` have the paper form's
    numbered-circle/size-box diagram burned into the image pixels (not
    overlaid by code) — this was flagged mid-build and intentionally
    deferred; the user plans to source clean replacement images later. Two
    catalog types (`Shirt`, `Customized`) have no photo at all and fall back
    to a generic drawn SVG silhouette.
12. **Dates are plain ISO strings**, generated relative to "today" at module
    load (`src/utils/date.ts`) so demo states (overdue/due-today/etc.) stay
    correct whenever the app is opened — there's no date library and no
    timezone handling.
13. **Order numbers are derived client-side** (`nextOrderNumber()` in
    `src/utils/id.ts`) by scanning the current in-memory `mockOrders` for the
    highest `SP-XXXX` and incrementing — this is a race-condition-prone
    pattern that must become a real sequence/counter server-side.
14. **IDs are client-generated** (`generateId()`, a simple random-suffix
    function in `src/utils/id.ts`) — not UUIDs from a database.

## 9. Explicit scope boundary (per project CLAUDE.md)

The following were **explicitly out of scope** for this phase and remain
fully unbuilt: Supabase/any backend, authentication, backend functions, real
file storage, payment processing, AI features beyond what's already built.

## 10. Suggested next steps for the backend prompt

Questions worth resolving before drafting that prompt, based on the gaps
above:
- Customer linking: rebuild the search/create-new flow, or handle matching
  server-side?
- File storage: which provider, and does the Artwork/PrintSpec preview flow
  need to change (e.g. upload-then-reference vs. inline base64)?
- Single source of truth for order state: Production Board's local copy vs.
  the shared `mockOrders` reference need to collapse into one real data
  fetch/mutation layer (e.g. React Query/SWR over real endpoints).
- Whether Order Detail's read-only tabs become editable in place, or a
  separate edit flow/route is introduced.
- Whether `Turnaround: 'Custom'` gets a real control (e.g. manual due-date
  entry) or gets removed from the enum entirely.
- Whether garment mockup images get replaced before or after backend work
  starts (independent of backend scope, but affects file-storage design if
  they end up user-uploadable per garment/colour combination later).

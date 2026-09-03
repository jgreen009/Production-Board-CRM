# SALT PRINTS — UI Plan (Frontend Phase 1)

Reference doc for implementation. Kept practical, not exhaustive.

## 1. Route architecture

React Router v7 (data-less `<Routes>`, no loaders — this phase has no backend).

```
/                       redirect -> /dashboard
/dashboard              Dashboard
/production             Production Board
/orders                 Orders list
/orders/new             New Order form
/orders/:id             Order detail (tabs)
/customers              Customers list
/customers/:id          Customer detail
/settings               Settings index (card nav)
/settings/garments       Settings - Garments
/settings/services       Settings - Services
/settings/statuses       Settings - Statuses
/settings/mockups        Settings - Mockup templates
*                       NotFound
```

All routes render inside `AppShell` (sidebar + top bar + `<Outlet/>`).

## 2. Main layout

`AppShell`
- `AppSidebar` (desktop: fixed 240px column; tablet: collapsible, toggled by a
  header button, overlays content when open; mobile: hidden, replaced by a
  slide-out drawer triggered from `AppHeader`).
- `AppHeader` (sticky top bar per route: title, description, search, "+ New
  Order" where relevant, notification icon, avatar placeholder).
- Content area: `max-w-screen-2xl` padded container, `<Outlet/>`.

Breakpoints used throughout: `sm` 390-640, `md` 768, `lg` 1024, `xl` 1280,
`2xl` 1440+ (Tailwind defaults line up close enough to the required test
widths; verified individually in the responsive pass).

## 3. Component hierarchy (high level)

```
App
 └ AppShell
    ├ AppSidebar
    ├ AppHeader
    └ <Outlet/>
       ├ Dashboard (StatCard grid, AttentionTable, DeadlinesList, ActivityFeed)
       ├ ProductionBoard (Toolbar, OrderTable|OrderCard grid, OrderQuickView drawer)
       ├ OrdersList (Toolbar, OrderTable)
       ├ NewOrderForm (OrderFormSection x N, OrderSummary sticky panel)
       ├ OrderDetail (header, StatCard row, Tabs -> 7 tab panels)
       ├ CustomersList (table)
       ├ CustomerDetail (summary cards, recent orders table, notes)
       └ Settings/* (card nav + per-page tables/lists)
```

## 4. Mock data architecture

`src/data/`
- `mockStatuses.ts` — arrays + color/label maps for Payment, Artwork,
  Garment, Production, Priority, Turnaround. Single source of truth for
  `StatusBadge` colors.
- `mockGarments.ts` — garment catalog (type × brand × available sizes),
  matching section 11.0 verbatim values.
- `mockServices.ts` — service catalog (8 services from the paper form).
- `mockCustomers.ts` — 9 customers, AU small-business names.
- `mockOrders.ts` — 14 orders referencing customers/garments/services,
  covering every required state (overdue, same-day, urgent, completed,
  awaiting artwork, needs vectoring, awaiting garments, printing, ready for
  collection).
- `mockActivity.ts` — activity feed entries, keyed by orderId, used by both
  the dashboard "Recent Activity" feed and the order detail Activity tab.

Domain types live in `src/types/` (not `src/data/`) so components can import
types without pulling mock data into a real build later.

## 5. Order form sections (11 subsections from the brief, in build order)

1. Header (title, order date, actions)
2. Customer / Job (`CustomerSelector` combobox + create-new)
3. Turnaround & Delivery (Rush Fee -> Turnaround -> Priority auto-suggest
   chain, Pick Up/Delivery)
4. Services Required (8 checkboxes + 3 Yes/No toggles, Rush Fee toggle
   mirrors section 3's field — single `rushFee` boolean in form state, not
   duplicated)
5. Garments (`GarmentCard` list, adult + youth `SizeQuantityGrid`, running
   Sub Total)
6. Artwork & Files (`ArtworkUploader`, `ArtworkFileCard` list)
7. Mockup workspace (`MockupWorkspace`: left config panel, center
   `GarmentMockup` canvas, right print-detail panel, front/back thumbnails)
8. Print Details (repeating position/colour/width/height rows)
9. Payment Status (single select)
10. Internal Notes (production notes textarea)
11. Summary panel (`OrderSummary`, sticky on `lg+`, inline card on mobile) +
    terms fine print + Create Order submit

Form state: a single `useForm` (React Hook Form) instance with a Zod schema
(`src/schemas/orderFormSchema.ts`) covering all sections; garments and print
detail rows use `useFieldArray`. Zod validates shape only — nothing is sent
anywhere.

## 6. Production board structure

- `ProductionToolbar`: search input, filter popovers (Status groups,
  Priority, Due date), view tabs, sort dropdown, column-visibility toggle.
- Desktop/tablet (`md+`): `OrderTable` (TanStack Table) with the columns
  listed in section 9 of the brief; status cells use `StatusSelect` (inline
  dropdown, updates local state only).
- Mobile (`<md`): `OrderCard` list, same data, stacked layout.
- Row/card click opens `OrderQuickView` (right-side drawer on desktop,
  bottom sheet–style full-width panel on mobile) with Open Full Order / Edit
  / Close actions.
- Board state (filters, search, sort, selected order, status edits) lives in
  a single reducer-backed hook (`useProductionBoard`) local to the route —
  no global store needed for this phase.

## 7. Order detail structure

Header + 4 `StatCard`s, then a tab bar (`Overview`, `Order Form`, `Garments`,
`Artwork & Mockups`, `Production`, `Files`, `Activity`) rendering one panel
component each under `src/pages/order-detail/`. Tab state is local
(`useState`, no nested routing) since panels are cheap to render and this
keeps the URL simple for this phase.

## 8. Mockup workspace structure

`MockupWorkspace` holds local state: `{ garment, colour, view, position,
artworkId, widthMm, heightMm, printColours, notes }`. `GarmentMockup` renders
an SVG garment silhouette (front/back variants for T-shirt/Hoody/Polo) with
the selected artwork image absolutely positioned over it based on
`position` (a lookup table of approximate x/y/anchor per position, not a
physics layout). A single drag handler (pointer events) allows nudging the
artwork within the canvas bounds — no rotation/scale/layers, and no
Fabric.js. Front/back thumbnails re-render the same SVG at a smaller size
reading from the same state, so switching `view` updates the toggle only,
not two independent states.

## 9. Mobile behavior

- Sidebar collapses to a hidden slide-out drawer (`<lg`), opened via a menu
  button in `AppHeader`.
- Production board switches to card list (<`md`).
- Order/Customers tables switch to stacked cards (<`md`) reusing the same
  row data via a shared render-item function where practical.
- New Order form sections stack full-width; `SizeQuantityGrid` becomes a
  horizontally scrollable row (`overflow-x-auto`) rather than wrapping,
  since size columns must stay aligned to their header.
- Sticky `OrderSummary` (`lg+` only) becomes a normal static card placed
  just before the submit button on smaller screens.

## 10. Reusable UI components

`src/components/ui/` — generic: `Button`, `Card`, `Input`, `Select`,
`Textarea`, `Checkbox`, `Toggle`, `Badge`, `Tabs`, `Drawer`, `Tooltip`,
`EmptyState`, `LoadingSkeleton`, `ConfirmDialog`, `Toast` (+ `ToastProvider`).

`src/components/domain/` — the section-15 list: `AppSidebar`, `AppHeader`,
`PageHeader`, `StatCard`, `StatusBadge`, `StatusSelect`, `OrderTable`,
`OrderCard`, `OrderQuickView`, `CustomerSelector`, `OrderFormSection`,
`GarmentCard`, `SizeQuantityGrid`, `ArtworkUploader`, `ArtworkFileCard`,
`GarmentMockup`, `MockupWorkspace`, `OrderSummary`, `ActivityTimeline`.

## 11. Assumptions made to resolve ambiguity

- **Order numbers**: format `SP-1024` style, auto-incremented in mock data;
  the New Order form shows the next number as a note (not an editable
  field).
- **Toast system**: minimal custom `ToastProvider` + `useToast` hook (no
  extra dependency) since only success/info toasts are needed.
- **TanStack Table**: not used. Both the Production Board and Orders list
  drive sorting from a toolbar/header control over a single in-memory array
  (see `useProductionBoard`) — a plain `<table>` with the existing sort state
  is simpler than wiring column defs for the same behavior, so per section 2
  ("don't force it if plain components are simpler") plain tables are used
  throughout, including Customers.
- **Mockup artwork placement**: approximate/representative, not
  pixel-accurate garment print-area mapping — acceptable per brief ("basic
  frontend-only repositioning if straightforward").
- **Settings pages**: all editable-looking controls are wired to local
  component state (so toggles/edits visibly work) but nothing persists
  across a refresh — consistent with "UI-only, no persistence needed".
- **Customer "Create New"** from the order form creates a transient
  in-memory customer for that session only (not written back to
  `mockCustomers.ts`).
- **Print Position diagram**: implemented as a labelled dropdown rather than
  a clickable silhouette, but the option values and coordinates are taken
  directly from the paper form's numbered Print Position diagram (front 1-6,
  back 1-3, each with its A6/A4/A3 size hint) — see `src/data/printPositions.ts`.
  The Position dropdown is filtered by the selected View so front/back never
  show each other's numbers, and selecting a position auto-suggests that
  position's paper-form size preset (overridable, same pattern as the
  Turnaround/Priority auto-suggest).
- **Garment mockup photos**: `GarmentMockup` renders real reference photos
  (`src/assets/mockups/`, registered in `src/data/garmentImages.ts`) instead
  of hand-drawn silhouettes, for every catalog type except **Shirt** and
  **Customized** (no source photo was supplied for those — they fall back to
  a generic drawn silhouette, clearly labelled "No reference photo" in
  Settings > Mockup Templates). The front/back print-position percentages in
  `printPositions.ts` are shared across all garment photos and were checked
  against each one visually; they land within a few percent almost
  everywhere. Two garment-specific corrections were needed and are called
  out in `GarmentMockup.tsx`: Bennie/Hats only have one real print area (the
  cuff/panel), so every position value anchors there regardless of which
  option is selected; Singlet's photo has more empty canvas margin than the
  other torso photos, so its coordinates get a small uniform Y-nudge. Bottom
  wear (Shorts/Pants) reuses the same chest/center coordinates approximately
  rather than pocket-accurate placement — drag-to-reposition (already
  supported) covers the gap. None of this recolors the photo to match the
  selected garment colour (that was one of the appeals of hand-drawn
  silhouettes); colour is shown as text only for photo-backed garments.
- **Date handling**: plain `Date`/ISO strings + small formatting utils in
  `src/utils/date.ts`; no date library dependency needed for this scope.
- **Icons**: `lucide-react` throughout; no custom icon set.
- **Header split**: `AppHeader` (global, sticky) carries search / notifications
  / avatar / contextual "+ New Order"; the page title + description called
  for in section 6 is rendered per-route by `PageHeader` inside the content
  area instead of duplicating it in the global bar.

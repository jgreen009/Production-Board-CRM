# SALT PRINTS — Production Management App

Frontend-only phase 1 (no backend). See `/docs/UI_PLAN.md` for the full
architecture reference and assumptions made while building this.

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (via `@tailwindcss/vite`; config lives in `src/index.css`
  under `@theme`, not a `tailwind.config.js` file)
- React Router v7 (`BrowserRouter`, routes in `src/App.tsx`)
- React Hook Form + Zod (`src/schemas/orderFormSchema.ts`) for the New Order
  form
- lucide-react for icons
- No TanStack Table — plain tables driven by local sort/filter state (see
  UI_PLAN.md §"TanStack Table" for why)
- No backend, no auth, no real file storage, no payments. Everything runs on
  local component state + the mock data below.

## Run / build

```
npm install
npm run dev        # local dev server
npm run build      # tsc -b && vite build
npm run lint       # oxlint
```

`npx tsc --noEmit` at the repo root does **not** type-check anything (the
root `tsconfig.json` is a solution file with `files: []`). Use `npm run
build` (which runs `tsc -b`) to actually type-check.

## Folder structure

```
src/
  types/          domain types (Order, Customer, GarmentItem, etc.)
  data/           mock*.ts data files + orderStore.ts (mutates mockOrders
                  in place so a created order shows up across routes)
  schemas/        Zod schema for the New Order form
  utils/          date, quantity, status, dashboard, customers, colour, id
  hooks/          useProductionBoard (search/filter/sort/drawer state)
  components/
    ui/           generic primitives (Button, Card, Field, Badge, Tabs,
                  Drawer, Toast, EmptyState, ConfirmDialog, Tooltip, ...)
    domain/       SALT-PRINTS-specific components (StatusBadge, OrderCard,
                  GarmentMockup, MockupWorkspace, OrderSummary, ...)
  layouts/        AppShell (sidebar + header + outlet)
  pages/          one file per route; large routes split into subfolders:
    new-order/    New Order form section components + defaultValues/buildOrder
    order-detail/ Order Detail tab panels
    settings/     Settings sub-pages
```

## Mock data conventions

- All mock data lives in `src/data/` and is plain, mutable TypeScript
  arrays — there is no persistence layer yet. `addOrder()` in
  `orderStore.ts` pushes onto `mockOrders` directly so newly created orders
  are visible on other routes for the rest of the session (lost on refresh).
- Dates in `mockOrders.ts` / `mockActivity.ts` are generated relative to
  `todayIso()` (via `addDays`) rather than hardcoded, so overdue / due-today
  / same-day demo states stay correct no matter when the app is opened.
- Garment catalog (types, brands) and service catalog match SALT PRINTS'
  real paper order form verbatim — see `src/data/mockGarments.ts` and
  `src/data/mockServices.ts`. Don't invent new catalog values without
  checking the paper form reference in the original brief.

## Status enums

Five status dimensions, each with its own badge color config in
`src/data/mockStatuses.ts`:

- **Payment**: Unpaid, Deposit Paid, Part Paid, Paid, On Account
- **Artwork**: Not Started, Artwork To Do, Artwork Supplied, Need Artwork,
  Need Vectored, Mockup Required, Awaiting Approval, Approved, Completed
- **Garments**: Not Required, Need Ordering, Ordered, Follow Up, Part
  Received, Supplied, Received, Completed
- **Production**: New, Ready, Queued, In Production, Quality Check, Ready
  for Collection, Out for Delivery, Completed, On Hold
- **Priority**: Normal, High, Urgent (internal-only, not on the paper form)
- **Turnaround**: Standard, Rush, Same Day, Custom (internal-only)

Payment / Artwork / Garments / Production are independent of each other by
design (business rules in the original brief, §18) — don't collapse them
into a single "status" field.

## Next development phase

Backend/Supabase integration: auth, real persistence for orders/customers,
real file storage for artwork, and wiring the mockup canvas to a proper
editor (Fabric.js or similar) were explicitly deferred — see UI_PLAN.md.

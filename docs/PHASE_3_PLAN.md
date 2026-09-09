# SALT PRINTS — Phase 3 Plan: Mockup Studio

Implementation plan for `docs/PHASE_3_BRIEF.md` Milestone 0. **No application code
was written this session** — this is the plan deliverable only, per the brief's own
kickoff instructions. Read alongside the brief; section numbers below match brief §3.

---

## 0. Baseline (recorded before writing this plan)

```
npm run build   → PASS. Main JS chunk: 777.75 kB (gzip 216.45 kB). CSS: 34.09 kB (gzip 7.20 kB).
                  Vite's >500kB chunk-size warning is already present, pre-Phase-3.
npm run lint    → PASS, no warnings (oxlint).
npm run test    → PASS, 29/29 tests across 6 files.
```

Important nuance for §20 (Performance) below: the 20 garment reference PNGs (761 KB–1.18 MB
each) are **not** inside that 777.75 kB JS chunk — Vite emits image imports as separate
hashed files and the JS only holds the resolved URL string, so they're independently
network-fetched, not bundled. The 777.75 kB figure is pure JS/route code — and it's a single
chunk because **no route in this app is code-split today** (`App.tsx` imports every page
eagerly, no `React.lazy` anywhere yet). That matters directly for Milestone 10: introducing
lazy-loading for the Mockup Studio will be the first code-splitting this codebase has ever
had, not a refinement of existing splitting.

---

## 1. Current mockup architecture (as found in code)

There is no canvas library and no "studio" today. The entire mockup experience is:

- **`src/components/domain/GarmentMockup.tsx`** — a plain `<div>` containing one
  background `<img>` (the garment photo) and one absolutely-positioned `<img>` (the
  artwork), styled with CSS `left/top/width/height` percentages. Dragging is hand-rolled
  pointer-event math (`onPointerDown`/`onPointerMove`/`onPointerUp`) that updates an
  `{x, y}` offset in percentage points, clamped to ±40. **There is no resize handle and
  no rotation** — the only interactive affordance today is drag-to-reposition.
- **Artwork sizing is not a real physical-to-canvas mapping.** The rendered box size is
  `clamp(widthMm * 0.15, 8, maxWidthPct)` — a fixed multiplier, not derived from the
  artwork's actual intrinsic aspect ratio or the garment image's real physical
  dimensions. Width and height percentages are computed independently from `widthMm`/
  `heightMm`, so an artwork's on-screen aspect ratio does not necessarily match its
  real one. This is the single biggest functional gap Phase 3 needs to close (see §5).
- **Print positions already have a real, centralized zone model** —
  `src/data/printPositions.ts`'s `PRINT_POSITIONS`: nine entries, each with a `view`
  (Front/Back), a center `x`/`y` (percentage of garment image), and a
  `maxWidthPct`/`maxHeightPct` clamp box. This is materially the same shape the brief's
  §5.2 `printZones.ts` asks for, just under a different name and using center-point
  rather than top-left-corner coordinates. **Recommendation: evolve this file into the
  new config rather than create a competing one** (see §7).
- **Garment images**: `src/data/garmentImages.ts` maps `GarmentType → {front, back}`
  static-imported PNGs from `src/assets/mockups/`. Two special-case tables sit in
  `GarmentMockup.tsx` itself: `HEADWEAR_ANCHOR` (Bennie/Hats ignore position, always
  anchor to one spot) and `GARMENT_Y_OFFSET` (Singlet nudge). No garment-colour
  rendering exists at all today — the `colour`/`garmentColour` prop is only used by the
  no-photo SVG fallback's fill, never applied to a real photo.
- **One PrintSpec = one print location**, already exactly matching the brief's model —
  `PrintDetailsSection.tsx` renders a flat, repeating `useFieldArray` list (not tabs),
  each card independently editable with position buttons, artwork `<select>`, print-size
  buttons, and its own embedded `GarmentMockup` preview. Removing one print spec doesn't
  touch the others — no state leakage exists today because each spec's fields are fully
  self-contained form-array entries.
- **Order Detail's Artwork & Mockups tab** (`ArtworkMockupsTab.tsx`) already separates
  "Original Artwork" (file grid) from "Mockups" (one small read-only `GarmentMockup` per
  print spec) — structurally this is most of what brief §5.15 asks for; it just needs a
  real preview image instead of a live (but drag-disabled) re-render, plus dimensions/
  garment/artwork-name columns.
- **Order Form tab** (`OrderFormTab.tsx`) already renders a read-only print-spec table
  (Position/Colour/Width/Height) — needs garment, garment colour, artwork filename, and
  a thumbnail added, not built from scratch.
- **Production Board mockup "thumbnail"** (`MockupThumbnail.tsx`) is currently a generic
  `Shirt` icon with a tooltip — **no actual image is rendered anywhere on the board
  today.** This is a real, from-scratch gap.
- **`mockup_templates` table exists and is seeded** (one row per garment type × Front/
  Back) with an `image_storage_path` column that has never been used — the app still
  reads images from bundled `src/assets/mockups/` files, not Storage. Settings →
  Mockup Templates today only toggles `active`; no upload UI exists.
- **No preview/export generation exists at all.** No PNG is ever rendered to a file; no
  `preview_storage_path`-equivalent column exists on `print_specs`.
- **No approval note field or per-mockup approval concept exists** — `ArtworkStatus` is
  a single order-level enum (§14 below).

## 2. Existing PrintSpec model and schema

Frontend type (`src/types/index.ts`):
```ts
interface PrintSpec {
  id: string
  position: PrintPosition
  colour: string
  widthMm: number
  heightMm: number
  garmentType?: GarmentType
  garmentColour?: string
  artworkId?: string
  offsetX?: number
  offsetY?: number
}
```
Database (`print_specs`, from `order_core` migration): `id, order_id, artwork_id,
position, colour, width_mm, height_mm, garment_type (text, not FK — preview hint only),
garment_colour, offset_x, offset_y, sort_order, created_at, updated_at`. Mapped 1:1,
both directions, by `src/api/mappers/printSpec.ts` (`mapPrintSpecRowToDomain` /
`mapPrintSpecFormToPayload`) — already unit-testable, already tested elsewhere in the
mapper suite pattern. Persisted via `upsert_order`'s whole-child-set-replace (delete +
reinsert `print_specs` on every save) — this pattern is preserved unchanged by Phase 3;
new columns just ride along in the same jsonb payload / insert statement.

No `rotation_deg`, no scale/normalized-size columns, no `preview_storage_path` exist yet
— see §16 for exactly what's proposed to be added.

## 3. Canvas library decision — D1

**Recommendation: Fabric.js (v6, the current major version — ESM-native, TypeScript
types built in).**

Rationale: React 19.2 / Vite 8 / TS 6.0 are all current; Fabric.js v6 is framework-
agnostic (it owns a `<canvas>` element directly and exposes an imperative API), so there
is no React-version coupling risk the way there would be with a library that ships React
bindings tied to a specific React major. It's also the library the brief names as
preferred, and nothing in this codebase's stack creates the "concrete, documented
integration problem" the brief requires before falling back to Konva. Fabric.js directly
provides everything §5.8 asks for (select/drag/resize-with-aspect-lock/rotate) without
hand-rolled pointer-event math — replacing `GarmentMockup.tsx`'s current bespoke drag
logic, which is exactly the kind of "hand-built drag/resize with raw DOM transforms"
hard constraint #10 prohibits continuing.

Integration shape: a thin React wrapper component (`MockupCanvas.tsx`, new) owns a
`<canvas ref>`, constructs one `fabric.Canvas` in `useEffect` on mount, disposes it on
unmount, and exposes an imperative-handle-style API (`getTransform()`,
`setTransform(...)`, `centerHorizontally()`, etc.) so the surrounding form code stays
declarative React while Fabric owns only the actual canvas pixels. This isolates the one
new external dependency behind one component boundary.

## 4. Coordinate system

Two coordinate spaces, kept explicitly separate (this is the source of most mockup bugs
in comparable systems if conflated):

1. **Print-zone space** — percentage of the garment image's rendered box, already
   established by `PRINT_POSITIONS` (`x`, `y`, `maxWidthPct`, `maxHeightPct`). Unchanged
   by Phase 3 in spirit, just reshaped into `printZones.ts` (§7).
2. **Artwork transform space** — the artwork's position/size *within* its print zone,
   persisted as **percentages relative to the print zone's own box**, not the whole
   canvas and not raw pixels (hard constraint #5). E.g. `offsetXPct: 0.5, offsetYPct:
   0.5` = centered in the zone; `1.0` = touching the zone's right/bottom edge.

Reconstructing at any viewport size is then pure arithmetic: `zone box (%) × canvas
render size (px, whatever it is right now) × artwork transform (%)` — no absolute pixel
value is ever persisted or compared across viewport sizes, satisfying "must reconstruct
identically at desktop, tablet and mobile."

## 5. Artwork scaling model — D2 (with D3)

**Recommendation: `artwork_width_pct` / `artwork_height_pct`, not `scale_x`/`scale_y`.**

Rationale: physical width is primary (D3, brief's own recommendation, adopted as-is —
staff think in "this logo is 100mm wide," not "this logo is scaled 0.4x"). Percentage-
of-print-zone width/height derives directly and losslessly from `width_mm`/`height_mm`
plus the print zone's known real-world size assumption, and round-trips cleanly through
Fabric's own `scaleX`/`scaleY` object properties at render time (Fabric's internal scale
is a rendering *implementation detail* of one specific canvas instance's current pixel
size — persisting it directly would silently break reconstruction the moment the canvas
renders at a different pixel size, e.g. mobile vs desktop, which is exactly the
"identical reconstruction across viewports" requirement). Height is auto-derived from
the artwork's intrinsic aspect ratio (fetched once from the loaded image element) unless
proportions are explicitly unlocked — matching brief §5.9's worked example exactly
(1.25 ratio, 250mm → 200mm, width changed to 300mm → height auto-becomes 240mm).

`rotation_deg` is stored as a plain degree value (0–360, default 0) regardless of D2 —
rotation isn't part of the scale-vs-percentage question, it's orthogonal.

## 6. Physical-size mapping — D3

Adopted as recommended: **`width_mm` stays the primary editable field** (already true
today — it's what the PRINT_SIZES presets set). Height is computed as
`width_mm × (artwork intrinsic height / artwork intrinsic width)` and displayed
read-only unless the user clicks "Unlock proportions." The mm value is then converted to
a print-zone-relative percentage purely for rendering: `artwork_width_pct = width_mm /
zone_real_world_width_mm` — this requires establishing one more piece of data the
current model doesn't have: **an assumed real-world width for each print zone** (e.g.
"Full Front is roughly 350mm of usable garment width for a size-M-ish adult torso").
This is a deliberate approximation, not a precision claim — printers already work this
way from paper forms, eyeballing size against a body diagram. It only needs to be
roughly consistent so a 300mm print doesn't visually dwarf a Left Chest zone that's
realistically ~150mm wide. Add these assumed widths as one more field per zone in
`printZones.ts` (§7) — no schema change, purely a frontend rendering constant.

## 7. Print-zone model

`src/config/printZones.ts` will be a **direct evolution of `src/data/printPositions.ts`**,
not a parallel file — same nine entries, same `position → view` mapping (hard rule:
position determines view, never touched), extended with: `refWidthMm` (assumed real-world
zone width, §6), and coordinates reshaped from center-point to the top-left-anchored box
shape the brief's own example uses (`xPct, yPct, widthPct, heightPct`) since that maps
more directly onto Fabric object placement than the current center+max-box shape. The
existing `maxWidthPct`/`maxHeightPct` become the overflow-warning threshold (§5.10), not
a hard clamp — today's code silently clamps (`clamp()` in `GarmentMockup.tsx`); Phase 3
must instead **warn, not clip** per hard requirement — a real behavior change at this one
spot, called out explicitly so it isn't missed during implementation.

`src/data/printPositions.ts` itself is deleted once `printZones.ts` replaces it (single
source of truth, not two overlapping configs) — every current importer
(`PrintDetailsSection.tsx`, `GarmentMockup.tsx`, `ArtworkMockupsTab.tsx`) is updated in
the same milestone.

## 8. Garment-image strategy

Priority order from the brief (T-shirt, Hoody, Polo, Crew neck, then Singlet, Hi-Viz
vest, Shirt) is adopted as-is. Two structural changes beyond just swapping image files:

- **Sourcing clean replacement photography/renders is outside this session's ability to
  produce** — this plan flags it as a **hard external dependency**: someone (the user,
  or a contracted photographer/designer) needs to supply clean front/back garment images
  before Milestone 2 can actually close. The milestone's own fallback clause ("do not
  block Phase 3 on one obscure garment") is read broadly here: if clean images aren't
  available for *any* garment when Milestone 2 starts, the neutral-silhouette fallback
  (already partially built — see `FALLBACK_BODY` SVG in `GarmentMockup.tsx`, currently
  used only for Shirt/Customized) becomes the answer for every garment without a clean
  photo yet, and real photos are swapped in later without a schema/code change (they're
  just files referenced by `garmentImages.ts` or `mockup_templates.image_storage_path`).
- **Where the images live** — recommend moving from bundled `src/assets/` static imports
  to Supabase Storage, finally using the existing-but-dormant
  `mockup_templates.image_storage_path` column (a new small public-or-signed-URL bucket,
  since these are the business's own reference art, not customer files — no privacy
  requirement forces the private-bucket treatment artwork gets). This directly unblocks
  Settings → Mockup Templates upload management (brief §5.15) and gets large PNGs out of
  the git repo and Vite's static-asset pipeline. If this turns out to be more plumbing
  than Milestone 2's budget allows, the fallback is: keep bundled assets for now, ship
  the CRUD metadata (active/inactive, name) working as it already does, and revisit
  Storage-backed images as a fast-follow — brief §5.15 explicitly permits this exact
  fallback ("if disproportionately complex, ship seeded clean templates and keep CRUD
  metadata working").

## 9. Front/back model

No change to the existing rule (position determines view — already correctly
implemented in both `printPositions.ts` and `GarmentMockup.tsx`'s `isPositionVisible`).
Phase 3 adds explicit Front/Back **tabs** in the Mockup Studio UI (brief §5.3) as a
navigation affordance over the *set* of print specs for the current garment — clicking
"Back" filters/highlights which existing print-spec cards are on the back, and "+ Add
Print" defaults its position to one valid for whichever tab is active. This is a UI
grouping convenience only; it introduces no new state (no independent front/back
toggle), preserving the hard rule exactly.

## 10. Multiple-PrintSpec handling

Already structurally correct today (§1) — `useFieldArray` guarantees independent state
per entry with no leakage. Phase 3's job here is UI, not data-model: replace the current
flat stacked-cards layout with the tabs/cards pattern from brief §5.11
(`[ Left Chest ] [ Full Back ] [ + Add Print ]`) with one obviously-active selection at a
time, feeding into a single large canvas area rather than N small embedded ones. The
underlying `printSpecs` field array and its per-entry `update()` closure pattern already
used in `PrintDetailsSection.tsx` carries over directly.

## 11. Artwork lifecycle

Current upload/remove flow (`src/api/artwork.ts`) already satisfies hard constraint #8
by construction: removing an artwork's *association* with a print spec (clearing
`printSpecs[i].artworkId`) is a pure form-state change with no API call at all — deleting
the actual file is a separate, explicit action in `ArtworkSection.tsx` the user must
take independently. Phase 3 adds no new coupling here; it only needs to handle the
degrade-safely case brief §5.7 asks for: if a print spec's referenced `artworkId` no
longer exists in `order.artwork` (file was deleted after being used in a mockup), the
canvas renders that print spec's zone as empty/prompt-to-reselect rather than crashing —
`print_specs.artwork_id` is already `on delete set null` at the DB level (confirmed in
the original schema), so this is a rendering-layer null-check, not a new DB behavior.

PDF/AI handling: extends the existing `PREVIEWABLE_TYPES` gate already used in
`ArtworkMockupsTab.tsx`/`useArtworkPreviewUrls` — PDF/AI simply never populate an
`artworkUrl` for the canvas, triggering the same "select an alternate preview artwork"
UI the brief asks for (a dropdown already exists in `PrintDetailsSection.tsx`'s Artwork
field — it just needs a visible "(no preview)" annotation next to non-renderable files
in that list, not new functionality).

## 12. Mockup persistence

Unchanged transactional model: every `print_specs` row (existing + new columns) is
written via the same `upsert_order` RPC's whole-child-set-replace, in the same
transaction as everything else on the order. No new persistence *mechanism* — only new
*fields* flowing through the same pipe (form → `mapPrintSpecFormToPayload` → RPC jsonb →
insert). `preview_storage_path` (§13) is the one exception: like `artwork.storage_path`,
it's a Storage-backed reference written via a plain `update` after the file is
successfully uploaded, not through the RPC — Storage operations can't participate in the
RPC's SQL transaction, exactly the same reasoning Phase 2 already applied to artwork
uploads.

## 13. Preview/export generation

Fabric.js provides `canvas.toDataURL()` / `canvas.toBlob()` natively at an arbitrary
`multiplier` (pixel-ratio) — this directly satisfies "render at a higher internal pixel
ratio than the on-screen canvas" (brief §5.13) without a second offscreen render pass.
Editor chrome (selection handles, print-zone guide overlays) are Fabric objects with
`selectable: false, excludeFromExport: true` or simply hidden before calling
`toDataURL()` — a one-line toggle around the export call, not a parallel render tree.

Flow: **explicit Save only** (never on drag, per hard constraint #9 and brief §5.13) →
form's save handler calls `upsertOrder(...)` as today, and *after* that succeeds, for
each print spec whose canvas-affecting fields changed, exports a PNG blob and uploads it
to `mockup-previews/orders/{orderId}/print-specs/{printSpecId}/preview.png`, then a plain
`update print_specs set preview_storage_path = ... where id = ...`. A failed preview
export/upload must not roll back or block the already-successful order save (brief
acceptance test #15) — it surfaces a distinct, non-blocking toast ("Order saved — mockup
preview couldn't be generated, try saving again") and leaves the previous
`preview_storage_path` (or null) in place.

## 14. Approval workflow — D5

**Recommendation: extend the existing order-level `ArtworkStatus`, do not add a
per-PrintSpec approval field.** Rationale: every acceptance test and every current UI
surface (Production Board, Dashboard, Order Detail's Production tab) already operates on
one order-level `ArtworkStatus`; a real multi-mockup-approval need would require the
*board and dashboard* to somehow roll up N independent per-spec statuses into one
displayable badge, which is a materially bigger surface change than Phase 3's stated
non-goals allow ("do not redesign unrelated areas," "single-company internal tool, no
speculative complexity"). SALT PRINTS' actual workflow (per every doc read this phase)
treats "the artwork" for a job as one approval gate, not N independent ones per print
location — even orders with 3 print specs get approved as one job. The one genuinely new
piece of data is an **approval note**, added as a plain nullable `text` column on
`orders` (e.g. `artwork_approval_note`) rather than per-print-spec, surfaced next to the
existing `ArtworkStatus` selector, logged into `order_activity` on change exactly like
every other status field already is.

## 15. Production workflow improvements

Covered concretely in brief §5.15, adopted as specified with one clarification: the
Production Board's mockup thumbnail column reads `print_specs[0].preview_storage_path`
(via a signed URL, same `useArtworkPreviewUrls`-style on-demand hook, new
`useMockupPreviewUrls`) — falling back to "No Mockup" if no print spec has a preview yet,
or "Awaiting Artwork" if the order additionally has zero artwork files at all (the two
distinct empty states the brief calls for). The Readiness Indicator and Attention
Warnings are pure derived booleans over already-fetched order data (no new query) —
implemented as small pure functions (`isReadyForProduction(order)`,
`getAttentionWarnings(order)`) alongside the existing `src/utils/dashboard.ts` /
`useProductionBoard.ts` logic, unit-testable the same way `diffOrderForActivity` already
is.

## 16. Required database changes

One migration, additive only (no destructive changes to existing columns):

| Column | Table | Type | Justification |
|---|---|---|---|
| `rotation_deg` | `print_specs` | `numeric not null default 0` | New rotation capability (D8); default 0 means every existing row is valid with no backfill. |
| `artwork_width_pct` | `print_specs` | `numeric` (nullable) | Chosen transform model (D2/§5) — artwork's rendered width as a fraction of its print zone. Nullable so existing rows (created before Phase 3) don't need a synthetic value; the canvas falls back to today's `widthMm`-derived heuristic for any row where it's null, so nothing breaks for orders that predate this migration. |
| `artwork_height_pct` | `print_specs` | `numeric` (nullable) | Same reasoning as above; height half of the transform pair. |
| `preview_storage_path` | `print_specs` | `text` (nullable) | Path to the generated mockup PNG in the new `mockup-previews` bucket (§13/§17). Nullable — a print spec has no preview until the order is saved at least once under Phase 3. |
| `artwork_approval_note` | `orders` | `text` (nullable) | The one new field from the approval-workflow decision (§14). |

No changes to `garment_type`/`garment_colour`/`offset_x`/`offset_y`/`width_mm`/
`height_mm` — all stay exactly as-is; `offset_x`/`offset_y` continue to mean "offset
within the print zone," now just interpreted more precisely against the reshaped zone
model (§4/§7), not renamed or retyped.

`mockup_templates.image_storage_path` needs no migration — the column already exists
and is simply used for the first time (§8).

## 17. Required storage changes

Two additions, both via Supabase MCP/CLI migration + dashboard bucket creation (never
manual dashboard schema edits per hard constraint #6 — bucket creation itself isn't
schema DDL and is the one Storage action that has to go through the dashboard or the
Supabase management API, same as `artwork-originals` was originally created):

- **`mockup-previews`** bucket — private (matches `artwork-originals`'s treatment; these
  previews are still customer/job-specific, not public marketing material), path
  `orders/{orderId}/print-specs/{printSpecId}/preview.png`, RLS policies identical shape
  to the existing `artwork-originals` policies (`authenticated` full CRUD, no `anon`).
- **`mockup-templates`** bucket (only if §8's Storage-backed garment-image approach is
  adopted rather than the bundled-assets fallback) — can be **public** read (these are
  the business's own generic reference photography, not customer data), write restricted
  to `owner`/`admin` matching the existing `is_admin_or_owner()` pattern used for every
  other catalog table.

## 18. UI changes

Summarized from brief §5.11/§5.15 (already detailed there, not repeated verbatim): the
existing `PrintDetailsSection` "Print Details & Mockups" block becomes the embedded
Mockup Studio (three-panel desktop layout, tabs for print locations, one large canvas)
— replacing, not sitting alongside, the current per-card mini-mockup layout. `D7`
(dedicated `/orders/:id/mockups` route) — **recommendation: no**, not in Phase 3. The
brief's own condition ("only if it materially improves usability... embedded editor must
remain sufficient for basic PrintSpec creation") isn't met by anything found in this
codebase review — there's no existing workflow reason staff would need to leave the
order form to work on mockups, and adding a second entry point multiplies the
loading/empty/error-state surface area (§5.18) for no demonstrated benefit. Revisit if
real usage after Milestone 7 shows staff wanting a larger, order-form-free workspace.

## 19. Mobile behaviour

Per brief §5.19: stacked layout (controls → canvas → transform controls → print
details) below the existing responsive breakpoint conventions already used elsewhere in
this codebase (`sm:`/`md:`/`lg:` Tailwind prefixes, consistent with every other section
in `new-order/sections/`). Fabric.js's canvas natively supports touch events for
selection/drag/resize with no separate mobile input-handling code path required — this
is a concrete practical advantage of D1 over hand-rolled pointer logic (today's
`GarmentMockup.tsx` drag code already uses Pointer Events, which do unify mouse/touch,
but has no resize-handle concept at all to make touch-compatible in the first place).

## 20. Testing strategy

Following the pattern already established in Phase 2/2.5 (real automated tests for pure
logic, manual click-through for anything requiring a rendered browser — this session has
no browser-automation tool, a constraint documented in `docs/PHASE_2_5_HANDOVER.md` and
still true here):

- **Unit tests (Vitest, extending the existing suite)**: the mm↔percentage conversion
  math (§5/§6), `mapPrintSpecFormToPayload`/`mapPrintSpecRowToDomain` extended for the
  three new fields, `isReadyForProduction`/`getAttentionWarnings` pure functions (§15),
  print-zone overflow-detection logic (§5.10 — "does this transform exceed
  maxWidthPct/maxHeightPct" is pure arithmetic, directly testable without a canvas).
- **Manual/browser** (acceptance tests §7 in the brief, all 15 of them) — every one
  requires an actual rendered canvas and drag/resize interaction; none can be simulated
  by this agent without a browser tool. Each implementation-session's own milestone
  report should explicitly say which acceptance tests were run manually versus deferred,
  exactly as Phase 2.5 did.
- **Database-level** (Supabase MCP, as used throughout Phase 2/2.5): after the one
  migration (§16), re-run `get_advisors` (security + performance) and a direct integrity
  query confirming no orphaned `preview_storage_path` values (every non-null path
  resolves to a real `storage.objects` row), same pattern as the existing artwork
  integrity check.

## 21. Implementation milestones

Adopted as specified in brief §6 verbatim (Milestones 1–11) — this plan does not
propose reordering or merging them. Cross-reference: §3(items) → milestone mapping is
already 1:1 by construction (canvas library/zones/schema → M1; images → M2; core
canvas → M3; position/size → M4; multi-spec → M5; persistence → M6; preview export →
M7; approval → M8; production polish → M9; responsive/perf → M10; hardening → M11).

## 22. Deferred capabilities

Everything in brief §1.3 (unchanged, out of scope): customer-facing approval portal,
email/SMS proof sending, payments, invoicing, supplier ordering, inventory, AI
artwork generation/vectorization/background removal/logo enhancement, mockup version
history, multi-tenancy, ecommerce, PDF proof generation. Additionally, from this plan's
own analysis: a dedicated `/orders/:id/mockups` route (§18/D7, deferred pending real
usage evidence), and Storage-backed garment template images (§8/§17) are a soft-deferred
fallback if the upload plumbing proves disproportionate within Milestone 2's own budget
— not a hard Phase 3 non-goal, just a named fallback path.

---

## Decisions summary (brief §4)

| # | Decision | This plan's answer |
|---|---|---|
| D1 | Canvas library | **Fabric.js v6** — no React-version coupling risk found; replaces the existing hand-rolled pointer-event drag code, which has no resize/rotate concept to extend anyway. |
| D2 | Transform persistence model | **`artwork_width_pct`/`artwork_height_pct` + `rotation_deg`** — not raw Fabric `scale_x`/`scale_y`, which is a rendering-instant implementation detail that wouldn't reconstruct identically across viewport sizes. |
| D3 | Physical vs canvas size, primary | **Physical width primary** (brief's own recommendation, adopted as-is) — height auto-derives from the artwork's real intrinsic aspect ratio, unlockable. |
| D4 | Garment colour rendering | **Real colour-specific asset → neutral silhouette with fill (already partly built) → label-only**, in that priority order, per garment — no CSS-filter tinting of real photos (looks fake, explicitly prohibited). |
| D5 | Approval model | **Extend existing order-level `ArtworkStatus`**, add one new nullable `artwork_approval_note` text field on `orders`. No per-PrintSpec approval field — current UI/board/dashboard all operate at order granularity and SALT PRINTS' real workflow treats "the artwork" as one approval gate per job. |
| D6 | Preview persistence | **Yes** — private `mockup-previews` Storage bucket, path persisted on `print_specs.preview_storage_path`. |
| D7 | Dedicated `/orders/:id/mockups` route | **No**, not in Phase 3 — no demonstrated usability need found in this codebase; embedded editor stays the only entry point. Revisit post-Milestone 7 if real usage says otherwise. |
| D8 | Rotation support | **Yes, supported** — Fabric.js provides it natively at near-zero extra complexity; always paired with a visible Reset Rotation control. |
| D9 | `src/api/mockups.ts` | **No new file** — mockup persistence is entirely `print_specs` fields riding through the existing `upsert_order` RPC (`orders.ts`) plus preview-image Storage calls that are a natural extension of `artwork.ts`'s existing upload/signed-URL pattern. A separate file would split one cohesive read/write concern across two modules for no real separation-of-concerns benefit. |

---

**Exit criteria met**: every §3 item covered above; every §4 decision answered with
rationale; baseline build/lint/test recorded (§0). Per the brief, this is a **GATE** —
implementation does not begin until this plan is reviewed and signed off.

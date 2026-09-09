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

**Amended after DB inspection (Amendment 1).** Live-data check before finalizing this
section:

```sql
select count(*), min(offset_x), max(offset_x), min(offset_y), max(offset_y)
from print_specs where coalesce(offset_x,0)<>0 or coalesce(offset_y,0)<>0;
-- → nonzero_count: 0
```

Both real `print_specs` rows in the database have `offset_x = 0, offset_y = 0` — there is
**zero non-zero placement data** to lose or misinterpret. **Cutover strategy A applies**
(brief Amendment 1): the coordinate-system reinterpretation below is a deliberate Phase 3
cutover, not a silent reinterpretation of real data, because there is no real data at
stake — every existing row's `(0, 0)` is valid and unambiguous under both the old and new
semantics simultaneously (see below), so no backfill/reset UPDATE is even required; it's
a documented semantic redefinition applied going forward.

Two coordinate spaces, kept explicitly separate (this is the source of most mockup bugs
in comparable systems if conflated):

1. **Print-zone space** — percentage of the garment image's rendered box, already
   established by `PRINT_POSITIONS` (`x`, `y`, `maxWidthPct`, `maxHeightPct`). Unchanged
   by Phase 3 in spirit, just reshaped into `printZones.ts` (§7).
2. **Artwork placement space** — `offset_x`/`offset_y` are **redefined** from "percentage
   points added to the old center-point anchor, clamped ±40" to "fractional offset from
   the print zone's own center, nominal range roughly ±0.5, where `(0, 0)` means
   *centered in the zone*." This is chosen specifically because `(0, 0)` means "no
   adjustment from the base/centered position" under **both** the old and new schemes —
   the one value that exists in production today is valid unchanged under the new
   semantics, which is exactly why Strategy A (reset-to-centered-default) requires no
   actual data mutation here, only a documentation/code change.

No artwork *size* is persisted as a percentage (see Amendment 2 / §5) — placement
(`offset_x`/`offset_y`) and rotation (`rotation_deg`) are the only normalized values
persisted, per hard constraint #5. Reconstructing at any viewport size is pure
arithmetic: `zone box (%) × canvas render size (px, whatever it is right now) × offset
(fraction)` — no absolute pixel value is ever persisted or compared across viewport
sizes.

## 5. Artwork scaling model — D2 (amended)

**Amended (Amendment 2): do NOT persist `artwork_width_pct`/`artwork_height_pct`, and do
NOT persist Fabric's `scale_x`/`scale_y`.**

`width_mm`/`height_mm` (already existing columns) remain the sole production source of
truth for print size — this was already true before Phase 3 and stays true. The
original D2 recommendation in this plan's first draft would have added a *second*,
derived representation of the same size (a zone-relative percentage) sitting alongside
`width_mm`/`height_mm` — that's duplicated state that can silently go stale the moment a
print zone's calibration (`refWidthMm`, §7) is ever tuned, since the two values would no
longer agree and nothing would tell either the RPC or the canvas which one to trust.

**What persists:** `offset_x`/`offset_y` (placement, §4) and `rotation_deg` (0–360,
default 0) only. **What does not persist:** any form of scale, canvas-relative size, or
percentage-of-zone dimension. Canvas-rendered size is *always derived at render time*
from `width_mm`/`height_mm` + the artwork's intrinsic aspect ratio + the active print
zone's `refWidthMm` calibration (§7) — never stored.

The canvas and the physical-dimension form fields are therefore **two interfaces over
one canonical state** (`width_mm`, with `height_mm` following the aspect-ratio rule
unless unlocked): dragging a Fabric resize handle computes a new `width_mm` and writes it
back into form state immediately (same field the manual mm input edits); typing into the
mm input recomputes the canvas's rendered size on the next render. Neither is a second
source of truth — there is only one, `width_mm`/`height_mm`, matching brief §5.9's
worked example exactly (1.25 ratio, 250mm → 200mm, width changed to 300mm → height
auto-becomes 240mm).

New pure conversion utilities (Milestone 1, unit tested — see §20):
- `physicalWidthToZoneRelativeSize(widthMm, aspectRatio, zone): { widthPct, heightPct }`
- `zoneRelativeSizeToPhysicalWidth(widthPct, zone): widthMm`
- round-trip test: `physicalWidthToZoneRelativeSize` then
  `zoneRelativeSizeToPhysicalWidth` returns the original `widthMm` within an explicit
  tolerance (**±0.5mm**, documented in the test itself — floating-point percentage
  round-tripping through a real-world mm calibration is not expected to be exact to more
  decimal places than a tape measure would be anyway).

`rotation_deg` is orthogonal to this whole question and persists regardless, per D8.

## 6. Physical-size mapping — D3

Adopted as recommended: **`width_mm` stays the primary editable field** (already true
today — it's what the PRINT_SIZES presets set). Height is computed as
`width_mm × (artwork intrinsic height / artwork intrinsic width)` and displayed
read-only unless the user clicks "Unlock proportions." The mm value is converted to a
print-zone-relative percentage **only transiently, at render time, for that one paint**
(`renderWidthPct = width_mm / zone_real_world_width_mm`) — per Amendment 2 (§5) this
value is never written to `print_specs`; it's recomputed fresh every render from the
canonical `width_mm`/`height_mm`. This requires establishing one more piece of data the
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

## 8. Garment-image strategy (amended — Amendment 7)

**Confirmed: no clean garment photography/renders are being supplied for Phase 3.**
Amendment 7 removes clean photography as a Milestone 2 dependency entirely — this
plan's original draft flagged it as a hard external dependency blocking Milestone 2's
close; that dependency is now resolved by removing the requirement, not by waiting on
it.

**Phase 3 garment rendering is silhouette-first, not photo-first:**

- A polished neutral silhouette system (evolving the existing `FALLBACK_BODY` SVG in
  `GarmentMockup.tsx`, today used only for Shirt/Customized) becomes the **primary**
  rendering path for every garment type, not a fallback for edge cases. Silhouettes
  support garment colour directly via SVG fill (already how the no-photo path works
  today — `resolveGarmentColour(colour)` sets the fill), which incidentally satisfies
  D4's colour-rendering preference order better than any bundled photo could (no photo
  can be re-tinted safely per hard constraint against "naive CSS filters that look
  obviously fake"; an SVG fill has no such problem).
- Consistent front/back silhouettes are added per garment type — a small, deliberately
  simple set of body outlines (torso/hoody/tank/etc. shape variants), not photorealistic
  art. This is a bounded, in-house-producible asset task (SVG paths), unlike photography.
- **Bundled/static image delivery stays exactly as it is today** where any real photos
  currently exist (`src/assets/mockups/*.png` via `garmentImages.ts`) — nothing is
  deleted or migrated. They simply stop being the thing Phase 3 depends on shipping more
  of.
- **Storage-backed `mockup_templates.image_storage_path` upload/replacement plumbing is
  removed from Phase 3 scope** (moved to §22 Deferred). Settings → Mockup Templates keeps
  its existing metadata CRUD (name, view, active) exactly as it works today — no upload
  UI is built this phase. Real garment photography can replace silhouettes later,
  per-garment, without touching the PrintSpec/canvas model at all, since both a
  silhouette and a photo are just "whatever `GarmentMockup`/`MockupCanvas` renders as the
  background layer" — swapping one asset type for another is a rendering-layer decision.

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

### 12a. PrintSpec ID stability — investigated per Amendment 3, real defect found

Inspected `mapPrintSpecFormToPayload`, `mapDatabaseOrderToFormValues`, and the
`upsert_order` RPC's `print_specs` insert (`supabase/migrations/
20260908084613_order_core.sql` lines ~290–306). **Finding: PrintSpec IDs are NOT stable
across saves today.** Two compounding facts:

1. The RPC's `insert into print_specs (order_id, artwork_id, position, ...)` column list
   has **no `id` column at all** — every insert relies on the table's
   `default gen_random_uuid()`, so every `delete from print_specs where order_id = ...`
   + reinsert cycle (which happens on **every single order save**, per the existing
   whole-child-set-replace design) assigns every print spec a brand-new random UUID.
2. `mapPrintSpecFormToPayload` doesn't include `id` in its output at all, and
   `emptyPrintSpec()` (`src/pages/new-order/defaultValues.ts`) generates a new print
   spec's client-side id via `generateId('print')` — a non-UUID string like
   `print-l8x2k9-1` — so even if the payload carried it through today, casting it to
   `::uuid` in the RPC would error.

This confirms the brief's concern exactly: the proposed
`mockup-previews/.../print-specs/{printSpecId}/preview.png` path would silently orphan
every existing preview on the very next order save, with no error — a real, previously
undiscovered defect in the existing (pre-Phase-3) persistence design, not a
hypothetical risk.

**Fix, scoped into Milestone 1** (this is schema/RPC/mapper work, not UI, so it belongs
in the architecture milestone, not deferred to Milestone 7 when preview generation
itself is built):

- `emptyPrintSpec()` generates `crypto.randomUUID()` instead of `generateId('print')` —
  the exact same pattern `ArtworkSection.tsx` already uses for `artworkId` before first
  upload. Every print spec has a real, stable UUID from the moment it's created
  client-side, whether or not it's ever saved.
- `mapPrintSpecFormToPayload` includes `id: spec.id` in its output.
- The RPC's `insert into print_specs (...)` adds `id` to both the column list and the
  `select` list, reading `(p->>'id')::uuid` from the payload — since every id is now a
  real UUID from creation time, no `coalesce`/fallback-generation branch is needed.
- Net effect: an existing print spec keeps the exact same `id` through every
  delete+reinsert cycle for the rest of its life (matching how `order_garments`/
  `garment_quantities`/`order_services` behave today — they don't have this problem
  because nothing outside the order currently references their ids by path; `print_specs`
  is the first child table whose id needs to survive replacement, because Phase 3 is the
  first thing to reference it externally, via the Storage path).
- `sort_order` is explicitly **not** used as an identity substitute (per the brief's
  instruction) — it already changes freely when specs are reordered/added/removed and
  was never a candidate here regardless.

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
`preview_storage_path` (or null) in place. This flow depends entirely on PrintSpec IDs
being stable across saves (§12a) — without that fix the `{printSpecId}` path segment
would point at a different logical print spec after every save, which is exactly why
§12a's fix is scoped into Milestone 1 rather than deferred to this milestone.

**Storage integrity verification, expanded per Amendment 3** to check both directions
(same pattern already used for `artwork-originals` in the Phase 2.5 audit): (1) every
non-null `print_specs.preview_storage_path` resolves to a real `storage.objects` row,
and (2) every object under `mockup-previews/` is referenced by a current
`print_specs.preview_storage_path` — direction (2) is the one that specifically catches
orphans left behind by the exact ID-instability failure mode described in §12a, so it's
not redundant with direction (1).

## 14. Approval workflow — D5 (amended)

**`ArtworkStatus` stays exactly where it is today: one order-level enum.** Unchanged
from the original recommendation — every current UI surface (Production Board,
Dashboard, Order Detail) already operates at order granularity, and SALT PRINTS' actual
workflow treats "the artwork" for a job as one approval gate, not N independent ones.
Rolling that up from per-spec statuses would be a materially bigger surface change than
Phase 3's non-goals allow.

**Amended (Amendment 4): the approval note moves to `print_specs.approval_note`, not
`orders.artwork_approval_note`.** The status decision and the note-location decision are
separable, and the brief is right that they don't belong on the same row: a note like
"Move logo 20mm higher" is inherently about *one print location*, not the job as a
whole — an order with a Left Chest logo and a Full Back print might get feedback on only
one of them. Order-level `ArtworkStatus` still gates the overall job; `approval_note` is
just a plain nullable text field on the print spec it concerns, requiring no status
roll-up logic of any kind (it's not a status, just a comment). Surfaced next to each
print spec's own artwork/approval indicator in the Mockup Studio UI, not as a single
order-wide text box. Note *changes* are logged into `order_activity` (existing
`artwork` category, referencing which print spec/position in the message text) exactly
like every other field-change is today — no new activity category needed.

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

## 16. Required database changes (amended)

One migration, additive only (no destructive changes to existing columns). Per
Amendments 2, 4, and 5, `artwork_width_pct`/`artwork_height_pct`/
`orders.artwork_approval_note` are **removed** from scope; `approval_note` moves to
`print_specs`; the id-column fix from §12a rides in the same migration file since it's
an RPC-body change, not a new column, but is called out here for completeness:

| Change | Table | Type | Justification |
|---|---|---|---|
| `rotation_deg` | `print_specs` | `numeric not null default 0` | New rotation capability (D8); default 0 means every existing row (both of them) is valid with no backfill. |
| `preview_storage_path` | `print_specs` | `text` (nullable) | Path to the generated mockup PNG in the new `mockup-previews` bucket (§13/§17). Nullable — no print spec has a preview until Milestone 7 actually generates one. |
| `approval_note` | `print_specs` | `text` (nullable) | Per-print-spec approval feedback (Amendment 4/§14) — not per-order. |
| *(RPC body change, not a column)* `upsert_order`'s `print_specs` insert | — | — | Adds `id` to the insert column/select list, reading `(p->>'id')::uuid` from the payload, fixing the ID-instability defect found in §12a. Required before `preview_storage_path` can be trusted at all — sequencing this into the *same* migration as the column additions rather than a later one avoids a window where the new column exists but points at nothing reliable. |

**Offset semantics (Amendment 1):** no `offset_x`/`offset_y` value changes in this
migration — confirmed via live-data inspection (§4) that both existing rows are already
`(0, 0)`, which is valid under the new interpretation unchanged. This is a
code/documentation-level semantic cutover (Strategy A), not a data migration; explicitly
called out in the migration file's own header comment so a future reader doesn't assume
a `data migration` step is missing.

No changes to `garment_type`/`garment_colour`/`width_mm`/`height_mm` — all stay exactly
as-is, remaining the sole source of truth for print size per Amendment 2.

`mockup_templates.image_storage_path` needs no migration and, per Amendment 7, is **not
used this phase either** — see §8.

## 17. Required storage changes (amended)

**Amendment 6: bucket creation itself is versioned, not a manual dashboard step.**
Supabase supports creating a Storage bucket and its `storage.objects` RLS policies from
plain SQL (`insert into storage.buckets (...)`, then `create policy ... on
storage.objects`) — exactly the mechanism the existing `artwork_storage` migration
(`20260908091750_artwork_storage.sql`) already used for `artwork-originals`. The Phase 3
migration follows the identical pattern, so no manual Supabase Dashboard bucket-creation
step is required at all:

- **`mockup-previews`** bucket — private, created via migration SQL, path
  `orders/{orderId}/print-specs/{printSpecId}/preview.png`, RLS policies matching
  `artwork-originals`'s shape exactly (`authenticated` full CRUD via `bucket_id =
  'mockup-previews'`, no `anon` policy of any kind). Signed URLs only, generated on
  demand — no storage path or signed URL is ever persisted anywhere except the plain
  `storage_path` column itself, same rule as artwork.

**Amendment 7 removes the `mockup-templates` bucket from this plan entirely** — see §8;
Storage-backed garment template images are deferred, so no second bucket is created in
Phase 3.

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

## 22. Deferred capabilities (amended — Amendment 7 additions)

Everything in brief §1.3 (unchanged, out of scope): customer-facing approval portal,
email/SMS proof sending, payments, invoicing, supplier ordering, inventory, AI
artwork generation/vectorization/background removal/logo enhancement, mockup version
history, multi-tenancy, ecommerce, PDF proof generation. Additionally, from this plan's
own analysis: a dedicated `/orders/:id/mockups` route (§18/D7, deferred pending real
usage evidence). **Newly deferred per Amendment 7**: clean garment photography/renders
sourcing, and Storage-backed `mockup_templates.image_storage_path` upload/replacement
plumbing — both moved from "Milestone 2 dependency" to "later asset swap," to be
revisited once real garment photography is actually supplied. Silhouette-based
rendering (§8) is Phase 3's real, permanent-for-now answer, not a stopgap awaiting these.

---

## Decisions summary (brief §4) — revised status after review amendments

| # | Decision | Status | This plan's answer |
|---|---|---|---|
| D1 | Canvas library | **APPROVED** | **Fabric.js v6** — no React-version coupling risk found; replaces the existing hand-rolled pointer-event drag code, which has no resize/rotate concept to extend anyway. |
| D2 | Transform persistence model | **AMENDED + APPROVED** | **Persist normalized placement (`offset_x`/`offset_y`) + `rotation_deg` only.** Do **not** persist `artwork_width_pct`/`artwork_height_pct` or any Fabric scale value — `width_mm`/`height_mm` remain the sole canonical physical size; canvas-relative size is always derived at render time, never stored, so it can't go stale against print-zone calibration. |
| D3 | Physical vs canvas size, primary | **APPROVED** | **Physical width primary** (brief's own recommendation, adopted as-is) — height auto-derives from the artwork's real intrinsic aspect ratio, unlockable. |
| D4 | Garment colour rendering | **APPROVED** | **Real colour-specific asset → neutral fillable silhouette → label-only**, in that priority order. **For Phase 3 specifically, the neutral fillable silhouette is the primary implementation** (Amendment 7) — no clean photography is currently supplied, so the "real asset" tier of this priority order is unused this phase, not absent from the model. |
| D5 | Approval model | **AMENDED + APPROVED** | **`ArtworkStatus` stays order-level, unchanged.** Approval note moves to **`print_specs.approval_note`** (Amendment 4), not `orders.artwork_approval_note` — the note is inherently per-print-location even though the approval gate itself is per-job. |
| D6 | Preview persistence | **APPROVED** | **Yes** — private `mockup-previews` Storage bucket (created via versioned migration, Amendment 6 — no manual dashboard step), path persisted on `print_specs.preview_storage_path`. Depends on PrintSpec ID stability (§12a, fixed in Milestone 1). |
| D7 | Dedicated `/orders/:id/mockups` route | **APPROVED** | **No**, not in Phase 3 — no demonstrated usability need found in this codebase; embedded editor stays the only entry point. |
| D8 | Rotation support | **APPROVED** | **Yes, supported** — Fabric.js provides it natively; always paired with a visible Reset Rotation control. Persisted as `rotation_deg` per D2. |
| D9 | `src/api/mockups.ts` | **APPROVED** | **No new file** — mockup persistence is entirely `print_specs` fields riding through the existing `upsert_order` RPC (`orders.ts`) plus preview-image Storage calls extending `artwork.ts`'s existing pattern. |

---

**Exit criteria met**: every §3 item covered above; every §4 decision answered with
rationale; baseline build/lint/test recorded (§0). Per the brief, this is a **GATE** —
implementation does not begin until this plan is reviewed and signed off.

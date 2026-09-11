# Mockup System V2 — Architecture Audit

Status: **AUDIT ONLY — no application code, schema, or asset changes made in this pass.**
Scope: read-only inspection of the current codebase to explain why print-position placement on garment mockups is visually inaccurate, and to lay the factual groundwork for a V2 plan. See `MOCKUP_SYSTEM_V2_PLAN.md` for the proposed architecture and `MOCKUP SYSTEM V2 ARCHITECTURE GATE` at the end of the plan doc for the approval checkpoint.

---

## 1. Executive Summary

The mockup renderer places artwork using a **single, garment-agnostic set of percentage boxes** (`src/config/printZones.ts`) against a **fixed 240×300 canvas**, while the garment photo behind it is an **unrelated raster image stretched independently on X and Y** to fill that canvas regardless of its own proportions. Neither the zone geometry nor the stretch factor is aware of which of the 12 garment types is being rendered, or of that garment's real photographed proportions. The result is two independent, uncoordinated distortions stacked on top of each other:

1. **Photo distortion** — every garment photo (measured at 1226×1283px, aspect ratio 0.956, i.e. nearly square) is force-scaled into a 240×300 box (aspect ratio 0.800), a **~20% relative vertical compression** applied uniformly to every T-shirt, Polo, Hoody, Singlet, Shirt, Crew-neck, etc. photo, each of which has different real body proportions the compression does not account for.
2. **Zone-vs-anatomy mismatch** — the print zone boxes (e.g. Left Chest at `xPct:39, yPct:19`) were "checked against each garment photo" (per the file's own header comment) as flat percentages, but are then reused identically across all 12 garment types. A Singlet's chest sits higher and narrower on the body than a Hoody's; a Bennie/Hats item has no "chest" at all. One shared box cannot be correct for more than roughly one garment silhouette at a time.

A third, independently significant, previously undocumented finding: **garment colour is not visually represented at all** for any real garment. The raster photos (which take rendering priority over the vector fallback for every type except "Customized") cannot be recoloured — colour is stored and displayed only as a text label next to the mockup.

A fourth finding, outside placement accuracy but material to the V2 decision: **Fabric.js is not actually lazy-loaded** despite comments in `MockupCanvas.tsx` claiming "editor-only, lazy-loaded" — it is statically imported and ends up in the main JS bundle, loaded on every page view, not just when a mockup is being edited.

None of this requires guesswork to characterize — every claim below is backed by direct file inspection, a computed asset measurement, or a built-output inspection, cited inline.

---

## 2. Client Complaints (context, as relayed)

The presenting complaint driving this audit is that mockup print placement looks wrong to staff/clients reviewing a saved order — logos appearing off-center, too high/low, or the wrong size relative to the garment in the preview. The findings in §8 (root causes) explain this without needing anecdote: the geometry pipeline has no mechanism to guarantee a zone box percentage corresponds to the same physical spot on every garment photo, because neither the zone nor the photo scaling is garment-specific.

---

## 3. Current Mockup Architecture (overview)

Three cooperating layers, all under `src/`:

| Layer | File(s) | Role |
|---|---|---|
| Garment template data | `config/garmentTemplates.ts` | Per-`GarmentType` record: vector fallback shapes, real photo pair (front/back), optional anchor override (headwear), optional vertical nudge |
| Print zone data | `config/printZones.ts` | Single flat array of 9 `PrintZone` records (one per `PrintPosition`), each a top-left percentage box + assumed real-world width in mm |
| Geometry math | `utils/mockupGeometry.ts` | Converts zone % → pixel box (`zoneBoxPx`), converts mm size → pixel size using the zone's `refWidthMm` (`physicalSizeToPixelSize`), converts an offset → canvas position (`zoneOffsetToCanvasPosition`) |
| Interactive renderer (edit only) | `components/domain/MockupCanvas.tsx` (Fabric.js) | Used only inside `MockupStudio` (New/Edit Order flow) |
| Read-only renderer | `components/domain/GarmentMockup.tsx` | Non-Fabric fallback render used on Order Detail when no saved preview PNG exists yet |
| Generated preview | `utils/mockupPreviewRenderer.ts` + Storage bucket `mockup-previews` | A server/client-generated static PNG snapshot, saved once and then reused everywhere (Production Board, Order Detail, Order Quick View) so those surfaces never need to load Fabric |

All garment rendering funnels through one fixed SVG viewBox constant: `GARMENT_VIEW_BOX = '0 0 240 300'` (`config/garmentTemplates.ts`). Every consumer (Fabric canvas, GarmentMockup, the preview renderer) assumes this box.

---

## 4. Current PrintSpec Model

`PrintSpec` (see `src/types`, referenced throughout `MockupCanvas.tsx`/`MockupStudio.tsx`) carries, per print position on an order:
- `position: PrintPosition` (one of 9 fixed positions — Left/Right Chest, Across Chest, Full Front, Left/Right Sleeve, Full Back, Top Back, Bottom Back)
- `garmentType`, `garmentColour` (denormalized onto the spec at save time — colour is a string label, not a rendering input)
- `artworkId` (FK to an uploaded artwork file)
- `widthMm` / `heightMm` (physical print size, user-editable, now with A5/A4/A3/Oversized presets — not clamped to the zone box, only warned against overflow)
- `offsetX` / `offsetY` (legacy; see §8.4 — retained on the type and table for historical rows, but the current renderer always centers deterministically and ignores them for new placement)
- `rotationDeg` (still respected)
- `previewStoragePath` (populated once a preview PNG has been generated and saved)
- `approvalNote`

One `PrintSpec` = one artwork placement on one garment/position combination. Multiple specs per order are supported (e.g. Left Chest + Full Back).

---

## 5. Current Garment-Template Model

`GarmentTemplate` (`config/garmentTemplates.ts`), one record per `GarmentType` (12 total: T-shirt, Polo, Shirt, Hi-Viz vest, Singlet, Crew neck, Hoody, Shorts, Pants, Bennie, Hats, Customized):

```ts
interface GarmentTemplate {
  type: GarmentType
  category: ...
  frontBackDiffer: boolean
  defaultColour: string
  front: GarmentShape[]   // vector fallback outline
  back: GarmentShape[]
  images?: GarmentImagePair   // real front/back PNG photos — present for every type except Customized
  printAnchorOverride?: { x: number; y: number }   // Bennie: {50,71}; Hats: {50,43} — bypasses zone geometry entirely
  verticalOffsetPct?: number   // Singlet: 9 — a manual, undocumented-elsewhere nudge
}
```

`garmentTemplateToDataUrl()` (§9) returns the real photo for any type that has `images`, and only falls back to generating an SVG from the vector `front`/`back` shapes for `Customized`. In practice, **the vector shape system exists in the codebase but is dead code for every real order** — it can never be reached for the 11 real garment types, all of which have `images` defined.

Two garment types (`Bennie`, `Hats`) already have a special-cased `printAnchorOverride` that bypasses the standard print-zone box entirely and pins artwork to one fixed point — a tacit admission, already present in the code, that a single generic zone box does not work for every garment shape. `Singlet`'s `verticalOffsetPct: 9` is the same admission in a smaller, less legible form (a magic-number nudge with no accompanying explanation of what visual problem it corrects).

---

## 6. Current Print-Zone Model

`printZones.ts` (full contents, 9 records) is **strictly global** — there is no `garmentType` field on `PrintZone` at all. The same `{xPct, yPct, widthPct, heightPct, refWidthMm}` box for, e.g., `Left Chest` is used identically whether the garment is a Hoody, a Singlet, a Hi-Viz vest, or a Polo. The file's own header comment describes the boxes as "checked against each garment photo during Phase 1/2" (singular calibration pass, not per-garment), and documents them as an overflow-warning threshold rather than a hard clamp — correct behavior for the sizing question, but irrelevant to the positioning question, since the box's *origin*, not just its size, is what's shared across garments.

`refWidthMm` is likewise one number per position regardless of garment (e.g. Left Chest is always assumed to be a 150mm-wide print area) — reasonable as a rough default, but it cannot account for, e.g., a Hi-Viz vest's chest panel being physically narrower than a Hoody's.

---

## 7. Coordinate-System Analysis

Two coordinate systems are in play and are not reconciled:

1. **The garment photo's own pixel space** (e.g. 1226×1283 for the T-shirt/Hoody/Polo/Crew-neck front images measured directly from the PNG `IHDR` chunk).
2. **The fixed logical canvas** (`GARMENT_VIEW_BOX`, 240×300, aspect ratio 0.800), which every zone percentage and every rendering surface (Fabric canvas, GarmentMockup SVG, the static preview renderer) treats as ground truth.

`MockupCanvas.tsx`'s garment-background effect (`useEffect` keyed on `[garmentType, garmentColour, view]`) loads the photo and sets:
```ts
img.set({
  scaleX: canvas.getWidth() / (img.width || 1),
  scaleY: canvas.getHeight() / (img.height || 1),
  ...
})
```
`scaleX` and `scaleY` are computed **independently** — there is no shared scale factor, no `object-fit: contain`-equivalent, and no cropping. For a 1226×1283 (ratio 0.956) source stretched into a 240×300 (ratio 0.800) canvas, this applies roughly **19.6% more horizontal scale than vertical scale**, i.e. the photo is squashed vertically (equivalently, stretched horizontally) relative to its true proportions, for every garment that uses this shared image pipeline. This is a single global distortion applied uniformly underneath every position's zone box — it does not vary the distortion by garment type (they're all resized into the same 240×300, and the ones checked are all close to the same 0.956 native ratio, so the effect is consistently a ~20% vertical squeeze across the board), but it does mean the zone percentages were calibrated (per the file comment) against *some* rendering of the photo, and it's not clear from the code or comments whether that calibration pass happened before or after this stretch was introduced — i.e. whether "39%, 19%" was eyeballed against the correctly-proportioned photo or the already-stretched one.

The print-zone geometry (`zoneBoxPx`) then places boxes as percentages of that same stretched 240×300 canvas, so a zone box percentage always lands at a consistent *canvas* coordinate — but "consistent canvas coordinate" only equals "consistent anatomical location" if the underlying photo were rendered undistorted and identically proportioned across garments, and neither is true.

---

## 8. Identified Root Causes

1. **Independent X/Y stretch of raster photos to a fixed, garment-agnostic 240×300 box** (`MockupCanvas.tsx` lines ~184-192; mirrored in `GarmentMockup.tsx`/`mockupPreviewRenderer.ts`, not yet independently re-verified in this pass but sharing the same `GARMENT_VIEW_BOX` constant) is the primary, measurable, always-on distortion. Measured: source 1226×1283 (ratio 0.956) → target 240×300 (ratio 0.800) ≈ 20% relative vertical compression.
2. **Print zones are garment-agnostic** (`printZones.ts` has no per-garment dimension at all) despite garments having materially different chest/back/sleeve geometry — already tacitly acknowledged in code for Bennie/Hats (`printAnchorOverride`) and Singlet (`verticalOffsetPct`), but not generalized or documented as a known limitation for the other 8 types.
3. **No verification that the zone calibration pass and the stretch transform were done in a consistent order** — if the boxes were eyeballed against an already-stretched image, or against a differently-proportioned reference image than what ships today, the "39% from left" the staff sees will not match the "39% from left" a designer originally intended.
4. **Garment colour has no visual representation** (§9) — while not a *positioning* bug, it directly undermines trust in the mockup as an accurate preview, which is very likely part of why placement complaints are being raised at all (a mockup that's already visibly wrong on colour invites more scrutiny of position/size too).
5. **`refWidthMm` is one number per position, garment-agnostic** — a secondary, smaller contributor: physical size-to-pixel conversion (`physicalSizeToPixelSize`) is anchored to this constant, so the same requested `widthMm` renders at a different real-world scale relative to the garment than intended whenever the actual garment's usable print area differs from the assumed reference.

None of these are Fabric.js bugs — Fabric is rendering exactly what it's told (`scaleX`/`scaleY` as computed, zone box as computed). The distortion is entirely in the geometry/data layer feeding Fabric, not in Fabric's own transform code.

---

## 9. Fabric.js Analysis

- Version: `fabric@^6.9.1` (`package.json`).
- Usage is now deliberately non-interactive for end users: per `MockupCanvas.tsx`'s own header comment, drag/resize/rotate-by-handle were already removed in an earlier pass ("Pre-UAT product decision: the selected print position is now authoritative for artwork placement — staff no longer drag artwork around the garment"). The artwork object is `selectable: false, evented: false, hasControls: false, hasBorders: false`.
- Fabric's *only* remaining job is: (a) render a background image, (b) render a dashed guide rectangle for the active zone, (c) render the (non-interactive) artwork image at a computed left/top/scale/angle, recomputed any time `transform`, `zone`, or canvas size changes (`syncArtworkTransform`, `syncGuide`).
- Given how thin Fabric's actual responsibility now is (three non-interactive draw calls, no gesture handling, no object model beyond three objects), it is carrying very little unique value relative to its cost (§21) — see the plan doc's Fabric-survival critical question.
- **Bundle-loading finding**: despite the comment "editor-only, lazy-loaded," `fabric` is statically imported (`import * as fabric from 'fabric'`) in both `MockupCanvas.tsx` and `utils/mockupPreviewRenderer.ts`, with no `React.lazy()`/dynamic `import()` anywhere in `NewOrderForm.tsx` or its section components gating `MockupStudio`. Inspecting the last production build (`dist/assets`, built 2026-09-10) confirms this: there is no separate Fabric chunk; `MockupCanvas-C79UBzYl.js` is only 2.9KB (just the component wrapper) and `index-Cig6Yn0n.js`, the shared/main chunk loaded on every route, is 825KB — consistent with Fabric's ~300KB+ library code having been bundled into the common chunk rather than split out. This means **every page load** (Dashboard, Orders List, Production Board — not just New/Edit Order) currently pays for Fabric's parse/eval cost, contradicting the stated intent and directly relevant to the performance section (§21).

---

## 10. SVG Analysis

- `GARMENT_VIEW_BOX` (`'0 0 240 300'`) is an SVG viewBox string, and the vector-shape fallback path (`GarmentShape[]` → generated `<svg>` data URL in `garmentTemplateToDataUrl`) is genuine SVG.
- However, this path is **only reachable for `Customized`** — every other garment type has `images` defined and always takes the raster-photo branch (`garmentTemplateToDataUrl`'s priority order, confirmed by direct read of `config/garmentTemplates.ts`). The vector shapes for the other 11 types are therefore dead code for real orders today: they exist in the data file, are exercised by nothing a real customer order can reach, and cannot be recoloured any more usefully than the raster path can (they *can* be recoloured — vector fills support arbitrary colour — but that capability is unused because the raster branch always wins).
- No garment currently renders as canonical, colour-accurate SVG in production use.

---

## 11. Garment-Specific Zone Analysis

Concrete examples of where a single shared zone box cannot be correct for more than one silhouette:
- **Singlet vs Hoody, Left/Right Chest** (`xPct:39/50, yPct:19`): a Singlet's shoulder line sits materially higher and narrower than a Hoody's bulkier, longer torso — the same 19%-from-top box will read as "too low" on a Singlet photo and plausibly "about right" on a Hoody, exactly the kind of inconsistency a garment-agnostic zone table cannot avoid. (`Singlet` already carries a `verticalOffsetPct: 9` nudge in `garmentTemplates.ts`, which is itself evidence staff or a prior developer already found this exact mismatch and patched around it locally rather than in the zone table.)
- **Hi-Viz vest, Across Chest / Full Front**: a vest has open sides and a reflective-tape panel structure very unlike a T-shirt's continuous front panel; a 40%-wide Across Chest box calibrated against a T-shirt photo has no reason to line up with a vest's actual printable panel.
- **Bennie / Hats**: already fully special-cased via `printAnchorOverride`, bypassing the zone system outright — proof by existing precedent that headwear cannot use the T-shirt-shaped zone table at all.
- **Shorts / Pants, Full Front-equivalent positions**: the 9-position `PrintPosition` enum itself (Left/Right Chest, Across Chest, Full Front, sleeves, back positions) is garment-vocabulary borrowed from upper-body apparel; it's not clear from `printZones.ts` alone how a "Left Chest" position is meant to map onto Shorts/Pants at all, which is a modeling gap independent of the stretch/zone-percentage issues above.

---

## 12. Physical Sizing Analysis

`physicalSizeToPixelSize(widthMm, heightMm, zone, zonePx)` (`utils/mockupGeometry.ts`, referenced from `MockupCanvas.tsx`) converts a requested physical print size into on-canvas pixels using the zone's `refWidthMm` as the mm-per-zone-width reference. Because `refWidthMm` is per-position but not per-garment (§6), the same 150mm Left Chest print will render at a correct real-world proportion only for whichever garment the 150mm assumption was calibrated against — for a physically smaller garment (e.g. a kids' size, not currently modeled at all in `GarmentTemplate`) or a differently-shaped print panel (Hi-Viz vest), the rendered size-to-garment ratio will be off even though the requested mm value itself is stored and handled correctly. The A5/A4/A3/Oversized presets (`config/printSizePresets.ts`, added earlier this session) set `widthMm` directly and are not clamped to the zone box (correct, intentional overflow-warning behavior per the existing design) but inherit this same reference-scale uncertainty.

---

## 13. Mockup Preview Pipeline

`utils/mockupPreviewRenderer.ts` (imports Fabric directly, statically — same bundling caveat as §9) generates a static PNG snapshot of a `PrintSpec`'s mockup, stored via Supabase Storage bucket `mockup-previews`, referenced by `PrintSpec.previewStoragePath`. `syncMockupPreviewsForOrder` (`api/mockupPreviewSync.ts`, invoked from `useUpsertOrder`/`useUpdateOrderWithActivity` in `hooks/useOrders.ts`) regenerates previews after every Create Order / Save Changes / Edit Order submission that opts in (`generatePreviews: true`), diffing against `previousPrintSpecIds` to know which specs are new/changed. This pipeline is a snapshot of whatever `MockupCanvas`/`mockupPreviewRenderer` currently compute — it inherits every distortion in §8 verbatim; fixing the renderer's geometry (V2) requires either regenerating all existing previews or accepting that historical previews stay visually stale relative to new ones (see Plan doc §"historical order behavior").

---

## 14. Orders-Page Visibility Gap

`src/pages/OrdersList.tsx` was grepped directly for `MockupThumbnail`/`GarmentMockup` usage: **no matches**. The Orders List table/list view does not surface any mockup thumbnail at all today — mockup previews are only visible via `MockupThumbnail` on the Production Board (`components/domain/production/ProductionTable.tsx`, `OrderQuickView.tsx`) and via the full renderer/preview image on `ArtworkMockupsTab.tsx` (Order Detail). This is a genuine visibility gap relative to the audit's premise that the Orders page should plausibly show mockup state — worth a decision in the plan doc (§ Orders/Board/Detail integration) rather than assumed away.

---

## 15. Production Board Behavior

`ProductionTable.tsx` and `OrderQuickView.tsx` both use `MockupThumbnail`, which prefers the saved `previewStoragePath` PNG (a plain `<img>`, confirmed no Fabric import in `MockupThumbnail.tsx`) and falls back to a generic `Shirt` icon placeholder — **not** a live `GarmentMockup` render — when no preview exists yet. This means the Production Board's fallback state carries zero information about the actual garment/position/colour combination; only the tooltip text conveys that.

---

## 16. Order Detail Behavior

`ArtworkMockupsTab.tsx` (Order Detail's "Artwork & Mockups" tab) shows, per `PrintSpec`: the saved preview PNG if present, else a live `GarmentMockup` render (the non-Fabric fallback) plus a "No saved preview yet — save the order to generate one" note. This is the one surface in the app that still renders the live (non-snapshotted) geometry for a saved order, so it is also the surface most immediately affected by any V2 geometry change without needing a preview-regeneration migration.

---

## 17. Reorder Compatibility

Not independently re-verified file-by-file in this pass beyond what's already established: Reorder's flow (`NewOrderForm.tsx`'s `needsReorderArtworkCopy` branch, documented in this session's own recent work) copies artwork and print specs from a prior order into a new shell order, preserving `PrintSpec` fields including `offsetX`/`offsetY` and `widthMm`/`heightMm` as-is. A V2 geometry change does not break this copy mechanism structurally (it copies data, not rendered pixels), but a reordered spec's *rendered* appearance will change if V2 changes how those fields are interpreted — flagged for the plan doc's backward-compatibility section rather than assumed to be a non-issue.

---

## 18. Supplier-Link Architecture

Not present in the current codebase in any form found so far in this pass — no `garment_types`/`garment_brands`-style catalog table or supplier-link UI was located during this audit window. This section is incomplete pending a dedicated schema inspection (the audit ran out of scope/time before reaching it) and should not be treated as "confirmed absent" — see §23 (open items) and the Plan doc's explicit call-out that the supplier-link schema/UI question needs a follow-up pass before implementation, not a guess.

---

## 19. Responsive Implications

`MockupCanvas` resizes via a `ResizeObserver`-driven `width`/`height` prop change (`ResizeObserver` itself not directly re-inspected this pass, but the effect handling `[width, height]` changes is confirmed) and recomputes `scaleX`/`scaleY` fresh against the new dimensions each time — meaning the same independent-X/Y-stretch distortion (§7) is reapplied, unchanged, at every viewport size. Responsiveness is not itself broken by this, but it means the distortion is viewport-size-independent (not something that only shows up on mobile or only on desktop) — a small positive: fixing it once fixes it everywhere.

---

## 20. Garment Colours

Direct finding from `config/garmentTemplates.ts`'s own header comment plus its `images` structure: raster PNG photos "do NOT support the garment-colour fill the vector shapes did (an opaque raster image can't be recoloured...)". Every real garment type having `images` defined means **colour selection currently has no visual effect on any real order's mockup** — `garmentColour`/`spec.colour` are stored and displayed as text (`ArtworkMockupsTab.tsx`: `{garmentColour} {garmentType} — {spec.position}`) but the rendered photo is always whatever single photo exists for that type/view, regardless of selected colour. This is a materially significant, previously-undocumented product gap independent of the placement-accuracy investigation, but very likely compounding staff/client distrust of mockup accuracy generally.

---

## 21. Performance Implications

Two concrete, measured findings from the last production build (`dist/`, built 2026-09-10):
- **Garment photo payload**: 22 PNG files (front/back × ~11 garment types) totaling **~25MB** uncompressed, individual files ranging up to ~1.5MB each (e.g. `bennie-front`, `hoody-front`). These are only fetched on demand per garment type/view (not all 25MB on one page load), but each individual fetch is a heavy, unoptimized asset for what renders into a ~240×300 logical box.
- **Fabric bundling**: as established in §9, Fabric.js is not code-split from the main bundle (`index-*.js`, 825KB) despite the intent to keep it editor-only — every route pays this cost, not just New/Edit Order.

---

## 22. Accessibility Implications

`MockupCanvas`'s `<canvas>` element carries `role="img" aria-label="Mockup preview canvas"` — a static, non-descriptive label regardless of garment/position/artwork state (confirmed from the component's return statement). This was not the focus of this audit pass and is flagged here only as a secondary, low-effort improvement opportunity for the plan doc, not a root cause of the placement-accuracy complaint.

---

## 23. Open Items / Not Yet Verified

In the interest of not overstating this pass's completeness:
- Garment catalog DB schema (any `garment_types`/`garment_brands`/supplier tables) was not located within this audit's scope — §18 is incomplete, not "confirmed absent."
- `GarmentMockup.tsx` (the read-only fallback renderer) and `mockupPreviewRenderer.ts` were referenced but not read line-by-line in this pass to confirm they use the identical independent-scaleX/scaleY stretch as `MockupCanvas.tsx` — they share the same `GARMENT_VIEW_BOX` constant and the same `garmentTemplateToDataUrl()` source, so the same distortion is highly likely to apply, but this should be confirmed before V2 implementation rather than assumed.
- No unused/orphaned legacy garment PNGs or silhouette assets were specifically searched for beyond the 22 files already accounted for in `dist/assets`.

---

## 24. Recommended Architecture (summary — full detail in the Plan doc)

At a summary level (full reasoning, comparison matrix, and critical-question answers are in `MOCKUP_SYSTEM_V2_PLAN.md`): the two concrete, measured root causes (§8.1 independent-axis photo stretch, §8.2 garment-agnostic zone table) are both **data/geometry problems, not Fabric problems** — Fabric is correctly executing whatever transform it's given. This means the fix does not strictly require removing Fabric; it requires (a) preserving each garment photo's true aspect ratio instead of independently stretching X/Y, and (b) making print zones garment-specific instead of one shared table. Whether that's best done by keeping raster photos + fixing the stretch math, or moving to canonical SVG templates for full colour/geometry control, is exactly the tradeoff the Plan doc's comparison matrix and critical questions address directly and without hedging.

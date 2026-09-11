# Mockup System V2 — Batch A Handover

Batch: **CANONICAL GEOMETRY + PLACEMENT ACCURACY**
Audit commit: `cc50a2e` (docs only)
Status: implementation complete, build/lint/test clean, **stopped at MOCKUP SYSTEM V2 — BATCH A GATE** per instructions — no further milestone started automatically.

---

## 1. Batch Goal

Fix print-placement accuracy by replacing (a) the independent-axis garment-photo stretch and (b) the single garment-agnostic print-zone table with a canonical, garment-specific geometry model shared by all three renderers, while leaving Fabric, the preview storage scheme, Orders/Production/Order Detail UI, supplier links, and asset optimization untouched (all explicitly out of scope for this batch).

## 2. Root Causes Addressed

From `MOCKUP_SYSTEM_V2_AUDIT.md`:
1. **§8.1 Independent-axis stretch** — `MockupCanvas`/`mockupPreviewRenderer` used to set `scaleX = canvasWidth/imgWidth`, `scaleY = canvasHeight/imgHeight` independently, squashing every ~0.956-ratio garment photo into the fixed 240×300 (0.800-ratio) canvas. **Fixed**: replaced with `fitGarmentIntoViewport` — a single uniform `scale`, never independent axes.
2. **§8.2 Garment-agnostic print zones** — one flat `PrintZone[]` table reused identically across all 12 garment types. **Fixed**: `config/garmentGeometry.ts` defines zones per garment type *and* view.
3. **§8.2/§11 Ad hoc per-garment patches** (`printAnchorOverride`, `verticalOffsetPct`) — retired from the V2 render path (not deleted from `garmentTemplates.ts`, which still carries them for backward-compatible legacy consumers/tests — see §14).
4. **§12 Garment-agnostic `refWidthMm`** — V2 zones carry their own `refWidthMm` per garment/position, not one shared value per position.

Not addressed in this batch (by design — see the audit's own scope and Batch A's explicit exclusions): Fabric bundle-splitting, garment photo compression, supplier links, Orders-page thumbnails, historical preview backfill, garment colour recoloring.

## 3. New Geometry Architecture

Three new/extended pure modules, all framework-independent (no React, no Fabric):

- **`src/config/garmentGeometry.ts`** (new) — the geometry data + resolvers: `GARMENT_GEOMETRY` table, `resolveGarmentGeometry`, `resolvePrintZone`, `isPrintPositionSupported`, `getPositionView`, `ALL_PRINT_POSITIONS`, `getGarmentCalibrationTier`.
- **`src/utils/garmentFit.ts`** (new) — `fitGarmentIntoViewport` (the uniform-scale "contain" fit) plus `mapCanonicalRectToViewport`/`mapCanonicalPointToViewport`.
- **`src/utils/mockupGeometry.ts`** (extended, not replaced) — new canonical-unit functions (`canonicalUnitsPerMm`, `physicalSizeToCanonicalSize`, `canonicalZoneBoxMm`, `fitArtworkToCanonicalZone`, `isOverflowingCanonicalZoneMm`, `resolveArtworkPlacement`) added alongside the pre-existing legacy percentage-based functions, which are kept only for their own tests and `printZones.ts`'s now-inert offsetX/offsetY reconstruction math.

All three renderers (`MockupCanvas.tsx`, `GarmentMockup.tsx`, `mockupPreviewRenderer.ts`) now call the same resolver + fit + placement functions — none computes garment bounds, zone bounds, anchors, or mm scale independently (Part 11).

## 4. Canonical Coordinate Model

**`CANONICAL_VIEWPORT = { width: 1226, height: 1283 }`** — not an arbitrary round number, but the measured native pixel size of the current garment photos themselves (confirmed across 21 of the 22 assets in `src/assets/mockups/*.png`; `hats-back.png`, at 1312×1199, is the one exception — harmless since Hats carries no calibrated print zones in this batch, see §13). Garment geometry and print-zone geometry are defined in this same space by construction, so no separate normalization step can silently reintroduce an axis-independent stretch. If a future asset swap changes the native photo resolution, this constant (or a per-garment `viewBox` override) needs updating rather than the renderer silently stretching again.

## 5. Garment-Fit Algorithm

`fitGarmentIntoViewport(sourceWidth, sourceHeight, targetWidth, targetHeight)` returns `{ x, y, width, height, scale }`: a single uniform `scale = min(targetW/sourceW, targetH/sourceH)`, centered via `x/y` offsets (letterbox/pillarbox as needed), degrading safely to `{x:0,y:0,width:targetW,height:targetH,scale:1}` for a zero-size source. Used identically by all three renderers; unit-tested in `src/utils/garmentFit.test.ts` (portrait source, landscape source, exact aspect match, narrow mobile viewport, wide desktop viewport, zero-size degeneration, proportion-preservation across a range of viewport sizes).

## 6. Garment-Specific Zone Model

`GarmentPrintZone` (canonical units): `{ x, y, width, height, anchorX, anchorY, refWidthMm, defaultWidthMm?, maxWidthMm?, maxHeightMm? }`. `GarmentViewGeometry` wraps a `viewBox`, `garmentBounds`, and a `Partial<Record<PrintPosition, GarmentPrintZone>>`. `GARMENT_GEOMETRY: Record<GarmentType, GarmentGeometry>` carries a `tier: 'calibrated' | 'fallback' | 'unsupported'` per type (see §10/§13). The same position (e.g. `Left Chest`) intentionally maps to different coordinates for T-shirt vs Hoody — confirmed by test (`garmentGeometry.test.ts`: "T-shirt and Hoody Left Chest coordinates differ").

## 7. Anchor Model

Every zone's `anchorX`/`anchorY` defaults to its own box center (`x + width/2`, `y + height/2`) — kept as an explicit field rather than always-derived so a future calibration could anchor off-center within a box if ever needed, though none currently does. Artwork is always centered on this anchor; there is no code path that reads `offsetX`/`offsetY` to move it (see §14).

## 8. Physical mm Model

`canonicalUnitsPerMm(zone) = zone.width / zone.refWidthMm` — one factor, applied uniformly to both width and height (verified safe by test: canonical units are isotropic since the canonical viewBox is the garment photo's own native pixel grid, with no independent per-axis distortion once `fitGarmentIntoViewport` replaced the old scaleX/scaleY). `physicalSizeToCanonicalSize`, `canonicalZoneBoxMm`, `fitArtworkToCanonicalZone`, `isOverflowingCanonicalZoneMm`, and `resolveArtworkPlacement` build on this factor. The physical-size invariant ("a 90mm print stays 90mm regardless of viewport") is directly tested in `mockupGeometry.test.ts`, as is "changing position preserves widthMm."

## 9. Artwork-Ratio Model

Unchanged from the prior behavior: `heightMm = widthMm / aspectRatio` (`utils/printSizeConversion.ts`, untouched), height always follows the artwork's intrinsic ratio. `resolveArtworkPlacement` renders whatever width/height it's given without re-deriving or distorting the ratio — tested directly.

## 10. Priority Garment Calibration

**T-shirt, Hoody, Polo, Crew neck (jumper)** are tagged `'calibrated'` with individually-authored zones for all 9 positions on both views, derived from a direct visual read of each garment's actual technical-flat photo (`src/assets/mockups/{type}-{view}.png`) — see §20 "Visual QA status" for exactly how confident this calibration is. Concretely:
- **Hoody's chest zone sits lower** than T-shirt's (hood/drawstring area takes more vertical space at the top).
- **Hoody's Full Front is bounded above the kangaroo pocket** (~62% down), not the full collar-to-hem span T-shirt/Polo/Crew-neck use.
- **Polo's Across Chest sits lower** to clear its larger structured collar.
- **Crew neck's sleeve zone sits lower** than T-shirt's short-sleeve zone (long-sleeve upper-arm placement vs short-sleeve cuff-adjacent placement).
- Polo's and Crew neck's **back-view zones reuse T-shirt's back zones directly** (all three read as a plain torso panel in their photos) — an explicit, documented reuse, not an oversight.

## 11. Front/Back Behavior

Unchanged conceptually, now centralized: `POSITION_VIEW: Record<PrintPosition, 'Front'|'Back'>` in `garmentGeometry.ts` is the one place front/back is derived from a position — an anatomy fact independent of garment type, replacing every ad hoc `getPrintZone(position).view` call site across `MockupStudio.tsx`, `ArtworkMockupsTab.tsx`, and `mockupPreviewSync.ts`.

## 12. Sleeve Behavior

Left/Right Sleeve are calibrated per priority garment as required (Part 15) — not assumed identical across garments. T-shirt and Polo share a short-sleeve band; Hoody and Crew neck each get their own (different from each other and from the short-sleeve garments) — see the coordinates in `garmentGeometry.ts` and the differentiation test in `garmentGeometry.test.ts`.

## 13. Unsupported Garment Handling

**Shorts, Pants, Bennie, Hats are tagged `'unsupported'`** — `isPrintPositionSupported` returns `false` for all 9 current positions on these four types. This is a deliberate behavior change from the prior code, which mapped every position on Bennie/Hats onto one fixed `printAnchorOverride` point regardless of which was actually selected — exactly the "fake placement" this batch was told not to do, and explicitly named alongside Shorts/Pants as an anatomically-invalid vocabulary case in the batch brief (Part 16). The renderers still show the garment photo alone (via the same fit algorithm) for these types; `MockupCanvas` skips drawing the guide/artwork, `GarmentMockup` skips its overlay, `mockupPreviewRenderer` renders the garment-only preview, and `MockupStudio` shows an explicit inline warning plus dims (but does not hide) the unsupported position buttons. **This is documented, deferred domain work**: a real fix needs its own headwear/bottoms-specific position vocabulary (e.g. "Front Panel" for a cap, not "Left Chest") — not solved in this batch.

Shirt, Hi-Viz vest, Singlet, and Customized are tagged `'fallback'` — torso-shaped garments where the position vocabulary is anatomically valid but no dedicated calibration pass has been done; they reuse T-shirt's calibrated zones rather than guessing new numbers, an explicit placeholder rather than a silent unrelated distortion.

## 14. Offset Legacy Behavior

`offsetX`/`offsetY` remain on `MockupTransform`, `PrintSpecFormValues`, and the `print_specs` table — **no column changes, no type changes, no destructive migration**. No V2 code path reads them: `resolveArtworkPlacement`'s signature has no offset parameter at all (there is no way to move artwork off-anchor even historically through this function), and `MockupStudio.tsx`'s `transform` object still sets `offsetX: 0, offsetY: 0` unconditionally, unchanged from before this batch. Historical `PrintSpec` rows with a non-zero stored offset render identically to a zero-offset row — verified by test (`mockupGeometry.test.ts`: "centers artwork exactly on the zone anchor, ignoring any offsetX/offsetY value").

## 15. Renderer Unification

`MockupCanvas.tsx`, `GarmentMockup.tsx`, and `mockupPreviewRenderer.ts` all now call `resolveGarmentGeometry`/`resolvePrintZone` from `garmentGeometry.ts` and share `fitGarmentIntoViewport`/`mapCanonicalRectToViewport`/`mapCanonicalPointToViewport` from `garmentFit.ts`, plus `resolveArtworkPlacement` from `mockupGeometry.ts` for the mm→pixel placement step. For the same `PrintSpec` inputs (garmentType, position, widthMm/heightMm), all three resolve the identical canonical zone and anchor — they differ only in how they map canonical→viewport pixels (each owns its own canvas/container size), which is exactly the one axis they're supposed to differ on.

## 16. Preview-Generation Behavior

`mockupPreviewRenderer.ts`'s `MockupPreviewInput` dropped `zone: PrintZone` and `offsetX`/`offsetY` entirely, replaced with `position: PrintPosition` (view and zone are now resolved internally via the shared geometry functions, consistent with §15). `mockupPreviewSync.ts` updated to match. Output size changed from a fixed 720×900 (3× of the old 240×300) to `900 × (900 × viewBox.height/viewBox.width)` — still a single uniform scale of the canonical viewBox, never independently stretched. `previewStoragePath`, the Storage bucket, and the upload/cleanup logic are all untouched (Part 20).

## 17. Historical Compatibility

No `print_specs` schema change, no migration, no bulk data mutation. An existing `PrintSpec` (position + widthMm/heightMm + garmentType + garmentColour + artwork, whatever its stored offsetX/offsetY) resolves through the same V2 pipeline as a brand-new one. For a garment/position combination now marked unsupported (Bennie/Hats/Shorts/Pants), the garment still renders — just without a fabricated placement — rather than crashing or silently reusing the old fixed-anchor behavior. Reorder (`NewOrderForm.tsx`'s shell-then-attach flow) is unaffected — it copies `PrintSpec` field values, not rendered pixels.

## 18. Tests

40 new tests across 3 files (226 total, up from a 186 baseline — no existing test was deleted or altered in a way that changes its assertion):
- `src/utils/garmentFit.test.ts` (11 tests) — portrait/landscape/exact-match fitting, no independent scaleX/scaleY, narrow/wide viewports, zero-size degeneration, proportion preservation, canonical rect/point mapping including letterbox offset.
- `src/config/garmentGeometry.test.ts` (18 tests) — position→view mapping, all 4 priority garments calibrated with all 9 positions supported, T-shirt vs Hoody zone divergence, sleeve zone divergence, anchor-equals-box-center invariant, fallback-tier garments still resolve usable zones, unsupported-tier garments correctly report `false`/`undefined` for every position, safe fallback for an unrecognized garment type.
- `src/utils/mockupGeometry.test.ts` (+11 tests, appended to the existing legacy-model test file) — canonical mm-per-unit calibration, isotropic width/height scaling, zone-box-mm derivation, contain-fit sizing, overflow detection in mm, the 90mm-at-any-viewport physical-size invariant, position-change-preserves-widthMm (Left Chest → Full Front), anchor-centering with offset ignored, artwork-ratio-derives-height.

## 19. Performance Impact

No intended change — Batch A explicitly excludes Fabric bundle-splitting and asset compression. Measured build output: main chunk `828.71 kB` (baseline `825.56 kB`, +3.15 kB from the new geometry modules — no regression, no new Fabric duplication), `MockupCanvas` chunk `4.10 kB` (baseline `2.92 kB`, +1.18 kB from the added debug-overlay guard code and geometry calls — still a small, separately-chunked file, still not carrying Fabric itself), `mockupPreviewRenderer` chunk `1.02 kB` (baseline `0.89 kB`). Garment photo assets (~25 MB total) untouched.

## 20. Visual QA Status

**No browser-based visual verification was performed** — this environment has no browser/screenshot tooling available to this session. Per the batch brief's own instruction ("If browser tooling is NOT available: do NOT claim visual accuracy is confirmed... This limitation must be stated honestly"): the calibration values in `garmentGeometry.ts` are a deliberate, documented best-effort visual read of the actual garment photos (via direct image inspection of `tshirt-front.png`, `tshirt-back.png`, `hoody-front.png`, `polo-front.png`, `crew-neck-front.png`), converted into canonical-unit boxes — not a pixel-measured ground truth, and not confirmed correct in a rendered browser. What **was** verified deterministically: the geometry math itself (fit algorithm, mm mapping, anchor centering, position-independence of physical size) via 40 passing pure unit tests, and that the build/lint/test pipeline is clean. The manual visual QA matrix below is prepared for a human (or a future session with browser tooling) to actually check.

### Manual QA matrix (prepared, not yet executed)

| Garment | Position | Expected |
|---|---|---|
| T-shirt | Left Chest | Clearly left-of-center on the chest, not centered, not too close to the sleeve seam, not too low |
| T-shirt | Right Chest | Mirror of Left Chest |
| T-shirt | Full Front | Centered on the torso, clear of the neckline and the hem |
| T-shirt | Full Back | Centered on the back torso |
| Hoody | Left Chest | Left-of-center, sitting below the drawstrings/hood, above the kangaroo pocket |
| Hoody | Full Back | Centered on the back torso, clear of the hood's collar bump |
| Polo | Left Chest | Left-of-center, clear of the button placket |
| Crew neck | Left Chest | Left-of-center, matching the T-shirt band closely (same silhouette family) |
| Any priority garment | Left/Right Sleeve | Visually centered within the printable sleeve region, not spilling onto the shoulder seam or off the sleeve edge |

Not yet visually checked at all (§13, deferred by design): Shorts, Pants, Bennie, Hats — these intentionally show no placed artwork in this batch.

## 21. Known Limitations

- Garment-bounds boxes (`garmentBounds` in each `GarmentViewGeometry`) are a rough visual estimate, not a pixel-measured crop — currently only used informationally (not yet consumed by any rendering decision beyond being available for a future use, e.g. cropping).
- Polo's and Crew neck's back-view zones were not independently visually verified against their own back photos (`polo-back.png`, `crew-neck-back.png` were not opened this batch) — they reuse T-shirt's back zones on the documented assumption that these three read as the same plain torso panel from behind. This should be confirmed against the real photos before or during manual QA.
- Hoody's back-view zones were calibrated by inference from the front photo's proportions and the general "hood adds headroom at the collar" reasoning, not from directly viewing `hoody-back.png` — flagged for the same reason.
- `hats-back.png`'s real pixel size (1312×1199) differs from the declared `CANONICAL_VIEWPORT` (1226×1283) — harmless today since Hats carries no calibrated zones, but would need its own `viewBox` override if Hats is ever calibrated in a future batch.
- No browser-based visual confirmation (§20) — the manual QA matrix above still needs a human pass.
- The dev-only geometry debug overlay (`?mockupDebug=1` in a dev build) was added but not itself visually exercised in a browser for the same reason.

## 22. Next Mockup V2 Milestone

Per the batch brief's own sequencing and the audit's rollout plan: Batch B candidates, in rough priority order — (1) a human/browser visual QA pass against the matrix in §20, correcting any zone that reads wrong; (2) Polo/Crew-neck back-view zones verified against their own photos rather than reused from T-shirt; (3) Hoody back-view zones verified against `hoody-back.png` directly; (4) a real headwear/bottoms position vocabulary so Bennie/Hats/Shorts/Pants can eventually be supported instead of unsupported; (5) Fabric bundle-splitting and garment-photo compression (explicitly deferred performance work); (6) historical preview backfill once the above calibration is confirmed stable; (7) Orders-page mockup thumbnail visibility and the supplier-link schema (both explicitly out of scope here). None of this has been started.

---

## MOCKUP SYSTEM V2 — BATCH A GATE

Stopped here per instructions. Build/lint/test are clean (see §19/§18 for exact figures); no next milestone has been started automatically.

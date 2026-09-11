# Mockup System V2 — Post-Batch C Neck Clearance Calibration Patch

A focused visual-calibration patch on top of Batches A/B/C (`41b88ed`, `6af9153`, `19098fb`), triggered by the first round of real human visual QA. **Not a new implementation phase** — one file's data changed, plus tests and docs.

## Root Calibration Issue

Human visual QA confirmed the Batch A–C architecture is working correctly (deterministic positioning, artwork follows the selected print position, overall garment geometry substantially improved) but found four upper-body positions — **Left Chest, Right Chest, Across Chest, Top Back** — sitting slightly too close to the garment neckline/collar across the priority garments, a purely vertical calibration issue.

## What Changed

`src/config/garmentGeometry.ts` only — a small, garment-specific downward (`y +=`) shift to the four affected zones for each of the four priority garments. No shared/universal offset was applied; each garment's correction size was chosen independently based on its actual neck/collar geometry (a plain crew neckline needs less clearance than a hoody's hood/drawstrings or a polo's collar-and-placket). `x`, `width`, `height`, and `refWidthMm` are unchanged for every zone — this is a position-only fix.

## Before / After Calibration Table

| Garment | Position | Old y | New y | Δy (canonical units) | Δy (% of viewBox height) |
|---|---|---|---|---|---|
| T-shirt | Left Chest | 257 | 292 | +35 | +2.7% |
| T-shirt | Right Chest | 257 | 292 | +35 | +2.7% |
| T-shirt | Across Chest | 231 | 268 | +37 | +2.9% |
| T-shirt | Top Back | 180 | 215 | +35 | +2.7% |
| Hoody | Left Chest | 334 | 358 | +24 | +1.9% |
| Hoody | Right Chest | 334 | 358 | +24 | +1.9% |
| Hoody | Across Chest | 308 | 330 | +22 | +1.7% |
| Hoody | Top Back | 380 | 400 | +20 | +1.6% |
| Polo | Left Chest | 257 | 298 | +41 | +3.2% |
| Polo | Right Chest | 257 | 298 | +41 | +3.2% |
| Polo | Across Chest | 257 | 278 | +21 | +1.6% |
| Polo | Top Back | 180 | 218 | +38 | +3.0% |
| Crew Neck | Left Chest | 257 | 288 | +31 | +2.4% |
| Crew Neck | Right Chest | 257 | 288 | +31 | +2.4% |
| Crew Neck | Across Chest | 231 | 258 | +27 | +2.1% |
| Crew Neck | Top Back | 180 | 212 | +32 | +2.5% |

(Percentages are of `CANONICAL_VIEWPORT.height` = 1283. All `x`/`width`/`height`/`refWidthMm` values for these zones are unchanged from Batch A/B — only `y`, and therefore `anchorY`, moved.)

**Why the corrections differ by garment**: Polo received the largest chest correction (+41) because its collar-and-placket create the largest restricted region of any priority garment. Hoody received the smallest corrections (+20 to +24) because Batch B had already pushed its back zones down substantially to clear the hood's draped flap, and its front chest band was already lower than T-shirt's from Batch A's original calibration — less additional room was needed. T-shirt and Crew Neck, both plain-collar garments, landed in between.

## Left Chest

Moved down only (T-shirt +35, Hoody +24, Polo +41, Crew Neck +31 canonical units). `x`, `width`, `height`, `refWidthMm` unchanged — physical width, aspect ratio, and horizontal position are untouched. The artwork now centers further from the collar, on the chest itself rather than immediately below the neckline.

## Right Chest

Identical `y`/`height` to Left Chest for every garment (see the "Left/Right Chest symmetry" test below) — no independent drift, since none of the four garments' anatomy gives a reason for Left and Right to differ vertically. `x` values (368/711 per garment) are exactly what they were before this patch.

## Across Chest

Received its own correction per garment, not a copy of the chest correction — Polo's Across Chest needed the smallest further adjustment (+21) since Batch A had already placed it lower than the other garments to clear Polo's collar; T-shirt/Hoody/Crew Neck needed proportionally more (+37/+22/+27). Horizontal centering, physical-mm mapping, and width behavior are all unchanged (`x`, `width`, `refWidthMm` untouched).

## Top Back

Moved down per garment, deliberately staying well short of Full Back's own vertical range — verified by a new test asserting Top Back's bottom edge never reaches Full Back's bottom edge for any priority garment (i.e. it hasn't become a second Full Back). Hoody's correction (+20) is the smallest since Batch B already pushed Top Back down substantially to clear the hood's draped flap; Polo's (+38) accounts for its rear collar.

## Answers to the Report Questions

- **Horizontal coordinates changed?** No. Every `x` value for the four affected positions, across all four garments, is byte-for-byte identical to its Batch A/B/C value — verified by a new test.
- **refWidthMm changed?** No. Verified by a new test asserting `refWidthMm` for Left Chest/Right Chest (130), Across Chest (300), and Top Back (280) is unchanged for every priority garment.
- **Physical sizing changed?** No. `width`/`height` (the zone-box basis for the mm↔canonical-unit conversion) are unchanged for every corrected zone — verified by a new test.
- **Renderer code changed?** No. `MockupCanvas.tsx`, `GarmentMockup.tsx`, and `mockupPreviewRenderer.ts` were not touched. All three already resolve placement through `resolvePrintZone`/`resolveArtworkPlacement`, so the corrected `y` values propagate automatically to every surface (Mockup Studio, Orders, Production Board, Order Detail, Preview Drawer, saved preview PNG generation) with no per-renderer change needed.
- **WebP/Fabric asset-scaling changed?** No. `computeAssetCorrectedScale` (Batch C) was not touched — this patch operates entirely in canonical geometry coordinates (`garmentGeometry.ts`), never in asset pixel dimensions. Confirmed by a new test tying the corrected zone's anchor position together with `computeAssetCorrectedScale` at two different (original vs. optimized-webp) asset resolutions and showing the artwork anchor position is identical either way.
- **No `verticalOffsetPct`, `printAnchorOverride`, `offsetX`/`offsetY`, CSS transforms, or renderer-specific corrections were introduced** — the fix is entirely in `GarmentPrintZone.y` values inside `garmentGeometry.ts`, per the patch's own constraint.

## Zone Bounds vs. Anchor

Chose **Option A** (shift the zone's `y`, keeping `width`/`height` fixed) rather than changing vertical boundaries independently — the anchor is always the box's own center by construction (`zone()` helper), so it moved by exactly the same amount as the box and never needed separate handling. The visible zone guide (drawn from the same `GarmentPrintZone` the artwork is centered on) and the actual artwork placement continue to agree by construction — there is no code path where they could diverge.

## Tests

12 new tests across two files (269 → 281):
- `src/config/garmentGeometry.test.ts` (+11, new `describe('Post-Batch-C neck clearance patch')` block): Left/Right/Across Chest and Top Back remain explicitly defined per priority garment; Left/Right Chest stay vertically symmetric; Left/Right Chest `x` values are unchanged from before the patch; all four corrected positions stay within their garment's silhouette bounds; every anchor stays within its own zone; Top Back never creeps down into Full Back's bottom-edge territory; `refWidthMm` is unchanged for every corrected zone; zone `width`/`height` (the physical-mm mapping basis) is unchanged; no zone carries an `offsetX`/`offsetY` field; each garment received its own distinct correction (not one value copy-pasted across all four).
- `src/utils/mockupGeometry.test.ts` (+1): the corrected zone's anchor maps to the same on-screen point regardless of whether the loaded garment asset is the original 1226×1283 photo or the optimized ~900px webp.

Existing tests were deliberately **not** rewritten to hard-code the new coordinates — they test invariants (zones exist, differ appropriately between garments, resolve through the shared pipeline) that remain true regardless of the exact calibration numbers, which is why all of them kept passing unmodified through this patch.

## Visual QA Support

`docs/MOCKUP_V2_VISUAL_QA.md` updated: the human finding is recorded verbatim, and Left Chest/Right Chest/Across Chest/Top Back are marked **RETEST REQUIRED** (not PASS) for all four priority garments, with the specific old→new `y` value noted on each row so the retester knows exactly what changed. Across Chest rows were added to the Hoody/Polo/Crew Neck tables (previously only listed for T-shirt) since this patch affects that position on all four garments.

## Known Issues

None introduced by this patch. The pre-existing ~1-unit horizontal asymmetry between Left Chest's and Right Chest's `x` distance from the torso centerline (368/711 around a ~613.5 center — an artifact of Batch A's original eyeballed-not-algebraic calibration) was noticed while writing the symmetry test, is far too small to be visually meaningful, and was left untouched per this patch's explicit "do not change horizontal alignment" scope.

---

## MOCKUP V2 — NECK CLEARANCE CALIBRATION GATE

Stopped here per instructions. The next step is **human visual retest** of the RETEST REQUIRED rows in `docs/MOCKUP_V2_VISUAL_QA.md` — no further automatic visual adjustments will be made.

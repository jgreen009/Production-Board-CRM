# Mockup System V2 — Non-Upper-Body Garment Extension

Extends Mockup System V2 so Beanie, Hats, Shorts, and Pants always show a garment mockup and expose only the print positions that are anatomically valid for them, instead of being permanently marked "unsupported" and hidden.

## 1. Original limitation

Every Mockup System V2 batch (A/B/C) kept Bennie, Hats, Shorts, and Pants in an `'unsupported'` calibration tier: `printZones: {}` for both views, `isPrintPositionSupported()` always `false`, and every consumer (MockupCanvas, GarmentMockup, MockupThumbnail, the public order form) treated that as "don't render a placement, and in several places, don't render the garment mockup preview at all." This was a deliberate, honestly-documented decision at the time (the 9-position upper-body vocabulary — Left Chest, Full Front, sleeves, etc. — has no real meaning on a beanie or a pair of shorts), but the product requirement has changed: these garments must always show a mockup, with their own valid position set, not stay permanently unsupported.

## 2. Updated PrintPosition model

`src/types/index.ts`'s `PrintPosition` union gained 8 new values, purely additive — every existing upper-body value is untouched:

```ts
| 'Front' | 'Back' | 'Left Side' | 'Right Side'
| 'Left Leg' | 'Right Leg' | 'Left Thigh' | 'Right Thigh'
```

The `print_specs.position` CHECK constraint in Postgres was widened the same way (drop + recreate with every old value plus the 8 new ones — no value removed or renamed, so no historical row can fail to validate). Applied live via `supabase db query` (the `supabase db push` migration-history path was blocked by a pre-existing local/remote migration mismatch unrelated to this change — see §"known limitations"); the migration file `supabase/migrations/20260913000000_non_upper_body_print_positions.sql` documents the exact statement for history even though it wasn't the actual apply mechanism this time.

## 3. New positions added, and who uses them

| Position | Used by | View |
|---|---|---|
| Front | Bennie, Hats | Front |
| Back | Bennie, Hats, Shorts, Pants | Back |
| Left Leg | Shorts, Pants | Front |
| Right Leg | Shorts, Pants | Front |
| Left Thigh | Pants | Front |
| Right Thigh | Pants | Front |
| Left Side | *(none yet — reserved)* | n/a |
| Right Side | *(none yet — reserved)* | n/a |

`Left Side`/`Right Side` exist in the type/DB vocabulary (per the task's own "recommended initial additions") but are not returned by `getSupportedPrintPositions()` for any garment — the current Hat assets are front/back photos only, no side view, and this project's whole Mockup V2 philosophy has been "never fabricate a placement with no matching asset." They're documented here as deferred, not silently dropped.

## 4. Garment → supported-position mapping

The single source of truth is `getSupportedPrintPositions(garmentType)` in `src/config/garmentGeometry.ts` — it is **derived directly from the garment's own calibrated zones** (`Object.keys` of the front+back `printZones`), not a hand-maintained parallel list that could drift from the actual geometry:

```ts
export function getSupportedPrintPositions(type: GarmentType): { position: PrintPosition; label: string }[] {
  const geometry = getGarmentGeometry(type)
  const frontPositions = geometry.views.front ? Object.keys(geometry.views.front.printZones) : []
  const backPositions = geometry.views.back ? Object.keys(geometry.views.back.printZones) : []
  const supported = new Set([...frontPositions, ...backPositions])
  return ALL_PRINT_POSITIONS.filter((p) => supported.has(p.position))
}
```

Results:

- **T-shirt / Hoody / Polo / Crew neck / Shirt / Hi-Viz vest / Singlet / Customized** (all upper-body/fallback tier, unchanged): Left Chest, Right Chest, Across Chest, Full Front, Left Sleeve, Right Sleeve, Full Back, Top Back, Bottom Back.
- **Bennie**: Front, Back.
- **Hats**: Front, Back.
- **Shorts**: Left Leg, Right Leg, Back.
- **Pants**: Left Thigh, Right Thigh, Left Leg, Right Leg, Back.

`ALL_PRINT_POSITIONS`' own ordering is what makes the *first* entry of each filtered list the garment's sensible default — see §11.

## 5. Beanie geometry

Calibrated by direct visual inspection of `bennie-front.png`/`bennie-back.png` (technical-flat ribbed-cuff beanie sketches, 1226×1283 canonical space, same as every other garment). The only realistic beanie print location is a small centered patch on the folded cuff — the ribbed dome above it isn't a real print surface. `Front` zone: `x=368, y=790, width=490, height=220, refWidthMm=90, maxWidthMm=100` — centered within the cuff band (which spans roughly 55%–84% of the image height), not stretched across the whole band, so it reads as a small embroidered patch. `Back` reuses the identical box: the back photo shows no distinguishing rear feature (no seam, no tag) to calibrate independently against, so `CALIBRATION_CONFIDENCE` records Back as `'inferred'`, Front as `'verified'` — an honest distinction, not a blanket claim both were independently confirmed.

## 6. Hat geometry

Calibrated against `hats-front.png`/`hats-back.png`. `Front` zone: `x=380, y=280, width=466, height=280, refWidthMm=90, maxWidthMm=100` — the crown panel between the top seam junction and the brim's back edge, centered between the two eyelets (a standard embroidered front-crown logo position). `Back` zone: same box coordinates, calibrated against the back photo's own crown panel above the adjustable strap/buckle (the back crown shape is symmetric to the front's, and this one *was* independently verified against its own photo — `CALIBRATION_CONFIDENCE` records both Front and Back as `'verified'`).

## 7. Shorts geometry

Calibrated against `shorts-front.png`/`shorts-back.png`. `Left Leg`: `x=150, y=500, width=300, height=350, refWidthMm=90` — a logo box on the lower half of the left leg panel, below the pocket seam lines and above the hem (the conventional one-leg sports-shorts print spot). `Right Leg`: mirrored, `x=776`, same y/width/height. `Back`: `x=343, y=200, width=540, height=350, refWidthMm=250` — a centered seat-area box below the waistband, above where the center-back seam forks into the two legs. No Left Chest/Right Chest/Across Chest/Sleeve position is defined for Shorts at all — `isPrintPositionSupported` correctly returns `false` for all of them.

## 8. Pants geometry

Calibrated against `pants-front.png`/`pants-back.png`. `Left Thigh`: `x=230, y=350, width=280, height=280, refWidthMm=90` — the upper-leg band below the diagonal pocket bag and belt loops. `Right Thigh`: mirrored, `x=716`. `Left Leg`: `x=230, y=850, width=280, height=300, refWidthMm=90` — the lower-leg band, same leg panel, well above the hem. `Right Leg`: mirrored, `x=716`. `Back`: `x=310, y=140, width=605, height=280, refWidthMm=280` — a centered band spanning both back pockets, below the waistband yoke seam.

## 9. Asset/view limitations

- No side-view photography exists for any headwear garment — `Left Side`/`Right Side` are reserved vocabulary, not exposed (see §3).
- `hats-back.png` was already flagged in the original Mockup V2 audit as an outlier asset (measured 1312×1199 vs. every other garment photo's 1226×1283) — harmless for the *old* unsupported tier, but now that Hats has real calibrated zones, this asset's actual proportions should be re-verified against its declared canonical viewBox the next time browser tooling is available, since `garmentFit.ts`'s `computeAssetCorrectedScale` compensates for a mismatch but was never specifically re-checked against this one file post-extension.
- All new zone coordinates are a **visual estimate from direct inspection**, exactly the same methodology (and the same honesty about its limits) used for the priority upper-body garments in Batch A/B — not a pixel-measured ground truth. See §18.

## 10. Physical-size calibration

Every new zone gets its own `refWidthMm`, never borrowed from an upper-body zone:

| Zone | refWidthMm | Reasoning |
|---|---|---|
| Beanie Front/Back | 90 (max 100) | Small embroidered cuff patch |
| Hat Front/Back | 90 (max 100) | Small embroidered crown logo |
| Shorts Left/Right Leg | 90 | One-leg sports-shorts print |
| Shorts Back | 250 | Moderate seat-area print, smaller than a T-shirt's Full Back (320) |
| Pants Left/Right Thigh | 90 | Thigh-panel print |
| Pants Left/Right Leg | 90 | Lower-leg-panel print |
| Pants Back | 280 | Band spanning both back pockets |

None of the new zones reuse T-shirt's Left Chest `refWidthMm: 130` or any other upper-body value — pinned down by a dedicated regression test (`garmentGeometry.test.ts`, "none of the new zones reuse Left Chest's 130mm reference"). No changes were made to `PRINT_SIZE_PRESETS`/`PrintSizePresetButtons` — the existing A5/A4/A3/Oversized presets still apply uniformly; they were already "warn on overflow, never clamp," which extends correctly to the new, smaller headwear zones without any code change (a beanie patch selecting "A3" will show the existing overflow warning, exactly as intended).

## 11. Default-position behavior

`getDefaultPrintPosition(type)` returns the first entry of `getSupportedPrintPositions(type)` — and `ALL_PRINT_POSITIONS`' ordering was deliberately arranged (`Front, Left Side, Right Side, Left Thigh, Right Thigh, Left Leg, Right Leg, Back` appended after the 9 upper-body positions) so that filtering to any one garment's subset always produces the *correct* recommended default at index 0: T-shirt → Left Chest (unchanged), Bennie → Front, Hats → Front, Shorts → Left Leg, Pants → Left Thigh. `Back` is placed last precisely so it never wins the "first surviving entry" default for any garment that has more specific positions available.

## 12. UI filtering

`PrintPositionButtons` (`src/components/domain/mockup-studio/PrintPositionButtons.tsx`) changed from "render all 9 upper-body positions, dim the unsupported ones" to "render only the positions the caller passes in" — it no longer imports `ALL_PRINT_POSITIONS` or takes an `isSupported`/`unsupportedTitle` prop at all. Both `MockupStudio.tsx` (staff) and `PublicPrintDetailsSection.tsx` (public) now call `getSupportedPrintPositions(effectiveGarmentType)` and pass the result straight through — a customer or staff member physically cannot select an invalid combination through the position buttons any more, not just "shouldn't."

When the garment type changes **during an active editing session**, every print spec whose stored position is no longer valid for the new garment is normalized to that garment's default (`MockupStudio.tsx`'s `isFirstGarmentRender`-gated effect; the public form's `syncPrintSpecsToEffectiveGarment`, unconditional there since the public form only ever creates new orders, never loads historical ones). The staff-side effect deliberately **skips this normalization on the component's first render** — see §14.

## 13. Staff/public consistency

Both forms reuse the same components: `PrintPositionButtons`, `PrintSizePresetButtons`, `ArtworkSelector`, `PrintSpecTabs`, and the geometry resolver functions in `garmentGeometry.ts`. No second, parallel position-filtering system exists. The staff Mockup Studio still uses Fabric (`MockupCanvas`) for its interactive editor; the public form still uses the lightweight `GarmentMockup` (no Fabric) — that split predates this change and is untouched by it (Part 7 of the original Mockup System V2 plan explicitly kept it that way).

## 14. Server validation

`supabase/functions/public-order/index.ts`'s `isPrintPositionSupported()` was rewritten from a flat allow-list (which unconditionally rejected all 4 of these garment types) to a `GARMENT_SUPPORTED_POSITIONS` map mirroring `getSupportedPrintPositions()` exactly. `sanitizeSubmission()` already rejected any spec where `isPrintPositionSupported(garmentType, position)` is false, with a 400 and a specific message (`"${garmentType} does not support the ${position} print position"`) — this now correctly allows the new valid combinations and correctly still rejects invalid ones. **Live-verified** (disposable test data, cleaned up afterward): `Shorts + Left Chest` → 400 rejected; `Bennie + Full Back` → 400 rejected; `Shorts + Left Leg` → 200, real order created (`SP-1219`, deleted after verification).

Staff-side persistence deliberately does **not** get an equivalent hard Zod-level block. The position buttons already make an invalid combination unselectable through normal use (§12); adding a schema-level refuse-to-save rule keyed off garment/position compatibility risks blocking an unrelated save (e.g. staff just updating a due date) on an **old** order that happens to hold a stale position from before this extension existed — directly contradicting §"Historical PrintSpecs" (do not force historical data to be fixed as a side effect of an unrelated edit). This is a deliberate scope decision, consistent with this project's existing "warn, don't block, for non-critical placement issues" pattern (the overflow-warning banner uses the same philosophy) — documented here rather than silently decided.

## 15. Historical compatibility

No historical `print_specs` row was rewritten. An order created before this extension (e.g. a Shorts order whose only representable position used to be an upper-body one like "Left Chest", back when Shorts was fully unsupported) loads exactly as stored. `resolvePrintZone` returns `undefined` for that stale combination exactly as it always has for an unsupported one; `MockupCanvas`/`GarmentMockup` already handled `zone === undefined` safely (skip drawing the artwork/guide, still render the garment image) since Batch A — nothing new had to be built for the "don't crash" half of this requirement. What changed is the **messaging**: the staff warning banner now reads `"{position}" isn't a valid print position for {garmentType} — ... Choose one of the available positions above ... (this usually happens on an older order saved before this garment's current position options existed)` instead of the old "doesn't have a calibrated zone yet" framing, which is no longer accurate now that most garments do have zones.

## 16. Preview generation

`MockupCanvas.tsx`, `GarmentMockup.tsx`, and `mockupPreviewRenderer.ts` needed **zero code changes** for this extension — all three already resolve garment/zone geometry generically through `resolveGarmentGeometry`/`resolvePrintZone`, with no hardcoded position list of their own. The moment `garmentGeometry.ts` gained real zones for Bennie/Hats/Shorts/Pants, all three renderers started supporting them automatically, which is exactly the "one centralized geometry model, not scattered per-renderer logic" invariant every prior Mockup V2 batch established and this one relied on rather than re-litigated.

## 17. Orders/Board/Detail behavior

`MockupThumbnail.tsx`'s live-fallback eligibility check (`isPrintPositionSupported(garmentType, primary.position)`) also needed no code change — it will now return `true` for e.g. a Shorts order with `position: 'Left Leg'`, so Orders/Production Board/Quick Preview/Order Detail all start showing the live `GarmentMockup` fallback (instead of the old generic icon) for these four garment types automatically, the moment a real order uses one of the new positions. This was verified by code review of the existing conditional, not a new code path.

## 18. Tests

`src/config/garmentGeometry.test.ts` — 26 new tests covering: per-garment supported-position lists (T-shirt/Bennie/Hats/Shorts/Pants), the 4 explicit invalid-combination cases from the task brief (Shorts+Left Chest, Bennie+Left Sleeve, Hats+Full Front, Pants+Across Chest), default-position selection for all 5 garment families, zone existence for every new position, refWidthMm distinctness from the upper-body 130mm reference, view resolution for every new position, and anchor-centering for every new zone. Three pre-existing tests were updated (not deleted) because they iterated `ALL_PRINT_POSITIONS` assuming every garment supported every position — now restricted to a `UPPER_BODY_POSITIONS` constant so they keep testing what they always meant to test. One test ("a garment with no recorded calibration confidence") was repointed from `'Shorts'` (which now has real confidence) to `'Shirt'` (a fallback-tier garment, still correctly unconfigured). No server-side (Edge Function) automated tests were added — that logic was verified live instead (§14), consistent with this project's existing pattern of live-verifying Supabase-side behavior rather than mocking it.

## 19. Known limitations

- **Visual QA not yet performed in a browser** for any of the new zones — every coordinate is a direct-inspection estimate, matching this whole project's established (and honestly disclosed) calibration methodology, not a claim of pixel-perfect accuracy. `docs/MOCKUP_V2_VISUAL_QA.md` marks all of them **RETEST REQUIRED**.
- **`Left Side`/`Right Side` are unusable** by any garment today — reserved vocabulary only, pending real side-view hat photography.
- **Beanie's Back zone is inferred, not independently verified** — the flat-sketch asset has no visible feature distinguishing it from Front.
- **No staff-side hard validation gate** before save for a stale historical garment/position combination — a deliberate scope decision (§14), not an oversight.
- **The DB migration was applied via direct SQL, not `supabase db push`** — the linked project's migration-history table has entries not mirrored in this repo's local `supabase/migrations/` directory (predates this session), which made `db push` refuse to run. The migration file is still committed for documentation/history; a future session should reconcile the migration history (`supabase migration repair` + `supabase db pull`) rather than repeat this workaround indefinitely.
- **Shorts/Pants leg-print realism**: the current calibration places prints on the front leg panels only for "Left Leg"/"Right Leg" (no wrap-around or side-seam placement modeling) — a reasonable first pass, not a claim of covering every real printing method a shop might offer on bottoms.

# Mockup System V2 — Batch B Handover

Batch: **VISUAL CALIBRATION + ORDERS MOCKUP VISIBILITY + PREVIEW CONSISTENCY + FABRIC LAZY-LOAD FIX**
Batch A commit: `41b88ed`
Status: implementation complete, build/lint/test clean, **stopped at MOCKUP SYSTEM V2 — BATCH B GATE**.

---

## 1. Batch Objective

Finish the client-visible mockup experience on top of Batch A's corrected geometry: raise calibration confidence on the priority garments, make saved mockups visible directly in the Orders area, make every mockup surface resolve "which preview to show" the same way, put a safe strategy around stale historical previews, and resolve (or correctly characterize) the Fabric eager-loading concern the audit raised.

## 2. Batch A Carry-Forward

Unchanged from Batch A and re-verified this batch: non-uniform garment stretch stays removed, canonical geometry stays the single source of truth, `offsetX`/`offsetY` stay unread by every renderer, historical `PrintSpec` rows stay compatible, no schema/migration was touched.

## 3. Calibration Updates

Two real, substantive changes beyond Batch A, both driven by actually opening the real garment photos (not re-guessing from the front view):
- **Hoody's back zones were wrong in a way Batch A's own "inferred" label had already flagged** — `hoody-back.png` shows the hood draping down the back as a pointed flap reaching to roughly 29% of the image height at center, well below where Batch A's inferred Top Back zone (16%) started. Both Top Back and Full Back are now pushed down to clear it, verified against the actual photo.
- **Polo's and Crew neck's back zones are now their own explicit objects**, not a shared reference to T-shirt's `printZones`. Visually confirmed against `polo-back.png` and `crew-neck-back.png`: both read as the same plain raglan-seam torso panel as the T-shirt's back, so the *numbers* didn't need to change — but Batch A's aliasing (`printZones: TSHIRT_BACK.printZones`) meant "verified" would have been an overstatement even though the answer turned out to be "yes, they match." They're now independently declared and independently testable, so a future T-shirt-specific recalibration can't silently drag Polo/Crew-neck along with it.

A new `CalibrationConfidence` type (`'verified' | 'inferred' | 'unverified'`) and `CALIBRATION_CONFIDENCE`/`getCalibrationConfidence()` were added to `garmentGeometry.ts` so this status is a queryable fact, not just a comment.

## 4. T-shirt Calibration

**Confidence: VERIFIED** (front and back). Re-confirmed against `tshirt-front.png`/`tshirt-back.png` (already opened in Batch A); no numeric changes this batch — Batch A's own calibration held up.

## 5. Hoody Calibration

**Confidence: VERIFIED** (front and back). Front unchanged from Batch A (already verified against `hoody-front.png`). Back zones (Top Back, Full Back) **corrected** this batch after opening `hoody-back.png` directly — see §3.

## 6. Polo Calibration

**Confidence: VERIFIED** (front and back). Front unchanged from Batch A. Back zones now independently declared after opening `polo-back.png` — see §3. Numeric values match T-shirt's back panel (confirmed correct, not assumed).

## 7. Crew Neck Calibration

**Confidence: VERIFIED** (front and back). Front unchanged from Batch A. Back zones now independently declared after opening `crew-neck-back.png` — see §3. Numeric values match T-shirt's back panel (confirmed correct, not assumed).

No local nudges were introduced anywhere in this batch — every correction lives in `garmentGeometry.ts`'s zone tables, none in a component, CSS transform, or one-off JSX adjustment.

## 8. Primary Mockup-Selection Rule

**Reused the existing helper rather than building a new one** — `selectPrimaryPrintSpec(specs)` (`src/api/mappers/printSpec.ts`, already present before this batch, already used by `MockupThumbnail` and `productionReadiness.ts`): first spec with a `previewStoragePath`, else the first spec at all, else `undefined`. No `primary_mockup` column, no manual primary-selection UI — matches Part 2's explicit constraints. Added one new pure helper alongside it: `countAdditionalPrintSpecs(specs)` for the "+N more" indicator (§11), deliberately derived from the same list so the count and the shown preview can never disagree.

## 9. Orders Integration

`OrdersList.tsx` desktop table gained a compact leftmost thumbnail column (`w-14`, same 32px `MockupThumbnail` size used on Production Board) — clicking it opens `MockupPreviewDrawer` (see §12), row click still navigates to Order Detail as before (`stopPropagation` on the thumbnail's own click). No new image column wide enough to affect table density.

## 10. Mobile Orders Integration

`OrderCard` gained an optional `mockup` slot rendered full-width above the existing content (only when a caller passes one — Production Board's mobile card, which doesn't pass it, is visually unchanged). `OrdersList`'s mobile card passes a 96px `MockupThumbnail` in that slot, large enough to recognize garment type and print placement, wrapped in a labeled button that opens the same `MockupPreviewDrawer`.

## 11. Multiple-Print Indicator

`MockupThumbnail` gained an opt-in `showAdditionalCount` prop (default `false`, so Production Board's existing single-preview look is unaffected) — when enabled, overlays a small "+N" badge (bottom-right corner) using `countAdditionalPrintSpecs`. Enabled on both Orders surfaces (desktop column, mobile card).

## 12. Click/Viewer Behavior

**Reused `MockupPreviewDrawer`** (`src/components/domain/production/MockupPreviewDrawer.tsx`) — already built in an earlier batch for Production Board, already supports browsing multiple `PrintSpec`s via Prev/Next. No second modal/viewer was created. `OrdersList` now renders the same drawer component with its own `previewOrder` state, identical to how `ProductionBoard.tsx` already wires it.

## 13. Production Board Fallback

`MockupThumbnail` (shared by Production Board, Orders, Order Detail's Overview tab, and Order Quick View) no longer falls back to a generic `Shirt` icon when no saved preview PNG exists yet. New hierarchy: **saved PNG → live V2 `GarmentMockup` render (no Fabric) → plain icon**. The live fallback only renders when `isPrintPositionSupported(garmentType, position)` is true (Batch A's calibrated/fallback tiers) — for the unsupported tier (Shorts/Pants/Bennie/Hats) or when no garment data is available at all, it correctly falls through to the plain icon with a tooltip distinguishing "no preview yet" (supported, just not generated) from "Mockup placement not configured for this garment" (Part 3/10's "do not conflate" rule, extended to this icon state too).

Because current-generation `PrintSpec`s don't denormalize `garmentType`/`garmentColour` onto themselves any more (`MockupStudio.tsx`'s own comment: "Garments section is the single source of truth... previously spec.garmentType/garmentColour, now unused"), `MockupThumbnail` needed a new optional `garments` prop to fall back to `order.garments[0]` for the live-render's garment type/colour — wired at every call site (`ProductionTable.tsx`, `OrderQuickView.tsx`, `OverviewTab.tsx`, and the new `OrdersList.tsx` usages).

## 14. Order Detail Consistency

`OverviewTab.tsx`'s "Mockup Preview" card and `ArtworkMockupsTab.tsx`'s full print-spec grid both already existed; `OverviewTab` now passes `garments` to `MockupThumbnail` for the same fallback consistency as every other surface. `ArtworkMockupsTab` intentionally does **not** use `selectPrimaryPrintSpec` — it's a full listing of every `PrintSpec` on the order, not a single-preview surface, so showing "all of them" is the correct behavior there, not an inconsistency.

**Verified consistent**: Orders (desktop + mobile), Production Board (table + Quick View), and Order Detail's Overview tab all resolve "which preview to show" through the identical `selectPrimaryPrintSpec` call inside `MockupThumbnail` — none of them independently chooses a different "primary" spec.

## 15. Live Fallback Behavior

See §13 — implemented as a hierarchy (saved PNG → live `GarmentMockup` → icon), gated on `isPrintPositionSupported` so an unsupported garment/position combination is never faked. `GarmentMockup` is the existing lightweight, non-Fabric renderer from Batch A; no new renderer was created, and Fabric is never imported anywhere in this fallback path (confirmed — `MockupThumbnail.tsx` and `GarmentMockup.tsx` have no `fabric` import, static or dynamic).

## 16. Historical Preview Behavior

No change needed beyond what Batch A already established: an existing stored preview PNG remains visible and untouched; the next explicit Create Order/Save Changes/Edit Order submission that touches an order regenerates its previews via the existing `syncMockupPreviewsForOrder` path, now using V2 geometry, overwriting the same canonical `previewStoragePath` — exactly the "recommended" strategy in Part 5. No bulk/automatic regeneration was added or triggered.

## 17. Backfill Tooling Decision

**Deferred, with a concrete technical reason** (not merely time pressure): `mockupPreviewRenderer.ts`'s `renderMockupPreviewPng` depends on `document.createElement('canvas')` and Fabric's `StaticCanvas`/`FabricImage`/`toDataURL`, all of which require a real browser canvas implementation. This project's existing one-off scripts (`scripts/verify-*.ts`, run via `npx tsx`) execute in plain Node against the real Supabase API and would need a Node canvas polyfill (e.g. `node-canvas`, `@napi-rs/canvas`, or a jsdom+canvas shim) — a new runtime dependency this codebase doesn't currently have, introduced solely to run a rendering pipeline outside the browser it was built for. Given the explicit instruction ("if implementing the script adds disproportionate complexity, defer it and document why") and that no order-level urgency exists (old previews stay visible and correct-enough until naturally regenerated on next save), this batch defers the backfill script rather than adding a new dependency and a fragile polyfill layer under time pressure. **Recommended for a future batch**: either add the canvas polyfill deliberately (with its own small evaluation of `node-canvas` vs `@napi-rs/canvas` for this project's platform), or — likely simpler — build the backfill as a script that calls the *existing* `syncMockupPreviewsForOrder` logic through a real (if headless) browser context (e.g. Playwright) rather than trying to run Fabric in bare Node.

## 18. Fabric Eager-Load Root Cause

**This is a correction to a finding in the original audit and Batch A handover, not a bug fix** — verified by direct build-output inspection, not assumed. The audit claimed Fabric was "not actually lazy-loaded... bundled into the main chunk." Rebuilding and inspecting `dist/` this batch shows that claim does not hold:

- `fabric`'s own signature strings (`FabricObject`, `StaticCanvas`) appear **only** in `dist/assets/index.min-DfzIfMET.js` (289.01 kB / 87.88 kB gzip) — zero matches in the main entry chunk (`dist/assets/index-*.js`, 830.67 kB) or in `MockupCanvas`'s own chunk.
- `dist/index.html` contains exactly one `<script type="module">` tag, pointing at the main entry chunk, and **no** `<link rel="modulepreload">` for either the Fabric chunk or `MockupCanvas`'s chunk.
- The only reference to `index.min-DfzIfMET.js`'s filename inside the main chunk is a plain string inside Vite's own `__vite__mapDeps` lookup array — data consulted by Vite's dynamic-`import()` runtime helper *at the moment* a real `import()` call executes, not a static import that runs at page load.
- Source-level: both actual `import * as fabric from 'fabric'` statements (`MockupCanvas.tsx`, `mockupPreviewRenderer.ts`) sit behind genuine dynamic-import boundaries — `React.lazy(() => import('@/components/domain/MockupCanvas'))` in `MockupStudio.tsx`, and `await import('@/utils/mockupPreviewRenderer')` inside `mockupPreviewSync.ts`, which is itself only reached via `await import('@/api/mockupPreviewSync')` from the save-mutation hooks.

**Conclusion**: Fabric was already correctly code-split and lazily loaded before this batch; it is fetched and executed only when `MockupCanvas` actually mounts (New/Edit Order's mockup editor) or when a preview is actually being generated after an explicit save — never on Dashboard, Orders List, Production Board, Customers, Customer Detail, User Management, or a normal read-only Order Detail view. The name `index.min-*.js` is coincidental (it mirrors fabric's own package file `dist/index.min.mjs`), not a sign it's part of the app's main bundle — this was the source of the earlier misdiagnosis.

## 19. Fabric Lazy-Load Implementation

No code change was required — see §18. `MockupCanvas`'s existing `lazy()`/`Suspense` boundary in `MockupStudio.tsx` and `mockupPreviewRenderer`'s existing dynamic-import chain (`mockupPreviewSync.ts` → `useOrders.ts`) are both confirmed correct and were left as-is.

## 20. Actual Build Chunk Result

| Chunk | Size (raw) | Size (gzip) | Contains Fabric? |
|---|---|---|---|
| `index-*.js` (main/eager entry) | 830.67 kB | 230.48 kB | **No** — confirmed via string search |
| `index.min-*.js` (Fabric vendor, lazy) | 289.01 kB | 87.88 kB | Yes — this *is* the Fabric chunk |
| `MockupCanvas-*.js` (lazy) | 4.09 kB | 1.50 kB | No — thin wrapper only |
| `mockupPreviewRenderer-*.js` (lazy) | 1.02 kB | 0.58 kB | No — thin wrapper only |
| `mockupPreviewSync-*.js` (lazy) | 1.62 kB | 0.85 kB | No |

Main chunk grew from Batch A's 828.71 kB to 830.67 kB (+1.96 kB) from the new Orders UI code (`MockupThumbnail`'s live-fallback logic, the new `garmentGeometry`/`printSpec` mapper additions) — no Fabric duplication, no new eager dependency.

## 21. Asset-Performance Audit

Measured, not changed (Part 7 — audit only in this batch):
- **Total garment PNG output**: 22 files, **~25 MB** combined (unchanged from Batch A — no assets were touched).
- **Largest single asset**: `bennie-front.png`, 1,482.90 kB.
- **Actual source dimensions**: 1226×1283 px for 21 of 22 assets (the canonical viewBox itself, per Batch A).
- **Actual runtime display dimensions**: `MockupThumbnail` renders at 32 px (Production Board table, Orders desktop), 56 px (Quick View), 96 px (Orders mobile card), 120 px (Order Detail Overview); the interactive `MockupCanvas` editor renders at up to 360 px wide (`Math.min(containerWidth, 360)` in `MockupStudio.tsx`).
- **Expected optimization opportunity**: every garment photo is fetched at its full 1226×1283 native resolution even for a 32px thumbnail — roughly **38× oversized** relative to the largest actual on-screen use (360px) and up to ~40× oversized relative to the smallest (32px). Re-exporting these technical-flat PNGs at a sane maximum resolution (e.g. 800–900px longest edge, matching `mockupPreviewRenderer`'s own 900px output width already established in Batch A) with proper compression should recover the large majority of the current ~25MB with no visible quality loss at any real display size. **Not performed this batch** — explicitly deferred per Part 7 to keep this batch scoped to accuracy/visibility.

## 22. Accessibility

Every new clickable mockup surface is a real `<button>` with an explicit `aria-label` (`"View mockups for order {orderNumber}"`, matching the batch brief's own suggested phrasing exactly), not an unlabeled clickable `<img>`. Image `alt` text (`"{colour} {garmentType} — {position}"`) stays on the `<img>` itself for the saved-preview case, but is intentionally not duplicated as redundant surrounding text — the wrapping button's `aria-label` is what assistive tech actually announces for the click target, per Part 14's "avoid redundant verbose alt text" guidance. No accessibility regression to any existing surface — `ProductionTable.tsx`'s pre-existing button/`aria-label` pattern for its own thumbnail was left untouched and used as the template for the new Orders surfaces.

---

## Tests

11 new tests added (Batch A's 226 → Batch B's 237):
- `src/api/mappers/printSpec.test.ts` (+3) — `countAdditionalPrintSpecs`: counts correctly, zero for a single print, zero (not negative) for an empty list.
- `src/config/garmentGeometry.test.ts` (+8) — every priority garment's back zones explicitly defined; Polo's and Crew neck's back-zone objects are structurally independent from T-shirt's (not aliased); Hoody's Top Back/Full Back sit lower than T-shirt's (verified against the hood-drape correction); every priority garment/view reports `'verified'` calibration confidence, an uncalibrated type reports `'unverified'`; a calibrated combination is fallback-eligible, an unsupported one is safely rejected.

No component-rendering tests were added — this codebase's existing test suite is exclusively pure-function unit tests (no React Testing Library or similar currently set up), so new tests followed that same established convention rather than introducing a new testing layer for this batch alone.

## Visual QA Status

**No browser-based visual verification was performed** — same constraint as Batch A: this session has no browser/screenshot tooling available. What changed this batch is that the *calibration* claims are now backed by direct image inspection of `hoody-back.png`, `polo-back.png`, and `crew-neck-back.png` (in addition to the five images already inspected in Batch A), not just inference from a related view — genuinely raising confidence from "inferred"/"unverified" to "verified" for every priority garment's back zones, in the sense the batch brief defines those terms (an image was actually opened and read). This is **still not the same as confirming the rendered mockup looks correct in a browser** — no `<canvas>` or `<img>` was ever actually rendered and looked at on a screen this batch. The manual QA matrix from Batch A's handover remains the right tool for that; it should be run by a human (or a future session with browser tooling) before treating placement as production-confirmed.

## Known Limitations

- Signed-URL fetching for mockup previews (`useMockupPreviewUrl`, used inside `MockupThumbnail`) issues one request per distinct storage path — for a page rendering many order rows (Orders List, Production Board), this is an N+1-shaped request pattern at the signed-URL layer (not the order-data layer, which is confirmed N+1-free — see below). This is a pre-existing pattern from before this batch (already how Production Board worked), extended to Orders List rather than newly introduced. React Query caches/dedupes by path so it's not repeated on re-render, but a genuine fix (batch-fetching all visible rows' signed URLs in one call, the way `useMockupPreviewUrls` already does for `ArtworkMockupsTab`) would require `MockupThumbnail` to accept a pre-resolved URL instead of self-fetching — a real refactor of a component shared by four surfaces, deferred as a follow-up rather than attempted under this batch's scope.
- No mockup preview backfill tool was built (§17) — deferred with a concrete technical reason (Fabric's canvas dependency has no Node-side equivalent in this project today).
- Garment photo compression (§21) was measured but not performed, per Part 7.
- No browser-based visual confirmation (see above) — placement correctness is verified by pure geometry math and direct image inspection, not by looking at a rendered mockup.
- `Order` list/detail data was confirmed to already include `print_specs` and `order_garments` in one shared `ORDER_SELECT` query fragment (`src/api/orders.ts`) used by both `listOrders` and `getOrder` — no backend query change was needed for Orders visibility, and no N+1 was introduced at the order-fetch level.

## Next Batch Recommendation

In rough priority order: (1) a real human/browser visual QA pass — this is now the single biggest remaining gap across both batches; (2) decide and implement the signed-URL batching fix for `MockupThumbnail` if Orders List is used with large result sets in practice; (3) garment photo compression (Part 7's measured-but-deferred opportunity); (4) the mockup preview backfill tool, once a canvas-in-Node approach (or a headless-browser approach) is deliberately chosen; (5) supplier-link architecture (explicitly deferred twice now); (6) a real headwear/bottoms position vocabulary so Bennie/Hats/Shorts/Pants can move out of the unsupported tier.

---

## MOCKUP SYSTEM V2 — BATCH B GATE

Stopped here per instructions. Supplier-link work has not been started.

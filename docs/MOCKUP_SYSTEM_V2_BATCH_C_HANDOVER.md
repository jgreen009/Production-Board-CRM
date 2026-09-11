# Mockup System V2 — Batch C Handover

Batch: **SUPPLIER LINKS + GARMENT ASSET OPTIMIZATION + FINAL VISUAL HARDENING**
Batch A commit: `41b88ed` · Batch B commit: `6af9153`
Status: implementation complete, build/lint/test clean, migration applied and verified live, **stopped at MOCKUP SYSTEM V2 — BATCH C GATE**.

---

## 1. Batch Objective

Three independent objectives on top of Batches A/B's corrected geometry and Orders visibility: add a minimal, optional supplier-product link to the garment catalog; shrink the ~25MB garment asset payload without disturbing canonical geometry; and harden visual presentation (cropping/stretching/aspect-ratio bugs) across every surface that now shows a V2 mockup.

## 2. Supplier Catalog Audit

Full findings in the audit (delegated to a research pass before implementation — see below); the load-bearing facts:
- `garment_types` and `garment_brands` are real Supabase tables (`id, name, active, sort_order, created_at, updated_at`), not just TypeScript string unions — both already exist, both are RLS-protected (staff read, admin/owner write).
- `order_garments.garment_type_id`/`garment_brand_id` FK columns exist but are **dead** — every order-save path only ever writes the denormalized `garment_type_label`/`garment_brand_label` text columns, never the FK columns. Historical orders display whatever label string was captured at save time, immune to later catalog edits/renames/deactivation.
- `garment_types` already has a full Settings CRUD page (`SettingsGarments.tsx`) — name + active toggle. `garment_brands` has the API/hooks but **no Settings page at all**.
- No existing product-code, notes, or URL-style field on either catalog table.
- Garment colour has no catalog table at all — it's a free-text input.

## 3. Final Supplier Schema

Three new **nullable, additive** columns on `garment_types` (not `garment_brands`, and not a new join table — see reasoning below):

```sql
alter table garment_types
  add column supplier_name text,
  add column supplier_product_code text,
  add column supplier_url text;
```

No `supplier_product_name` column — `garment_types.name` already serves as the display name (e.g. "T-shirt"), satisfying the batch brief's own rule ("only add a product-name field if the entity doesn't already have one").

**Known simplification, stated plainly**: a real print shop's supplier product is technically a (brand × type) pairing — "AS Colour's T-shirt" and "Gildan's T-shirt" are different products with different codes/links — and this schema can only record one supplier reference per garment *type*, not per type-and-brand combination. Building the fully-correct model would mean either populating the currently-dead `order_garments` FK columns (a save-path change touching `upsert_order`, explicitly higher-risk) or a new join table (a new domain entity the batch brief's minimalism explicitly discourages, and the audit found no existing management UI for brands to hang it off anyway). Given the batch's explicit "minimal model," "use the actual current catalog table," and "don't guess table names" instructions, `garment_types` — the one catalog entity with full Settings CRUD already — was the pragmatic choice. Flagged here rather than glossed over.

## 4. Settings Integration

`SettingsGarments.tsx` rebuilt as a mobile-first card list (was a desktop-only table) — each garment type is a `Card` with its name + active toggle in the header and three inline text inputs below (Supplier, Product Code, Supplier URL) that commit on blur, only if the value actually changed. No new "Save" step or dirty-state UI — matches the existing active-toggle's "every interaction is already a save" feel. A lightweight client-side URL-format hint shows immediately on blur; the authoritative validation still happens server-side in `updateGarmentType` (§7) regardless of what the client-side hint says.

## 5. Order-Form Supplier UX

`GarmentCard.tsx` (New/Edit Order's garment selector) already has the full `garmentTypes` catalog list in scope (it's the source of the type dropdown's options) — no new query was needed. When the selected type's catalog row has a `supplierUrl`, a compact "View Supplier Garment ↗" link renders directly under the Garment Type field, visually secondary (small text, brand-accent color, no background/border competing with the dropdown itself).

## 6. Order Detail Supplier UX

`GarmentsTab.tsx` now calls `useGarmentTypesSettings()` and matches each order garment line's `type` string against the live catalog by name. When a match has any supplier field set, a line appears under the garment's size breakdown: supplier name, product code, and the same `SupplierLink` component, in that order — matching the batch brief's own example format ("AS Colour / Staple Tee 5001 / View Supplier Garment ↗"). Nothing renders when no supplier metadata exists (no empty "Supplier: —" line). Customer Detail was deliberately left untouched — no clear operational reason to surface a supplier link there, per the batch brief's own guidance.

Because this is a **live catalog lookup by name**, not data snapshotted onto the order, a renamed or deleted garment type on an old order simply shows no supplier line — the garment's own label/colour/size data (already snapshotted) is completely unaffected either way.

## 7. Supplier URL Security

One shared validator (`src/utils/url.ts`), used at both write time and render time so the two can never disagree:
- `isSafeHttpUrl(value)`: parses with the real `URL` constructor (not a regex — a regex scheme check is trivially bypassed by a malformed-but-still-dangerous string) and only accepts `http:`/`https:`.
- `normalizeSupplierUrl(value)`: trims and returns the URL, or `null` for anything empty or unsafe.
- **Write time**: `api/settings.ts`'s `buildGarmentTypeUpdatePatch` calls `normalizeSupplierUrl` — an unsafe value (`javascript:`, `data:`, `file:`, a malformed string) is silently stored as `null` rather than blocking the save of the rest of the garment type (supplier data is optional enhancement, never required).
- **Render time**: a shared `SupplierLink` component (`src/components/domain/SupplierLink.tsx`) re-validates with `isSafeHttpUrl` before ever rendering an `<a>` — defense in depth against the stored value having somehow changed through a different path. Renders `target="_blank" rel="noopener noreferrer"`, plain text content (no `dangerouslySetInnerHTML`, nothing that could render arbitrary HTML). Used identically by both `GarmentCard.tsx` and `GarmentsTab.tsx` so link-safety can't drift between the two consumers.

## 8. Asset Optimization Approach

`scripts/optimize-mockup-assets.mjs` (new, one-time — not a project dependency, uses `sharp` installed ad hoc with `npm install --no-save sharp` and not committed to `package.json`) converts each `src/assets/mockups/*.png` to `*.webp`:
- Resized to a 900px long-edge (matching `mockupPreviewRenderer`'s own `PREVIEW_OUTPUT_WIDTH` from Batch B — the preview-export path never needs to upscale past this), `withoutEnlargement` so nothing already smaller gets blown up.
- `quality: 90` lossy WebP — visually confirmed (direct image inspection of the converted `tshirt-front.webp`) indistinguishable from the original at this resolution; these are flat black-line-on-white technical sketches, not photos, so WebP compresses them extremely well.
- Aspect ratio preserved exactly (single-dimension resize target, never independent width/height — same "no independent scaleX/scaleY" discipline the geometry renderers themselves follow).
- `garmentTemplates.ts`'s imports switched from `.png` to `.webp`. The original PNGs remain in the repo (`src/assets/mockups/*.png`) as source/history but are no longer imported anywhere — confirmed via build output that zero `.png` files are emitted into `dist/` any more (Vite only bundles what's actually imported).

## 9. Before/After Asset Sizes

Measured from actual `dist/assets/` output (Part 14 — emitted production bytes, not source-directory size):

| | Before (PNG) | After (WebP) |
|---|---|---|
| Total (22 files) | ~25.0 MB (24.10 MB measured from source) | **1.00 MB** (1004 KB / 22 files measured from `dist/`) |
| Largest single asset | `bennie-front.png`, 1,482.90 KB | `bennie-front.webp`, 118.74 KB |
| Emitted PNG count in `dist/` | 22 | **0** |

**Reduction: ~24.1 MB absolute, 96.1%.**

## 10. Geometry Safety (critical finding — this is the load-bearing section)

Swapping the asset resolution from 1226×1283 to ~900px long-edge **would have silently broken every garment's rendered size** if left unaddressed — this was caught and fixed, not merely avoided. Root cause: `MockupCanvas.tsx` and `mockupPreviewRenderer.ts` both compute a `fit.scale` from `fitGarmentIntoViewport(viewGeometry.viewBox.width, viewGeometry.viewBox.height, ...)` — i.e. against the **declared canonical viewBox** (1226×1283, unchanged), which is correct and exactly what Batch A intended. But Fabric.js's `scaleX`/`scaleY` scale an image relative to **its own real loaded pixel dimensions**, not the declared viewBox. Before this batch the two happened to be identical (every asset really was 1226×1283), so this gap was invisible. After the asset swap, applying `scaleX: fit.scale` directly to an 860×900-pixel image would have rendered every garment at roughly 70% of its intended size (`860/1226 ≈ 0.70`) — a real, silent placement-and-scale regression the batch brief explicitly warned about ("the geometry model must NOT suddenly use those new pixel dimensions as canonical coordinates").

**Fix**: a new shared pure helper, `computeAssetCorrectedScale(fit, viewBoxWidth, viewBoxHeight, naturalWidth, naturalHeight)` in `garmentFit.ts`, multiplies in a correction factor (`viewBoxWidth / naturalWidth`, `viewBoxHeight / naturalHeight`) that is exactly `1` (a no-op) whenever an asset's real size matches its declared viewBox, and correctly compensates whenever it doesn't. Applied identically in both `MockupCanvas.tsx` (via a new shared `fitGarmentBackground` helper, used on both initial load and every canvas resize — those two code paths previously computed fit two different ways, a latent inconsistency also fixed here) and `mockupPreviewRenderer.ts`. Six new unit tests in `garmentFit.test.ts` pin this down, including one that explicitly asserts the pre- and post-optimization on-screen rendered width match exactly. `GarmentMockup.tsx` (the plain-CSS, non-Fabric renderer) was never vulnerable to this — it only sets a CSS `width`, letting the browser derive height from the image's own intrinsic ratio automatically, regardless of native pixel count.

Canonical geometry data itself (`garmentGeometry.ts`'s zone coordinates, `CANONICAL_VIEWPORT`) was **not touched** — confirmed by a new regression test asserting `CANONICAL_VIEWPORT` still equals `{width:1226, height:1283}` and every priority garment's `viewBox` still resolves to that same value, regardless of what resolution the actual imported asset file happens to be.

## 11. Visual Asset Resolver

No change to the resolver's shape — `garmentTemplates.ts`'s `getGarmentImage`/`garmentTemplateToDataUrl` remain the one place any renderer obtains a garment visual asset reference (Part 6's "one visual asset mapping source" requirement was already satisfied by Batch A's architecture; this batch only changed what the imports at the top of that file point to). New tests assert each priority garment's resolved asset path ends in `.webp`, so an accidental future revert to a `.png` import fails a test immediately rather than only showing up as a bundle-size regression.

## 12. Thumbnail Hardening

Two real presentation bugs found and fixed in `MockupThumbnail.tsx` (shared by Orders, Production Board, Order Detail's Overview tab, and Order Quick View):
- The saved-preview `<img>` used `object-cover` inside a forced-square box — since the actual preview PNG's aspect ratio (~0.956, from the canonical viewBox) isn't exactly square, this cropped a sliver off the top/bottom of every saved preview, hiding a small amount of garment anatomy.
- The live `GarmentMockup` fallback rendered at its own natural (non-square) aspect ratio inside that same forced-square, `overflow-hidden` box — for the same reason, it would overflow and get clipped by the same small margin.

**Fix**: the box's height is now computed from the same `CANONICAL_VIEWPORT` ratio (`size / (1226/1283)`) instead of being forced square, so real garment content never needs to crop or stretch — only the two purely-iconographic states (no artwork yet, no fallback possible) stay a plain square, since there's no garment image there to have an aspect-ratio opinion about. Saved-preview `<img>` switched from `object-cover` to `object-contain` as a second, belt-and-suspenders layer. `MockupPreviewDrawer.tsx` and `ArtworkMockupsTab.tsx` were already using `object-contain` inside a fixed `aspect-[4/5]` box — audited, found correct, left unchanged (some letterboxing there since 4:5=0.8 doesn't exactly match 0.956, but letterboxing never hides anatomy the way cropping does, so this was judged acceptable rather than worth touching).

## 13. Signed URL Findings

Measured/reasoned, not changed at the architecture level (Part 11 — "do not redesign it unless performance evidence shows it is causing a real problem"): `MockupThumbnail` calls `useMockupPreviewUrl(path)` once per component instance, so a page rendering N order rows with N distinct saved-preview paths issues **N separate signed-URL requests** on initial mount. React Query dedupes by exact query key (`['mockup-preview-url', path]`), so a re-render never repeats an in-flight or already-cached request — this is not N-requests-per-render, just N-requests-per-distinct-path. A genuine batching fix (parent page calls `useMockupPreviewUrls` once and passes resolved URLs down, the way `ArtworkMockupsTab` already does) would require `MockupThumbnail` to stop self-fetching — a real refactor of a component shared by four surfaces, correctly out of scope for "no premature complex optimization introduced."

**One low-risk fix was implemented**: neither `useMockupPreviewUrl` nor `useMockupPreviewUrls` had a `staleTime` set, so React Query's default (`0`) meant a cached signed URL was considered stale immediately — every component remount or browser window refocus re-requested a brand-new signed URL even though `mockupPreviews.ts` signs them for a full hour (`SIGNED_URL_EXPIRY_SECONDS = 3600`). Added `staleTime: 55 * 60 * 1000` (55 minutes, safely under the real expiry) to both hooks — a genuinely low-risk, one-line change that reduces redundant re-signing without any risk of ever serving an expired URL.

## 14. Visual QA Checklist

`docs/MOCKUP_V2_VISUAL_QA.md` (new) — a concise, human-executable PASS/ADJUST/FAIL matrix covering every priority-garment position from the batch brief, plus a cross-surface consistency check (Mockup Studio, Orders, Production Board, Order Detail ×2, Preview Drawer, downloaded PNG) and the expected "safe unsupported state" for Shorts/Pants/Bennie/Hats. Explicitly **not yet run** — stated in the document itself, not just here.

## 15. Tests

29 new tests (Batch B's 237 → Batch C's 269):
- `src/utils/url.test.ts` (+10, new file) — safe/unsafe URL detection (https, http, javascript:, data:, file:, malformed, empty), normalize-to-null behavior.
- `src/api/settings.test.ts` (+9, new file) — DB→domain mapping for supplier fields (populated and null), domain→save-payload mapping (per-field snake_case mapping, omitted fields never nulled, empty-string→null normalization, unsafe URL→null without blocking the rest of the patch, valid http/https accepted, malformed rejected).
- `src/utils/garmentFit.test.ts` (+6) — `computeAssetCorrectedScale`: no-op when natural size matches viewBox, on-screen size identical before/after a resolution change, aspect ratio preserved, pure/deterministic, safe against a zero-size input.
- `src/config/garmentGeometry.test.ts` (+2) — `CANONICAL_VIEWPORT` unchanged, every priority garment's `viewBox` still resolves to it regardless of asset resolution.
- `src/config/garmentTemplates.test.ts` (+5) — each priority garment's front/back asset resolves to a `.webp` path; Customized's vector-markup fallback still works.

No new tests were needed for "primary mockup selected correctly" / "additional-print count unchanged" (Part 13 #17/18) — Batch B's existing `printSpec.test.ts` coverage of `selectPrimaryPrintSpec`/`countAdditionalPrintSpecs` was not touched by this batch and still passes unchanged, which is itself the confirmation those behaviors are unaffected.

## 16. Bundle Result

| Chunk | Batch B baseline | Batch C | Change |
|---|---|---|---|
| Main entry (`index-*.js`) | 830.67 kB | 834.04 kB | +3.37 kB (supplier UI + new pure-function code) |
| Fabric vendor (`index.min-*.js`) | 289.01 kB | 289.01 kB | **unchanged** |
| `MockupCanvas-*.js` | 4.09 kB | 4.14 kB | +0.05 kB |
| `mockupPreviewRenderer-*.js` | 1.02 kB | 1.10 kB | +0.08 kB |
| Garment assets (`dist/assets/*.webp`, was `*.png`) | ~25 MB | **1.00 MB** | **-24 MB (-96.1%)** |

Fabric confirmed still isolated in its own separately-chunked, lazily-loaded file (re-verified via the same string-search method as Batch B: zero `FabricObject`/`StaticCanvas` matches in the main chunk).

## 17. Migration/Advisor Result

Migration `20260911000000_phase6_garment_types_supplier_link.sql` applied live via `mcp__supabase__apply_migration` and verified:
- `information_schema.columns` confirms all three new columns exist on `garment_types`, all nullable.
- All 12 existing `garment_types` rows read back unaffected, all three new columns `null` (no backfill, matching "no destructive backfill, no rewrite of existing rows").
- `mcp__supabase__get_advisors` (security and performance) run after the migration — **zero new findings attributable to this change**. Every existing finding (three pre-existing `SECURITY DEFINER` functions, leaked-password-protection being off, a couple of unindexed FKs on `admin_activity`, several unused indexes elsewhere) was already present before this migration and is unrelated to `garment_types`/supplier columns. RLS was not touched — the existing `garment_types` policies (staff select, admin/owner insert/update) already cover the three new columns with no policy change needed.

## 18. Visual QA Status

**No browser-based visual verification was performed** — same constraint as every prior batch: no browser/screenshot tooling has been available to any session working on this project. What this batch *did* verify directly: the webp-converted `tshirt-front.webp` was opened and visually inspected (not just measured) and is indistinguishable from the pre-optimization PNG at normal viewing size; the geometry-safety fix (§10) was verified by pure math/unit test, not by looking at a rendered mockup. `docs/MOCKUP_V2_VISUAL_QA.md` remains unexecuted and should be the first thing run by a human (or a future session with browser tooling) before treating any of this as visually production-confirmed.

## 19. Known Limitations

- Supplier metadata models one link per garment *type*, not per (type × brand) combination — a real simplification for shops carrying multiple brands of the same garment type with different supplier links (§3).
- Signed-URL fetching is still one-request-per-distinct-path on list pages (Orders, Production Board) — improved (stale-time fix, §13) but not architecturally batched.
- `MockupPreviewDrawer`/`ArtworkMockupsTab`'s fixed `aspect-[4/5]` preview boxes letterbox slightly (their ratio doesn't exactly match the garment photos' own ~0.956) — judged acceptable (letterboxing never hides anatomy) and left as a minor, non-blocking cosmetic gap.
- The optimize-assets script requires manually installing `sharp` ad hoc (`npm install --no-save sharp`) to re-run — deliberate, per the batch's own "don't add a heavy runtime image-processing library" instruction, but means re-optimizing after a future source-photo change is a manual, documented step rather than an automatic build step.
- No browser-based visual QA has been performed at any point across Batches A/B/C (§18) — this is the single largest remaining gap in the whole Mockup System V2 effort.

## 20. Final Mockup V2 Readiness

Architecturally complete and internally consistent: canonical geometry, garment-specific zones for all four priority garments, deterministic anchor-based placement, one shared render pipeline across the interactive editor/read-only fallback/static preview export, Orders-area visibility, a real (if minimal) supplier link, and a ~96% smaller asset payload — all verified by 269 passing unit tests and a clean build/lint. The one thing standing between this and calling it *visually* production-ready is the unexecuted `docs/MOCKUP_V2_VISUAL_QA.md` checklist — every placement number is a careful, documented, best-effort reading of the real garment photos, but none has ever been confirmed correct by a human looking at a rendered screen.

## 21. Recommended Next Action

Run `docs/MOCKUP_V2_VISUAL_QA.md` in a real browser before anything else — it's the fastest way to convert this batch's "verified by inspection and math" calibration into "confirmed correct in production." After that: supplier-link architecture for the (type × brand) case if a real client need for it surfaces; the signed-URL batching refactor if Orders List usage patterns show it's worth the component-boundary change; a proper headwear/bottoms position vocabulary so Bennie/Hats/Shorts/Pants can leave the unsupported tier.

---

## MOCKUP SYSTEM V2 — BATCH C GATE

Stopped here per instructions. No further development has been started automatically.

# Mockup System V2 — Architecture Plan

Status: **PLAN ONLY — pending approval. No implementation has started.** See `MOCKUP_SYSTEM_V2_AUDIT.md` for the evidence this plan is built on. Stop point: **MOCKUP SYSTEM V2 ARCHITECTURE GATE** at the end of this document.

---

## 1. Goals

Fix the two measured root causes from the audit (independent-axis photo stretch; garment-agnostic print zones) without regressing anything currently working (order creation, Reorder, historical previews, Production Board thumbnails), and without a rewrite larger than the actual problem requires.

---

## 2. Comparison Matrix

| | **A. CURRENT (raster + Fabric, fixed viewBox)** | **B. FABRIC + CANONICAL SVG** (keep Fabric, swap raster→SVG garment templates) | **C. DETERMINISTIC SVG/DOM** (no Fabric; pure SVG/CSS layout) | **D. 3D / ADVANCED** (WebGL garment model) |
|---|---|---|---|---|
| Accuracy | Poor — measured ~20% axis-independent stretch + shared zones (audit §8) | Good — SVG geometry can carry per-garment viewBox/anchor data, no raster stretch | Good — same geometry benefit as B, no raster stretch | Best in theory, but overkill relative to the actual defect |
| Visual quality | Photo-realistic base, but distorted | Depends entirely on SVG template art quality (illustration, not photo) | Same as B | Highest, most expensive to produce |
| Complexity | Low (already built) | Medium — needs a template authoring pass per garment | Medium-low — removes Fabric's object model, replaces with plain layout math | High — new rendering stack, new asset pipeline |
| Performance | Fabric loaded on every route (audit §9/§21) unnecessarily; 25MB photo set | Fabric retained, same bundling issue unless separately fixed | Removes Fabric entirely — biggest bundle win | Heaviest by far (3D engine + models) |
| Mobile UX | Fine (static render) | Fine | Fine, and simpler DOM = easier to reason about at small sizes | Risk — 3D on low-end mobile is a real concern |
| Physical-size consistency | Undermined by shared `refWidthMm` and stretch (audit §12) | Fixable — SVG geometry can define per-garment reference scale exactly | Same fix as B | Best possible, not needed to fix the actual bug |
| Preview export | Already works (static PNG snapshot pipeline) | Same pipeline, swap input renderer | Same pipeline, swap input renderer | Requires new export path |
| Maintainability | Photos are easy to source but hard to keep geometrically honest; vector fallback already dead code (audit §10) | One format (SVG) end to end; more work up front per garment, less drift long-term | Same as B, plus removes a whole dependency (Fabric) to maintain | Requires 3D-specific skills the team doesn't currently need elsewhere |
| Migration risk | None (status quo) | Medium — swaps every garment's visual asset, needs care with existing previews | Medium-high — also removes Fabric's non-visual behaviors (see §9) that must be reimplemented plainly | High — effectively a from-scratch rebuild |

**Recommendation: B (Fabric + canonical SVG), with the independent-axis-stretch bug fixed regardless of which option is chosen.** The measured root causes are data problems, not rendering-engine problems (audit §24); C is the more "correct" long-term destination given Fabric now does almost no interactive work (audit §9), but B is the smaller, lower-risk first step that fixes the actual complaint without touching the preview pipeline's plumbing or Reorder's data flow. D is not proportionate to this problem and is not recommended at any point on this roadmap.

---

## 3. Critical Questions — Direct Answers

**Should Fabric survive?**
**YES, but only as a static, non-interactive renderer** — not for its interactive/editing capabilities, which are already fully disabled (audit §9: no drag, no resize handles, no rotate-by-handle). Its remaining job (draw background, draw guide rect, draw one non-interactive image at a computed transform) does not require Fabric's object model, but replacing it is a separate, larger decision (Option C) that is not required to fix the placement-accuracy bug. Recommend fixing the stretch bug under Option B first; revisit "should Fabric be removed entirely" as a later, independent cleanup once bundling is fixed (§8 below) and it no longer costs every page load.

**Should SVG become canonical?**
**YES**, for garment geometry specifically. Canonical SVG garment templates (viewBox tied to the garment's real proportions, not a fixed 240×300) let per-garment aspect ratio, per-garment print-zone anchors, and colour fills all live in one coordinate system instead of three uncoordinated ones (audit §7). This does not require abandoning the raster photos as the *visual* garment appearance in the near term (see §5) — it requires that whatever geometry decisions are made (zone placement, aspect ratio) be authored against real per-garment measurements instead of one shared assumption.

**Should print zones be garment-specific?**
**YES**, unambiguously — the audit already found two garment types (Bennie, Hats) special-cased around this exact limitation (`printAnchorOverride`) and one (Singlet) patched with an undocumented nudge (`verticalOffsetPct: 9`). Concrete example: Left Chest at `yPct:19` reads correctly against a Hoody's longer torso but too low against a Singlet's higher, narrower shoulder line — exactly the kind of drift `verticalOffsetPct` was invented to paper over locally instead of fixing structurally. V2 should replace ad hoc per-garment nudges/overrides with one consistent mechanism: a per-garment-type zone table (or per-garment zone overrides layered on sane defaults), not a single global table plus exceptions.

**Should offsetX/offsetY remain active, become legacy-ignored, or be repurposed?**
**Legacy-ignored, explicitly.** The current renderer already ignores them for new placement and centers deterministically (audit §5, `MockupCanvas.tsx`'s own comment: "this renderer center[s] the artwork within its zone deterministically") — they are retained on `PrintSpec`/the `print_specs` table purely for historical rows. V2 should keep this exactly as-is: do not repurpose the fields for new behavior (that would silently change what old data means), do not resurrect drag-to-position UI (a deliberate prior product decision this task is explicitly barred from reversing), and do not drop the columns (breaking any historical read). Document them as frozen/legacy in the schema, nothing more.

**Should visual resize handles exist?**
**NO.** Consistent with the existing, deliberate "position/size is form-driven, not drag-driven" product decision already in place (audit §9) and with this task's explicit constraint not to reintroduce interactive placement. Physical size stays a numeric `widthMm`/`heightMm` field (with the existing preset buttons), not a draggable handle.

**What's the smallest appropriate supplier-link schema/UI model?**
**Not yet answerable with confidence.** The audit (§18, §23) did not locate any existing garment-catalog/supplier table or UI within its scope/time — this needs a short, dedicated follow-up read (garment catalog schema + its Settings UI, if any exists) before proposing a schema. Proposing one now would be a guess dressed as a recommendation, which this task's own instructions ask to avoid. Flagging this explicitly as the one required section this plan cannot respond to substantively without more investigation, rather than filling it with a placeholder that looks like an answer.

---

## 4. Component / Renderer Architecture (target state)

No change to the three-layer shape (template data → zone data → geometry math → renderer) established in the audit — V2 changes the *content* of the template/zone data and the stretch math inside the renderer, not the overall layering:
- `garmentTemplates.ts`: each template gains a real aspect ratio (derived from its own SVG/photo, not assumed to be 240×300) and, where the photo-vs-SVG decision (§5) keeps photos for now, the renderer stops independently scaling X/Y and instead scales uniformly + letterboxes/crops to the garment's own ratio.
- `printZones.ts`: gains a per-garment dimension (either a `Record<GarmentType, PrintZone[]>` or a base table plus per-garment override deltas — implementation detail for the build phase, not this plan).
- `MockupCanvas.tsx` / `GarmentMockup.tsx` / `mockupPreviewRenderer.ts`: all three currently share `GARMENT_VIEW_BOX`; all three need the same aspect-ratio-preserving fix applied consistently (the audit's §23 open item — confirm all three actually share the bug before assuming a one-file fix covers everything).

---

## 5. Garment-Template Contract (target state)

Recommend keeping real photos as the *visual* layer in the near term (they already look good and clients are used to them) while fixing:
1. Aspect-ratio-preserving scale (uniform scale + `object-fit: contain`-equivalent centering, not independent scaleX/scaleY).
2. A real per-garment viewBox/canvas ratio derived from that garment's actual photo dimensions, rather than one shared 240×300 assumed for all.

Full canonical-SVG-first garment templates (replacing photos outright) is a larger, separate investment (better colour-fill support, per audit §20) that should be sequenced as a later milestone, not bundled into the fix for the placement-accuracy complaint this audit was scoped to address.

---

## 6. SVG Coordinate System (target state)

Each garment template carries its own native aspect ratio; print-zone percentages for that garment are authored against that garment's own ratio, not a shared one. This directly removes the axis-independent-stretch root cause (audit §8.1) without requiring the zone-authoring process to guess at a compensating factor.

---

## 7. Print-Zone Schema (target state)

Zones become per-`GarmentType`. Recommend a base "generic torso" table (today's values, kept as sane defaults) plus explicit per-garment overrides for types already known to diverge (Singlet, Hi-Viz vest, headwear types — already special-cased today, just formalized instead of nudged). This is additive to the existing `PrintZone` shape (add a `garmentType` dimension), not a redesign of the box model itself (top-left + width/height + refWidthMm stays).

---

## 8. Garment-Specific Configuration

Headwear (Bennie, Hats) keeps its existing `printAnchorOverride` mechanism — it already works and is a reasonable model for "this garment doesn't have zone-shaped regions." Singlet's `verticalOffsetPct` should be replaced by a proper per-garment zone override once the schema supports it (§7), removing the need for a bespoke nudge field.

---

## 9. Anchor Model

Keep the existing anchor-override escape hatch (§8) for genuinely zone-incompatible garments; make it the documented exception, not an ad hoc one-off.

---

## 10. Physical Size Conversion

`refWidthMm` becomes per-garment-per-zone once zones are per-garment (§7), removing the audit §12 finding that the same mm value renders at an inconsistent real-world scale across different garments' actual print panels.

---

## 11. Artwork-Ratio Behavior

No change recommended — artwork aspect ratio is already preserved (`onArtworkAspectRatio`, `MockupCanvas.tsx`); this was not implicated in the audit's findings.

---

## 12. Front/Back Behavior

No structural change — `frontBackDiffer`/separate front/back photo pairs already exist per template and are unaffected by the stretch/zone fixes.

---

## 13. Multiple PrintSpecs

No change — multiple specs per order already supported; unaffected by geometry fixes.

---

## 14. Preview Generation

`mockupPreviewRenderer.ts` needs the same aspect-ratio fix as `MockupCanvas.tsx` (audit §23 open item to confirm first). No change to the storage/snapshot pipeline itself.

---

## 15. Orders / Board / Detail Integration

Recommend adding a `MockupThumbnail` to `OrdersList.tsx` to close the visibility gap found in audit §14 — this is a UI-visibility recommendation for a future milestone, not something this audit-only pass implements (explicitly barred: "do NOT change Orders UI"). Flagged here as a plan item, not executed.

---

## 16. Supplier Links

Deferred — see §3's direct answer above. Needs its own short investigation pass before a schema can be proposed responsibly.

---

## 17. Schema / API / Hook / UI Changes (summary of what V2 eventually touches)

- `printZones.ts`: add per-garment dimension (data-file change, not a DB migration — zones are static config today, not DB rows).
- `garmentTemplates.ts`: add real aspect ratio per template; retire `verticalOffsetPct` once superseded by §7.
- `MockupCanvas.tsx`, `GarmentMockup.tsx`, `mockupPreviewRenderer.ts`: fix independent-axis stretch consistently across all three.
- No `print_specs` table schema change — `offsetX`/`offsetY` stay as legacy-ignored columns (§3).
- No new migrations required for the stretch/zone fix itself; supplier-link work (§16) would need its own migration, scoped separately once designed.

---

## 18. Fabric Migration Strategy

None required for this fix (§3: Fabric survives, non-interactively). A future, independent decision to move to Option C (deterministic SVG/DOM, no Fabric) should be scoped as its own milestone once bundle-splitting (§21 below) is addressed and shown insufficient on its own.

---

## 19. Old-Offset Behavior

Legacy-ignored, unchanged (§3). Historical `offsetX`/`offsetY` values remain stored and unused by the renderer, exactly as today.

---

## 20. Historical Order Behavior

Fixing the stretch/zone bug changes how *existing* saved `PrintSpec`s render, since geometry authoring changes retroactively affect anything computed from `PrintZone`/aspect-ratio at render time. Two sub-cases:
- **Live renders** (`ArtworkMockupsTab.tsx`'s no-preview-yet fallback, `MockupCanvas.tsx` in Edit Order): will immediately reflect the corrected geometry — a strict improvement, no action needed.
- **Already-generated static preview PNGs** (`previewStoragePath`): stay visually stale (old distortion baked into the PNG) until that order is next saved and its preview regenerated (already-existing `syncMockupPreviewsForOrder` opt-in flow). Recommend a one-time backfill job to regenerate all existing previews after the fix ships, rather than requiring every historical order to be manually re-saved — but this is an operational/rollout decision, not something to execute as part of this audit-only pass.

---

## 21. Performance Plan

Two independent wins, both low-risk:
1. Fix Fabric's bundling (audit §9/§21) via a genuine dynamic `import()`/`React.lazy()` around `MockupStudio`, so Fabric only loads when a New/Edit Order mockup editor actually mounts — removes ~300KB+ from every other route's initial load.
2. Compress/resize the 22 garment PNGs (currently up to ~1.5MB each, ~25MB total) — they render into a small logical box; there is no reason for multi-megabyte source files. A straightforward re-export at a sane max resolution (e.g. 1200px longest edge, properly compressed) should recover most of this with no visible quality loss at mockup render sizes.

---

## 22. Responsive Plan

No structural change needed — the existing `ResizeObserver`-driven resize already recomputes geometry fresh at any size (audit §19); once the stretch fix lands, that recomputation is simply correct at every size instead of consistently wrong at every size.

---

## 23. Accessibility Plan

Low-priority, low-effort: make the `MockupCanvas`'s `aria-label` describe the actual garment/position/colour being rendered instead of the current static "Mockup preview canvas" string (audit §22). Not a blocker for the placement-accuracy fix.

---

## 24. Test Strategy

- Unit-test the geometry math (`mockupGeometry.ts`) directly: given a garment's real aspect ratio and a zone's percentage box, assert the computed pixel box matches expected values without axis-independent distortion — this is exactly the kind of pure-function test already established as the pattern in this codebase (`printSizePresets.test.ts`).
- Visual/manual verification per garment type against its real photo, since "does this look right" for placement accuracy is ultimately a human judgment call the client is already the arbiter of.
- Regression-check Reorder (copies `PrintSpec` fields verbatim — audit §17) and the preview-generation pipeline (audit §13) after any zone-table restructuring, since both consume `PrintZone`/`GarmentTemplate` shapes directly.

---

## 25. Rollout Milestones

1. **Fix the independent-axis stretch** (audit §8.1) across all three renderers (`MockupCanvas.tsx`, `GarmentMockup.tsx`, `mockupPreviewRenderer.ts`) — smallest, highest-confidence, most isolated change; does not require touching `printZones.ts`'s shape.
2. **Make print zones per-garment** (audit §8.2) — larger, needs real per-garment measurement/authoring work (someone checking each zone box against each garment photo, per garment, the way the original single-pass calibration was done but multiplied by 11 garment types).
3. **Backfill regenerate existing mockup previews** once 1+2 are live, so historical orders don't stay visually stale (§20).
4. **Fix Fabric bundle-splitting** (§21) — independent of the above, can ship any time, purely a build-config/import-site change.
5. **Compress garment source photos** (§21) — independent, can ship any time.
6. *(Separately scoped, not part of this fix)* Supplier-link investigation and schema (§16), Orders-page thumbnail visibility (§15), full SVG-canonical garment templates if colour-fill becomes a priority (§5/§20 of the audit).

---

## 26. Rollback Strategy

Each milestone above is independently revertable: the stretch fix and per-garment zone table are both data/renderer changes with no destructive migration, so a straight `git revert` restores prior (known-buggy but stable) behavior. The preview backfill (milestone 3) is the one step that touches stored data (regenerated PNGs) — recommend keeping the prior preview PNGs until the backfill is confirmed correct across a sample of real orders, rather than deleting-then-regenerating in place, so a bad backfill can be rolled back without data loss.

---

## MOCKUP SYSTEM V2 ARCHITECTURE GATE

This plan stops here. Per the task's explicit constraint, no Fabric removal/rewrite, no PrintSpec rewrite, no garment asset replacement, no `printZones.ts` change, no supplier columns, no migrations, no Orders UI change, no preview regeneration, and no production-data modification have been made — this document and its companion audit are the only artifacts produced.

**Waiting for explicit approval before any implementation begins.**

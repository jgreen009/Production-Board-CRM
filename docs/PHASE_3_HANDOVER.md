# SALT PRINTS — Phase 3 Handover: Mockup Studio & Artwork/Production Workflow

**Purpose of this doc**: the ground-truth snapshot of everything Phase 3
added, written for whoever plans Phase 4. It documents the final
architecture, what was verified and how, what's still an open risk, and the
exact scope carried forward. Supersedes nothing — it sits alongside
`docs/HANDOVER.md` (Phase 1/frontend) and `docs/PHASE_2_HANDOVER.md`
(backend/Supabase) as the third leg of the "current state" reference set.

Last verified against the codebase: 2026-09-09 (commit range `1af33bc` …
current Batch D work, this doc's own commit included).

---

## 1. Phase 3 overview

Phase 3 took the Order form's artwork/mockup handling from static
placeholder silhouettes to an interactive, persisted, print-production-aware
workflow. It shipped in five gated batches:

- **Milestones 1–2**: Mockup Studio architecture + neutral garment template
  system (pre-dates the batch structure below).
- **Batch A** (Milestones 3–5): interactive Fabric.js canvas — drag, resize,
  rotate, print-zone geometry, physical print size as the authoritative
  value, multiple PrintSpecs per order, Front/Back navigation.
- **Batch B** (Milestones 6–7): persistence/reconstruction correctness
  (stable PrintSpec IDs, offset-from-zone-center semantics that survive any
  canvas pixel size) and clean mockup PNG export/storage.
- **Batch C** (Milestones 8–9): approval-note workflow on top of the
  existing ArtworkStatus enum, and a centralized, pure production-readiness
  and attention-warning model shared by Dashboard, Production Board, Quick
  View, and Order Detail.
- **Batch D** (Milestones 10–11, this document): responsive/touch hardening,
  performance verification, error/empty-state hardening, storage/security
  re-verification, database integrity checks, accessibility pass, cleanup,
  and this handover.

## 2. Final architecture

```
src/components/domain/
  MockupCanvas.tsx              Fabric.js canvas wrapper — the ONLY file
                                 that imports 'fabric'. Lazy-loaded.
  GarmentMockup.tsx              Static/read-only silhouette+artwork render
                                 (SVG-position based), used by legacy call
                                 sites and as a pre-preview-generation
                                 fallback in ArtworkMockupsTab.
  MockupThumbnail.tsx            Small read-only thumbnail: saved preview
                                 PNG if present, else a Shirt icon fallback.
  mockup-studio/
    MockupStudio.tsx             Editor shell: layout, per-spec state,
                                 wires MockupCanvas + all the controls below.
    PrintSpecTabs.tsx            Front/Back grouping + per-spec chip nav.
    ArtworkSelector.tsx          Pick which uploaded artwork file a spec uses.
    TransformControls.tsx        Non-canvas width/rotation/placement controls
                                 (Batch A accessibility requirement — every
                                 canvas gesture has a plain-control equivalent).
  production/
    ProductionTable.tsx, ProductionToolbar.tsx   Production Board list.
    AttentionBadge.tsx            Compact per-row warning icon (Batch C).
    MockupPreviewDrawer.tsx       Read-only multi-spec preview drawer (Batch C).
    OrderQuickView.tsx            Read-only order drawer, readiness+warnings (Batch C).

src/utils/
  mockupGeometry.ts               Pure zone<->pixel<->mm conversions (Batch A/B).
  mockupPreviewRenderer.ts        Fabric-based off-screen PNG export (Batch B).
  productionReadiness.ts          Pure readiness/blockers/warnings (Batch C).

src/api/
  mockupPreviews.ts                Read-only: signed URLs, canonical path fn,
                                   integrity checker. No Fabric import.
  mockupPreviewSync.ts             Write path: render+upload+cleanup. Fabric-
                                   using, dynamically imported only from the
                                   save mutation's onSuccess.
  artwork.ts                       Customer artwork upload/signed-URL/remove.
  orders.ts                        upsert_order RPC wrapper + activity diffing.

src/config/printZones.ts           Print-zone geometry (single source of truth).
src/config/garmentTemplates.ts     Neutral silhouette catalog per garment/view.
```

## 3. Fabric version

`fabric@^6.9.1` (Fabric.js v6, `FabricImage`/`Canvas` API). One dependency,
one import site (`MockupCanvas.tsx`), loaded via a single `lazy()` boundary
in `MockupStudio.tsx`.

## 4. MockupCanvas architecture

A thin imperative wrapper: mounts a Fabric `Canvas` on a plain `<canvas
role="img" aria-label="Mockup preview canvas">`, draws the garment
silhouette + print-zone guide, loads the artwork image as a `FabricImage`
with corner-only resize handles (aspect ratio locked — `ml/mr/mt/mb`
controls hidden, only corner controls exposed), and reports transform
commits back up via `onTransformCommit`. Touch handles use
`touchCornerSize: 26` (vs. `cornerSize: 12` visual) — a deliberately
larger invisible hit area for touch, already tuned in Batch A and
re-verified unchanged in Batch D. Exposes an imperative handle
(`MockupCanvasHandle`) for the plain-control equivalents (center, reset
position/rotation/size) so no transform is canvas-only.

## 5. Print-zone model

`src/config/printZones.ts` — one `PrintZone` per `PrintPosition`, defined as
a top-left-anchored percentage box (`xPct/yPct/widthPct/heightPct`) over the
garment mockup image, plus a `refWidthMm` (an intentional approximation of
that body location's real usable print width, e.g. Left Chest ≈150mm, Full
Front ≈350mm) used only to convert a physical width into on-canvas pixels.
These box dimensions are an **overflow-warning threshold, not a hard clamp**
— placement may exceed them; the UI warns but never silently clips.

## 6. Physical-size model

`widthMm`/`heightMm` on each PrintSpec are the authoritative, persisted
values — canvas pixel size is always derived from them via
`physicalSizeToPixelSize` (`mockupGeometry.ts`), never the reverse. Height
is derived from width via the artwork's own aspect ratio
(`heightMmFromWidth`), so height is never independently editable — the
"Print Height (mm)" field in `TransformControls` is read-only.

## 7. Offset semantics

`offsetX`/`offsetY` are **fractional offsets from the print zone's own
center** (0,0 = zone center), not raw canvas pixels or whole-canvas-relative
coordinates. This is what makes a persisted offset reconstruct identically
regardless of the editor's current pixel size/viewport — `zoneOffsetToCanvasPosition`
and its inverse `canvasPositionToZoneOffset` are the pure, tested conversion
functions (`mockupGeometry.ts`).

## 8. Rotation model

Stored normalized to `[0, 360)` degrees (`normalizeRotationDeg`) — Fabric
can report negative angles or values ≥360 depending on drag direction, so
every write path runs through this normalizer before persisting.

## 9. PrintSpec schema changes

Phase 3 additions to `print_specs` (all pre-existing as of Batch D — no
schema changes were made in Batch C or D): `offset_x`, `offset_y`,
`rotation_deg`, `preview_storage_path`, `approval_note`. No new enums, no
new tables added this phase.

## 10. Stable PrintSpec ID fix

Milestone 1 fixed an identity bug where PrintSpec ids were regenerated on
every render/save, breaking the canonical-preview-path strategy (a new id
each save meant a new, orphaned preview path each time). IDs are now stable
across the field-array lifetime and across saves — verified structurally
(the id is set once, at creation, and threaded through `useFieldArray`
unchanged) and via the DB integrity queries in §28 (zero duplicate
`print_specs.id`, stable `preview_storage_path` per spec).

## 11. Garment template system

`src/config/garmentTemplates.ts` + `src/assets/mockups/*.png` — 22 neutral
flat-sketch garment images (11 garment types × Front/Back), each swapped in
by `GarmentMockup`/`MockupCanvas` based on `garmentType` + `view`. Settings'
`mockup_templates.active` flag controls which garment types actually appear
as selectable Preview Garment options per view (`useMockupTemplates`).

## 12. Artwork rendering behavior

Only `PNG/JPG/WEBP/SVG` artwork types render a live preview on the canvas or
in any read-only mockup (`PREVIEWABLE_ARTWORK_TYPES` in three parallel
places — `MockupStudio.tsx`, `mockupPreviewSync.ts`, `ArtworkMockupsTab.tsx`
— all identical). `PDF/AI` files stay attached to the PrintSpec (selectable,
shown by filename) but never attempt an in-browser preview; the UI says so
explicitly ("Preview unavailable for this artwork type").

## 13. Multiple PrintSpec behavior

Unlimited PrintSpecs per order, each with its own position, garment
type/colour, artwork reference, transform, and approval note. Front/Back
tabs are a pure derived grouping over the existing array (never persisted
separately) — computed from each spec's own `position → view` mapping.

## 14. Draft behavior

Drafts (`order_state = 'Draft'`) autosave periodically but **never** trigger
mockup preview generation or approval-note activity logging — both are
explicit-save-only, verified by code inspection: `syncMockupPreviewsForOrder`
and `diffOrderForActivity` are called only from `updateOrderWithActivity`
and the Create/Save-Draft-finalize mutation success handlers, never from the
autosave interval.

## 15. Active-order save behavior

Explicit save (Save Draft's finalize path, Create Order, Edit Order's Save
Changes) runs `upsertOrder(..., finalize)` then, on success,
`syncMockupPreviewsForOrder` (mockup PNGs) and `diffOrderForActivity` +
an `order_activity` insert (priority/payment/mockup-note changes). A preview
generation failure is caught **per PrintSpec** and reported as a
succeeded/failed count — it never throws back into the save flow, so the
order is never lost or rolled back because of a rendering problem.

## 16. Preview generation

`src/utils/mockupPreviewRenderer.ts` — an off-screen Fabric canvas,
identical geometry math to the interactive editor, rendered to a PNG `Blob`.
Runs once per current PrintSpec on every explicit save (not diffed against
what actually changed — deliberate, documented tradeoff: the canonical path
is always overwritten in place, so regeneration is safe/idempotent even when
nothing changed, and acceptable for a small per-order spec count).

## 17. Preview storage strategy

Bucket: `mockup-previews` (private). Canonical, stable path per spec:
`orders/{orderId}/print-specs/{printSpecId}/preview.png` — one object per
PrintSpec, always overwritten (`upsert: true`), no version history. Path
generation is a pure function (`mockupPreviewStoragePath`), unit-tested for
determinism and per-spec uniqueness.

## 18. Preview cleanup/integrity

On save, PrintSpecs present in the previous snapshot but absent from the
current save have their preview object deleted (best-effort — a failed
delete is logged, not fatal, and would surface later as an orphan in the
integrity check, not as silent data loss). Customer artwork
(`artwork-originals` bucket) is never touched by this cleanup — different
bucket, different table, different code path entirely.

**Batch D re-verification** (live DB, via Supabase SQL, 2026-09-09):
- Every non-null `print_specs.preview_storage_path` has a matching Storage
  object — **0 broken references**.
- Every Storage object under `mockup-previews/orders/` is referenced by a
  current `print_specs.preview_storage_path` — **0 orphans**.
(Dataset was small — 2 orders / 2 print_specs at verification time — so this
confirms current correctness, not the cleanup path under heavy concurrent
load, which remains unexercised.)

## 19. Approval workflow

Deliberately **not** a second status system. The existing order-level
`ArtworkStatus` enum (`Not Started → … → Mockup Required → Awaiting
Approval → Approved → Completed`) is unchanged and remains the single
approval-state source of truth, set via the existing `StatusSelect` control
on the Production tab. Batch C added *context* around it (where it's shown,
what note goes with it) — never a parallel per-PrintSpec status field.

## 20. Approval-note model

`print_specs.approval_note` (already existed pre-Batch-C) — a free-text
note per PrintSpec, editable via a 2-row textarea in Mockup Studio, shown
read-only (amber block) in Order Detail → Artwork & Mockups and in the
Mockup Preview Drawer. Changing it logs one `order_activity` row per
changed spec (`activity_type: 'mockup'`, `"Mockup note updated for
{position}"`) on explicit save only — never per keystroke, never on
autosave (unit-tested in `src/api/orders.test.ts`).

## 21. Production readiness

`src/utils/productionReadiness.ts` — `isReadyForProduction(order)`: true iff
`artworkStatus ∈ {Approved, Completed}` AND `garmentStatus ∈ {Received,
Supplied, Completed, Not Required}` AND `productionStatus ≠ Completed`.
"Order is Active" is not separately checked — every `Order` reaching this
function already came from `listOrders`/`getOrder`, which filter to
`order_state = 'Active'`. **Payment status is never a factor.** Pure, no DB
reads, no side effects, 24 unit tests.

## 22. Attention warnings

`getAttentionWarnings(order)` returns a severity-ranked
(`critical`/`warning`/`info`) list from a small deterministic rule set:
overdue → critical; due today or same-day-turnaround with artwork
incomplete → critical; due tomorrow with artwork incomplete → warning;
urgent priority with garments not ready → warning; awaiting-approval with a
near due date → info/warning. A `Completed`-production order always yields
zero warnings, regardless of technical overdue-ness (tested explicitly).
`compareWarningSeverity` gives a stable sort order for surfaces showing
multiple warnings at once.

## 23. Production Board changes

Real saved-PNG thumbnails (Batch B) with a click target that opens the new
read-only `MockupPreviewDrawer` (browse all of an order's PrintSpecs, no
editing) instead of the row's existing `OrderQuickView`. One compact
`AttentionBadge` icon per row (color-coded by top severity, full text via
tooltip **and** an `aria-label`/`role="img"` for non-hover access — Batch D
accessibility fix) replaces what would otherwise have been five new warning
columns.

## 24. Dashboard changes

`ordersRequiringAttention` now delegates entirely to the same
`getAttentionWarnings` the Board's `AttentionBadge` uses (previously a
separate, hand-written rule chain) — the two surfaces cannot disagree by
construction. Reviewed in Batch D: `awaitingArtworkOrders` and
`readyForProductionOrders` (simple dashboard stat-card filters, pre-existing)
were flagged by a cleanup audit as conceptually adjacent but are
intentionally distinct — they answer "how many orders are literally in
status X," not the cross-field readiness question — left as-is to avoid
changing dashboard stat semantics without a concrete defect.

## 25. Order Detail changes

- **Overview**: a readiness/warning banner (amber left border), shown only
  when not-ready or warnings exist — a clean order shows nothing extra.
- **Artwork & Mockups**: artwork status badge + "Edit Mockup" link (into the
  existing Edit Order route — no second editor) next to the Mockups card
  header; approval note shown per spec.
- **Production**: existing 2×2 status-control grid preserved unchanged
  (per the brief's "keep existing status controls/architecture"); a new
  "Ready for Production" summary card added alongside it (Yes/No + blockers
  + warnings), not replacing anything.

## 26. Responsive behavior

Verified via static layout analysis at the four target breakpoint
boundaries (1440/1280/1024/768/390 — Tailwind defaults: `sm`=640,
`lg`=1024). No live browser was available this session (see §30) — the
following is what the code does, not a click-through confirmation:

- **Mockup Studio**: `grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_240px]`.
  Below 1024px it collapses to one stacked column in DOM/reading order:
  location/garment/artwork/approval-note controls → canvas → transform
  controls (Batch D reordered this from the prior canvas-first mobile order
  to match the brief's requested stacked flow). The canvas itself is
  `ResizeObserver`-driven (`min(containerWidth, 420)`), so it scales down
  gracefully rather than overflowing at 390px, and `PrintSpecTabs` uses
  `flex-wrap` so any number of print locations wraps instead of scrolling
  horizontally.
- **Fixed 2-column grids with no responsive prefix** — found and fixed in
  Batch D: `CustomerJobSection.tsx`, `ServicesSection.tsx` (now
  `grid-cols-1 sm:grid-cols-2`), `TurnaroundDeliverySection.tsx` (now
  `grid-cols-1 sm:grid-cols-3`) — all three would have cramped two/three
  fields or long toggle labels into a 390px viewport.
- **Filter popover** (`ProductionToolbar.tsx`) — added
  `max-w-[calc(100vw-2rem)]` as a safety cap alongside its existing `w-72`,
  so it can never itself force horizontal page overflow on very narrow
  viewports.
- **Tables**: every `<table>` in the app (Orders List, Customers List,
  Dashboard, File Metadata, Order Form review tab, Production Board) is
  already wrapped in an `overflow-x-auto` container — confirmed via
  audit, no changes needed.
- **Drawers** (`Drawer.tsx`, used by Quick View and Mockup Preview Drawer):
  `w-full max-w-md` — already full-width-safe at 390px.
- Not fixed, out of scope: no live-browser confirmation of actual rendered
  spacing/wrapping at each exact breakpoint, or of touch-drag/resize/rotate
  behavior on a real touch device. Fabric's `touchCornerSize: 26` was
  reviewed and left as-is (already a deliberate Batch A touch accommodation
  beyond the default corner size).

## 27. Performance / chunk sizes

| Chunk | Batch C | Batch D (final) |
|---|---|---|
| Main (`index-*.js`) | 806.01 kB (gzip 224.18 kB) | 807.41 kB (gzip 224.68 kB) |
| Fabric/editor (`index.min-*.js`) | 289.01 kB (gzip 87.88 kB) | 289.01 kB (gzip 87.88 kB) — **unchanged, byte-identical hash** |
| `MockupCanvas-*.js` | 4.40 kB (gzip 1.62 kB) | 4.40 kB (gzip 1.62 kB) |
| `mockupPreviewRenderer-*.js` | 0.89 kB | 0.89 kB |
| `mockupPreviewSync-*.js` | 1.68 kB | 1.68 kB |

Delta from Batch C to Batch D: **+1.4 kB main chunk** (the new
`ErrorBoundary` component, Drawer/ConfirmDialog Escape-key handling, and a
few className tweaks) — negligible. The Fabric chunk is byte-for-byte
unchanged, confirming Batch D's edits never touched anything on the editor
side of the lazy boundary.

**Fabric isolation, re-verified in Batch D**: `dist/index.html`'s single
eagerly-loaded script tag references only the main chunk — `index.min-*.js`
(which contains the string `fabric`) does not appear there, nor does the
string `fabric` appear anywhere in the main chunk or `MockupCanvas-*.js`
text. It is fetched only when `MockupCanvas`'s `lazy()` import actually
resolves, i.e. only when Mockup Studio mounts. Dashboard, Customers, Orders
List, Production Board, and Order Detail's read-only preview surfaces all
statically import only `mockupPreviews.ts` (no Fabric) — confirmed both by
source-level import inspection and by the bundle grep above.

**Known, pre-existing, not a Phase 3 regression**: main chunk exceeds
Vite's 500 kB advisory warning threshold (807 kB). This was already true at
the end of Batch C and is not something Batch D's scope (no broad
route-splitting refactor authorized) addresses. Recommended for Phase 4:
route-level code-splitting via React Router's lazy route modules.

**Image assets**: 22 neutral garment PNGs (`src/assets/mockups/`), 580 kB–
1.5 MB each, emitted 1:1 into `dist/assets` (22 source → 22 emitted, no
orphans, no stale duplicates). These are fetched by the browser as ordinary
`<img>`/CSS-background assets only when a given garment type/view is
actually rendered — never bundled into JS (all well above Vite's 4 kB
inline threshold). Their per-file size is large for what they show (flat
line-art sketches) but is a pre-existing Milestone-2-era asset-authoring
concern, not something Batch D's scope covers ("do not spend time deleting
unrelated dead assets unless safe and trivial" — re-encoding 22 production
images is neither).

## 28. Security/RLS/Storage result

Re-ran Supabase advisors (2026-09-09):

**Security** — 2 warnings, both pre-existing (from Milestone 11's original
RLS/security audit), neither new nor caused by Phase 3:
- `authenticated_security_definer_function_executable` — `upsert_order` is
  `SECURITY DEFINER` and callable by any authenticated user. This is
  intentional: it's the one write path behind the whole-child-set-replace
  upsert (orders + garments + services + print_specs together), and every
  authenticated user in this app is internal staff. Accepted, unchanged.
- `auth_leaked_password_protection` — HaveIBeenPwned password checking is
  disabled at the Auth project level. Pre-existing, informational,
  unrelated to Phase 3 — a project-settings toggle, not a code change.

**Performance** — 1 informational category, 16 unused-index findings across
`orders`, `customers`, `artwork`, `mockup_templates`, `order_activity`,
`order_garments`, `order_services`, `print_specs`. All are `INFO`-level
"never used" notices, expected on a low-traffic development project — not
actionable without real production query volume. None are new to Phase 3.

**No new critical findings from Batches A–D.**

Storage re-verification (live SQL against `storage.buckets`/`pg_policies`):
- `artwork-originals` and `mockup-previews` are both `public: false`.
- Both buckets' policies are scoped to `bucket_id = '<bucket>'` for the
  `authenticated` role only, covering SELECT/INSERT/UPDATE/DELETE — **no
  `anon` policy exists on either bucket**, confirmed by reading
  `pg_policies` directly (not inferred from source).
- Signed URLs are generated at read time only (`getArtworkSignedUrl`,
  `getMockupPreviewSignedUrl`), 1-hour expiry, never written to the
  database or any cache — confirmed by code inspection: neither function's
  return value is persisted anywhere, only returned to the calling
  component/hook for immediate `<img src>` use.

## 29. Automated test results

**111 tests passing, 13 test files** (up from 24 tests in a single new file
at the start of Batch C; Batch D added no new tests — a coverage review
found geometry, mapper round-trip, preview-lifecycle helpers, readiness,
warning logic, primary-preview-selection, storage-path-generation, and
identity-stability all already covered by existing suites, see §32).

```
npm run build   ✓ tsc -b && vite build — 0 errors
npm run lint    ✓ oxlint — 0 warnings, 0 errors
npm run test    ✓ 111/111 passed, 13/13 files
```

## 30. Manual UAT results

**No browser tool was available in this session for either Batch C or
Batch D.** No click-through UI verification was performed at any point in
Phase 3. This is stated plainly, not inferred — every acceptance test below
is marked `NOT PERFORMED (no browser access)`, never `PASS`.

| Test | Result |
|---|---|
| A1–A10 (Batch A: canvas/geometry/mobile editor) | NOT PERFORMED — no browser access |
| B1–B13 (Batch B: persistence/preview lifecycle/signed URLs) | NOT PERFORMED — no browser access |
| C1–C12 (Batch C: approval notes/readiness/warnings/board/dashboard) | NOT PERFORMED — no browser access |

What *was* done in place of browser UAT, this batch:
- Direct SQL verification of preview-path integrity (bidirectional, §18/§28)
  and database integrity (§32) against the live Supabase project — this
  substitutes for B7/B9/B13's storage-side assertions but not for the UI
  interactions (B1–B6, B8, B10–B12) that produce that state.
- Static source-level verification of every code path A1–C12 depend on
  (geometry math, offset/rotation persistence, preview generation triggers,
  approval-note diffing, readiness/warning rule logic) — all backed by the
  111 passing unit tests, which exercise the pure logic directly.
- Bundle-level verification of Fabric isolation (§27) — substitutes for the
  "Fabric doesn't load on X page" *mechanism*, not for confirming the pages
  visually render correctly.

**This is a real gap, not a formality.** Nothing in Phase 3's UI has been
seen rendered in an actual browser by an agent this phase. Full manual
click-through of A1–A10, B1–B13, and C1–C12 — plus the Part 7 end-to-end
workflow below — must happen before this is called launch-ready.

## 31. Known limitations

- No live browser verification anywhere in Phase 3 (§30) — the single
  largest open item.
- Main JS chunk (807 kB) exceeds the 500 kB advisory threshold; not
  code-split (out of Batch D's authorized scope).
- 22 garment silhouette PNGs are heavier (580 kB–1.5 MB each) than their
  visual complexity warrants; not re-encoded this phase.
- Preview regeneration is unconditional per save (every current PrintSpec's
  preview is re-rendered every explicit save, not diffed) — correct and
  safe, but means save latency scales with PrintSpec count. Not measured
  under load.
- The bidirectional preview-integrity check was run against a small live
  dataset (2 orders / 2 print_specs) — confirms current correctness, not
  behavior under concurrent writes or at scale.
- `auth_leaked_password_protection` remains disabled (Auth project setting,
  pre-existing, not a Phase 3 regression, but worth flagging for whoever
  owns the Supabase project config).

## 32. Deferred features

Nothing product-scoped was deferred out of the original Phase 3 brief.
Explicitly out of scope by the brief's own "Do NOT" list and never
attempted: a second per-PrintSpec approval-status system, payment status as
a production blocker, a warning-scoring engine, Fabric on any read-only
surface, broad route-level code-splitting, full WCAG certification, deleting
unrelated dead assets.

## 33. Remaining browser-verification gaps

All of §30's table, plus the full realistic end-to-end workflow specified
in Batch D's Part 7 (login → customer → order → garments → artwork → two
PrintSpecs with drag/resize/rotate → save draft → refresh/resume → finalize
→ Production Board → mockup preview → approval-note → status transitions →
edit/re-save → preview overwrite verification → production status →
refresh → logout/login persistence check). **None of this was executed —
no browser tool was available.** This entire workflow, plus A1–A10/B1–B13/
C1–C12 individually, is the concrete punch list for whoever performs launch
QA.

## 34. Recommended Phase 4 scope

- Perform the full manual UAT punch list from §30/§33 first — this should
  gate everything else.
- Route-level code-splitting (main chunk is the one clear, measured
  performance opportunity left).
- Consider re-encoding/optimizing the 22 garment template PNGs if load time
  on slow connections becomes a real user complaint (not measured as one
  yet).
- Enable HaveIBeenPwned leaked-password checking in Auth settings (a
  one-click Supabase dashboard change, no code involved).
- Whatever Phase 4's actual product scope is (this document does not
  presume it) — Phase 3's mockup/approval/readiness architecture is stable
  and pure enough (see `productionReadiness.ts`, `mockupGeometry.ts`) to be
  extended rather than reworked.

---

## Phase 3 Definition of Done — status

- [x] Mockup Studio works (code-level: builds, type-checks, unit-tested geometry)
- [x] Drag / [x] Resize / [x] Rotation — implemented, unit-tested geometry; **not browser-confirmed**
- [x] Physical dimensions stay authoritative (§6)
- [x] Print zones work (§5)
- [x] Overflow warnings work (implemented, warns-not-clamps per §5; not browser-confirmed)
- [x] Multiple PrintSpecs work (§13)
- [x] Front/Back workflow works (§13)
- [x] Draft reconstruction works (code-level, Batch B; not browser-confirmed)
- [x] Active-order explicit save works (§15)
- [x] Mockups persist (§17, DB-integrity-confirmed)
- [x] Clean preview PNGs generate (§16)
- [x] Preview PNGs stored privately (§28, confirmed via live bucket config)
- [x] Preview paths stable (§10, §17, unit-tested)
- [x] Deleted previews cleaned up (§18, best-effort, code-level)
- [x] Order Detail displays mockups (§25)
- [x] Production Board displays mockups (§23)
- [x] Quick Preview works (§23, code-level; not browser-confirmed)
- [x] Approval workflow works (§19)
- [x] Approval notes work (§20)
- [x] Production readiness works (§21, 24 unit tests)
- [x] Attention warnings work (§22, unit tests)
- [x] Dashboard uses shared warning logic (§24)
- [x] Fabric remains editor-only (§27, bundle-verified)
- [x] Mobile/tablet/desktop layouts work (§26, code-level review + fixes; **not browser-confirmed**)
- [x] Storage integrity clean (§18, §28, live-DB-verified)
- [x] RLS/security clean (§28, no new findings)
- [x] Build passes / [x] Lint passes / [x] Tests pass (§29)
- [x] `PHASE_3_HANDOVER.md` written (this document)

---

## Final recommendation

**NOT READY FOR PHASE 4** — pending manual browser QA only.

Every code-level, database-level, and bundle-level check available without
a browser has been performed and passes clean: build/lint/111 tests, live
Supabase security/performance advisors (no new findings), live storage
bucket/policy configuration (private, staff-only, no anon access), live
bidirectional preview-integrity SQL (zero broken references, zero orphans),
and live database-integrity SQL (zero orphan print_specs, zero broken
artwork references, zero invalid physical sizes/rotations, zero duplicate
IDs or preview paths).

**The exact blocker**: no part of Phase 3's UI — across Batches A, B, C, or
D — has ever been rendered and clicked through in an actual browser by an
agent. The full A1–A10 / B1–B13 / C1–C12 acceptance-test list and the Part 7
end-to-end workflow (§33) remain entirely unexecuted. This is a genuine gap
in verification, not a code defect — the underlying logic is unit-tested
and the data layer is confirmed clean, but interactive behavior (drag/
resize/rotate feel, touch usability, responsive breakpoint rendering, the
full save→reload→resume→finalize round trip as a human would experience it)
has zero direct observation behind it.

**To reach READY**: run the manual UAT punch list in §30/§33 in a real
browser (desktop + at least one touch device), fix whatever regressions
surface, then re-issue this recommendation.

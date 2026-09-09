# Phase 3 — Mockup Studio & Artwork/Production Workflow

**Project:** SALT PRINTS internal production-management CRM
**Status:** Not started
**Prerequisite phases:** 1 (frontend), 2 (Supabase backend), 2.5 (audit/stabilisation) — all complete

---

## 0. How to run this phase

Do not attempt this in one session. Run it as a sequence of scoped sessions with a
`/clear` between milestones. Each milestone below has **exit criteria** and most end in a
**GATE** where you stop and wait for human review.

### Kickoff prompt (paste into Claude Code for session 1)

```
Read docs/PHASE_3_BRIEF.md in full, then read the context files it lists in §1.1.

Do NOT write application code this session.

Deliver only Milestone 0: docs/PHASE_3_PLAN.md, covering every item in §3 of the brief,
with an explicit recommendation and rationale for each decision in §4.

Before writing the plan, run `npm run build`, `npm run lint`, `npm run test` and record
the baseline results (including current main bundle size) in the plan.

Stop when the plan is written. Do not begin implementation.
```

### Prompt for each later session

```
Read docs/PHASE_3_BRIEF.md and docs/PHASE_3_PLAN.md.
Implement Milestone <N> only. Respect the hard constraints in §1.2.
Stop at the milestone exit criteria and report status against them.
```

### Commands

```bash
npm run build     # must pass; report bundle size delta each milestone
npm run lint      # must pass with no new warnings
npm run test      # must pass
```

Run all three **before** starting work and **before** declaring any milestone complete.
Run Supabase advisors after any migration.

---

## 1. Context and guardrails

### 1.1 Required reading before any code change

| File | Why |
|---|---|
| `CLAUDE.md` | Project conventions |
| `docs/HANDOVER.md` | Phase 1 |
| `docs/PHASE_2_SPEC.md` | Phase 2 intent |
| `docs/PHASE_2_BACKEND_PLAN.md` | Backend design |
| `docs/PHASE_2_HANDOVER.md` | Phase 2 outcome |
| `docs/PHASE_2_5_VERIFICATION_PLAN.md` | Audit scope |
| `docs/PHASE_2_5_HANDOVER.md` | Current known state |

Then inspect:

```
src/types/index.ts
src/data/printPositions.ts
src/data/printSizes.ts
src/data/garmentImages.ts
src/components/domain/GarmentMockup*
src/components/domain/Artwork*
src/pages/new-order/
src/pages/order-detail/
src/api/orders.ts
src/api/artwork.ts
src/api/settings.ts
src/api/mappers/
src/hooks/useOrders*
src/hooks/useArtwork*
src/hooks/useSettings*
supabase/migrations/
```

### 1.2 Hard constraints — do not violate

1. **Do not rebuild the application.** Phase 3 extends existing code.
2. **Do not redesign unrelated areas.** Dashboard, Customers, Settings shell, auth, etc. stay as they are.
3. **PrintSpec stays one entity.** Do not split it into `print_details` + `mockups`. Do not create a competing mockup domain model that duplicates PrintSpec data.
4. **Preserve the architecture rule:** components → hooks → `src/api` → Supabase. No direct Supabase calls inside mockup components.
5. **No raw pixel coordinates in the database.** Persist normalised values only.
6. **All schema changes are versioned migrations** under `supabase/migrations/`. Never edit production schema via the dashboard.
7. **Artwork and previews stay private.** Signed URLs at read time; persist storage paths, never signed URLs.
8. **Never delete the customer's original artwork file** because it was removed from a PrintSpec.
9. **Do not add active-order canvas autosave.** Phase 2's explicit-save model for active orders is preserved.
10. **Do not hand-build drag/resize/rotate with raw DOM transforms.** Use the chosen canvas library.
11. **This is a single-company internal tool.** No speculative SaaS features.

### 1.3 Non-goals (explicitly out of scope)

Customer-facing proof approval portal · email/SMS proof sending · payments · invoicing ·
supplier ordering · inventory · AI artwork generation · AI vectorisation · background
removal · logo enhancement · mockup version history · multi-tenancy · ecommerce ·
PDF proof generation (defer unless trivially simple).

---

## 2. Objective and definition of done

Turn the existing garment mockup / PrintSpec area into a real production tool. The client
named the mockup section as one of the most important parts of the system. It must be
operationally useful, not decorative.

**Phase 3 is done when this end-to-end workflow works:**

```
Open order
  → upload or select customer artwork
  → choose garment
  → choose garment colour
  → choose print location
  → artwork appears on the correct garment area
  → drag / resize artwork
  → physical print size is clearly shown
  → add a second print location
  → configure front and back independently
  → save
  → refresh
  → the exact mockup reconstructs
  → a clean mockup preview exists
  → Order Detail displays it
  → Production Board displays a thumbnail
  → artwork progresses through approval statuses
  → production staff can understand the job without opening the editor
```

The result should make the digital order form meaningfully better than the original
paper/PDF form.

---

## 3. Milestone 0 — Plan (GATE)

**Deliverable:** `docs/PHASE_3_PLAN.md`. No application code this milestone.

Cover, in order:

1. Current mockup architecture (as found in code, not as assumed)
2. Existing PrintSpec model and current `print_specs` schema
3. Canvas library decision
4. Coordinate system
5. Artwork scaling model
6. Physical-size mapping
7. Print-zone model
8. Garment-image strategy
9. Front/back model
10. Multiple-PrintSpec handling
11. Artwork lifecycle
12. Mockup persistence
13. Preview/export generation
14. Approval workflow
15. Production workflow improvements
16. Required database changes (with justification per field)
17. Required storage changes
18. UI changes
19. Mobile behaviour
20. Testing strategy
21. Implementation milestones (mapped to §6)
22. Deferred capabilities

Also record the baseline `build` / `lint` / `test` results and current main bundle size.

**Exit criteria:** plan written, every §4 decision answered with a rationale.
**GATE:** stop. Wait for human sign-off before Milestone 1.

---

## 4. Decisions to make and record in the plan

| # | Decision | Default / guidance |
|---|---|---|
| D1 | Canvas library | **Fabric.js** preferred. Konva.js permitted only if the current React/Vite/TS versions create a concrete, documented integration problem. |
| D2 | Transform persistence model | Pick **one** coherent model: either `scale_x`/`scale_y`(+`rotation_deg`) **or** `artwork_width_pct`/`artwork_height_pct`(+`rotation_deg`). Do not persist both. |
| D3 | Physical size vs canvas size, which is primary | Recommended: **physical width is primary**, height auto-derives from artwork aspect ratio. |
| D4 | Garment colour rendering | Preference order: real colour-specific asset → neutral asset with safe tint/mask → existing image plus colour label. Never naive CSS filters that look obviously fake. |
| D5 | Approval model | **Prefer extending the existing order-level `ArtworkStatus`.** Only add a per-PrintSpec approval field if order-level status genuinely cannot represent multi-mockup needs. Document either way. |
| D6 | Preview persistence | Recommended **yes**: private Supabase Storage, path persisted on `print_specs`. |
| D7 | Dedicated `/orders/:id/mockups` route | Only if it materially improves usability. Embedded editor must remain sufficient for basic PrintSpec creation. |
| D8 | Rotation support | Support only if it stays intuitive. Prioritise drag/scale. Always provide Reset Rotation. |
| D9 | `src/api/mockups.ts` | Create only if it is a genuinely separate data-access responsibility. Otherwise extend `orders.ts` / `artwork.ts` / `settings.ts`. |

---

## 5. Technical requirements

### 5.1 Visual architecture

```
GARMENT IMAGE → PRINT ZONE → ARTWORK OBJECT → TRANSFORM/PLACEMENT → SAVED PRINT SPEC
```

One PrintSpec = one print location (e.g. Left Chest logo, Full Back artwork, Left Sleeve
logo). An order may hold several.

### 5.2 Print zones

Create one central config, suggested `src/config/printZones.ts`. Do not scatter
coordinates through components. Percentage-based garment coordinates only, so zones
reconstruct responsively.

Each entry defines roughly:

```ts
{ position, view, xPct, yPct, widthPct, heightPct, maxWidthPct, maxHeightPct, anchor? }
```

Reference values:

- Left Chest — x 28%, y 25%, w 20%, h 22%
- Full Front — x 20%, y 18%, w 60%, h 60%
- Full Back — equivalent back-zone configuration

### 5.3 Garment view model

Print position already determines the view. Preserve that rule; do not add independent
front/back state.

| Position | View |
|---|---|
| Left Chest, Across Chest, Full Front | Front |
| Full Back, Top Back, Bottom Back | Back |
| Sleeves | Most appropriate existing reference view |

Show clear Front / Back tabs. Switching must not lose unsaved changes.

### 5.4 Garment reference images

Existing assets have baked-in diagram markings (numbered circles, measurement boxes,
paper-form annotations). Replace with clean assets.

Priority: T-shirt, Hoody, Polo, Crew neck. Then Singlet, Hi-Viz vest, Shirt. Front and
back where appropriate.

Requirements: no annotations, consistent framing, similar canvas dimensions, clean or
transparent background, suitable for overlay.

If a clean image is unavailable for a catalog item, fall back to a polished neutral
silhouette with configurable fill colour. **Do not block Phase 3 on one obscure garment.**

Optimise assets (WebP, or optimised PNG where transparency is needed). Prefer
public/static or storage-backed delivery over bundling large sources.

### 5.5 Coordinate system

- Persist `offset_x` / `offset_y` as 0–1 or percentage, relative to the print zone/canvas.
- Persist scale or normalised width/height per **D2**.
- The saved mockup must reconstruct identically at desktop, tablet and mobile canvas sizes.

### 5.6 PrintSpec schema

Current `print_specs` already holds: `position`, `colour`, `width_mm`, `height_mm`,
`garment_type`, `garment_colour`, `artwork_id`, `offset_x`, `offset_y`.

Add only what is genuinely required. Candidates: `rotation_deg` (default 0),
`artwork_scale_x` / `artwork_scale_y` **or** `artwork_width_pct` / `artwork_height_pct`,
`preview_storage_path`. Justify each addition in the plan. Migration only if required.

### 5.7 Artwork rendering by file type

| Type | Behaviour |
|---|---|
| PNG, JPG, JPEG, WEBP, SVG | Render directly on canvas |
| PDF | Use an existing or safely generated preview image; otherwise show metadata and let staff select an alternate preview artwork |
| AI | No native Illustrator rendering. Original stays stored. Show "Original artwork stored — preview unavailable" and allow an alternate preview artwork |

Artwork selector shows thumbnail, filename, file type. Selecting updates the canvas
immediately. If artwork is removed from the order, referencing PrintSpecs must degrade
safely with no broken foreign keys.

### 5.8 Transform controls

Canvas: select, drag, resize, maintain aspect ratio, optional rotation.
Buttons: centre horizontally, centre vertically, reset position, reset size, reset
rotation, remove from this PrintSpec, replace artwork.

### 5.9 Physical dimensions

Physical width is the primary editable measurement (per **D3**); height auto-calculates
from artwork aspect ratio. Allow unlocking proportions only if necessary.

Example: intrinsic ratio 1.25, width 250mm → height 200mm. Change width to 300mm →
height becomes 240mm automatically.

Preserve presets A6, A5, A4, A3, Oversize as conveniences that populate `width_mm` /
`height_mm`. Presets are not the only valid sizes; manual adjustment must remain possible.

### 5.10 Print area warnings

If artwork exceeds the configured zone, show a **non-blocking** warning, e.g.
"Artwork extends beyond the recommended Left Chest print area." Never silently clip
production data. Staff may override.

### 5.11 Mockup Studio UI

Upgrade the existing Print Details / Mockup area. Keep the overall New Order / Edit Order
form structure. Do not turn the order form into a canvas application.

Desktop layout:

| Left panel | Centre | Right panel |
|---|---|---|
| Print location, artwork, garment, garment colour, print colour, size/measurements | Large garment canvas | Artwork transform, width/height, placement controls, warnings, reset |

Print-location tabs/cards above or below: `[ Left Chest ] [ Full Back ] [ + Add Print ]`.
Selected PrintSpec must be obvious. Each is independently editable with no state leakage.

Optional pattern: embedded compact editor plus "Open Full Mockup Studio" for detailed work.

### 5.12 Save behaviour and unsaved changes

- **Draft orders:** mockup changes may join draft autosave if safe.
- **Active orders:** explicit save only. Provide "Save Mockup Changes".
- Leaving an active order with modified mockup state warns: "You have unsaved mockup
  changes." Actions: Stay / Discard Changes / Save Changes.
- Do not interfere with draft autosave.

### 5.13 Preview generation, storage and regeneration

Generate a clean PNG from the canvas containing garment, garment colour and artwork
placement. Exclude editor chrome: no bounding boxes, print-zone guides or selection
handles.

Render at a higher internal pixel ratio than the on-screen canvas so exports are not
blurry, while keeping the editor responsive.

Store privately, e.g. `mockup-previews/orders/{orderId}/print-specs/{printSpecId}/preview.png`,
or the equivalent within the existing private storage strategy. Persist the path on
`print_specs`.

Regenerate on **explicit save** when artwork, garment, garment colour, position, size,
offset or rotation changed. **Never generate or upload on drag events.**

Optional download with names like `SP-1042-left-chest-mockup.png`.

No version history. A new preview may replace the previous one for that PrintSpec.

### 5.14 Approval and artwork status

Existing progression, to be preserved:

```
Not Started → Artwork To Do → Artwork Supplied → Need Artwork → Need Vectored
→ Mockup Required → Awaiting Approval → Approved → Completed
```

Improve the UI so staff can see the relationship between artwork, mockup and approval.
Do not duplicate status concepts (see **D5**). Allow a short approval note, e.g. "Move logo
20mm higher". Do not build a commenting platform.

### 5.15 Production workflow

- **Order Detail → Artwork & Mockups tab:** list ARTWORK FILES and MOCKUPS separately. Per
  mockup show garment, view/position, artwork, print dimensions, preview. Actions: View,
  Edit Mockup, optionally Download Preview.
- **Order Form tab (read-only):** per PrintSpec show position, garment, garment colour,
  artwork, print colour, print width, print height, plus a small preview. Production staff
  must not need the editor to understand the job.
- **Production Board Mockup column:** thumbnail, or "No Mockup", or "Awaiting Artwork".
  Clicking opens a quick preview in a modal/lightbox/drawer without navigating away. No
  editing from the board. Keep the board visually light.
- **Readiness indicator:** e.g. READY FOR PRODUCTION when conditions hold (active order,
  artwork approved/completed, garments ready/received/supplied, production not completed).
  Use indicators and warnings, never rigid blocking.
- **Attention warnings** from existing data only: due tomorrow + artwork not approved;
  same day + need artwork; urgent + garments not received. No automation engine.
- **Dashboard:** do not redesign. Optionally extend "Orders Requiring Attention" with
  mockup awaiting approval / artwork missing / print spec incomplete, only where cleanly
  supported by existing data.
- **Settings → Mockup Templates:** allow owner/admin to manage garment, view, reference
  image, active state. Support uploading/replacing a clean garment image if the existing
  storage architecture allows it safely. If upload management is disproportionately
  complex, ship seeded clean templates and keep the CRUD metadata working.

### 5.16 Data layer and caching

Extend `src/api/orders.ts`, `artwork.ts`, `settings.ts`; add `src/api/mockups.ts` only per
**D9**. Use existing TanStack Query conventions.

After a mockup save, invalidate or update only: order detail, order form values,
artwork/mockup views, production board (when thumbnail or status changed), activity where
relevant. Do not invalidate the whole app.

### 5.17 Activity

Record only explicit saved workflow changes: mockup created, mockup updated, artwork
changed, artwork approved. Use existing activity categories. **No events for drag or
resize.**

### 5.18 Errors, loading and empty states

Handle gracefully, without crashing Order Edit: canvas init failure, missing garment asset,
missing or expired signed URL, preview generation failure, preview upload failure, save
failure, invalid file reference.

Loading states: artwork previews, garment templates, mockup preview, canvas init, saving
preview. Avoid layout jumps.

Empty states with instructions: no artwork uploaded ("Upload artwork above to create a
garment mockup."), no print specs, no garment selected, no garment image, no preview.

### 5.19 Responsive and accessibility

- **Mobile (~390px):** never three side-by-side panels. Stack controls → canvas →
  transform controls → print details, or use bottom-sheet controls. Touch must support tap
  selection, drag and resize handles. No horizontal page overflow. Save must be reachable.
- **Tablet (768px):** two-column where practical, no horizontal overflow.
- **Desktop usability must not be sacrificed** to make mobile identical.
- **Accessibility:** canvas manipulation cannot be the only control mechanism. Numeric
  inputs and buttons for width, height, position reset and centring are required. Label
  controls properly.

### 5.20 Performance

Phase 2 already has a >500kB main bundle warning, partly from garment imagery. Phase 3
adds a canvas library.

- Lazy-load the Mockup Studio, the canvas library and large garment assets.
- Strongly prefer dynamic import for the dedicated mockup editor.
- The canvas engine must not load on Dashboard or Customers pages.
- Report bundle size delta at each milestone. Do not prematurely optimise everything else.

---

## 6. Milestones

Tick items as completed. Stop at each GATE.

### Milestone 1 — Architecture

- [ ] Canvas library installed and integrated in a spike
- [ ] `src/config/printZones.ts` created and populated
- [ ] Normalised transform model defined in `src/types/index.ts`
- [ ] PrintSpec schema reviewed; minimal migration added if required
- [ ] Canvas component architecture established

No major UI rewrite yet.
**Exit:** build/lint/test pass; advisors clean if a migration was added. **GATE.**

### Milestone 2 — Clean garment templates

- [ ] Highest-priority marked images replaced (T-shirt, Hoody, Polo, Crew neck)
- [ ] Reliable front/back template lookup
- [ ] Neutral silhouette fallback implemented
- [ ] Garment colour strategy working per **D4**
- [ ] Assets optimised, loading strategy in place

**Exit:** each priority garment renders clean front and back; bundle delta reported.

### Milestone 3 — Core canvas

- [ ] Garment background renders
- [ ] Artwork renders
- [ ] Selection, dragging, resizing
- [ ] Aspect-ratio preservation
- [ ] Centring and reset controls
- [ ] Normalised transforms held in frontend form state

**GATE:** demo before continuing.

### Milestone 4 — Print position and size

- [ ] Print position → print zone wiring
- [ ] Physical width/height wired to canvas per **D3**
- [ ] Preset sizes populate dimensions
- [ ] Overflow warnings (non-blocking)

### Milestone 5 — Multiple print specs

- [ ] Multiple locations, add/remove
- [ ] Switching selected PrintSpec with clear active indication
- [ ] Front/back view switching
- [ ] Independent artwork, dimensions, placement, no state leakage

### Milestone 6 — Persistence

- [ ] Transform state, dimensions, artwork association, garment, garment colour, rotation persisted
- [ ] Edit/reload reconstruction verified at three viewport sizes

**GATE:** run acceptance tests 1–6, 9, 10.

### Milestone 7 — Preview export

- [ ] Clean PNG generation, no editor chrome
- [ ] Private storage upload, path persisted
- [ ] Displayed on Order Detail, Production Board, Quick View
- [ ] Regeneration on explicit save only

### Milestone 8 — Approval workflow

- [ ] Artwork status flow improved around Mockup Required → Awaiting Approval → Approved → Completed
- [ ] Approval note support
- [ ] UI indicators, no duplicate approval system

### Milestone 9 — Production workflow polish

- [ ] Mockup thumbnails on board
- [ ] Attention warnings
- [ ] Production readiness indicator
- [ ] Quick preview modal

### Milestone 10 — Responsive and performance

- [ ] Desktop, tablet, mobile verified
- [ ] Editor code lazy-loaded; canvas absent from Dashboard/Customers bundles
- [ ] Large assets optimised
- [ ] Phase 3 performance regressions resolved

### Milestone 11 — Hardening

- [ ] `npm run build`, `npm run lint`, `npm run test` all pass
- [ ] Supabase advisors run and clean
- [ ] RLS and storage policies tested
- [ ] Full order workflow tested end to end
- [ ] `docs/PHASE_3_HANDOVER.md` written

---

## 7. Acceptance tests

Run these at Milestone 11; run the marked subset at earlier gates.

| # | Scenario | Expected |
|---|---|---|
| 1 | T-shirt, black, PNG logo, Left Chest, 100mm width | Logo on correct chest area, aspect retained, size shown, drag works, save works, refresh reconstructs identically |
| 2 | Full Back with different artwork, switch view | Back garment shown, artwork in back zone, survives save + refresh |
| 3 | Left Chest + Full Back + Left Sleeve | Independent artwork, colour, size, placement; switching causes no state leakage |
| 4 | Garment colour black → white | Mockup updates visibly, artwork stays positioned |
| 5 | T-shirt → Hoody | New template, appropriate print zone, artwork remains manageable, no canvas crash |
| 6 | Resize artwork visually | Physical dimensions stay coherent; same size after save + refresh |
| 7 | Drag beyond Left Chest zone | Warning appears, override allowed, no silent clipping |
| 8 | Generate PNG export | Clean PNG, no selection box or zone guides, correct garment/artwork/colour, stored preview survives refresh |
| 9 | Edit active order mockup | Persisted order unchanged before save; after save placement persists and activity is recorded |
| 10 | Draft with artwork/mockup, navigate away, resume | Mockup state restored; PrintSpecs survive finalisation |
| 11 | Upload `.ai` file | File stored, canvas does not crash, "preview unavailable" state is clear, alternate preview selectable |
| 12 | Mobile at ~390px | Garment visible, artwork selectable, drag/resize usable, controls accessible, no horizontal overflow, save available |
| 13 | Production Board with saved mockup | Thumbnail appears; click opens larger clean preview; no editor controls |
| 14 | Mockup Required → Awaiting Approval → Approved | Status persists, visible app-wide, activity entries created, board reflects latest state |
| 15 | Force preview generation/upload failure | Order data not lost, safe error shown, canvas still usable, retry possible |

---

## 8. Final deliverable

`docs/PHASE_3_HANDOVER.md`, covering:

1. Phase 3 overview
2. Canvas library selected and why
3. Mockup architecture
4. Print-zone model
5. Coordinate/transform model
6. PrintSpec schema changes
7. Migrations
8. Garment template architecture
9. Artwork rendering behaviour
10. Physical-size logic
11. Front/back behaviour
12. Multiple-print behaviour
13. Mockup preview generation
14. Storage path strategy
15. Approval workflow and the §D5 decision
16. Production Board changes
17. Performance changes and bundle size delta
18. Responsive behaviour
19. Tests performed (results against §7)
20. Known limitations
21. Deferred functionality
22. Recommended Phase 4 work

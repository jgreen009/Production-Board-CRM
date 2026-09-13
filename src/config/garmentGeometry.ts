import type { GarmentType, PrintPosition } from '@/types'

// Mockup System V2 Batch A — the authoritative source of truth for garment
// geometry and print-zone placement, replacing src/config/printZones.ts's
// role as the real render path's geometry provider (that file is kept only
// for its legacy percentage-based pure-math helpers/tests — see its own
// header comment — and is no longer imported by any renderer).
//
// CANONICAL COORDINATE SPACE: 1226 x 1283 units. This is not an arbitrary
// round number — it is the measured native pixel size of the current
// garment photos themselves (confirmed across 21 of the 22 assets in
// src/assets/mockups/*.png at audit time; hats-back.png is the one
// exception, harmless here since Hats carries no calibrated print zones —
// see the "unsupported" tier below). Choosing the real photo dimensions as
// the canonical space means garment geometry and print-zone geometry are
// defined in the SAME space as the source asset by construction: no
// separate normalization step can silently reintroduce an axis-independent
// stretch the way the old fixed 240x300 GARMENT_VIEW_BOX did against a
// 0.956-ratio photo (see MOCKUP_SYSTEM_V2_AUDIT.md §7-8). If a future
// asset swap changes the native photo resolution, update this constant (or
// move to per-garment viewBox overrides) rather than silently stretching.
export const CANONICAL_VIEWPORT = { width: 1226, height: 1283 } as const

// Position -> view is anatomy, not garment geometry — a chest/front
// position is always photographed/printed on the front view and a back
// position always on the back view, regardless of which of the 12 garment
// types is selected. This is intentionally separate from per-garment zone
// calibration below (§ Part 14 "front/back behavior").
export const POSITION_VIEW: Record<PrintPosition, 'Front' | 'Back'> = {
  'Left Chest': 'Front',
  'Right Chest': 'Front',
  'Across Chest': 'Front',
  'Full Front': 'Front',
  'Left Sleeve': 'Front',
  'Right Sleeve': 'Front',
  'Full Back': 'Back',
  'Top Back': 'Back',
  'Bottom Back': 'Back',
  // Non-upper-body vocabulary (headwear/bottoms) — Front/Back are literal
  // view names here, not upper-body euphemisms. Left/Right Leg and
  // Left/Right Thigh are all front-facing placements (a customer looks at
  // the front of their own legs), matching the actual garment photos,
  // which only have front/back views, no per-leg side view.
  Front: 'Front',
  Back: 'Back',
  'Left Leg': 'Front',
  'Right Leg': 'Front',
  'Left Thigh': 'Front',
  'Right Thigh': 'Front',
  // Reserved, not yet exposed by any garment's supported-position list
  // (see getSupportedPrintPositions) — no current asset has a side view to
  // render against. Mapped to 'Front' only so this Record stays total and
  // nothing crashes if ever misused; never actually reached in practice.
  'Left Side': 'Front',
  'Right Side': 'Front',
}

export function getPositionView(position: PrintPosition): 'Front' | 'Back' {
  return POSITION_VIEW[position]
}

// Replaces PRINT_ZONES as the UI's "full vocabulary of position names" list
// (label only — geometry now comes from resolvePrintZone, which is
// garment-specific). Order matches the original printZones.ts ordering so
// existing UI layout (position buttons) doesn't visually reshuffle.
// The new entries' relative order is deliberate, not cosmetic:
// getSupportedPrintPositions() filters this list down to one garment's
// valid positions while preserving order, and the FIRST surviving entry
// becomes that garment's default position (see its own doc comment). This
// single ordering has to produce the right default for every garment at
// once — Front before Back (Beanie/Hats default to Front), Left Thigh
// before Left Leg (Pants defaults to Left Thigh, not its lower-leg
// position), and Back last of all (every garment that has a Back option
// treats it as a fallback, never the default).
export const ALL_PRINT_POSITIONS: { position: PrintPosition; label: string }[] = [
  { position: 'Left Chest', label: 'Left Chest' },
  { position: 'Right Chest', label: 'Right Chest' },
  { position: 'Across Chest', label: 'Across Chest' },
  { position: 'Full Front', label: 'Full Front' },
  { position: 'Left Sleeve', label: 'Left Sleeve' },
  { position: 'Right Sleeve', label: 'Right Sleeve' },
  { position: 'Full Back', label: 'Full Back' },
  { position: 'Top Back', label: 'Top Back' },
  { position: 'Bottom Back', label: 'Bottom Back' },
  { position: 'Front', label: 'Front' },
  { position: 'Left Side', label: 'Left Side' },
  { position: 'Right Side', label: 'Right Side' },
  { position: 'Left Thigh', label: 'Left Thigh' },
  { position: 'Right Thigh', label: 'Right Thigh' },
  { position: 'Left Leg', label: 'Left Leg' },
  { position: 'Right Leg', label: 'Right Leg' },
  { position: 'Back', label: 'Back' },
]

export type GarmentCalibrationTier = 'calibrated' | 'fallback' | 'unsupported'

// Batch B §"Visual calibration method" — how each view's zone numbers were
// actually produced, recorded explicitly rather than left to be assumed.
// 'verified': the real garment photo (src/assets/mockups/*.png) was opened
// and visually inspected, and the zone coordinates below were read off
// landmarks in that specific image. 'inferred': reasoned from a related
// verified view (e.g. a garment's own front photo, or another garment's
// verified view) without opening this exact image. 'unverified': not yet
// checked against any image at all. No garment/view in this file is
// 'unverified' as of Batch B — see CALIBRATION_CONFIDENCE below for the
// per-view breakdown and the Batch B handover doc for the full reasoning.
export type CalibrationConfidence = 'verified' | 'inferred' | 'unverified'

// A print zone's box + anchor + physical reference, all in canonical units
// (not percentages — percentages were the old model's own source of
// ambiguity, since "percentage of what, measured how" was never pinned to
// one coordinate space). anchorX/anchorY is where artwork is deterministically
// centered (Part 6) — normally the box's own center, but kept as an
// explicit field rather than always-derived so a future zone can anchor
// off-center within its box if a real calibration ever needs that.
export interface GarmentPrintZone {
  x: number
  y: number
  width: number
  height: number
  anchorX: number
  anchorY: number
  /** Real-world width this zone's canonical `width` represents, in mm — the sole mm<->canonical-unit calibration (Part 7). */
  refWidthMm: number
  defaultWidthMm?: number
  maxWidthMm?: number
  maxHeightMm?: number
}

export interface GarmentViewGeometry {
  viewBox: { width: number; height: number }
  /** The garment silhouette's own bounding box within viewBox — mostly informational/future-use (e.g. cropping) since these raster photos already fill nearly the whole canonical canvas; see calibration notes below. */
  garmentBounds: { x: number; y: number; width: number; height: number }
  printZones: Partial<Record<PrintPosition, GarmentPrintZone>>
}

export interface GarmentGeometry {
  garmentType: GarmentType
  tier: GarmentCalibrationTier
  views: {
    front?: GarmentViewGeometry
    back?: GarmentViewGeometry
  }
}

function zone(
  x: number,
  y: number,
  width: number,
  height: number,
  refWidthMm: number,
  extra?: Partial<Pick<GarmentPrintZone, 'defaultWidthMm' | 'maxWidthMm' | 'maxHeightMm'>>,
): GarmentPrintZone {
  return { x, y, width, height, anchorX: x + width / 2, anchorY: y + height / 2, refWidthMm, ...extra }
}

// Silhouette bounds shared by every torso-family garment view calibrated
// below — visually estimated from the actual technical-flat photos (collar
// near the very top, hem near the very bottom, sleeves spanning almost the
// full width). See "Visual QA status" in the Batch A handover doc: this is
// a best-effort visual read of the source art, not a pixel-measured crop.
const TORSO_GARMENT_BOUNDS = { x: 25, y: 38, width: 1177, height: 1180 }

// ---------------------------------------------------------------------
// PRIORITY GARMENT CALIBRATION (Batch A §Part 4) — T-shirt, Hoody, Polo,
// Crew neck (jumper). Values below are canonical-unit boxes derived from a
// direct visual read of src/assets/mockups/{type}-{view}.png (1226x1283),
// converted from percentage estimates of collar/hem/sleeve/torso landmarks
// in each photo. They are a deliberate, documented best-effort calibration,
// not a pixel-measured ground truth — see the handover doc's "Visual QA
// status" section for exactly what was and wasn't verified in a browser.
// ---------------------------------------------------------------------

const TSHIRT_FRONT: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  printZones: {
    // Post-Batch-C neck-clearance patch (human visual QA): Left/Right
    // Chest and Across Chest sat too close to the crew neckline. Shifted
    // down only (y += 35/37 canonical units, ~2.7-2.9% of viewBox height)
    // — x, width, height, and refWidthMm all unchanged, so physical size
    // and horizontal position are untouched; only vertical breathing room
    // below the collar increased. See the neck-clearance patch handover
    // for the full before/after table.
    'Left Chest': zone(368, 292, 147, 154, 130),
    'Right Chest': zone(711, 292, 147, 154, 130),
    'Across Chest': zone(307, 268, 613, 180, 300),
    'Full Front': zone(294, 282, 637, 770, 320),
    'Left Sleeve': zone(49, 231, 172, 205, 80),
    'Right Sleeve': zone(1005, 231, 172, 205, 80),
  },
}

const TSHIRT_BACK: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  printZones: {
    // Post-Batch-C neck-clearance patch: Top Back sat too close to the
    // rear neckline — shifted down (y += 35, ~2.7% of viewBox height),
    // height unchanged so it doesn't creep toward Full Back's territory.
    'Top Back': zone(368, 215, 490, 180, 280),
    'Full Back': zone(294, 282, 637, 770, 320),
    'Bottom Back': zone(343, 706, 539, 385, 280),
  },
}

const HOODY_FRONT: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  printZones: {
    // Chest band sits lower than a T-shirt's — the hood/collar and
    // drawstrings occupy more vertical space at the top of the garment.
    // Post-Batch-C neck-clearance patch: nudged down a further +24/+22
    // canonical units (smaller than T-shirt's correction since Hoody
    // already had extra clearance built in for the hood/drawstrings).
    'Left Chest': zone(368, 358, 147, 154, 130),
    'Right Chest': zone(711, 358, 147, 154, 130),
    'Across Chest': zone(307, 330, 613, 180, 300),
    // Bounded above the kangaroo pocket (~62% down) rather than reusing
    // the T-shirt's full-hem-to-collar box.
    'Full Front': zone(294, 308, 637, 462, 320),
    'Left Sleeve': zone(49, 282, 172, 205, 80),
    'Right Sleeve': zone(1005, 282, 172, 205, 80),
  },
}

const HOODY_BACK: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  printZones: {
    // Batch B: verified against hoody-back.png directly — the hood drapes
    // down the back as a pointed flap reaching to roughly 29% of the
    // image height at center, materially further down than a T-shirt's
    // plain collar. Top Back is pushed well below that flap's tip (was
    // y=205/16% in Batch A, an inferred guess — now y=380/29.6%, read
    // directly off the photo) rather than a small generic nudge.
    // Post-Batch-C neck-clearance patch: a further +20 canonical units for
    // extra margin below the hood flap (smaller correction than T-shirt's
    // — the hood-flap clearance already did most of the work in Batch B).
    'Top Back': zone(368, 400, 490, 150, 280),
    // Full Back's top edge is similarly dropped below the hood flap so a
    // large back print doesn't appear to start underneath the hood
    // illustration; bottom edge unchanged (hem is unaffected by the hood).
    // Not touched by this patch — human QA flagged Top Back, not Full Back.
    'Full Back': zone(294, 340, 637, 712, 320),
    'Bottom Back': zone(343, 706, 539, 385, 280),
  },
}

const POLO_FRONT: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  printZones: {
    // Post-Batch-C neck-clearance patch: Left/Right Chest pushed down the
    // most of any priority garment (+41 canonical units) — the collar AND
    // placket together create a materially larger restricted region than
    // a plain crew neckline, per human QA's own note that Polo needs more
    // clearance than T-shirt/Crew neck.
    'Left Chest': zone(368, 298, 147, 154, 130),
    'Right Chest': zone(711, 298, 147, 154, 130),
    // Already lower/shorter than the T-shirt's Across Chest to clear the
    // Polo's larger structured collar — smaller further correction here
    // (+21) since some clearance was already built in.
    'Across Chest': zone(307, 278, 613, 180, 300),
    'Full Front': zone(294, 282, 637, 770, 320),
    'Left Sleeve': zone(49, 231, 172, 205, 80),
    'Right Sleeve': zone(1005, 231, 172, 205, 80),
  },
}

const POLO_BACK: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  // Batch B: verified directly against polo-back.png, not inherited
  // blindly. The photo's back panel — collar height, shoulder line, torso
  // width, hem position — reads as visually identical to the T-shirt's
  // back panel (same raglan-seam short-sleeve torso silhouette); the
  // T-shirt's numbers are reproduced explicitly below (not referenced by
  // object identity) so this is its own independently-confirmed
  // calibration, not an alias that would silently drift if T-shirt's
  // values are ever recalibrated for a T-shirt-specific reason.
  printZones: {
    // Post-Batch-C neck-clearance patch: +38 canonical units, comparable
    // to Left/Right Chest's correction above — the structured collar
    // extends around to the back panel too, not just the front placket.
    'Top Back': zone(368, 218, 490, 180, 280),
    'Full Back': zone(294, 282, 637, 770, 320),
    'Bottom Back': zone(343, 706, 539, 385, 280),
  },
}

const CREW_NECK_FRONT: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  printZones: {
    // Post-Batch-C neck-clearance patch: +31/+27 canonical units — the
    // crew collar plus the dropped-shoulder line (see the sleeve note
    // below) meant this needed a bit more room than a standard T-shirt.
    'Left Chest': zone(368, 288, 147, 154, 130),
    'Right Chest': zone(711, 288, 147, 154, 130),
    'Across Chest': zone(307, 258, 613, 180, 300),
    'Full Front': zone(294, 282, 637, 770, 320),
    // Long sleeve — print sits on the upper arm, slightly lower band than
    // a short T-shirt sleeve's cuff-adjacent spot.
    'Left Sleeve': zone(49, 257, 172, 205, 80),
    'Right Sleeve': zone(1005, 257, 172, 205, 80),
  },
}

const CREW_NECK_BACK: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  // Batch B: verified directly against crew-neck-back.png, not inherited
  // blindly. Same reasoning as Polo's back above — the photo's raglan
  // seams, collar height, torso width, and ribbed hem line up with the
  // T-shirt's back panel closely enough that no different numbers are
  // warranted; reproduced explicitly (not aliased) for the same
  // independent-drift-safety reason.
  printZones: {
    // Post-Batch-C neck-clearance patch: +32 canonical units below the
    // rear crew collar.
    'Top Back': zone(368, 212, 490, 180, 280),
    'Full Back': zone(294, 282, 637, 770, 320),
    'Bottom Back': zone(343, 706, 539, 385, 280),
  },
}

// ---------------------------------------------------------------------
// FALLBACK TIER (Batch A §Part 4/16) — torso-shaped garments where the
// upper-body position vocabulary is anatomically valid but no dedicated
// per-garment calibration pass has been done yet. Reuses the T-shirt's
// calibrated zones rather than guessing new numbers or falling back to the
// old global table — an explicit, documented placeholder, not a silent
// unrelated distortion. Singlet's old ad hoc `verticalOffsetPct: 9`
// (garmentTemplates.ts) is superseded here, not migrated: that nudge was
// largely compensating for the independent-axis photo stretch this batch
// removes (audit §8.1) plus the old global zone table's own generic
// positioning — with both root causes fixed, reusing the T-shirt's
// properly-proportioned fallback zones is a better starting point than
// carrying the old nudge forward onto a now-different geometry model.
// ---------------------------------------------------------------------

const FALLBACK_TORSO_FRONT: GarmentViewGeometry = TSHIRT_FRONT
const FALLBACK_TORSO_BACK: GarmentViewGeometry = TSHIRT_BACK

// ---------------------------------------------------------------------
// NON-UPPER-BODY CALIBRATION — Bennie, Hats, Shorts, Pants. The old
// upper-body vocabulary (Left Chest, Full Front, sleeves...) never applied
// to these four; rather than continuing to mark them fully unsupported
// (the old code even hid the mockup entirely — see this file's git
// history), each gets its own real position vocabulary and calibrated
// zones below, visually read off the actual technical-flat photos exactly
// like the priority upper-body garments were. See
// docs/MOCKUP_V2_NON_UPPER_BODY_HANDOVER.md for the full reasoning and the
// asset limitations (no side-view art exists for Hats, so Left/Right Side
// are reserved vocabulary but not exposed — see getSupportedPrintPositions).
// ---------------------------------------------------------------------

// Beanie/Hat photos are both full-canvas headwear illustrations (crown +
// brim/cuff) — visually estimated bounds, same "best-effort read of the
// source art" caveat as every other garmentBounds in this file.
const HEADWEAR_GARMENT_BOUNDS = { x: 60, y: 100, width: 1100, height: 950 }

const BENNIE_FRONT: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: HEADWEAR_GARMENT_BOUNDS,
  printZones: {
    // The only realistic beanie print location is a small centered patch
    // on the folded cuff — verified against bennie-front.png: the cuff
    // band spans roughly y 55%-84% of the image; a patch is centered
    // within that band, not stretched across its full height, so it
    // reads as a small embroidered patch rather than a full-cuff wrap.
    Front: zone(368, 790, 490, 220, 90, { maxWidthMm: 100 }),
  },
}

const BENNIE_BACK: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: HEADWEAR_GARMENT_BOUNDS,
  printZones: {
    // bennie-back.png reads as visually identical to the front (the flat
    // sketch shows no distinguishing rear feature — no seam, no tag), so
    // this reuses the front cuff-patch position rather than inventing an
    // unverifiable difference; see CALIBRATION_CONFIDENCE ('inferred' for
    // back, 'verified' for front).
    Back: zone(368, 790, 490, 220, 90, { maxWidthMm: 100 }),
  },
}

const HATS_FRONT: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: HEADWEAR_GARMENT_BOUNDS,
  printZones: {
    // Verified against hats-front.png: the crown panel between the top
    // seam junction and the brim's back edge, centered between the two
    // eyelets — a standard embroidered front-crown logo position.
    Front: zone(380, 280, 466, 280, 90, { maxWidthMm: 100 }),
  },
}

const HATS_BACK: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: HEADWEAR_GARMENT_BOUNDS,
  printZones: {
    // Verified against hats-back.png: the back crown panel above the
    // adjustable strap, between the two eyelets — same proportions as the
    // front crown since the panel shape is symmetric.
    Back: zone(380, 280, 466, 280, 90, { maxWidthMm: 100 }),
  },
}

// Shorts/Pants photos are similarly near-full-canvas garment
// illustrations — visually estimated bounds.
const SHORTS_GARMENT_BOUNDS = { x: 60, y: 140, width: 1100, height: 1000 }
const PANTS_GARMENT_BOUNDS = { x: 150, y: 30, width: 900, height: 1220 }

const SHORTS_FRONT: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: SHORTS_GARMENT_BOUNDS,
  printZones: {
    // Verified against shorts-front.png: a small logo box on the lower
    // half of each leg panel, below the pocket seam lines and above the
    // hem — the conventional spot for a one-leg sports-shorts print.
    'Left Leg': zone(150, 500, 300, 350, 90),
    'Right Leg': zone(776, 500, 300, 350, 90),
  },
}

const SHORTS_BACK: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: SHORTS_GARMENT_BOUNDS,
  printZones: {
    // Verified against shorts-back.png: a centered seat-area box below
    // the waistband and above where the center-back seam forks into the
    // two legs.
    Back: zone(343, 200, 540, 350, 250),
  },
}

const PANTS_FRONT: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: PANTS_GARMENT_BOUNDS,
  printZones: {
    // Verified against pants-front.png: each leg panel's upper "thigh"
    // band, below the diagonal pocket bag and belt loops.
    'Left Thigh': zone(230, 350, 280, 280, 90),
    'Right Thigh': zone(716, 350, 280, 280, 90),
    // Lower-leg band, same leg panels, well above the hem.
    'Left Leg': zone(230, 850, 280, 300, 90),
    'Right Leg': zone(716, 850, 280, 300, 90),
  },
}

const PANTS_BACK: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: PANTS_GARMENT_BOUNDS,
  printZones: {
    // Verified against pants-back.png: a centered band spanning both back
    // pockets, below the waistband yoke seam.
    Back: zone(310, 140, 605, 280, 280),
  },
}

// ---------------------------------------------------------------------
// UNSUPPORTED TIER — kept as a mechanism (not currently used by any of
// the 12 catalog garment types, now that Bennie/Hats/Shorts/Pants all
// have real calibrated geometry above) for a future garment type that
// genuinely has no usable asset/vocabulary yet. `isPrintPositionSupported`
// and the renderers already handle an empty `printZones` object safely —
// see MOCKUP_SYSTEM_V2_AUDIT.md/BATCH_A_HANDOVER.md for the original
// "do not fake placement" reasoning that still applies whenever this is
// used.
// ---------------------------------------------------------------------

const UNSUPPORTED_VIEW: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  printZones: {},
}

export const GARMENT_GEOMETRY: Record<GarmentType, GarmentGeometry> = {
  'T-shirt': { garmentType: 'T-shirt', tier: 'calibrated', views: { front: TSHIRT_FRONT, back: TSHIRT_BACK } },
  Hoody: { garmentType: 'Hoody', tier: 'calibrated', views: { front: HOODY_FRONT, back: HOODY_BACK } },
  Polo: { garmentType: 'Polo', tier: 'calibrated', views: { front: POLO_FRONT, back: POLO_BACK } },
  'Crew neck (jumper)': {
    garmentType: 'Crew neck (jumper)',
    tier: 'calibrated',
    views: { front: CREW_NECK_FRONT, back: CREW_NECK_BACK },
  },
  Shirt: { garmentType: 'Shirt', tier: 'fallback', views: { front: FALLBACK_TORSO_FRONT, back: FALLBACK_TORSO_BACK } },
  'Hi-Viz vest': {
    garmentType: 'Hi-Viz vest',
    tier: 'fallback',
    views: { front: FALLBACK_TORSO_FRONT, back: FALLBACK_TORSO_BACK },
  },
  Singlet: {
    garmentType: 'Singlet',
    tier: 'fallback',
    views: { front: FALLBACK_TORSO_FRONT, back: FALLBACK_TORSO_BACK },
  },
  Customized: {
    garmentType: 'Customized',
    tier: 'fallback',
    views: { front: FALLBACK_TORSO_FRONT, back: FALLBACK_TORSO_BACK },
  },
  Shorts: { garmentType: 'Shorts', tier: 'calibrated', views: { front: SHORTS_FRONT, back: SHORTS_BACK } },
  Pants: { garmentType: 'Pants', tier: 'calibrated', views: { front: PANTS_FRONT, back: PANTS_BACK } },
  Bennie: { garmentType: 'Bennie', tier: 'calibrated', views: { front: BENNIE_FRONT, back: BENNIE_BACK } },
  Hats: { garmentType: 'Hats', tier: 'calibrated', views: { front: HATS_FRONT, back: HATS_BACK } },
}

// Batch B calibration-confidence record, per garment/view — see
// CalibrationConfidence's own doc comment for what each level means, and
// the Batch B handover doc for the reasoning behind each entry. Priority
// garments only; fallback/unsupported tiers don't carry their own
// calibration (fallback reuses T-shirt's, unsupported has none).
export const CALIBRATION_CONFIDENCE: Partial<
  Record<GarmentType, { front: CalibrationConfidence; back: CalibrationConfidence }>
> = {
  'T-shirt': { front: 'verified', back: 'verified' },
  Hoody: { front: 'verified', back: 'verified' },
  Polo: { front: 'verified', back: 'verified' },
  'Crew neck (jumper)': { front: 'verified', back: 'verified' },
  // Non-upper-body calibration: Front views (Bennie/Hats) and both views
  // of Shorts/Pants were each read directly off their own photo. Bennie's
  // Back is 'inferred' — the flat sketch shows no rear-distinguishing
  // feature, so it deliberately reuses the front cuff-patch position
  // rather than an independently-verified different one (see BENNIE_BACK's
  // comment). Hats' Back was verified against its own photo (which does
  // have a distinguishing strap/buckle feature), so it's 'verified' too.
  Bennie: { front: 'verified', back: 'inferred' },
  Hats: { front: 'verified', back: 'verified' },
  Shorts: { front: 'verified', back: 'verified' },
  Pants: { front: 'verified', back: 'verified' },
}

export function getCalibrationConfidence(
  type: GarmentType,
  view: 'Front' | 'Back',
): CalibrationConfidence {
  const entry = CALIBRATION_CONFIDENCE[type]
  if (!entry) return 'unverified'
  return view === 'Front' ? entry.front : entry.back
}

export function getGarmentGeometry(type: GarmentType): GarmentGeometry {
  return GARMENT_GEOMETRY[type] ?? GARMENT_GEOMETRY.Customized
}

export function resolveGarmentGeometry(type: GarmentType, view: 'Front' | 'Back'): GarmentViewGeometry {
  const geometry = getGarmentGeometry(type)
  const viewGeometry = view === 'Front' ? geometry.views.front : geometry.views.back
  return viewGeometry ?? geometry.views.front ?? UNSUPPORTED_VIEW
}

export function resolvePrintZone(
  type: GarmentType,
  view: 'Front' | 'Back',
  position: PrintPosition,
): GarmentPrintZone | undefined {
  return resolveGarmentGeometry(type, view).printZones[position]
}

// The one centralized source of truth for "which print positions make
// sense on this garment" — derived directly from the garment's own
// calibrated zones (front + back), never a hand-maintained parallel list
// that could drift from the actual geometry. Order matters: it's
// ALL_PRINT_POSITIONS' own order with everything not on this garment
// filtered out, which is what makes the first surviving entry the right
// default for every garment at once — see ALL_PRINT_POSITIONS' own doc
// comment for the exact ordering reasoning.
export function getSupportedPrintPositions(type: GarmentType): { position: PrintPosition; label: string }[] {
  const geometry = getGarmentGeometry(type)
  const frontPositions = geometry.views.front ? (Object.keys(geometry.views.front.printZones) as PrintPosition[]) : []
  const backPositions = geometry.views.back ? (Object.keys(geometry.views.back.printZones) as PrintPosition[]) : []
  const supported = new Set<PrintPosition>([...frontPositions, ...backPositions])
  return ALL_PRINT_POSITIONS.filter((p) => supported.has(p.position))
}

// The garment's own default position — the first entry in its supported
// list (see getSupportedPrintPositions' doc comment for why that's always
// the right one), or undefined for a garment with no supported positions
// at all (the 'unsupported' tier, not currently used by any real garment).
export function getDefaultPrintPosition(type: GarmentType): PrintPosition | undefined {
  return getSupportedPrintPositions(type)[0]?.position
}

// Pure garment/position compatibility check (Batch A §Part 16) — used by
// the UI to disable/flag invalid combinations instead of silently
// rendering a fabricated placement for them. Equivalent to (but simpler
// than) checking membership in getSupportedPrintPositions(type).
export function isPrintPositionSupported(type: GarmentType, position: PrintPosition): boolean {
  const view = getPositionView(position)
  return !!resolvePrintZone(type, view, position)
}

export function getGarmentCalibrationTier(type: GarmentType): GarmentCalibrationTier {
  return getGarmentGeometry(type).tier
}

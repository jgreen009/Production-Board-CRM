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
}

export function getPositionView(position: PrintPosition): 'Front' | 'Back' {
  return POSITION_VIEW[position]
}

// Replaces PRINT_ZONES as the UI's "full vocabulary of position names" list
// (label only — geometry now comes from resolvePrintZone, which is
// garment-specific). Order matches the original printZones.ts ordering so
// existing UI layout (position buttons) doesn't visually reshuffle.
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
    'Left Chest': zone(368, 257, 147, 154, 130),
    'Right Chest': zone(711, 257, 147, 154, 130),
    'Across Chest': zone(307, 231, 613, 180, 300),
    'Full Front': zone(294, 282, 637, 770, 320),
    'Left Sleeve': zone(49, 231, 172, 205, 80),
    'Right Sleeve': zone(1005, 231, 172, 205, 80),
  },
}

const TSHIRT_BACK: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  printZones: {
    'Top Back': zone(368, 180, 490, 180, 280),
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
    'Left Chest': zone(368, 334, 147, 154, 130),
    'Right Chest': zone(711, 334, 147, 154, 130),
    'Across Chest': zone(307, 308, 613, 180, 300),
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
    'Top Back': zone(368, 380, 490, 150, 280),
    // Full Back's top edge is similarly dropped below the hood flap so a
    // large back print doesn't appear to start underneath the hood
    // illustration; bottom edge unchanged (hem is unaffected by the hood).
    'Full Back': zone(294, 340, 637, 712, 320),
    'Bottom Back': zone(343, 706, 539, 385, 280),
  },
}

const POLO_FRONT: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  printZones: {
    'Left Chest': zone(368, 257, 147, 154, 130),
    'Right Chest': zone(711, 257, 147, 154, 130),
    // Slightly lower/shorter than the T-shirt's Across Chest to clear the
    // Polo's larger structured collar.
    'Across Chest': zone(307, 257, 613, 180, 300),
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
    'Top Back': zone(368, 180, 490, 180, 280),
    'Full Back': zone(294, 282, 637, 770, 320),
    'Bottom Back': zone(343, 706, 539, 385, 280),
  },
}

const CREW_NECK_FRONT: GarmentViewGeometry = {
  viewBox: CANONICAL_VIEWPORT,
  garmentBounds: TORSO_GARMENT_BOUNDS,
  printZones: {
    'Left Chest': zone(368, 257, 147, 154, 130),
    'Right Chest': zone(711, 257, 147, 154, 130),
    'Across Chest': zone(307, 231, 613, 180, 300),
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
    'Top Back': zone(368, 180, 490, 180, 280),
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
// UNSUPPORTED TIER (Batch A §Part 16) — the current 9-position vocabulary
// (Left/Right Chest, Across Chest, Full Front, sleeves, back positions) is
// upper-body apparel language. It does not describe a real location on
// Shorts, Pants, or headwear (Bennie/Hats) — a "Left Chest" on a beanie is
// not a real thing. The old code already tacitly admitted this for
// Bennie/Hats via `printAnchorOverride` (garmentTemplates.ts), which
// mapped every one of the 9 positions onto one fixed point regardless of
// which was actually selected — exactly the "fake placement" this batch is
// told not to do. V2 marks all four of these types as having NO calibrated
// zones for the current vocabulary at all; `isPrintPositionSupported`
// returns false for them, and the renderers show the garment alone with an
// explicit "not supported" state rather than guessing a point. Proper
// support needs its own headwear/bottoms-specific position vocabulary —
// documented here as deferred domain work, not solved in this batch.
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
  Shorts: { garmentType: 'Shorts', tier: 'unsupported', views: { front: UNSUPPORTED_VIEW, back: UNSUPPORTED_VIEW } },
  Pants: { garmentType: 'Pants', tier: 'unsupported', views: { front: UNSUPPORTED_VIEW, back: UNSUPPORTED_VIEW } },
  Bennie: { garmentType: 'Bennie', tier: 'unsupported', views: { front: UNSUPPORTED_VIEW, back: UNSUPPORTED_VIEW } },
  Hats: { garmentType: 'Hats', tier: 'unsupported', views: { front: UNSUPPORTED_VIEW, back: UNSUPPORTED_VIEW } },
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

// Pure garment/position compatibility check (Batch A §Part 16) — used by
// the UI to disable/flag invalid combinations instead of silently
// rendering a fabricated placement for them.
export function isPrintPositionSupported(type: GarmentType, position: PrintPosition): boolean {
  const view = getPositionView(position)
  return !!resolvePrintZone(type, view, position)
}

export function getGarmentCalibrationTier(type: GarmentType): GarmentCalibrationTier {
  return getGarmentGeometry(type).tier
}

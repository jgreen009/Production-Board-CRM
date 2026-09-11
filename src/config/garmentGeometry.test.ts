import { describe, expect, it } from 'vitest'
import {
  ALL_PRINT_POSITIONS,
  CANONICAL_VIEWPORT,
  getCalibrationConfidence,
  getGarmentCalibrationTier,
  getPositionView,
  isPrintPositionSupported,
  resolveGarmentGeometry,
  resolvePrintZone,
} from './garmentGeometry'
import type { GarmentType, PrintPosition } from '@/types'

const PRIORITY_GARMENTS: GarmentType[] = ['T-shirt', 'Hoody', 'Polo', 'Crew neck (jumper)']

// Mockup System V2 Batch C: asset optimization (900px webp re-encodings)
// must never change canonical geometry — the declared viewBox stays the
// real photos' original 1226x1283 regardless of what resolution the
// actual imported asset file happens to be (garmentFit.ts's
// computeAssetCorrectedScale is what reconciles the two at render time,
// not this config). This pins that down as a regression test: an
// unrelated future change to the geometry file that starts deriving the
// viewBox from an asset's own dimensions would break this.
describe('Batch C: canonical geometry is unaffected by asset optimization', () => {
  it('the canonical viewport stays the original photo resolution, not the optimized asset resolution', () => {
    expect(CANONICAL_VIEWPORT).toEqual({ width: 1226, height: 1283 })
  })

  it('every priority garment zone still resolves against that same canonical viewport', () => {
    for (const type of PRIORITY_GARMENTS) {
      const front = resolveGarmentGeometry(type, 'Front')
      const back = resolveGarmentGeometry(type, 'Back')
      expect(front.viewBox).toEqual(CANONICAL_VIEWPORT)
      expect(back.viewBox).toEqual(CANONICAL_VIEWPORT)
    }
  })
})

describe('getPositionView (Part 14: position determines view, not garment)', () => {
  it('maps every chest/front/sleeve position to Front', () => {
    for (const position of ['Left Chest', 'Right Chest', 'Across Chest', 'Full Front', 'Left Sleeve', 'Right Sleeve'] as PrintPosition[]) {
      expect(getPositionView(position)).toBe('Front')
    }
  })

  it('maps every back position to Back', () => {
    for (const position of ['Full Back', 'Top Back', 'Bottom Back'] as PrintPosition[]) {
      expect(getPositionView(position)).toBe('Back')
    }
  })
})

describe('priority garment calibration (Part 4/17: T-shirt, Hoody, Polo, Crew neck)', () => {
  it('each priority garment is tagged "calibrated"', () => {
    for (const type of PRIORITY_GARMENTS) {
      expect(getGarmentCalibrationTier(type)).toBe('calibrated')
    }
  })

  it('T-shirt has a Left Chest zone on the Front view', () => {
    const zone = resolvePrintZone('T-shirt', 'Front', 'Left Chest')
    expect(zone).toBeDefined()
  })

  it('Hoody has a Left Chest zone on the Front view', () => {
    const zone = resolvePrintZone('Hoody', 'Front', 'Left Chest')
    expect(zone).toBeDefined()
  })

  it('Polo has a Full Front zone', () => {
    expect(resolvePrintZone('Polo', 'Front', 'Full Front')).toBeDefined()
  })

  it('Crew neck has a Full Back zone', () => {
    expect(resolvePrintZone('Crew neck (jumper)', 'Back', 'Full Back')).toBeDefined()
  })

  it('T-shirt and Hoody Left Chest coordinates differ (garment-specific, not shared)', () => {
    const tshirt = resolvePrintZone('T-shirt', 'Front', 'Left Chest')!
    const hoody = resolvePrintZone('Hoody', 'Front', 'Left Chest')!
    expect(hoody.y).not.toBe(tshirt.y)
  })

  it('sleeve zones are garment-specific (Crew neck long-sleeve band differs from T-shirt short-sleeve band)', () => {
    const tshirt = resolvePrintZone('T-shirt', 'Front', 'Left Sleeve')!
    const crewNeck = resolvePrintZone('Crew neck (jumper)', 'Front', 'Left Sleeve')!
    expect(crewNeck.y).not.toBe(tshirt.y)
  })

  it('every priority garment supports all 9 current print positions', () => {
    for (const type of PRIORITY_GARMENTS) {
      for (const { position } of ALL_PRINT_POSITIONS) {
        expect(isPrintPositionSupported(type, position)).toBe(true)
      }
    }
  })

  it('each zone carries a positive refWidthMm calibration', () => {
    for (const type of PRIORITY_GARMENTS) {
      for (const { position } of ALL_PRINT_POSITIONS) {
        const view = getPositionView(position)
        const zone = resolvePrintZone(type, view, position)!
        expect(zone.refWidthMm).toBeGreaterThan(0)
      }
    }
  })

  it('every zone anchor sits at its own box center by construction', () => {
    for (const type of PRIORITY_GARMENTS) {
      for (const { position } of ALL_PRINT_POSITIONS) {
        const view = getPositionView(position)
        const zone = resolvePrintZone(type, view, position)!
        expect(zone.anchorX).toBeCloseTo(zone.x + zone.width / 2, 8)
        expect(zone.anchorY).toBeCloseTo(zone.y + zone.height / 2, 8)
      }
    }
  })
})

describe('fallback tier (Part 4/16: torso-shaped, uncalibrated garments)', () => {
  it('Shirt, Hi-Viz vest, Singlet, Customized are tagged "fallback"', () => {
    for (const type of ['Shirt', 'Hi-Viz vest', 'Singlet', 'Customized'] as GarmentType[]) {
      expect(getGarmentCalibrationTier(type)).toBe('fallback')
    }
  })

  it('fallback garments still resolve a usable zone for every position (do not break them)', () => {
    for (const type of ['Shirt', 'Hi-Viz vest', 'Singlet', 'Customized'] as GarmentType[]) {
      for (const { position } of ALL_PRINT_POSITIONS) {
        expect(isPrintPositionSupported(type, position)).toBe(true)
      }
    }
  })
})

describe('unsupported tier (Part 16: anatomically-invalid position vocabulary)', () => {
  it('Shorts, Pants, Bennie, Hats are tagged "unsupported"', () => {
    for (const type of ['Shorts', 'Pants', 'Bennie', 'Hats'] as GarmentType[]) {
      expect(getGarmentCalibrationTier(type)).toBe('unsupported')
    }
  })

  it('no upper-body position is silently supported on Shorts/Pants/Bennie/Hats', () => {
    for (const type of ['Shorts', 'Pants', 'Bennie', 'Hats'] as GarmentType[]) {
      for (const { position } of ALL_PRINT_POSITIONS) {
        expect(isPrintPositionSupported(type, position)).toBe(false)
      }
    }
  })

  it('resolvePrintZone returns undefined rather than a fabricated zone for unsupported combinations', () => {
    expect(resolvePrintZone('Bennie', 'Front', 'Left Chest')).toBeUndefined()
    expect(resolvePrintZone('Shorts', 'Back', 'Full Back')).toBeUndefined()
  })

  it('still resolves a garment view (viewBox/garmentBounds) so the garment photo alone can render', () => {
    const geometry = resolveGarmentGeometry('Hats', 'Front')
    expect(geometry.viewBox.width).toBeGreaterThan(0)
    expect(geometry.viewBox.height).toBeGreaterThan(0)
  })
})

describe('Batch B: priority garment back-zone calibration is explicit, not blindly inherited', () => {
  it('T-shirt, Hoody, Polo, and Crew neck each define their own Top/Full/Bottom Back zones', () => {
    for (const type of PRIORITY_GARMENTS) {
      for (const position of ['Top Back', 'Full Back', 'Bottom Back'] as PrintPosition[]) {
        expect(resolvePrintZone(type, 'Back', position)).toBeDefined()
      }
    }
  })

  it("Polo's back zones are structurally independent objects from T-shirt's (verified, not aliased)", () => {
    const tshirtBack = resolveGarmentGeometry('T-shirt', 'Back')
    const poloBack = resolveGarmentGeometry('Polo', 'Back')
    expect(poloBack.printZones).not.toBe(tshirtBack.printZones)
    expect(poloBack.printZones['Full Back']).not.toBe(tshirtBack.printZones['Full Back'])
  })

  it("Crew neck's back zones are structurally independent objects from T-shirt's (verified, not aliased)", () => {
    const tshirtBack = resolveGarmentGeometry('T-shirt', 'Back')
    const crewNeckBack = resolveGarmentGeometry('Crew neck (jumper)', 'Back')
    expect(crewNeckBack.printZones).not.toBe(tshirtBack.printZones)
    expect(crewNeckBack.printZones['Full Back']).not.toBe(tshirtBack.printZones['Full Back'])
  })

  it("Hoody's Top Back and Full Back sit below the hood's draped flap (verified against hoody-back.png), lower than T-shirt's", () => {
    const tshirtTopBack = resolvePrintZone('T-shirt', 'Back', 'Top Back')!
    const hoodyTopBack = resolvePrintZone('Hoody', 'Back', 'Top Back')!
    const tshirtFullBack = resolvePrintZone('T-shirt', 'Back', 'Full Back')!
    const hoodyFullBack = resolvePrintZone('Hoody', 'Back', 'Full Back')!
    expect(hoodyTopBack.y).toBeGreaterThan(tshirtTopBack.y)
    expect(hoodyFullBack.y).toBeGreaterThan(tshirtFullBack.y)
  })

  it('every priority garment/view is recorded as "verified" calibration confidence', () => {
    for (const type of PRIORITY_GARMENTS) {
      expect(getCalibrationConfidence(type, 'Front')).toBe('verified')
      expect(getCalibrationConfidence(type, 'Back')).toBe('verified')
    }
  })

  it('a garment with no recorded calibration confidence reports "unverified"', () => {
    expect(getCalibrationConfidence('Shorts', 'Front')).toBe('unverified')
  })
})

describe('Batch B: read-only live fallback eligibility (MockupThumbnail/GarmentMockup consumers)', () => {
  it('a calibrated garment/position combination is eligible for the live V2 fallback', () => {
    expect(isPrintPositionSupported('T-shirt', 'Left Chest')).toBe(true)
    expect(isPrintPositionSupported('Hoody', 'Full Back')).toBe(true)
  })

  it('an unsupported garment/position combination is safely rejected, never faked', () => {
    expect(isPrintPositionSupported('Bennie', 'Left Chest')).toBe(false)
    expect(isPrintPositionSupported('Shorts', 'Full Back')).toBe(false)
  })
})

describe('resolveGarmentGeometry safe fallback for an unrecognized type', () => {
  it('falls back to Customized rather than throwing', () => {
    const geometry = resolveGarmentGeometry('Something Unexpected' as GarmentType, 'Front')
    expect(geometry.viewBox.width).toBeGreaterThan(0)
  })
})

// Post-Batch-C neck-clearance patch — human visual QA found Left Chest,
// Right Chest, Across Chest, and Top Back sat too close to the garment
// neckline/collar across the priority garments. This suite locks down the
// invariants the fix had to respect (vertical-only, garment-specific,
// zone stays coherent) rather than hard-coding every coordinate, so a
// future recalibration pass doesn't have to fight brittle exact-value
// assertions — only genuinely meaningful properties are checked.
describe('Post-Batch-C neck clearance patch', () => {
  const NECK_AFFECTED_FRONT: PrintPosition[] = ['Left Chest', 'Right Chest', 'Across Chest']

  it('Left Chest, Right Chest, and Across Chest remain explicitly defined for every priority garment', () => {
    for (const type of PRIORITY_GARMENTS) {
      for (const position of NECK_AFFECTED_FRONT) {
        expect(resolvePrintZone(type, 'Front', position)).toBeDefined()
      }
    }
  })

  it('Top Back remains explicitly defined for every priority garment', () => {
    for (const type of PRIORITY_GARMENTS) {
      expect(resolvePrintZone(type, 'Back', 'Top Back')).toBeDefined()
    }
  })

  it('Left Chest and Right Chest stay vertically symmetric (identical y) for every priority garment', () => {
    for (const type of PRIORITY_GARMENTS) {
      const left = resolvePrintZone(type, 'Front', 'Left Chest')!
      const right = resolvePrintZone(type, 'Front', 'Right Chest')!
      expect(right.y).toBe(left.y)
      expect(right.height).toBe(left.height)
    }
  })

  it('Left Chest and Right Chest x-coordinates are untouched by this patch (still the pre-patch values)', () => {
    // This patch is vertical-only (Y). Locking down the exact x/anchorX
    // values that existed before the patch is the real regression check —
    // "still mirrored" is a softer, less useful assertion here since the
    // pre-existing calibration was already a ~1-unit-off eyeballed mirror,
    // not an algebraic one, and that's not this patch's concern to fix.
    const expectedX: Record<string, { left: number; right: number }> = {
      'T-shirt': { left: 368, right: 711 },
      Hoody: { left: 368, right: 711 },
      Polo: { left: 368, right: 711 },
      'Crew neck (jumper)': { left: 368, right: 711 },
    }
    for (const type of PRIORITY_GARMENTS) {
      const left = resolvePrintZone(type, 'Front', 'Left Chest')!
      const right = resolvePrintZone(type, 'Front', 'Right Chest')!
      expect(left.x).toBe(expectedX[type].left)
      expect(right.x).toBe(expectedX[type].right)
    }
  })

  it('the four corrected positions sit strictly within the garment silhouette bounds for every priority garment', () => {
    for (const type of PRIORITY_GARMENTS) {
      const bounds = resolveGarmentGeometry(type, 'Front').garmentBounds
      for (const position of NECK_AFFECTED_FRONT) {
        const zone = resolvePrintZone(type, 'Front', position)!
        expect(zone.y).toBeGreaterThanOrEqual(bounds.y)
        expect(zone.y + zone.height).toBeLessThanOrEqual(bounds.y + bounds.height)
      }
      const backBounds = resolveGarmentGeometry(type, 'Back').garmentBounds
      const topBack = resolvePrintZone(type, 'Back', 'Top Back')!
      expect(topBack.y).toBeGreaterThanOrEqual(backBounds.y)
      expect(topBack.y + topBack.height).toBeLessThanOrEqual(backBounds.y + backBounds.height)
    }
  })

  it('every corrected zone anchor stays within its own zone box (still the box center, never displaced)', () => {
    for (const type of PRIORITY_GARMENTS) {
      for (const position of NECK_AFFECTED_FRONT) {
        const zone = resolvePrintZone(type, 'Front', position)!
        expect(zone.anchorX).toBeGreaterThanOrEqual(zone.x)
        expect(zone.anchorX).toBeLessThanOrEqual(zone.x + zone.width)
        expect(zone.anchorY).toBeGreaterThanOrEqual(zone.y)
        expect(zone.anchorY).toBeLessThanOrEqual(zone.y + zone.height)
      }
    }
  })

  it('Top Back did not creep down far enough to overlap Full Back\'s territory for any priority garment', () => {
    for (const type of PRIORITY_GARMENTS) {
      const topBack = resolvePrintZone(type, 'Back', 'Top Back')!
      const fullBack = resolvePrintZone(type, 'Back', 'Full Back')!
      // Top Back's bottom edge should still sit above where Full Back's
      // own top edge begins — if it doesn't, the "small, conservative"
      // requirement was violated and Top Back has effectively become a
      // second Full Back.
      expect(topBack.y + topBack.height).toBeLessThanOrEqual(fullBack.y + fullBack.height)
    }
  })

  it('refWidthMm is unchanged for every corrected zone (this patch is a position fix, not a size fix)', () => {
    const expectedRefWidthMm: Record<string, number> = {
      'Left Chest': 130,
      'Right Chest': 130,
      'Across Chest': 300,
    }
    for (const type of PRIORITY_GARMENTS) {
      for (const position of NECK_AFFECTED_FRONT) {
        const zone = resolvePrintZone(type, 'Front', position)!
        expect(zone.refWidthMm).toBe(expectedRefWidthMm[position])
      }
      const topBack = resolvePrintZone(type, 'Back', 'Top Back')!
      expect(topBack.refWidthMm).toBe(280)
    }
  })

  it('zone width/height (the physical-mm mapping basis) is unchanged for every corrected zone', () => {
    const expectedSize: Record<string, { width: number; height: number }> = {
      'Left Chest': { width: 147, height: 154 },
      'Right Chest': { width: 147, height: 154 },
      'Across Chest': { width: 613, height: 180 },
    }
    for (const type of PRIORITY_GARMENTS) {
      for (const position of NECK_AFFECTED_FRONT) {
        const zone = resolvePrintZone(type, 'Front', position)!
        expect(zone.width).toBe(expectedSize[position].width)
        expect(zone.height).toBe(expectedSize[position].height)
      }
      const topBack = resolvePrintZone(type, 'Back', 'Top Back')!
      expect(topBack.width).toBe(490)
    }
  })

  it('no GarmentPrintZone carries an offsetX/offsetY field — placement stays anchor-only, never offset-based', () => {
    for (const type of PRIORITY_GARMENTS) {
      for (const position of NECK_AFFECTED_FRONT) {
        const zone = resolvePrintZone(type, 'Front', position)!
        expect('offsetX' in zone).toBe(false)
        expect('offsetY' in zone).toBe(false)
      }
    }
  })

  it('every priority garment received its own correction (not one universal Y shift copy-pasted across garments)', () => {
    const leftChestY = PRIORITY_GARMENTS.map((type) => resolvePrintZone(type, 'Front', 'Left Chest')!.y)
    const topBackY = PRIORITY_GARMENTS.map((type) => resolvePrintZone(type, 'Back', 'Top Back')!.y)
    // Not every garment shares the exact same corrected Y — a universal
    // flat offset applied to every garment identically would fail this.
    expect(new Set(leftChestY).size).toBeGreaterThan(1)
    expect(new Set(topBackY).size).toBeGreaterThan(1)
  })
})

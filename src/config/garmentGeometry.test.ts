import { describe, expect, it } from 'vitest'
import {
  ALL_PRINT_POSITIONS,
  getGarmentCalibrationTier,
  getPositionView,
  isPrintPositionSupported,
  resolveGarmentGeometry,
  resolvePrintZone,
} from './garmentGeometry'
import type { GarmentType, PrintPosition } from '@/types'

const PRIORITY_GARMENTS: GarmentType[] = ['T-shirt', 'Hoody', 'Polo', 'Crew neck (jumper)']

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

describe('resolveGarmentGeometry safe fallback for an unrecognized type', () => {
  it('falls back to Customized rather than throwing', () => {
    const geometry = resolveGarmentGeometry('Something Unexpected' as GarmentType, 'Front')
    expect(geometry.viewBox.width).toBeGreaterThan(0)
  })
})

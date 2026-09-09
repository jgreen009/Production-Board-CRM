import { describe, expect, it } from 'vitest'
import {
  heightMmFromWidth,
  isOverflowingZone,
  physicalWidthToZoneRelativeSize,
  zoneRelativeSizeToPhysicalWidth,
} from './printSizeConversion'
import type { PrintZone } from '@/config/printZones'

const zone: PrintZone = {
  position: 'Left Chest',
  label: 'Left Chest',
  view: 'Front',
  xPct: 34,
  yPct: 19,
  widthPct: 16,
  heightPct: 20,
  refWidthMm: 150,
}

describe('physicalWidthToZoneRelativeSize', () => {
  it('converts a physical width to a percentage of the garment image using the zone calibration', () => {
    const result = physicalWidthToZoneRelativeSize(75, 1, zone)
    // 75mm is half of the zone's 150mm reference width -> half its 16% width
    expect(result.widthPct).toBeCloseTo(8, 5)
  })

  it('derives height from the artwork intrinsic aspect ratio, per brief §5.9', () => {
    // ratio 1.25 (wider than tall): 250mm wide -> 200mm tall (brief's own worked example)
    const wide = physicalWidthToZoneRelativeSize(250, 1.25, zone)
    const scale = zone.widthPct / zone.refWidthMm
    expect(wide.heightPct).toBeCloseTo(200 * scale, 5)

    const resized = physicalWidthToZoneRelativeSize(300, 1.25, zone)
    expect(resized.heightPct).toBeCloseTo(240 * scale, 5)
  })
})

describe('heightMmFromWidth', () => {
  it('matches the brief §5.9 worked example', () => {
    expect(heightMmFromWidth(250, 1.25)).toBeCloseTo(200, 5)
    expect(heightMmFromWidth(300, 1.25)).toBeCloseTo(240, 5)
  })
})

describe('zoneRelativeSizeToPhysicalWidth round-trip', () => {
  it('recovers the original width_mm within an explicit ±0.5mm tolerance', () => {
    const widths = [10, 75, 100, 150, 300, 420.5]
    for (const widthMm of widths) {
      const { widthPct } = physicalWidthToZoneRelativeSize(widthMm, 1.4, zone)
      const recovered = zoneRelativeSizeToPhysicalWidth(widthPct, zone)
      expect(Math.abs(recovered - widthMm)).toBeLessThanOrEqual(0.5)
    }
  })
})

describe('isOverflowingZone', () => {
  it('flags a size that exceeds the zone box as a warning, not a clamp', () => {
    expect(isOverflowingZone({ widthPct: 20, heightPct: 10 }, zone)).toBe(true)
    expect(isOverflowingZone({ widthPct: 10, heightPct: 25 }, zone)).toBe(true)
    expect(isOverflowingZone({ widthPct: 10, heightPct: 10 }, zone)).toBe(false)
  })

  it('does not flag a size exactly at the zone boundary', () => {
    expect(isOverflowingZone({ widthPct: zone.widthPct, heightPct: zone.heightPct }, zone)).toBe(false)
  })
})

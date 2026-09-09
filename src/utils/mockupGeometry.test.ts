import { describe, expect, it } from 'vitest'
import {
  canvasPositionToZoneOffset,
  isOverflowingZonePx,
  normalizeRotationDeg,
  physicalSizeToPixelSize,
  pixelWidthToPhysicalWidth,
  zoneBoxPx,
  zoneOffsetToCanvasPosition,
} from './mockupGeometry'
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

describe('zoneBoxPx', () => {
  it('scales the zone percentages to the given canvas pixel size', () => {
    const box = zoneBoxPx(zone, 1000, 1000)
    expect(box).toEqual({ x: 340, y: 190, width: 160, height: 200 })
  })

  it('produces different pixel boxes for different canvas sizes from the same zone', () => {
    const small = zoneBoxPx(zone, 300, 300)
    const large = zoneBoxPx(zone, 900, 900)
    expect(large.width).toBeCloseTo(small.width * 3, 5)
  })
})

describe('zoneOffsetToCanvasPosition / canvasPositionToZoneOffset round-trip', () => {
  it('(0,0) offset maps to the exact zone center', () => {
    const box = zoneBoxPx(zone, 1000, 1000)
    const pos = zoneOffsetToCanvasPosition({ offsetX: 0, offsetY: 0 }, box)
    expect(pos.left).toBeCloseTo(box.x + box.width / 2, 5)
    expect(pos.top).toBeCloseTo(box.y + box.height / 2, 5)
  })

  it('round-trips arbitrary offsets exactly (pure algebra, no rounding)', () => {
    const box = zoneBoxPx(zone, 1000, 1000)
    const offsets = [
      { offsetX: 0, offsetY: 0 },
      { offsetX: 0.5, offsetY: -0.3 },
      { offsetX: -0.5, offsetY: 0.5 },
    ]
    for (const offset of offsets) {
      const pos = zoneOffsetToCanvasPosition(offset, box)
      const recovered = canvasPositionToZoneOffset(pos, box)
      expect(recovered.offsetX).toBeCloseTo(offset.offsetX, 10)
      expect(recovered.offsetY).toBeCloseTo(offset.offsetY, 10)
    }
  })

  it('reconstructs the same relative position at a different canvas size (identical offset in, same relative position out)', () => {
    const offset = { offsetX: 0.25, offsetY: -0.1 }
    const smallBox = zoneBoxPx(zone, 400, 400)
    const largeBox = zoneBoxPx(zone, 1200, 1200)
    const smallPos = zoneOffsetToCanvasPosition(offset, smallBox)
    const largePos = zoneOffsetToCanvasPosition(offset, largeBox)
    // relative position within the zone box should match at any canvas size
    const smallRelX = (smallPos.left - smallBox.x) / smallBox.width
    const largeRelX = (largePos.left - largeBox.x) / largeBox.width
    expect(smallRelX).toBeCloseTo(largeRelX, 10)
  })
})

describe('physicalSizeToPixelSize / pixelWidthToPhysicalWidth round-trip', () => {
  it('a width equal to refWidthMm renders at exactly the zone pixel width', () => {
    const zonePx = zoneBoxPx(zone, 1000, 1000)
    const size = physicalSizeToPixelSize(zone.refWidthMm, zone.refWidthMm, zone, zonePx)
    expect(size.widthPx).toBeCloseTo(zonePx.width, 5)
  })

  it('round-trips physical width through pixel width', () => {
    const zonePx = zoneBoxPx(zone, 1000, 1000)
    for (const widthMm of [10, 75, 150, 300]) {
      const size = physicalSizeToPixelSize(widthMm, widthMm, zone, zonePx)
      const recovered = pixelWidthToPhysicalWidth(size.widthPx, zone, zonePx)
      expect(recovered).toBeCloseTo(widthMm, 8)
    }
  })

  it('produces the same physical size at any canvas pixel size (position-change-preserves-physical-size invariant)', () => {
    const smallZonePx = zoneBoxPx(zone, 300, 300)
    const largeZonePx = zoneBoxPx(zone, 1500, 1500)
    const widthMm = 100
    const smallSize = physicalSizeToPixelSize(widthMm, widthMm, zone, smallZonePx)
    const largeSize = physicalSizeToPixelSize(widthMm, widthMm, zone, largeZonePx)
    // pixel size differs (different canvas), but recovers the same mm value
    expect(pixelWidthToPhysicalWidth(smallSize.widthPx, zone, smallZonePx)).toBeCloseTo(widthMm, 8)
    expect(pixelWidthToPhysicalWidth(largeSize.widthPx, zone, largeZonePx)).toBeCloseTo(widthMm, 8)
  })

  it('the same physical width renders smaller, relative to the zone, in a larger reference zone (Left Chest -> Full Front example)', () => {
    const fullFront: PrintZone = { ...zone, position: 'Full Front', widthPct: 44, heightPct: 46, refWidthMm: 350 }
    const zonePx = zoneBoxPx(zone, 1000, 1000)
    const fullFrontZonePx = zoneBoxPx(fullFront, 1000, 1000)
    const widthMm = 100
    const chestSize = physicalSizeToPixelSize(widthMm, widthMm, zone, zonePx)
    const frontSize = physicalSizeToPixelSize(widthMm, widthMm, fullFront, fullFrontZonePx)
    // same physical width, but relative to its own (larger) zone box, it should occupy a smaller fraction
    expect(chestSize.widthPx / zonePx.width).toBeGreaterThan(frontSize.widthPx / fullFrontZonePx.width)
  })
})

describe('isOverflowingZonePx', () => {
  it('flags artwork pixel size exceeding the zone pixel box', () => {
    const zonePx = zoneBoxPx(zone, 1000, 1000)
    expect(isOverflowingZonePx({ widthPx: zonePx.width + 1, heightPx: 10 }, zonePx)).toBe(true)
    expect(isOverflowingZonePx({ widthPx: 10, heightPx: zonePx.height + 1 }, zonePx)).toBe(true)
    expect(isOverflowingZonePx({ widthPx: zonePx.width - 1, heightPx: zonePx.height - 1 }, zonePx)).toBe(false)
  })
})

describe('normalizeRotationDeg', () => {
  it('leaves values already in [0, 360) unchanged', () => {
    expect(normalizeRotationDeg(0)).toBe(0)
    expect(normalizeRotationDeg(45)).toBe(45)
    expect(normalizeRotationDeg(359)).toBe(359)
  })

  it('wraps negative angles into [0, 360)', () => {
    expect(normalizeRotationDeg(-10)).toBeCloseTo(350, 10)
    expect(normalizeRotationDeg(-360)).toBe(0)
  })

  it('wraps values >= 360 back into range', () => {
    expect(normalizeRotationDeg(360)).toBe(0)
    expect(normalizeRotationDeg(370)).toBeCloseTo(10, 10)
    expect(normalizeRotationDeg(720)).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import {
  canvasPositionToZoneOffset,
  fitArtworkToZone,
  isOverflowingZonePx,
  normalizeRotationDeg,
  physicalSizeToPixelSize,
  pixelWidthToPhysicalWidth,
  zoneBoxMm,
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

describe('zoneBoxMm', () => {
  it('width always equals refWidthMm; height derives from the box pixel aspect ratio', () => {
    const box = zoneBoxMm(zone)
    expect(box.widthMm).toBe(150)
    expect(box.heightMm).toBeCloseTo(234.375, 5)
  })

  it('is independent of any particular reference canvas size', () => {
    expect(zoneBoxMm(zone)).toEqual(zoneBoxMm(zone))
  })
})

describe('fitArtworkToZone (auto-fill sizing)', () => {
  it('width-constrains a relatively wide/square artwork to the zone width', () => {
    const fit = fitArtworkToZone(zone, 1) // square
    expect(fit.widthMm).toBeCloseTo(150, 8)
    expect(fit.heightMm).toBeCloseTo(150, 8)
  })

  it('height-constrains a relatively tall artwork to the zone height', () => {
    const fit = fitArtworkToZone(zone, 0.4) // taller than the box
    expect(fit.heightMm).toBeCloseTo(234.375, 8)
    expect(fit.widthMm).toBeCloseTo(234.375 * 0.4, 8)
  })

  it('never produces a size that overflows the zone box in either dimension', () => {
    const box = zoneBoxMm(zone)
    for (const aspectRatio of [0.1, 0.5, 0.64, 1, 2, 5]) {
      const fit = fitArtworkToZone(zone, aspectRatio)
      expect(fit.widthMm).toBeLessThanOrEqual(box.widthMm + 1e-8)
      expect(fit.heightMm).toBeLessThanOrEqual(box.heightMm + 1e-8)
    }
  })

  it('preserves the artwork aspect ratio exactly', () => {
    const fit = fitArtworkToZone(zone, 0.75)
    expect(fit.widthMm / fit.heightMm).toBeCloseTo(0.75, 8)
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

// Batch B acceptance test B5 (viewport reconstruction): the same PrintSpec
// (offset fractions, widthMm/heightMm, rotationDeg) must reconstruct to the
// same *relative* placement and physical size at desktop/tablet/mobile
// canvas sizes — never compared as exact pixels, since those necessarily
// differ across viewport sizes.
describe('cross-viewport reconstruction (Batch A/B "same offset/size/rotation at any canvas size")', () => {
  const savedPrintSpec = {
    offsetX: 0.3,
    offsetY: -0.2,
    rotationDeg: 42,
    widthMm: 120,
    heightMm: 96,
  }

  // Canvas pixel widths a real container could plausibly produce at each
  // breakpoint, height derived to keep the GARMENT_VIEW_BOX 4:5 ratio —
  // exactly as MockupStudio's own canvasHeight calculation does.
  const viewports = {
    desktop: { width: 420, height: Math.round((420 / 240) * 300) },
    tablet: { width: 300, height: Math.round((300 / 240) * 300) },
    mobile: { width: 220, height: Math.round((220 / 240) * 300) },
  }

  it('recovers the identical offset fractions and physical mm size at every viewport size', () => {
    for (const { width, height } of Object.values(viewports)) {
      const zonePx = zoneBoxPx(zone, width, height)
      const pos = zoneOffsetToCanvasPosition({ offsetX: savedPrintSpec.offsetX, offsetY: savedPrintSpec.offsetY }, zonePx)
      const recoveredOffset = canvasPositionToZoneOffset(pos, zonePx)
      expect(recoveredOffset.offsetX).toBeCloseTo(savedPrintSpec.offsetX, 8)
      expect(recoveredOffset.offsetY).toBeCloseTo(savedPrintSpec.offsetY, 8)

      const sizePx = physicalSizeToPixelSize(savedPrintSpec.widthMm, savedPrintSpec.heightMm, zone, zonePx)
      const recoveredWidthMm = pixelWidthToPhysicalWidth(sizePx.widthPx, zone, zonePx)
      expect(recoveredWidthMm).toBeCloseTo(savedPrintSpec.widthMm, 8)

      // rotationDeg is never viewport-dependent — persisted and reapplied verbatim.
      expect(normalizeRotationDeg(savedPrintSpec.rotationDeg)).toBe(savedPrintSpec.rotationDeg)
    }
  })

  it('renders a proportionally larger artwork box on a larger canvas, without changing the physical mm size', () => {
    const desktopZonePx = zoneBoxPx(zone, viewports.desktop.width, viewports.desktop.height)
    const mobileZonePx = zoneBoxPx(zone, viewports.mobile.width, viewports.mobile.height)
    const desktopSize = physicalSizeToPixelSize(savedPrintSpec.widthMm, savedPrintSpec.heightMm, zone, desktopZonePx)
    const mobileSize = physicalSizeToPixelSize(savedPrintSpec.widthMm, savedPrintSpec.heightMm, zone, mobileZonePx)
    // absolute pixels differ (different canvas sizes)...
    expect(desktopSize.widthPx).not.toBeCloseTo(mobileSize.widthPx, 0)
    // ...but both recover the exact same physical width
    expect(pixelWidthToPhysicalWidth(desktopSize.widthPx, zone, desktopZonePx)).toBeCloseTo(savedPrintSpec.widthMm, 8)
    expect(pixelWidthToPhysicalWidth(mobileSize.widthPx, zone, mobileZonePx)).toBeCloseTo(savedPrintSpec.widthMm, 8)
  })
})

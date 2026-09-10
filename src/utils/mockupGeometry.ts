import type { PrintZone } from '@/config/printZones'

export interface PixelBox {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasPosition {
  left: number
  top: number
}

export interface ZoneOffset {
  offsetX: number
  offsetY: number
}

// The print zone's box in canvas pixels, for a canvas of the given size.
// Pure — no Fabric, no DOM. Reused by MockupCanvas for both the visible
// zone guide and the offset<->pixel conversions below.
export function zoneBoxPx(zone: PrintZone, canvasWidth: number, canvasHeight: number): PixelBox {
  return {
    x: (zone.xPct / 100) * canvasWidth,
    y: (zone.yPct / 100) * canvasHeight,
    width: (zone.widthPct / 100) * canvasWidth,
    height: (zone.heightPct / 100) * canvasHeight,
  }
}

// Phase 3 plan §4 (Amendment 1) semantics: offsetX/offsetY are a fractional
// offset from the print zone's own center — (0, 0) is centered in the zone,
// not the whole canvas. This is what makes the same persisted values
// reconstruct identically regardless of the canvas's current pixel size.
export function zoneOffsetToCanvasPosition(offset: ZoneOffset, zonePx: PixelBox): CanvasPosition {
  return {
    left: zonePx.x + zonePx.width / 2 + offset.offsetX * zonePx.width,
    top: zonePx.y + zonePx.height / 2 + offset.offsetY * zonePx.height,
  }
}

export function canvasPositionToZoneOffset(position: CanvasPosition, zonePx: PixelBox): ZoneOffset {
  return {
    offsetX: (position.left - (zonePx.x + zonePx.width / 2)) / zonePx.width,
    offsetY: (position.top - (zonePx.y + zonePx.height / 2)) / zonePx.height,
  }
}

// Rotation is always stored in [0, 360) — Fabric can report negative angles
// or values >= 360 depending on drag direction/wraparound.
export function normalizeRotationDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

export interface PixelSize {
  widthPx: number
  heightPx: number
}

// px-per-mm, calibrated from the zone's refWidthMm against its own pixel
// width — applied uniformly to both axes (not a separate height-basis
// scale) because the canvas element's pixel grid is square: a physical mm
// converted once via this single factor preserves the artwork's real
// aspect ratio in rendered pixels regardless of the garment view box's own
// (non-square) aspect ratio.
export function mmPerCanvasPixelScale(zone: PrintZone, zonePx: PixelBox): number {
  return zonePx.width / zone.refWidthMm
}

export function physicalSizeToPixelSize(widthMm: number, heightMm: number, zone: PrintZone, zonePx: PixelBox): PixelSize {
  const scale = mmPerCanvasPixelScale(zone, zonePx)
  return { widthPx: widthMm * scale, heightPx: heightMm * scale }
}

export function pixelWidthToPhysicalWidth(widthPx: number, zone: PrintZone, zonePx: PixelBox): number {
  return widthPx / mmPerCanvasPixelScale(zone, zonePx)
}

// The print zone's own realistic box size in real-world mm — width comes
// straight from refWidthMm (that's what it's calibrated against); height
// is derived from the box's pixel aspect ratio at any reference canvas
// size sharing the fixed 240:300 garment view-box ratio (the result is the
// same regardless of which reference size is used).
export function zoneBoxMm(zone: PrintZone): { widthMm: number; heightMm: number } {
  const refPx = zoneBoxPx(zone, 240, 300)
  return {
    widthMm: zone.refWidthMm,
    heightMm: zone.refWidthMm * (refPx.height / refPx.width),
  }
}

// Auto-fill sizing: the largest an artwork of the given aspect ratio
// (natural width / natural height) can be while still fitting entirely
// inside its print zone's own box — a "contain" fit, touching the zone's
// width or height limit (whichever binds first) without ever overflowing
// it. This replaces manual width/height entry — artwork is sized to fill
// its position automatically the moment it's selected.
export function fitArtworkToZone(zone: PrintZone, aspectRatio: number): { widthMm: number; heightMm: number } {
  const box = zoneBoxMm(zone)
  const boxAspect = box.widthMm / box.heightMm
  if (aspectRatio >= boxAspect) {
    return { widthMm: box.widthMm, heightMm: box.widthMm / aspectRatio }
  }
  return { widthMm: box.heightMm * aspectRatio, heightMm: box.heightMm }
}

// Pixel-space overflow check — deliberately not percentage-based (see
// isOverflowingZone in printSizeConversion.ts, which compares widthPct
// against a width-basis and heightPct against a height-basis that aren't
// actually the same unit). Comparing real pixel dimensions on both sides
// sidesteps that basis mismatch entirely.
export function isOverflowingZonePx(size: PixelSize, zonePx: PixelBox): boolean {
  return size.widthPx > zonePx.width || size.heightPx > zonePx.height
}

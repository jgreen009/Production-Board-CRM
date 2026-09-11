import type { PrintZone } from '@/config/printZones'
import type { GarmentPrintZone } from '@/config/garmentGeometry'
import { mapCanonicalPointToViewport, type FitResult } from '@/utils/garmentFit'

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

// ---------------------------------------------------------------------
// Mockup System V2 Batch A — canonical-unit geometry (garment-specific
// zones defined in config/garmentGeometry.ts). These are the functions the
// real render path (MockupCanvas, GarmentMockup, mockupPreviewRenderer)
// uses; everything above this point is the legacy percentage-based model,
// kept only for its own pure-math tests and printZones.ts's historical
// offsetX/offsetY reconstruction semantics (Part "OFFSET_X / OFFSET_Y" —
// rendering no longer depends on those fields at all, but the columns and
// their pure conversion math are kept, not deleted).
// ---------------------------------------------------------------------

// Canonical units per real-world mm, calibrated from the zone's own
// refWidthMm against its own canonical `width` — one factor applied
// uniformly to both axes (Part 7: "verify whether width-only calibration
// is sufficient" — it is, because canonical units are isotropic by
// construction: the canonical viewBox equals the garment photo's own
// native pixel grid, which has no independent per-axis distortion once
// fitGarmentIntoViewport replaces the old independent scaleX/scaleY).
export function canonicalUnitsPerMm(zone: GarmentPrintZone): number {
  return zone.width / zone.refWidthMm
}

export function physicalSizeToCanonicalSize(
  widthMm: number,
  heightMm: number,
  zone: GarmentPrintZone,
): { width: number; height: number } {
  const scale = canonicalUnitsPerMm(zone)
  return { width: widthMm * scale, height: heightMm * scale }
}

// The zone's own realistic box size in real-world mm — width comes
// straight from refWidthMm; height derives from the box's own canonical
// aspect ratio, exactly mirroring the legacy zoneBoxMm's reasoning but
// against canonical units instead of a percentage-of-240x300 box.
export function canonicalZoneBoxMm(zone: GarmentPrintZone): { widthMm: number; heightMm: number } {
  return { widthMm: zone.refWidthMm, heightMm: zone.refWidthMm * (zone.height / zone.width) }
}

// Auto-fill sizing (contain fit) against a garment-specific canonical zone
// — the V2 equivalent of the legacy fitArtworkToZone.
export function fitArtworkToCanonicalZone(
  zone: GarmentPrintZone,
  aspectRatio: number,
): { widthMm: number; heightMm: number } {
  const box = canonicalZoneBoxMm(zone)
  const boxAspect = box.widthMm / box.heightMm
  if (aspectRatio >= boxAspect) {
    return { widthMm: box.widthMm, heightMm: box.widthMm / aspectRatio }
  }
  return { widthMm: box.heightMm * aspectRatio, heightMm: box.heightMm }
}

// Non-blocking overflow check against a garment-specific canonical zone,
// computed directly in mm (Part 5.10 rule unchanged: a warning threshold,
// never a hard clamp).
export function isOverflowingCanonicalZoneMm(widthMm: number, heightMm: number, zone: GarmentPrintZone): boolean {
  const box = canonicalZoneBoxMm(zone)
  return widthMm > box.widthMm || heightMm > box.heightMm
}

export interface ArtworkPlacement {
  /** Center point in viewport pixels — matches Fabric's originX/originY: 'center' convention already used by every renderer. */
  centerX: number
  centerY: number
  width: number
  height: number
}

// The full anchor-based placement pipeline (Part 6/11): artwork is always
// centered on the zone's configured anchor — offsetX/offsetY are never
// read here (Part "OFFSET_X / OFFSET_Y": legacy-ignored for rendering).
export function resolveArtworkPlacement(
  zone: GarmentPrintZone,
  fit: FitResult,
  widthMm: number,
  heightMm: number,
): ArtworkPlacement {
  const canonicalSize = physicalSizeToCanonicalSize(widthMm, heightMm, zone)
  const center = mapCanonicalPointToViewport({ x: zone.anchorX, y: zone.anchorY }, fit)
  return {
    centerX: center.x,
    centerY: center.y,
    width: canonicalSize.width * fit.scale,
    height: canonicalSize.height * fit.scale,
  }
}

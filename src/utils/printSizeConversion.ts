import type { PrintZone } from '@/config/printZones'

export interface ZoneRelativeSize {
  widthPct: number
  heightPct: number
}

// Phase 3 plan §5/Amendment 2: width_mm/height_mm are the sole persisted,
// canonical size — nothing derived here is ever written to the database.
// These are pure, render-time-only conversions between that canonical
// physical size and the on-canvas percentage-of-garment-image size, using
// a print zone's `refWidthMm` as the mm-per-percentage calibration.
function mmToPctScale(zone: PrintZone): number {
  return zone.widthPct / zone.refWidthMm
}

// physical width (mm) + artwork's intrinsic aspect ratio (width/height) ->
// on-canvas size as a percentage of the garment image.
export function physicalWidthToZoneRelativeSize(
  widthMm: number,
  aspectRatio: number,
  zone: PrintZone,
): ZoneRelativeSize {
  const scale = mmToPctScale(zone)
  const widthPct = widthMm * scale
  const heightMm = widthMm / aspectRatio
  const heightPct = heightMm * scale
  return { widthPct, heightPct }
}

// Inverse of the width half of the above — a canvas resize handle reports a
// new on-canvas widthPct; this recovers the physical width_mm to write back
// into form state (the one canonical value, per Amendment 2).
export function zoneRelativeSizeToPhysicalWidth(widthPct: number, zone: PrintZone): number {
  return widthPct / mmToPctScale(zone)
}

// brief §5.9's rule: width is primary, height always follows the artwork's
// real intrinsic aspect ratio unless proportions are explicitly unlocked.
export function heightMmFromWidth(widthMm: number, aspectRatio: number): number {
  return widthMm / aspectRatio
}

// Non-blocking overflow check (brief §5.10) — the print zone's box is a
// warning threshold, never a hard clamp; callers decide what to do with a
// true result (show a warning), never silently resize/clip.
export function isOverflowingZone(size: ZoneRelativeSize, zone: PrintZone): boolean {
  return size.widthPct > zone.widthPct || size.heightPct > zone.heightPct
}

import type { PrintPosition } from '@/types'

export interface PrintZone {
  position: PrintPosition
  label: string
  view: 'Front' | 'Back'
  /** Top-left corner of the print zone box, as a percentage (0-100) of the garment image's width/height. */
  xPct: number
  yPct: number
  /** Realistic size of this body location's print zone, as a percentage of the garment image's width/height. */
  widthPct: number
  heightPct: number
  /**
   * Assumed real-world width of this print zone in mm — a deliberate
   * approximation (not a precision claim) used only to convert a physical
   * width_mm into an on-canvas render size. E.g. Left Chest is realistically
   * ~150mm of usable print width on an adult torso; Full Front is ~350mm.
   * Printers already work this way from paper forms, eyeballing size
   * against a body diagram — this just gives that eyeballing a number.
   */
  refWidthMm: number
}

// Single source of truth for print-zone geometry, replacing
// src/data/printPositions.ts (deleted in the same change — no second,
// competing position config). Reshaped from the old center-point + max-box
// shape into a top-left-anchored box (xPct/yPct/widthPct/heightPct), which
// maps directly onto Fabric.js object placement. Coordinates are
// percentages of the garment mockup image's rendered box, carried over
// (allowing for the center->corner reshape) from the values already
// checked against each garment photo during Phase 1/2.
//
// Per Phase 3 plan §5.10: these box dimensions are the OVERFLOW-WARNING
// threshold, not a hard clamp. Placement may exceed them — the UI warns,
// it never silently clips (unlike the old GarmentMockup.tsx behavior).
export const PRINT_ZONES: PrintZone[] = [
  // Left/Right Chest recalibrated per staff feedback: the box was too tall
  // (nearly square) for a real chest-logo print area, and it spanned all
  // the way out to xPct 34/66 with only its inner edge touching the
  // centerline — which reads as "way over toward the shoulder" rather
  // than the few-inches-off-center placement chest logos actually sit at.
  // Narrower + shorter box, shifted inward so its center sits close to
  // the middle instead of its edge.
  { position: 'Left Chest', label: 'Left Chest', view: 'Front', xPct: 39, yPct: 19, widthPct: 11, heightPct: 13, refWidthMm: 150 },
  { position: 'Right Chest', label: 'Right Chest', view: 'Front', xPct: 50, yPct: 19, widthPct: 11, heightPct: 13, refWidthMm: 150 },
  { position: 'Across Chest', label: 'Across Chest', view: 'Front', xPct: 30, yPct: 20, widthPct: 40, heightPct: 18, refWidthMm: 320 },
  { position: 'Full Front', label: 'Full Front', view: 'Front', xPct: 28, yPct: 27, widthPct: 44, heightPct: 46, refWidthMm: 350 },
  { position: 'Left Sleeve', label: 'Left Sleeve', view: 'Front', xPct: 17, yPct: 28, widthPct: 14, heightPct: 14, refWidthMm: 90 },
  { position: 'Right Sleeve', label: 'Right Sleeve', view: 'Front', xPct: 69, yPct: 28, widthPct: 14, heightPct: 14, refWidthMm: 90 },
  { position: 'Full Back', label: 'Full Back', view: 'Back', xPct: 29, yPct: 25, widthPct: 42, heightPct: 46, refWidthMm: 350 },
  { position: 'Top Back', label: 'Top Back', view: 'Back', xPct: 36, yPct: 16, widthPct: 28, heightPct: 20, refWidthMm: 320 },
  { position: 'Bottom Back', label: 'Bottom Back', view: 'Back', xPct: 32, yPct: 34, widthPct: 36, heightPct: 28, refWidthMm: 320 },
]

export function getPrintZone(position: PrintPosition): PrintZone {
  return PRINT_ZONES.find((z) => z.position === position) ?? PRINT_ZONES[0]
}

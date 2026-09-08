import type { PrintPosition } from '@/types'

export interface PrintPositionConfig {
  value: PrintPosition
  label: string
  view: 'Front' | 'Back'
  /** Center of the print area, as a percentage (0-100) of the garment image's width/height. */
  x: number
  y: number
  /**
   * Realistic maximum print area for this body location, as a percentage of
   * the garment image's width/height — a sleeve can only ever hold a small
   * print no matter what "size" is picked, while Full Front can hold a
   * large one. The mockup clamps the selected print size to this box so it
   * always fits within the actual position rather than overflowing it.
   */
  maxWidthPct: number
  maxHeightPct: number
}

// Coordinates are percentages of the garment mockup image's rendered box,
// reused across all garment photos in src/assets/mockups/ — checked against
// each image and landing within a few percent of the real print boxes;
// drag-to-reposition (already supported) covers the rest.
export const PRINT_POSITIONS: PrintPositionConfig[] = [
  { value: 'Left Chest', label: 'Left Chest', view: 'Front', x: 42, y: 29, maxWidthPct: 16, maxHeightPct: 20 },
  { value: 'Right Chest', label: 'Right Chest', view: 'Front', x: 58, y: 29, maxWidthPct: 16, maxHeightPct: 20 },
  { value: 'Across Chest', label: 'Across Chest', view: 'Front', x: 50, y: 29, maxWidthPct: 40, maxHeightPct: 18 },
  { value: 'Full Front', label: 'Full Front', view: 'Front', x: 50, y: 50, maxWidthPct: 44, maxHeightPct: 46 },
  { value: 'Left Sleeve', label: 'Left Sleeve', view: 'Front', x: 24, y: 35, maxWidthPct: 14, maxHeightPct: 14 },
  { value: 'Right Sleeve', label: 'Right Sleeve', view: 'Front', x: 76, y: 35, maxWidthPct: 14, maxHeightPct: 14 },
  { value: 'Full Back', label: 'Full Back', view: 'Back', x: 50, y: 48, maxWidthPct: 42, maxHeightPct: 46 },
  { value: 'Top Back', label: 'Top Back', view: 'Back', x: 50, y: 26, maxWidthPct: 28, maxHeightPct: 20 },
  { value: 'Bottom Back', label: 'Bottom Back', view: 'Back', x: 50, y: 68, maxWidthPct: 36, maxHeightPct: 28 },
]

export function getPrintPositionConfig(value: PrintPosition): PrintPositionConfig {
  return PRINT_POSITIONS.find((p) => p.value === value) ?? PRINT_POSITIONS[0]
}

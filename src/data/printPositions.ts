import type { PrintPosition } from '@/types'

export interface PrintPositionConfig {
  value: PrintPosition
  label: string
  view: 'Front' | 'Back' | 'Both'
  /** Center of the print area, as a percentage (0-100) of the garment image's width/height. */
  x: number
  y: number
  sizePreset?: { widthMm: number; heightMm: number }
}

// Coordinates are percentages of the garment mockup image's rendered box.
// Layout and numbering match the paper form's Print Position diagram
// verbatim: front has 6 numbered spots, back has 3, each with the
// diagram's rough A6/A4/A3 size hint. The same percentages are reused
// across all garment photos in src/assets/mockups/ — they were checked
// against each image and land within a few percent of the real print
// boxes; drag-to-reposition (already supported) covers the rest.
export const PRINT_POSITIONS: PrintPositionConfig[] = [
  {
    value: 'Front 1 — Right Chest (A6)',
    label: 'Front 1 — Right Chest (A6)',
    view: 'Front',
    x: 58,
    y: 29,
    sizePreset: { widthMm: 105, heightMm: 148 },
  },
  {
    value: 'Front 2 — Left Chest (A6)',
    label: 'Front 2 — Left Chest (A6)',
    view: 'Front',
    x: 42,
    y: 29,
    sizePreset: { widthMm: 105, heightMm: 148 },
  },
  {
    value: 'Front 3 — Center Chest (A4)',
    label: 'Front 3 — Center Chest (A4)',
    view: 'Front',
    x: 50,
    y: 44,
    sizePreset: { widthMm: 210, heightMm: 297 },
  },
  {
    value: 'Front 4 — Lower Front (A3)',
    label: 'Front 4 — Lower Front (A3)',
    view: 'Front',
    x: 50,
    y: 65,
    sizePreset: { widthMm: 297, heightMm: 420 },
  },
  {
    value: 'Front 5 — Right Sleeve',
    label: 'Front 5 — Right Sleeve',
    view: 'Front',
    x: 76,
    y: 35,
    sizePreset: { widthMm: 80, heightMm: 80 },
  },
  {
    value: 'Front 6 — Left Sleeve',
    label: 'Front 6 — Left Sleeve',
    view: 'Front',
    x: 24,
    y: 35,
    sizePreset: { widthMm: 80, heightMm: 80 },
  },
  {
    value: 'Back 1 — Upper Back (A4)',
    label: 'Back 1 — Upper Back (A4)',
    view: 'Back',
    x: 50,
    y: 30,
    sizePreset: { widthMm: 210, heightMm: 297 },
  },
  {
    value: 'Back 2 — Mid Back (A4)',
    label: 'Back 2 — Mid Back (A4)',
    view: 'Back',
    x: 50,
    y: 46,
    sizePreset: { widthMm: 210, heightMm: 297 },
  },
  {
    value: 'Back 3 — Lower Back (A3)',
    label: 'Back 3 — Lower Back (A3)',
    view: 'Back',
    x: 50,
    y: 66,
    sizePreset: { widthMm: 297, heightMm: 420 },
  },
  {
    value: 'Custom',
    label: 'Custom (manual placement)',
    view: 'Both',
    x: 50,
    y: 50,
    sizePreset: { widthMm: 150, heightMm: 150 },
  },
]

export function getPrintPositionConfig(value: PrintPosition): PrintPositionConfig {
  return PRINT_POSITIONS.find((p) => p.value === value) ?? PRINT_POSITIONS[0]
}

export function printPositionsForView(view: 'Front' | 'Back'): PrintPositionConfig[] {
  return PRINT_POSITIONS.filter((p) => p.view === view || p.view === 'Both')
}

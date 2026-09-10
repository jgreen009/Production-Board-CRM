export interface PrintSizePreset {
  key: string
  label: string
  widthMm: number
}

// Standard paper-size-equivalent print widths, the terminology this shop
// already uses day to day for talking about print size. Height is always
// derived from the artwork's own aspect ratio (heightMmFromWidth), same
// as the automatic zone-fit — a preset only ever sets the width. Oversize
// isn't a real paper size; it's this shop's own top bracket for anything
// bigger than A3.
export const PRINT_SIZE_PRESETS: PrintSizePreset[] = [
  { key: 'A5', label: 'A5', widthMm: 148 },
  { key: 'A4', label: 'A4', widthMm: 210 },
  { key: 'A3', label: 'A3', widthMm: 297 },
  { key: 'Oversized', label: 'Oversized', widthMm: 400 },
]

// Matches a spec's current widthMm back to a preset key for highlighting
// the active button, within a small tolerance (float rounding, or a
// value nudged slightly by earlier auto-fit math) — null when the current
// size doesn't correspond to any preset (e.g. still on the automatic
// zone-fit size, or a historical order saved before presets existed).
export function matchPrintSizePreset(widthMm: number): string | null {
  const match = PRINT_SIZE_PRESETS.find((p) => Math.abs(p.widthMm - widthMm) < 1)
  return match?.key ?? null
}

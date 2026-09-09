const COLOUR_MAP: Record<string, string> = {
  navy: '#1e2a4a',
  black: '#18181b',
  white: '#f8fafc',
  sand: '#d8c9ab',
  charcoal: '#3f3f46',
  red: '#b91c1c',
  'bottle green': '#14532d',
  green: '#166534',
  yellow: '#eab308',
  gold: '#ca8a04',
  grey: '#a1a1aa',
  gray: '#a1a1aa',
  maroon: '#7f1d1d',
  royal: '#1d4ed8',
  'royal blue': '#1d4ed8',
  blue: '#1d4ed8',
  orange: '#ea580c',
  purple: '#7e22ce',
  pink: '#db2777',
}

// Safe neutral fallback used whenever a colour can't be resolved — the
// staff-entered label is always shown separately in the form regardless
// (this fill is only the garment render, never the only place the colour
// name appears), so falling back here never hides real information.
export const FALLBACK_GARMENT_COLOUR = '#d4d4d8'

// Accepts "#rgb", "#rrggbb", or the same without the leading '#'. Pure
// regex-based (no DOM/canvas dependency) so it stays testable in a plain
// Node/Vitest environment, unlike browser-only CSS-color validation tricks.
function normalizeHex(input: string): string | null {
  const cleaned = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{6}$/i.test(cleaned)) return `#${cleaned.toLowerCase()}`
  if (/^[0-9a-f]{3}$/i.test(cleaned)) {
    const [r, g, b] = cleaned.toLowerCase().split('')
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return null
}

export function resolveGarmentColour(colour: string): string {
  const trimmed = colour.trim()
  const hex = normalizeHex(trimmed)
  if (hex) return hex
  const first = trimmed.split('/')[0]?.trim().toLowerCase() ?? ''
  return COLOUR_MAP[first] ?? FALLBACK_GARMENT_COLOUR
}

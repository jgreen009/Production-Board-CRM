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
  blue: '#1d4ed8',
  orange: '#ea580c',
  purple: '#7e22ce',
  pink: '#db2777',
}

export function resolveGarmentColour(colour: string): string {
  const first = colour.split('/')[0]?.trim().toLowerCase() ?? ''
  return COLOUR_MAP[first] ?? '#d4d4d8'
}

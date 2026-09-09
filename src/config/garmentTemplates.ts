import type { GarmentType } from '@/types'
import { resolveGarmentColour } from '@/utils/colour'

// Phase 3 Milestone 2 — the ONE source of truth for garment rendering,
// replacing src/data/garmentImages.ts (the old marked paper-form photos)
// and the FALLBACK_BODY/HEADWEAR_ANCHOR/GARMENT_Y_OFFSET hacks that used to
// live inline in GarmentMockup.tsx. No clean garment photography is being
// supplied for this phase (see docs/PHASE_3_PLAN.md §8/Amendment 7), so
// every garment type renders from a polished neutral SVG silhouette here —
// this is the primary Phase 3 rendering strategy, not a fallback.
//
// Deliberately framework-independent: no React, no Fabric.js import. Both
// GarmentMockup.tsx (plain SVG/JSX) and MockupCanvas.tsx (via
// garmentTemplateToDataUrl below, which Fabric loads as an image URL)
// consume the same shape data — one rendering source, two renderers.

export type GarmentSilhouetteCategory =
  | 'torso'
  | 'sleeveless'
  | 'hoody'
  | 'bottoms'
  | 'headwear-beanie'
  | 'headwear-cap'

export type ShapeRole = 'garment' | 'accent' | 'shade' | 'outline'

export interface GarmentShape {
  d: string
  role: ShapeRole
}

export interface GarmentTemplate {
  type: GarmentType
  category: GarmentSilhouetteCategory
  /** Whether the front and back views are meaningfully different (a hood, a vest opening, a cap brim) — if false, `back` may just repeat `front`. */
  frontBackDiffer: boolean
  defaultColour: string
  front: GarmentShape[]
  back: GarmentShape[]
  /**
   * Garment-specific print-anchor override, replacing the old inline
   * HEADWEAR_ANCHOR hack. Headwear doesn't have a chest/sleeve/back the
   * generic print-position list applies to, so every position anchors to
   * this one spot instead of the normal print-zone geometry.
   */
  printAnchorOverride?: { x: number; y: number }
  /**
   * Small vertical nudge applied on top of the normal print-zone anchor,
   * replacing the old inline GARMENT_Y_OFFSET hack (the Singlet silhouette
   * sits with more headroom in the shared viewBox than a full-sleeve torso).
   */
  verticalOffsetPct?: number
}

// Shared coordinate space every silhouette is drawn in — one normalized
// viewBox regardless of garment shape, so the same markup renders cleanly
// at a small Order Detail thumbnail, the current form preview, and a
// future large Fabric canvas without separate desktop/mobile assets.
export const GARMENT_VIEW_BOX = '0 0 240 300'

// Fixed reflective-strip colour for the Hi-Viz vest accent — not
// garment-colour-dependent, since real hi-viz strips are always this kind
// of silver/yellow regardless of the vest's base colour.
const HI_VIZ_STRIP = '#e5e7eb'

const torsoFront: GarmentShape[] = [
  {
    role: 'garment',
    d: 'M120,22 C110,22 100,18 92,24 C84,30 78,34 70,38 L28,55 L46,95 L70,78 L70,282 Q70,288 76,288 L164,288 Q170,288 170,282 L170,78 L194,95 L212,55 L170,38 C162,34 156,30 148,24 C140,18 130,22 120,22 Z',
  },
]

const torsoBack: GarmentShape[] = [
  {
    role: 'garment',
    d: 'M120,26 C108,26 96,26 88,30 C82,33 76,36 70,38 L28,55 L46,95 L70,78 L70,282 Q70,288 76,288 L164,288 Q170,288 170,282 L170,78 L194,95 L212,55 L170,38 C164,36 158,33 152,30 C144,26 132,26 120,26 Z',
  },
]

const sleevelessBody: GarmentShape[] = [
  {
    role: 'garment',
    d: 'M105,24 L100,45 L92,45 L92,80 L92,282 Q92,288 98,288 L142,288 Q148,288 148,282 L148,80 L148,45 L140,45 L135,24 Z',
  },
]

function bottoms(legLengthY: number): GarmentShape[] {
  return [
    {
      role: 'garment',
      d: `M85,40 L155,40 L160,60 L160,${legLengthY} Q160,${legLengthY + 7} 154,${legLengthY + 7} L131,${legLengthY + 7} L129,110 L111,110 L109,${legLengthY + 7} L86,${legLengthY + 7} Q80,${legLengthY + 7} 80,${legLengthY} L80,60 Z`,
    },
  ]
}

const beanie: GarmentShape[] = [
  { role: 'garment', d: 'M70,110 Q70,50 120,45 Q170,50 170,110 L170,130 Q170,140 160,140 L80,140 Q70,140 70,130 Z' },
  { role: 'accent', d: 'M70,118 L170,118 L170,138 Q168,140 160,140 L80,140 Q72,140 70,138 Z' },
]

const capFront: GarmentShape[] = [
  { role: 'garment', d: 'M75,95 Q75,55 120,50 Q165,55 165,95 L165,100 Q165,108 155,108 L85,108 Q75,108 75,100 Z' },
  { role: 'accent', d: 'M90,105 Q120,125 150,105 L150,110 Q120,128 90,110 Z' },
]

const capBack: GarmentShape[] = [
  { role: 'garment', d: 'M75,95 Q75,55 120,50 Q165,55 165,95 L165,100 Q165,108 155,108 L85,108 Q75,108 75,100 Z' },
  { role: 'accent', d: 'M110,105 L130,105 L130,112 L110,112 Z' },
]

export const GARMENT_TEMPLATES: Record<GarmentType, GarmentTemplate> = {
  'T-shirt': {
    type: 'T-shirt',
    category: 'torso',
    frontBackDiffer: true,
    defaultColour: '#a1a1aa',
    front: torsoFront,
    back: torsoBack,
  },
  Polo: {
    type: 'Polo',
    category: 'torso',
    frontBackDiffer: true,
    defaultColour: '#a1a1aa',
    front: [
      ...torsoFront,
      { role: 'outline', d: 'M100,24 L115,40 L120,26 L125,40 L140,24' },
      { role: 'outline', d: 'M120,26 L120,55' },
    ],
    back: torsoBack,
  },
  Shirt: {
    type: 'Shirt',
    category: 'torso',
    frontBackDiffer: true,
    defaultColour: '#a1a1aa',
    front: [
      ...torsoFront,
      { role: 'outline', d: 'M96,22 L120,42 L144,22' },
      { role: 'outline', d: 'M120,42 L120,282' },
    ],
    back: torsoBack,
  },
  'Hi-Viz vest': {
    type: 'Hi-Viz vest',
    category: 'sleeveless',
    frontBackDiffer: true,
    defaultColour: '#f59e0b',
    front: [
      {
        role: 'garment',
        d: 'M85,30 L70,45 L70,282 Q70,288 76,288 L104,288 L104,120 L136,120 L136,288 L164,288 Q170,288 170,282 L170,45 L155,30 L145,45 L140,30 L100,30 L95,45 Z',
      },
      { role: 'accent', d: `M70,110 L104,110 L104,120 L70,120 Z` },
      { role: 'accent', d: `M136,110 L170,110 L170,120 L136,120 Z` },
      { role: 'accent', d: `M70,230 L104,230 L104,240 L70,240 Z` },
      { role: 'accent', d: `M136,230 L170,230 L170,240 L136,240 Z` },
    ],
    back: [
      {
        role: 'garment',
        d: 'M75,32 L70,45 L70,282 Q70,288 76,288 L164,288 Q170,288 170,282 L170,45 L165,32 L145,30 L120,26 L95,30 Z',
      },
      { role: 'accent', d: 'M70,110 L170,110 L170,120 L70,120 Z' },
      { role: 'accent', d: 'M70,230 L170,230 L170,240 L70,240 Z' },
    ],
  },
  Singlet: {
    type: 'Singlet',
    category: 'sleeveless',
    frontBackDiffer: false,
    defaultColour: '#a1a1aa',
    front: sleevelessBody,
    back: sleevelessBody,
    verticalOffsetPct: 9,
  },
  'Crew neck (jumper)': {
    type: 'Crew neck (jumper)',
    category: 'torso',
    frontBackDiffer: true,
    defaultColour: '#a1a1aa',
    front: [...torsoFront, { role: 'shade', d: 'M95,26 Q120,14 145,26 Q120,34 95,26 Z' }],
    back: [...torsoBack, { role: 'shade', d: 'M88,30 Q120,20 152,30 Q120,38 88,30 Z' }],
  },
  Hoody: {
    type: 'Hoody',
    category: 'hoody',
    frontBackDiffer: true,
    defaultColour: '#a1a1aa',
    front: [
      ...torsoFront,
      { role: 'outline', d: 'M110,30 L108,55' },
      { role: 'outline', d: 'M130,30 L132,55' },
      {
        role: 'shade',
        d: 'M95,180 Q95,175 100,175 L140,175 Q145,175 145,180 L145,215 Q145,222 138,222 L102,222 Q95,222 95,215 Z',
      },
    ],
    back: [...torsoBack, { role: 'accent', d: 'M85,15 Q120,-5 155,15 Q150,35 120,38 Q90,35 85,15 Z' }],
  },
  Shorts: {
    type: 'Shorts',
    category: 'bottoms',
    frontBackDiffer: false,
    defaultColour: '#a1a1aa',
    front: bottoms(148),
    back: bottoms(148),
  },
  Pants: {
    type: 'Pants',
    category: 'bottoms',
    frontBackDiffer: false,
    defaultColour: '#a1a1aa',
    front: bottoms(275),
    back: bottoms(275),
  },
  Bennie: {
    type: 'Bennie',
    category: 'headwear-beanie',
    frontBackDiffer: false,
    defaultColour: '#a1a1aa',
    front: beanie,
    back: beanie,
    printAnchorOverride: { x: 50, y: 71 },
  },
  Hats: {
    type: 'Hats',
    category: 'headwear-cap',
    frontBackDiffer: true,
    defaultColour: '#a1a1aa',
    front: capFront,
    back: capBack,
    printAnchorOverride: { x: 50, y: 43 },
  },
  Customized: {
    type: 'Customized',
    category: 'torso',
    frontBackDiffer: true,
    defaultColour: '#a1a1aa',
    front: torsoFront,
    back: torsoBack,
  },
}

export function getGarmentTemplate(type: GarmentType): GarmentTemplate {
  return GARMENT_TEMPLATES[type] ?? GARMENT_TEMPLATES.Customized
}

export function getGarmentShapes(type: GarmentType, view: 'Front' | 'Back'): GarmentShape[] {
  const template = getGarmentTemplate(type)
  return view === 'Front' ? template.front : template.back
}

// Shared by both renderers (GarmentMockup's plain JSX and the SVG-markup
// builder below) so the two never disagree on what a shape "role" means to
// look at — one place decides how garment/accent/shade/outline paint.
export function getGarmentShapeStyle(role: ShapeRole, garmentFill: string): { fill: string; stroke: string } {
  const fill = role === 'garment' ? garmentFill : role === 'accent' ? HI_VIZ_STRIP : role === 'shade' ? 'rgba(0,0,0,0.12)' : 'none'
  const stroke = role === 'outline' ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.15)'
  return { fill, stroke }
}

// Pure SVG-markup builder — no DOM, no Fabric. Used two ways: (1) embedded
// directly by GarmentMockup.tsx's plain-JSX renderer isn't this function at
// all (JSX maps over the shape array itself, avoiding dangerouslySetInnerHTML);
// (2) MockupCanvas.tsx calls this to build a data: URL Fabric can load as a
// background image, since Fabric needs a URL, not a React tree.
export function garmentTemplateToSvgMarkup(type: GarmentType, view: 'Front' | 'Back', colour: string): string {
  const fill = resolveGarmentColour(colour)
  const shapes = getGarmentShapes(type, view)
  const paths = shapes
    .map((shape) => {
      const style = getGarmentShapeStyle(shape.role, fill)
      return `<path d="${shape.d}" fill="${style.fill}" stroke="${style.stroke}" />`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${GARMENT_VIEW_BOX}">${paths}</svg>`
}

export function garmentTemplateToDataUrl(type: GarmentType, view: 'Front' | 'Back', colour: string): string {
  const markup = garmentTemplateToSvgMarkup(type, view, colour)
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`
}

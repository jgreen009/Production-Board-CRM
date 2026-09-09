import { describe, expect, it } from 'vitest'
import {
  GARMENT_TEMPLATES,
  garmentTemplateToDataUrl,
  garmentTemplateToSvgMarkup,
  getGarmentImage,
  getGarmentShapes,
  getGarmentTemplate,
} from './garmentTemplates'
import type { GarmentType } from '@/types'

const ALL_TYPES: GarmentType[] = [
  'T-shirt',
  'Polo',
  'Shirt',
  'Hi-Viz vest',
  'Singlet',
  'Crew neck (jumper)',
  'Hoody',
  'Shorts',
  'Pants',
  'Bennie',
  'Hats',
  'Customized',
]

describe('getGarmentTemplate', () => {
  it('returns a template for every catalog garment type', () => {
    for (const type of ALL_TYPES) {
      const template = getGarmentTemplate(type)
      expect(template.type).toBe(type)
      expect(template.front.length).toBeGreaterThan(0)
      expect(template.back.length).toBeGreaterThan(0)
    }
  })

  it('falls back safely to a reasonable template for an unrecognized type', () => {
    // Simulates stale/unexpected data (e.g. a renamed catalog entry) —
    // must not throw or return undefined.
    const template = getGarmentTemplate('Something Unexpected' as GarmentType)
    expect(template).toBeDefined()
    expect(template.front.length).toBeGreaterThan(0)
  })

  it('flags priority garments (§2) with front/back geometry that actually differs', () => {
    for (const type of ['T-shirt', 'Hoody', 'Polo', 'Crew neck (jumper)'] as GarmentType[]) {
      const template = getGarmentTemplate(type)
      expect(template.frontBackDiffer).toBe(true)
      expect(template.front).not.toEqual(template.back)
    }
  })
})

describe('getGarmentShapes (front/back lookup)', () => {
  it('returns different shapes for Front vs Back when frontBackDiffer is true', () => {
    const front = getGarmentShapes('Hoody', 'Front')
    const back = getGarmentShapes('Hoody', 'Back')
    expect(front).not.toEqual(back)
  })

  it('may share identical geometry for Front vs Back when frontBackDiffer is false', () => {
    expect(GARMENT_TEMPLATES.Singlet.frontBackDiffer).toBe(false)
    const front = getGarmentShapes('Singlet', 'Front')
    const back = getGarmentShapes('Singlet', 'Back')
    expect(front).toEqual(back)
  })
})

describe('headwear special cases moved into template config', () => {
  it('Bennie and Hats carry a printAnchorOverride instead of a component-level hack', () => {
    expect(GARMENT_TEMPLATES.Bennie.printAnchorOverride).toEqual({ x: 50, y: 71 })
    expect(GARMENT_TEMPLATES.Hats.printAnchorOverride).toEqual({ x: 50, y: 43 })
  })

  it('Singlet carries its vertical nudge in config, not a component-level hack', () => {
    expect(GARMENT_TEMPLATES.Singlet.verticalOffsetPct).toBe(9)
  })

  it('a standard torso garment has neither override', () => {
    expect(GARMENT_TEMPLATES['T-shirt'].printAnchorOverride).toBeUndefined()
    expect(GARMENT_TEMPLATES['T-shirt'].verticalOffsetPct).toBeUndefined()
  })
})

describe('getGarmentImage (real artwork, when available)', () => {
  it('returns a front and back image for every type except Customized', () => {
    for (const type of ALL_TYPES) {
      const front = getGarmentImage(type, 'Front')
      const back = getGarmentImage(type, 'Back')
      if (type === 'Customized') {
        expect(front).toBeUndefined()
        expect(back).toBeUndefined()
      } else {
        expect(front).toBeTruthy()
        expect(back).toBeTruthy()
      }
    }
  })
})

describe('garmentTemplateToDataUrl', () => {
  it('prefers real artwork over the generated vector markup when available', () => {
    const url = garmentTemplateToDataUrl('T-shirt', 'Front', 'Navy')
    expect(url).not.toContain('data:image/svg+xml')
    expect(url).toBe(getGarmentImage('T-shirt', 'Front'))
  })

  it('falls back to generated vector markup for a type with no real artwork', () => {
    const url = garmentTemplateToDataUrl('Customized', 'Front', 'Navy')
    expect(url).toContain('data:image/svg+xml')
  })
})

describe('garmentTemplateToSvgMarkup', () => {
  it('produces valid-looking SVG markup with the shared normalized viewBox', () => {
    const markup = garmentTemplateToSvgMarkup('T-shirt', 'Front', 'Navy')
    expect(markup).toContain('<svg')
    expect(markup).toContain('viewBox="0 0 240 300"')
    expect(markup).toContain('<path')
  })

  it('resolves the requested colour into the garment fill', () => {
    const markup = garmentTemplateToSvgMarkup('T-shirt', 'Front', 'Black')
    expect(markup).toContain('#18181b')
  })

  it('falls back to a safe neutral fill for an unresolvable colour, without throwing', () => {
    expect(() => garmentTemplateToSvgMarkup('T-shirt', 'Front', 'Not A Real Colour')).not.toThrow()
  })
})

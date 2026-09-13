import { describe, expect, it } from 'vitest'
import { emptyPublicPrintSpec, ensureDefaultPrintSpec, syncPrintSpecsToEffectiveGarment } from './publicPrintSpecDefaults'
import type { PublicPrintSpecFormValues } from '@/schemas/publicOrderFormSchema'

describe('emptyPublicPrintSpec', () => {
  it('produces a spec with a valid default position and a positive size (GarmentPreview has something to render immediately)', () => {
    const spec = emptyPublicPrintSpec('T-shirt', 'Navy')
    expect(spec.position).toBe('Left Chest')
    expect(spec.garmentType).toBe('T-shirt')
    expect(spec.garmentColour).toBe('Navy')
    expect(spec.widthMm).toBeGreaterThan(0)
    expect(spec.heightMm).toBeGreaterThan(0)
    expect(spec.artworkFileId).toBeNull()
  })

  it('generates a unique id each time', () => {
    const a = emptyPublicPrintSpec('T-shirt', 'Navy')
    const b = emptyPublicPrintSpec('T-shirt', 'Navy')
    expect(a.id).not.toBe(b.id)
  })
})

// GarmentPreview must be visible by default — Part 1 of the request.
// These pin down the exact decision logic the "no reveal button" behavior
// depends on: a print location (and therefore the preview) exists the
// moment a garment type is known, with no separate user action.
describe('ensureDefaultPrintSpec (GarmentPreview visible by default)', () => {
  it('seeds a print spec automatically once a garment type is known and none exists yet', () => {
    const result = ensureDefaultPrintSpec([], 'T-shirt', 'Navy', '')
    expect(result.changed).toBe(true)
    expect(result.printSpecs).toHaveLength(1)
    expect(result.printSpecs[0].garmentType).toBe('T-shirt')
    expect(result.activeSpecId).toBe(result.printSpecs[0].id)
  })

  it('does nothing while no garment type has been chosen yet (nothing to preview)', () => {
    const result = ensureDefaultPrintSpec([], '', '', '')
    expect(result.changed).toBe(false)
    expect(result.printSpecs).toEqual([])
  })

  it('does not add a second print spec once one already exists', () => {
    const existing: PublicPrintSpecFormValues[] = [
      { id: 'existing-1', position: 'Full Front', garmentType: 'T-shirt', garmentColour: 'Navy', widthMm: 300, heightMm: 300, colour: '', artworkFileId: null },
    ]
    const result = ensureDefaultPrintSpec(existing, 'T-shirt', 'Navy', 'existing-1')
    expect(result.changed).toBe(false)
    expect(result.printSpecs).toBe(existing)
    expect(result.activeSpecId).toBe('existing-1')
  })
})

describe('syncPrintSpecsToEffectiveGarment (garment selection keeps the preview current, never stale)', () => {
  const spec: PublicPrintSpecFormValues = {
    id: 'spec-1',
    position: 'Left Chest',
    garmentType: 'T-shirt',
    garmentColour: 'Navy',
    widthMm: 100,
    heightMm: 100,
    colour: '',
    artworkFileId: null,
  }

  it('updates every print spec to the new garment type/colour when the customer changes garment', () => {
    const updated = syncPrintSpecsToEffectiveGarment([spec], 'Hoody', 'Black')
    expect(updated[0].garmentType).toBe('Hoody')
    expect(updated[0].garmentColour).toBe('Black')
  })

  it('returns the identical array reference when nothing has changed (lets callers skip a state update)', () => {
    const specs = [spec]
    const updated = syncPrintSpecsToEffectiveGarment(specs, 'T-shirt', 'Navy')
    expect(updated).toBe(specs)
  })

  it('does not leave stale geometry from a previous garment on any print spec', () => {
    const specs: PublicPrintSpecFormValues[] = [spec, { ...spec, id: 'spec-2', position: 'Full Back' }]
    const updated = syncPrintSpecsToEffectiveGarment(specs, 'Polo', 'White')
    for (const s of updated) {
      expect(s.garmentType).toBe('Polo')
      expect(s.garmentColour).toBe('White')
    }
  })
})

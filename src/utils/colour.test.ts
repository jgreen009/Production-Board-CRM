import { describe, expect, it } from 'vitest'
import { FALLBACK_GARMENT_COLOUR, resolveGarmentColour } from './colour'

describe('resolveGarmentColour', () => {
  it('resolves common named colours', () => {
    expect(resolveGarmentColour('Black')).toBe('#18181b')
    expect(resolveGarmentColour('White')).toBe('#f8fafc')
    expect(resolveGarmentColour('Navy')).toBe('#1e2a4a')
    expect(resolveGarmentColour('Red')).toBe('#b91c1c')
    expect(resolveGarmentColour('Grey')).toBe('#a1a1aa')
    expect(resolveGarmentColour('Green')).toBe('#166534')
  })

  it('resolves the two-word "Royal Blue" phrase, not just "Royal"', () => {
    expect(resolveGarmentColour('Royal Blue')).toBe('#1d4ed8')
  })

  it('is case-insensitive', () => {
    expect(resolveGarmentColour('bLaCk')).toBe('#18181b')
  })

  it('resolves 6-digit and 3-digit hex values, with or without a leading #', () => {
    expect(resolveGarmentColour('#112233')).toBe('#112233')
    expect(resolveGarmentColour('112233')).toBe('#112233')
    expect(resolveGarmentColour('#fff')).toBe('#ffffff')
    expect(resolveGarmentColour('abc')).toBe('#aabbcc')
  })

  it('takes the first slash-separated segment for multi-colour labels', () => {
    expect(resolveGarmentColour('Black/White')).toBe('#18181b')
  })

  it('falls back to a safe neutral for anything unresolvable, without throwing', () => {
    expect(resolveGarmentColour('Some Custom Fabric Colour')).toBe(FALLBACK_GARMENT_COLOUR)
    expect(resolveGarmentColour('')).toBe(FALLBACK_GARMENT_COLOUR)
  })
})

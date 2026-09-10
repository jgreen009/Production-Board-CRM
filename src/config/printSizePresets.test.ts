import { describe, expect, it } from 'vitest'
import { matchPrintSizePreset, PRINT_SIZE_PRESETS } from './printSizePresets'

describe('matchPrintSizePreset', () => {
  it('matches an exact preset width', () => {
    expect(matchPrintSizePreset(210)).toBe('A4')
  })

  it('matches within a small floating-point tolerance', () => {
    expect(matchPrintSizePreset(297.001)).toBe('A3')
  })

  it('returns null for a size that matches no preset', () => {
    expect(matchPrintSizePreset(180)).toBeNull()
  })

  it('has a unique key per preset', () => {
    const keys = PRINT_SIZE_PRESETS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

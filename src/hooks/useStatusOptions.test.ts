import { describe, expect, it } from 'vitest'
import { toStatusConfig } from './useStatusOptions'
import type { StatusOption } from '@/api/statusOptions'

function option(overrides: Partial<StatusOption> = {}): StatusOption {
  return {
    id: 'opt-1',
    dimension: 'production',
    value: 'Completed',
    label: 'Completed',
    color: 'success',
    isSystem: true,
    active: true,
    sortOrder: 0,
    ...overrides,
  }
}

describe('toStatusConfig', () => {
  it('carries value and label through unchanged', () => {
    const config = toStatusConfig(option())
    expect(config.value).toBe('Completed')
    expect(config.label).toBe('Completed')
  })

  it('a renamed status keeps its original value in className lookups (value/label split)', () => {
    const config = toStatusConfig(option({ value: 'Completed', label: 'Finished' }))
    expect(config.value).toBe('Completed')
    expect(config.label).toBe('Finished')
  })

  it('maps every colour to a distinct className', () => {
    const classNames = new Set(
      (['neutral', 'danger', 'warning', 'success', 'info'] as const).map(
        (color) => toStatusConfig(option({ color })).className,
      ),
    )
    expect(classNames.size).toBe(5)
  })
})

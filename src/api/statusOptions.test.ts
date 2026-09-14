import { describe, expect, it } from 'vitest'
import { assertDeletable } from './statusOptions'
import type { StatusOption } from './statusOptions'

const baseOption: StatusOption = {
  id: 'opt-1',
  dimension: 'priority',
  value: 'Normal',
  label: 'Normal',
  color: 'neutral',
  isSystem: false,
  active: true,
  sortOrder: 0,
}

describe('assertDeletable', () => {
  it('allows deleting a non-system status', () => {
    expect(() => assertDeletable(baseOption)).not.toThrow()
  })

  it('refuses to delete a built-in (is_system) status', () => {
    expect(() => assertDeletable({ ...baseOption, isSystem: true })).toThrow(/built-in/)
  })
})

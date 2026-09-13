import { describe, expect, it } from 'vitest'
import { getOrderSourceLabel } from './orderSource'

describe('getOrderSourceLabel', () => {
  it('resolves a staff-created order to "Staff Created"', () => {
    expect(getOrderSourceLabel('staff')).toBe('Staff Created')
  })

  it('resolves a public-form order to "Customer Submitted"', () => {
    expect(getOrderSourceLabel('public_form')).toBe('Customer Submitted')
  })

  it('never surfaces the internal DB value itself, or internal implementation terms, as the label', () => {
    expect(getOrderSourceLabel('staff')).not.toBe('staff')
    expect(getOrderSourceLabel('public_form')).not.toBe('public_form')
    for (const value of [getOrderSourceLabel('staff'), getOrderSourceLabel('public_form')]) {
      expect(value.toLowerCase()).not.toContain('anonymous')
      expect(value.toLowerCase()).not.toContain('edge function')
      expect(value.toLowerCase()).not.toContain('rpc')
      expect(value.toLowerCase()).not.toContain('token')
    }
  })
})

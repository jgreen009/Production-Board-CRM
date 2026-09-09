import { describe, expect, it } from 'vitest'
import { mockupPreviewStoragePath } from './mockupPreviews'

describe('mockupPreviewStoragePath', () => {
  it('produces the canonical, stable path per docs/PHASE_3_PLAN.md §13/§17', () => {
    expect(mockupPreviewStoragePath('order-1', 'spec-1')).toBe('orders/order-1/print-specs/spec-1/preview.png')
  })

  it('is a pure function of (orderId, printSpecId) only — same inputs always produce the same path', () => {
    const a = mockupPreviewStoragePath('order-1', 'spec-1')
    const b = mockupPreviewStoragePath('order-1', 'spec-1')
    expect(a).toBe(b)
  })

  it('produces different paths for different print specs on the same order (one preview per PrintSpec)', () => {
    const a = mockupPreviewStoragePath('order-1', 'spec-1')
    const b = mockupPreviewStoragePath('order-1', 'spec-2')
    expect(a).not.toBe(b)
  })
})

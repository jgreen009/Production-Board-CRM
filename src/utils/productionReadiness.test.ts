import { describe, expect, it } from 'vitest'
import {
  compareWarningSeverity,
  getAttentionWarnings,
  getProductionBlockers,
  isReadyForProduction,
  selectPrimaryMockup,
} from './productionReadiness'
import { addDays, todayIso } from '@/utils/date'
import type { Order } from '@/types'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    orderNumber: 'SP-1001',
    customerId: 'c1',
    customer: 'Test Customer',
    jobName: 'Test Job',
    phone: '',
    email: '',
    createdAt: todayIso(),
    dueDate: addDays(todayIso(), 7),
    turnaroundType: 'Standard',
    quantity: 10,
    paymentStatus: 'Unpaid',
    artworkStatus: 'Approved',
    garmentStatus: 'Received',
    productionStatus: 'Queued',
    priority: 'Normal',
    deliveryMethod: 'Pick Up',
    rushFee: false,
    suppliesGarments: false,
    graphicDesignServices: false,
    specialisedApplication: false,
    services: [],
    garments: [],
    printSpecs: [],
    artwork: [],
    notes: '',
    productionNotes: '',
    staffCompleted: false,
    source: 'staff',
    ...overrides,
  }
}

describe('isReadyForProduction', () => {
  it('is ready: artwork approved, garments received, production not completed (C3)', () => {
    expect(isReadyForProduction(makeOrder())).toBe(true)
  })

  it('artwork Completed also counts as ready', () => {
    expect(isReadyForProduction(makeOrder({ artworkStatus: 'Completed' }))).toBe(true)
  })

  it('not ready: artwork awaiting approval (C4)', () => {
    expect(isReadyForProduction(makeOrder({ artworkStatus: 'Awaiting Approval' }))).toBe(false)
  })

  it('not ready: garments not received/supplied/completed/not-required', () => {
    expect(isReadyForProduction(makeOrder({ garmentStatus: 'Ordered' }))).toBe(false)
  })

  it('garments "Not Required" counts as ready', () => {
    expect(isReadyForProduction(makeOrder({ garmentStatus: 'Not Required' }))).toBe(true)
  })

  it('not ready once production is already Completed', () => {
    expect(isReadyForProduction(makeOrder({ productionStatus: 'Completed' }))).toBe(false)
  })

  it('payment status never affects readiness (Batch C: payment is tracking-only)', () => {
    expect(isReadyForProduction(makeOrder({ paymentStatus: 'Unpaid' }))).toBe(true)
    expect(isReadyForProduction(makeOrder({ paymentStatus: 'Paid' }))).toBe(true)
  })
})

describe('getProductionBlockers', () => {
  it('returns no blockers for a ready order', () => {
    expect(getProductionBlockers(makeOrder())).toEqual([])
  })

  it('names artwork approval as the blocker (C4)', () => {
    expect(getProductionBlockers(makeOrder({ artworkStatus: 'Awaiting Approval' }))).toEqual([
      'Artwork approval required',
    ])
  })

  it('names garments as a blocker', () => {
    expect(getProductionBlockers(makeOrder({ garmentStatus: 'Ordered' }))).toEqual(['Garments not ready'])
  })

  it('can report multiple blockers at once', () => {
    const blockers = getProductionBlockers(
      makeOrder({ artworkStatus: 'Mockup Required', garmentStatus: 'Need Ordering' }),
    )
    expect(blockers).toEqual(['Artwork approval required', 'Garments not ready'])
  })
})

describe('getAttentionWarnings', () => {
  it('a fully on-track order has no warnings', () => {
    expect(getAttentionWarnings(makeOrder())).toEqual([])
  })

  it('overdue + production not completed -> critical (C6)', () => {
    const warnings = getAttentionWarnings(makeOrder({ dueDate: addDays(todayIso(), -2) }))
    expect(warnings).toContainEqual({ severity: 'critical', message: 'Order overdue' })
  })

  it('due today + artwork not approved -> critical', () => {
    const warnings = getAttentionWarnings(
      makeOrder({ dueDate: todayIso(), artworkStatus: 'Mockup Required' }),
    )
    expect(warnings).toContainEqual({ severity: 'critical', message: 'Due today — artwork not approved' })
  })

  it('due tomorrow + artwork not approved -> warning (C5)', () => {
    const warnings = getAttentionWarnings(
      makeOrder({ dueDate: addDays(todayIso(), 1), artworkStatus: 'Awaiting Approval' }),
    )
    expect(warnings.some((w) => w.message === 'Due tomorrow — artwork not approved' && w.severity === 'warning')).toBe(
      true,
    )
  })

  it('same-day order + artwork incomplete -> critical', () => {
    const warnings = getAttentionWarnings(
      makeOrder({ turnaroundType: 'Same Day', artworkStatus: 'Need Artwork', dueDate: todayIso() }),
    )
    expect(warnings).toContainEqual({ severity: 'critical', message: 'Same-day order — artwork incomplete' })
  })

  it('urgent priority + garments not ready -> warning (C7)', () => {
    const warnings = getAttentionWarnings(makeOrder({ priority: 'Urgent', garmentStatus: 'Ordered' }))
    expect(warnings).toContainEqual({ severity: 'warning', message: 'Urgent — garments not ready' })
  })

  it('awaiting approval due soon -> info/warning depending on how soon', () => {
    const soon = getAttentionWarnings(makeOrder({ artworkStatus: 'Awaiting Approval', dueDate: addDays(todayIso(), 3) }))
    expect(soon).toContainEqual({ severity: 'info', message: 'Approval required before due date' })

    const verySoon = getAttentionWarnings(makeOrder({ artworkStatus: 'Awaiting Approval', dueDate: addDays(todayIso(), 1) }))
    expect(verySoon.some((w) => w.message === 'Approval required before due date' && w.severity === 'warning')).toBe(
      true,
    )
  })

  it('does not fire "approval required before due date" once already overdue (overdue rule covers it)', () => {
    const warnings = getAttentionWarnings(
      makeOrder({ artworkStatus: 'Awaiting Approval', dueDate: addDays(todayIso(), -1) }),
    )
    expect(warnings.some((w) => w.message === 'Approval required before due date')).toBe(false)
    expect(warnings).toContainEqual({ severity: 'critical', message: 'Order overdue' })
  })

  it('a completed production order never shows warnings, even if technically overdue (C12)', () => {
    expect(
      getAttentionWarnings(makeOrder({ productionStatus: 'Completed', dueDate: addDays(todayIso(), -5) })),
    ).toEqual([])
  })

  it('can raise multiple simultaneous warnings for one order, sorted most severe first', () => {
    const warnings = getAttentionWarnings(
      makeOrder({
        dueDate: addDays(todayIso(), -1), // overdue
        artworkStatus: 'Mockup Required',
        priority: 'Urgent',
        garmentStatus: 'Ordered',
      }),
    )
    expect(warnings.length).toBeGreaterThan(1)
    expect(warnings[0].severity).toBe('critical')
    // severities are non-decreasing (already sorted most severe first)
    for (let i = 1; i < warnings.length; i++) {
      expect(compareWarningSeverity(warnings[i - 1], warnings[i])).toBeLessThanOrEqual(0)
    }
  })
})

describe('compareWarningSeverity', () => {
  it('orders critical before warning before info', () => {
    const critical = { severity: 'critical' as const, message: 'a' }
    const warning = { severity: 'warning' as const, message: 'b' }
    const info = { severity: 'info' as const, message: 'c' }
    const sorted = [info, warning, critical].sort(compareWarningSeverity)
    expect(sorted.map((w) => w.severity)).toEqual(['critical', 'warning', 'info'])
  })
})

describe('selectPrimaryMockup', () => {
  it('delegates to the print spec with a generated preview, falling back to the first', () => {
    const order = makeOrder({
      printSpecs: [
        { id: '1', position: 'Left Chest', colour: 'White', widthMm: 100, heightMm: 80, rotationDeg: 0 },
        {
          id: '2',
          position: 'Full Back',
          colour: 'White',
          widthMm: 200,
          heightMm: 160,
          rotationDeg: 0,
          previewStoragePath: 'orders/o1/print-specs/2/preview.png',
        },
      ],
    })
    expect(selectPrimaryMockup(order)?.id).toBe('2')
  })

  it('returns undefined for an order with no print specs', () => {
    expect(selectPrimaryMockup(makeOrder({ printSpecs: [] }))).toBeUndefined()
  })
})

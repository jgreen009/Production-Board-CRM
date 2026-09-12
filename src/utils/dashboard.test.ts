import { describe, expect, it } from 'vitest'
import { averageTurnaroundDays, ordersByAssignee, ordersByProductionStatus, overdueOrders } from './dashboard'
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

describe('overdueOrders', () => {
  it('includes an active order with a past due date', () => {
    const order = makeOrder({ dueDate: addDays(todayIso(), -3) })
    expect(overdueOrders([order])).toEqual([order])
  })

  it('excludes a Completed order even if its due date is in the past', () => {
    const order = makeOrder({ productionStatus: 'Completed', dueDate: addDays(todayIso(), -30) })
    expect(overdueOrders([order])).toEqual([])
  })

  it('excludes an order due today or in the future', () => {
    const order = makeOrder({ dueDate: todayIso() })
    expect(overdueOrders([order])).toEqual([])
  })
})

describe('ordersByProductionStatus', () => {
  it('groups and counts orders by their production status', () => {
    const orders = [
      makeOrder({ id: 'a', productionStatus: 'Queued' }),
      makeOrder({ id: 'b', productionStatus: 'Queued' }),
      makeOrder({ id: 'c', productionStatus: 'In Production' }),
    ]
    const result = ordersByProductionStatus(orders)
    expect(result).toEqual([
      { status: 'Queued', count: 2 },
      { status: 'In Production', count: 1 },
    ])
  })

  it('returns an empty array for no orders', () => {
    expect(ordersByProductionStatus([])).toEqual([])
  })
})

describe('averageTurnaroundDays', () => {
  it('returns null when there are no completed orders', () => {
    const order = makeOrder({ productionStatus: 'Queued' })
    expect(averageTurnaroundDays([order])).toBeNull()
  })

  it('computes turnaround for a single completed order (completedAt - createdAt)', () => {
    const order = makeOrder({
      createdAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-04T00:00:00.000Z',
    })
    expect(averageTurnaroundDays([order])).toBe(3)
  })

  it('averages turnaround across multiple completed orders, rounded to 1 decimal place', () => {
    const orders = [
      makeOrder({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-02T00:00:00.000Z' }),
      makeOrder({ id: 'b', createdAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-04T00:00:00.000Z' }),
    ]
    // (1 + 3) / 2 = 2 exactly
    expect(averageTurnaroundDays(orders)).toBe(2)
  })

  it('rounds a fractional average to 1 decimal place', () => {
    const orders = [
      makeOrder({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-02T00:00:00.000Z' }),
      makeOrder({ id: 'b', createdAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-03T00:00:00.000Z' }),
    ]
    // (1 + 2) / 2 = 1.5
    expect(averageTurnaroundDays(orders)).toBe(1.5)
  })

  it('excludes incomplete orders from the average even when mixed with completed ones', () => {
    const orders = [
      makeOrder({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-03T00:00:00.000Z' }),
      makeOrder({ id: 'b', productionStatus: 'Queued', completedAt: undefined }),
    ]
    expect(averageTurnaroundDays(orders)).toBe(2)
  })
})

describe('ordersByAssignee', () => {
  it('counts orders grouped by assignee', () => {
    const orders = [
      makeOrder({ id: 'a', assignedTo: 'u1', assignedToName: 'Alex' }),
      makeOrder({ id: 'b', assignedTo: 'u1', assignedToName: 'Alex' }),
      makeOrder({ id: 'c', assignedTo: 'u2', assignedToName: 'Sam' }),
    ]
    const result = ordersByAssignee(orders)
    expect(result).toEqual([
      { assignedTo: 'u1', assigneeName: 'Alex', count: 2 },
      { assignedTo: 'u2', assigneeName: 'Sam', count: 1 },
    ])
  })

  it('groups unassigned orders under a single Unassigned bucket', () => {
    const orders = [makeOrder({ id: 'a', assignedTo: undefined }), makeOrder({ id: 'b', assignedTo: undefined })]
    expect(ordersByAssignee(orders)).toEqual([{ assignedTo: null, assigneeName: 'Unassigned', count: 2 }])
  })

  it('excludes Completed orders from workload counts', () => {
    const orders = [makeOrder({ id: 'a', assignedTo: 'u1', assignedToName: 'Alex', productionStatus: 'Completed' })]
    expect(ordersByAssignee(orders)).toEqual([])
  })
})

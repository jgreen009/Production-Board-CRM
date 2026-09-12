import { describe, expect, it } from 'vitest'
import { compareQueueRank, getProductionQueueRank, queueTierLabel } from './productionQueue'
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

describe('getProductionQueueRank', () => {
  it('ranks a past due date as overdue', () => {
    const order = makeOrder({ dueDate: addDays(todayIso(), -1) })
    expect(getProductionQueueRank(order)).toBe('overdue')
  })

  it('ranks a Same Day turnaround order as same-day, even if not due for a few days', () => {
    const order = makeOrder({ turnaroundType: 'Same Day', dueDate: addDays(todayIso(), 2) })
    expect(getProductionQueueRank(order)).toBe('same-day')
  })

  it('ranks an Urgent-priority order as urgent-or-due-today regardless of due date', () => {
    const order = makeOrder({ priority: 'Urgent', dueDate: addDays(todayIso(), 5) })
    expect(getProductionQueueRank(order)).toBe('urgent-or-due-today')
  })

  it('ranks a Normal-priority order due today as urgent-or-due-today', () => {
    const order = makeOrder({ dueDate: todayIso() })
    expect(getProductionQueueRank(order)).toBe('urgent-or-due-today')
  })

  it('ranks an order due tomorrow as due-tomorrow', () => {
    const order = makeOrder({ dueDate: addDays(todayIso(), 1) })
    expect(getProductionQueueRank(order)).toBe('due-tomorrow')
  })

  it('ranks everything else as upcoming', () => {
    const order = makeOrder({ dueDate: addDays(todayIso(), 7) })
    expect(getProductionQueueRank(order)).toBe('upcoming')
  })

  it('ranks a Completed order as upcoming (lowest priority) even if technically overdue', () => {
    const order = makeOrder({ productionStatus: 'Completed', dueDate: addDays(todayIso(), -30), priority: 'Urgent' })
    expect(getProductionQueueRank(order)).toBe('upcoming')
  })

  it('overdue outranks Same Day when both technically apply', () => {
    const order = makeOrder({ turnaroundType: 'Same Day', dueDate: addDays(todayIso(), -1) })
    expect(getProductionQueueRank(order)).toBe('overdue')
  })
})

describe('compareQueueRank', () => {
  it('sorts overdue before same-day before urgent-or-due-today before due-tomorrow before upcoming', () => {
    const overdue = makeOrder({ id: 'overdue', dueDate: addDays(todayIso(), -1) })
    const sameDay = makeOrder({ id: 'same-day', turnaroundType: 'Same Day', dueDate: addDays(todayIso(), 3) })
    const urgent = makeOrder({ id: 'urgent', priority: 'Urgent', dueDate: addDays(todayIso(), 5) })
    const tomorrow = makeOrder({ id: 'tomorrow', dueDate: addDays(todayIso(), 1) })
    const upcoming = makeOrder({ id: 'upcoming', dueDate: addDays(todayIso(), 10) })

    const sorted = [upcoming, tomorrow, urgent, sameDay, overdue].sort(compareQueueRank)
    expect(sorted.map((o) => o.id)).toEqual(['overdue', 'same-day', 'urgent', 'tomorrow', 'upcoming'])
  })

  it('is stable/deterministic for orders in the same tier (no reordering beyond the tier grouping)', () => {
    const a = makeOrder({ id: 'a', dueDate: addDays(todayIso(), 10) })
    const b = makeOrder({ id: 'b', dueDate: addDays(todayIso(), 20) })
    expect(compareQueueRank(a, b)).toBe(0)
  })
})

describe('queueTierLabel', () => {
  it('has a human-readable label for every tier', () => {
    expect(queueTierLabel('overdue')).toBe('Overdue')
    expect(queueTierLabel('same-day')).toBe('Same Day')
    expect(queueTierLabel('urgent-or-due-today')).toBe('Urgent / Due Today')
    expect(queueTierLabel('due-tomorrow')).toBe('Due Tomorrow')
    expect(queueTierLabel('upcoming')).toBe('Upcoming')
  })
})

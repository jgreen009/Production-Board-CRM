import { describe, expect, it } from 'vitest'
import { diffOrderForActivity } from '@/api/orders'
import { defaultOrderFormValues } from '@/pages/new-order/defaultValues'
import type { Order } from '@/types'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    orderNumber: 'SP-1001',
    customerId: 'c1',
    customer: 'Kelston Rugby Club',
    jobName: 'Home Jersey Reprint',
    phone: '',
    email: '',
    createdAt: '2026-01-01T00:00:00Z',
    dueDate: '2026-01-10',
    turnaroundType: 'Standard',
    quantity: 10,
    paymentStatus: 'Unpaid',
    artworkStatus: 'Not Started',
    garmentStatus: 'Not Required',
    productionStatus: 'New',
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
    ...overrides,
  }
}

describe('diffOrderForActivity', () => {
  it('returns no entries when nothing diffable changed', () => {
    const previous = makeOrder()
    const values = defaultOrderFormValues()
    values.priority = previous.priority
    values.paymentStatus = previous.paymentStatus

    expect(diffOrderForActivity(previous, values)).toEqual([])
  })

  it('logs a priority entry when priority changed', () => {
    const previous = makeOrder({ priority: 'Normal' })
    const values = defaultOrderFormValues()
    values.priority = 'Urgent'
    values.paymentStatus = previous.paymentStatus

    expect(diffOrderForActivity(previous, values)).toEqual([
      { activityType: 'priority', message: 'Priority changed to Urgent' },
    ])
  })

  it('logs a payment entry when payment status changed', () => {
    const previous = makeOrder({ paymentStatus: 'Unpaid' })
    const values = defaultOrderFormValues()
    values.priority = previous.priority
    values.paymentStatus = 'Paid'

    expect(diffOrderForActivity(previous, values)).toEqual([
      { activityType: 'payment', message: 'Payment status changed to Paid' },
    ])
  })

  it('logs both when both changed, and never logs due date (no matching activity_type)', () => {
    const previous = makeOrder({ priority: 'Normal', paymentStatus: 'Unpaid', dueDate: '2026-01-10' })
    const values = defaultOrderFormValues()
    values.priority = 'High'
    values.paymentStatus = 'Deposit Paid'
    values.dueDate = '2026-02-01'

    expect(diffOrderForActivity(previous, values)).toEqual([
      { activityType: 'priority', message: 'Priority changed to High' },
      { activityType: 'payment', message: 'Payment status changed to Deposit Paid' },
    ])
  })

  it('logs a mockup entry when a print spec approval note changed', () => {
    const previous = makeOrder({
      printSpecs: [
        {
          id: 'ps1',
          position: 'Left Chest',
          colour: 'White',
          widthMm: 100,
          heightMm: 100,
          offsetX: 0,
          offsetY: 0,
          rotationDeg: 0,
          approvalNote: 'Please check logo colour',
        },
      ],
    })
    const values = defaultOrderFormValues()
    values.priority = previous.priority
    values.paymentStatus = previous.paymentStatus
    values.printSpecs = [
      {
        id: 'ps1',
        position: 'Left Chest',
        colour: 'White',
        widthMm: 100,
        heightMm: 100,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        approvalNote: 'Looks good, approved',
      },
    ]

    expect(diffOrderForActivity(previous, values)).toEqual([
      { activityType: 'mockup', message: 'Mockup note updated for Left Chest' },
    ])
  })

  it('does not log a mockup entry when the approval note is unchanged', () => {
    const previous = makeOrder({
      printSpecs: [
        {
          id: 'ps1',
          position: 'Left Chest',
          colour: 'White',
          widthMm: 100,
          heightMm: 100,
          offsetX: 0,
          offsetY: 0,
          rotationDeg: 0,
          approvalNote: 'Same note',
        },
      ],
    })
    const values = defaultOrderFormValues()
    values.priority = previous.priority
    values.paymentStatus = previous.paymentStatus
    values.printSpecs = [
      {
        id: 'ps1',
        position: 'Left Chest',
        colour: 'White',
        widthMm: 100,
        heightMm: 100,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        approvalNote: 'Same note',
      },
    ]

    expect(diffOrderForActivity(previous, values)).toEqual([])
  })
})

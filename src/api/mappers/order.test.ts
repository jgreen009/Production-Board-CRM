import { describe, expect, it } from 'vitest'
import { mapDatabaseOrderToDomain, mapOrderFormToUpsertPayload } from '@/api/mappers/order'
import type { OrderRow } from '@/api/mappers/order'
import { defaultOrderFormValues, emptyGarment } from '@/pages/new-order/defaultValues'

describe('mapOrderFormToUpsertPayload', () => {
  it('renames turnaround to turnaroundType and passes the rest through', () => {
    const values = defaultOrderFormValues()
    values.turnaround = 'Rush'
    values.jobName = 'Test Job'
    values.garments = [emptyGarment()]
    values.services = ['Screen Printing']

    const payload = mapOrderFormToUpsertPayload(values)

    expect(payload.turnaroundType).toBe('Rush')
    expect(payload).not.toHaveProperty('turnaround')
    expect(payload.jobName).toBe('Test Job')
    expect(payload.services).toEqual(['Screen Printing'])
    expect(payload.garments).toHaveLength(1)
  })
})

describe('mapDatabaseOrderToDomain', () => {
  const baseRow: OrderRow = {
    id: 'o1',
    customer_id: 'c1',
    order_number: 'SP-1001',
    job_name: 'Home Jersey Reprint',
    phone: '0412 334 556',
    email: 'admin@kelstonrugby.com.au',
    created_at: '2026-01-01T00:00:00Z',
    due_date: '2026-01-10',
    turnaround_type: 'Rush',
    payment_status: 'Deposit Paid',
    artwork_status: 'Approved',
    garment_status: 'Received',
    production_status: 'In Production',
    priority: 'Urgent',
    delivery_method: 'Pick Up',
    rush_fee: true,
    supplies_garments: false,
    graphic_design_services: false,
    specialised_application: false,
    specialised_application_details: null,
    notes: 'Chase up today.',
    production_notes: '',
    staff_completed: false,
    order_state: 'Active',
    customers: { name: 'Dave Kelston', company: 'Kelston Rugby Club' },
    order_garments: [
      {
        id: 'g1',
        garment_type_label: 'T-shirt',
        garment_brand_label: 'AS colour',
        colour: 'Navy',
        sizing_type: 'Adult',
        sort_order: 0,
        garment_quantities: [
          { size: 'M', quantity: 8 },
          { size: 'L', quantity: 10 },
        ],
      },
    ],
    order_services: [{ services: { name: 'Screen Printing' } }],
    print_specs: [],
  }

  it('prefers the customer company for the denormalized display name', () => {
    const order = mapDatabaseOrderToDomain(baseRow)
    expect(order.customer).toBe('Kelston Rugby Club')
    expect(order.customerId).toBe('c1')
  })

  it('falls back to job_name when there is no linked customer', () => {
    const order = mapDatabaseOrderToDomain({ ...baseRow, customer_id: null, customers: null })
    expect(order.customer).toBe('Home Jersey Reprint')
    expect(order.customerId).toBe('')
  })

  it('computes quantity as the sum of all garment quantities', () => {
    const order = mapDatabaseOrderToDomain(baseRow)
    expect(order.quantity).toBe(18)
  })

  it('drops an order_services row with no joined service (defensive against a dangling id)', () => {
    const order = mapDatabaseOrderToDomain({
      ...baseRow,
      order_services: [{ services: { name: 'Screen Printing' } }, { services: null }],
    })
    expect(order.services).toEqual([{ name: 'Screen Printing', enabled: true }])
  })
})

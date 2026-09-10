import { describe, expect, it } from 'vitest'
import { mapDatabaseOrderToDomain, mapDatabaseOrderToFormValues, mapOrderFormToUpsertPayload } from '@/api/mappers/order'
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
    assigned_to: null,
    customers: { name: 'Dave Kelston', company: 'Kelston Rugby Club' },
    assignee: null,
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
    artwork: [],
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

  it('maps artwork rows to the domain shape (fixed in Milestone 8 — used to always be [])', () => {
    const order = mapDatabaseOrderToDomain({
      ...baseRow,
      artwork: [
        { id: 'aw1', file_name: 'logo.png', file_type: 'PNG', file_size_bytes: 2048, storage_path: 'x', created_at: '2026-01-01T00:00:00Z' },
      ],
    })
    expect(order.artwork).toEqual([
      { id: 'aw1', fileName: 'logo.png', fileType: 'PNG', sizeKb: 2, uploadedAt: '2026-01-01T00:00:00Z', storagePath: 'x' },
    ])
  })

  it('is unassigned when assigned_to is null', () => {
    const order = mapDatabaseOrderToDomain({ ...baseRow, assigned_to: null, assignee: null })
    expect(order.assignedTo).toBeUndefined()
    expect(order.assignedToName).toBeNull()
  })

  it('surfaces the joined assignee name and active status', () => {
    const order = mapDatabaseOrderToDomain({
      ...baseRow,
      assigned_to: 'staff-1',
      assignee: { full_name: 'James Smith', is_active: true },
    })
    expect(order.assignedTo).toBe('staff-1')
    expect(order.assignedToName).toBe('James Smith')
    expect(order.assignedToActive).toBe(true)
  })

  it('preserves a historical assignee’s name even when they’re now inactive', () => {
    const order = mapDatabaseOrderToDomain({
      ...baseRow,
      assigned_to: 'staff-1',
      assignee: { full_name: 'James Smith', is_active: false },
    })
    expect(order.assignedTo).toBe('staff-1')
    expect(order.assignedToName).toBe('James Smith')
    expect(order.assignedToActive).toBe(false)
  })
})

describe('mapDatabaseOrderToFormValues', () => {
  const row: OrderRow = {
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
    specialised_application: true,
    specialised_application_details: 'Puff print on logo',
    notes: 'Chase up today.',
    production_notes: '',
    staff_completed: false,
    order_state: 'Active',
    assigned_to: null,
    customers: { name: 'Dave Kelston', company: 'Kelston Rugby Club' },
    assignee: null,
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
    print_specs: [
      {
        id: 'p1',
        position: 'Left Chest',
        colour: 'White',
        width_mm: 105,
        height_mm: 148,
        garment_type: 'T-shirt',
        garment_colour: 'Navy',
        artwork_id: null,
        offset_x: null,
        offset_y: null,
        sort_order: 0,
        rotation_deg: 0,
        preview_storage_path: null,
        approval_note: null,
      },
    ],
    artwork: [
      { id: 'aw1', file_name: 'logo.png', file_type: 'PNG', file_size_bytes: 2048, storage_path: 'orders/o1/artwork/aw1/logo.png', created_at: '2026-01-01T00:00:00Z' },
    ],
  }

  it('fills in every adult size (not just the non-zero ones) so the size grid renders correctly', () => {
    const values = mapDatabaseOrderToFormValues(row)
    expect(values.garments[0].adultQuantities).toEqual({
      S: 0, M: 8, L: 10, XL: 0, '2XL': 0, '3XL': 0, '4XL': 0, '5XL': 0,
    })
  })

  it('never sets newCustomerName — an edited order already has a real customerId', () => {
    const values = mapDatabaseOrderToFormValues(row)
    expect(values.customerId).toBe('c1')
    expect(values.newCustomerName).toBe('')
  })

  it('renames turnaround_type back to the form field name turnaround', () => {
    const values = mapDatabaseOrderToFormValues(row)
    expect(values.turnaround).toBe('Rush')
  })

  it('carries storagePath through for artwork files, with no previewUrl (fetched separately)', () => {
    const values = mapDatabaseOrderToFormValues(row)
    expect(values.artworkFiles).toEqual([
      { id: 'aw1', fileName: 'logo.png', fileType: 'PNG', sizeKb: 2, previewUrl: undefined, storagePath: 'orders/o1/artwork/aw1/logo.png' },
    ])
  })

  it('pre-populates specialisedApplicationDetails for acceptance test #17', () => {
    const values = mapDatabaseOrderToFormValues(row)
    expect(values.specialisedApplication).toBe(true)
    expect(values.specialisedApplicationDetails).toBe('Puff print on logo')
  })

  it('carries assigned_to through to assignedTo for the edit form', () => {
    const assignedRow: OrderRow = { ...row, assigned_to: 'staff-1' }
    const values = mapDatabaseOrderToFormValues(assignedRow)
    expect(values.assignedTo).toBe('staff-1')
  })
})

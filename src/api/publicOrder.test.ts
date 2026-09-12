import { describe, expect, it } from 'vitest'
import { buildPublicOrderSubmissionPayload } from './publicOrder'
import type { PublicOrderFormValues } from '@/schemas/publicOrderFormSchema'

function baseValues(overrides: Partial<PublicOrderFormValues> = {}): PublicOrderFormValues {
  return {
    customerName: 'Jane Smith',
    company: 'Jane Co',
    email: 'jane@example.com',
    phone: '0400 000 000',
    jobTitle: 'Team Tees',
    dueDate: '2026-10-01',
    deliveryMethod: 'Pick Up',
    services: ['Screen Printing'],
    garments: [
      {
        id: 'g1',
        type: 'T-shirt',
        brand: 'AS colour',
        colour: 'Navy',
        sizing: 'Adult',
        adultQuantities: { M: 5, L: 3 },
        youthQuantities: {},
      },
    ],
    artworkFiles: [],
    printSpecs: [
      {
        id: 'spec-1',
        position: 'Left Chest',
        garmentType: 'T-shirt',
        garmentColour: 'Navy',
        widthMm: 100,
        heightMm: 100,
        colour: 'White',
        artworkFileId: 'file-1',
      },
    ],
    notes: 'Please rush if possible',
    ...overrides,
  }
}

describe('buildPublicOrderSubmissionPayload', () => {
  it('maps customer fields correctly', () => {
    const payload = buildPublicOrderSubmissionPayload(baseValues())
    expect(payload.customer).toEqual({ name: 'Jane Smith', company: 'Jane Co', email: 'jane@example.com', phone: '0400 000 000' })
  })

  it('maps garments and quantities through unchanged', () => {
    const payload = buildPublicOrderSubmissionPayload(baseValues())
    expect(payload.garments).toEqual([
      { type: 'T-shirt', brand: 'AS colour', colour: 'Navy', sizing: 'Adult', adultQuantities: { M: 5, L: 3 }, youthQuantities: {} },
    ])
  })

  it('maps services through unchanged', () => {
    const payload = buildPublicOrderSubmissionPayload(baseValues())
    expect(payload.services).toEqual(['Screen Printing'])
  })

  it('maps print specs, resolving artworkFileId to artworkKey', () => {
    const payload = buildPublicOrderSubmissionPayload(baseValues())
    expect(payload.printSpecs).toEqual([
      { id: 'spec-1', position: 'Left Chest', colour: 'White', widthMm: 100, heightMm: 100, garmentType: 'T-shirt', garmentColour: 'Navy', artworkKey: 'file-1' },
    ])
  })

  it('preserves the print spec id exactly (a stable client-generated UUID in real use, not regenerated here)', () => {
    const payload = buildPublicOrderSubmissionPayload(baseValues())
    expect(payload.printSpecs[0].id).toBe('spec-1')
  })

  it('maps customer notes into order.notes, and nowhere else', () => {
    const payload = buildPublicOrderSubmissionPayload(baseValues())
    expect(payload.order.notes).toBe('Please rush if possible')
  })

  it('never includes a productionNotes/approvalNote field anywhere in the payload', () => {
    const payload = buildPublicOrderSubmissionPayload(baseValues())
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('productionNotes')
    expect(serialized).not.toContain('approvalNote')
  })

  it('never includes a priority field anywhere in the payload, even if present on the input object', () => {
    const values = baseValues() as PublicOrderFormValues & { priority?: string }
    values.priority = 'Urgent' // simulates a maliciously/accidentally augmented object
    const payload = buildPublicOrderSubmissionPayload(values)
    expect(JSON.stringify(payload)).not.toContain('priority')
    expect(JSON.stringify(payload)).not.toContain('Urgent')
  })

  it('never includes paymentStatus/artworkStatus/garmentStatus/productionStatus/assignedTo/staffCompleted fields', () => {
    const values = baseValues() as PublicOrderFormValues & Record<string, unknown>
    values.paymentStatus = 'Paid'
    values.artworkStatus = 'Approved'
    values.garmentStatus = 'Ordered'
    values.productionStatus = 'In Production'
    values.assignedTo = 'some-staff-id'
    values.staffCompleted = true
    const payload = buildPublicOrderSubmissionPayload(values)
    const serialized = JSON.stringify(payload)
    for (const forbidden of ['paymentStatus', 'artworkStatus', 'garmentStatus', 'productionStatus', 'assignedTo', 'staffCompleted', 'Paid', 'Approved', 'In Production']) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it('never includes offsetX/offsetY on any print spec', () => {
    const payload = buildPublicOrderSubmissionPayload(baseValues())
    for (const spec of payload.printSpecs) {
      expect('offsetX' in spec).toBe(false)
      expect('offsetY' in spec).toBe(false)
    }
  })

  it('falls back to the customer name as the job title when none is provided', () => {
    const payload = buildPublicOrderSubmissionPayload(baseValues({ jobTitle: undefined }))
    expect(payload.order.jobName).toBe('Jane Smith')
  })

  it('handles an empty artworkFileId (no artwork attached to this print location) as null in the key', () => {
    const values = baseValues({
      printSpecs: [
        { id: 'spec-2', position: 'Full Back', garmentType: 'T-shirt', garmentColour: 'Navy', widthMm: 200, heightMm: 200, colour: 'White', artworkFileId: null },
      ],
    })
    const payload = buildPublicOrderSubmissionPayload(values)
    expect(payload.printSpecs[0].artworkKey).toBeNull()
  })
})

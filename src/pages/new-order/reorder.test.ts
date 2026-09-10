import { describe, expect, it } from 'vitest'
import { buildReorderFormValues } from './reorder'
import type { OrderFormValues } from '@/schemas/orderFormSchema'

function makeSourceValues(overrides: Partial<OrderFormValues> = {}): OrderFormValues {
  return {
    orderDate: '2026-01-01',
    customerId: 'cust-1',
    newCustomerName: '',
    jobName: 'Kelston Rugby Home Jersey',
    email: 'dave@kelstonrugby.com.au',
    phone: '0412 334 556',
    dueDate: '2026-01-10',
    rushFee: true,
    turnaround: 'Rush',
    deliveryMethod: 'Delivery',
    priority: 'High',
    services: ['Screen Printing', 'Embroidery'],
    suppliesGarments: true,
    graphicDesignServices: false,
    specialisedApplication: true,
    specialisedApplicationDetails: 'Puff print on crest',
    garments: [
      {
        id: 'g1',
        type: 'T-shirt',
        brand: 'AS colour',
        colour: 'Navy',
        sizing: 'Adult',
        adultQuantities: { S: 0, M: 8, L: 10, XL: 2, '2XL': 0, '3XL': 0, '4XL': 0, '5XL': 0 },
        youthQuantities: { '2': 0, '4': 0, '6': 0, '8': 0, '10': 0, '12': 0, '14': 0, '16': 0, '18': 0 },
      },
    ],
    artworkFiles: [
      { id: 'aw-1', fileName: 'crest.png', fileType: 'PNG', sizeKb: 120, previewUrl: 'blob:crest', storagePath: 'orders/src-order/artwork/aw-1/crest.png' },
      { id: 'aw-2', fileName: 'sponsor.pdf', fileType: 'PDF', sizeKb: 400, previewUrl: undefined, storagePath: 'orders/src-order/artwork/aw-2/sponsor.pdf' },
    ],
    printSpecs: [
      {
        id: 'ps-1',
        position: 'Left Chest',
        colour: 'White',
        widthMm: 100,
        heightMm: 100,
        garmentType: 'T-shirt',
        garmentColour: 'Navy',
        artworkId: 'aw-1',
        offsetX: 0.1,
        offsetY: -0.2,
        rotationDeg: 15,
        previewStoragePath: 'mockup-previews/orders/src-order/print-specs/ps-1/preview.png',
        approvalNote: 'Move logo up slightly',
      },
      {
        id: 'ps-2',
        position: 'Full Back',
        colour: 'White',
        widthMm: 300,
        heightMm: 250,
        garmentType: 'T-shirt',
        garmentColour: 'Navy',
        artworkId: 'aw-1',
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        previewStoragePath: 'mockup-previews/orders/src-order/print-specs/ps-2/preview.png',
        approvalNote: undefined,
      },
    ],
    paymentStatus: 'Paid',
    productionNotes: 'Deliver to loading dock, ask for Dave.',
    notes: 'Customer wants extra XLs this time.',
    assignedTo: 'staff-1',
    staffCompleted: true,
    ...overrides,
  }
}

describe('buildReorderFormValues — REGENERATE', () => {
  it('gives every copied PrintSpec a brand-new UUID, never reusing the source id', () => {
    const source = makeSourceValues()
    const result = buildReorderFormValues(source)
    const sourceIds = new Set(source.printSpecs.map((p) => p.id))
    for (const spec of result.printSpecs) {
      expect(sourceIds.has(spec.id)).toBe(false)
      expect(spec.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    }
  })

  it('produces a distinct new id for every PrintSpec, not the same id repeated', () => {
    const result = buildReorderFormValues(makeSourceValues())
    const ids = result.printSpecs.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // order id / order number are server-assigned (upsert_order / a DB
  // trigger) and never appear in OrderFormValues at all — nothing in this
  // pure function could reuse them even by accident. Covered by
  // NewOrderForm always calling upsertOrder(values, null, ...) for a
  // reorder's first save, exercised in the manual/E2 acceptance test.
})

describe('buildReorderFormValues — COPY', () => {
  it('copies the customer', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.customerId).toBe('cust-1')
  })

  it('copies services', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.services).toEqual(['Screen Printing', 'Embroidery'])
  })

  it('copies garments', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.garments).toHaveLength(1)
    expect(result.garments[0].type).toBe('T-shirt')
    expect(result.garments[0].brand).toBe('AS colour')
    expect(result.garments[0].colour).toBe('Navy')
  })

  it('copies garment quantities', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.garments[0].adultQuantities).toEqual({ S: 0, M: 8, L: 10, XL: 2, '2XL': 0, '3XL': 0, '4XL': 0, '5XL': 0 })
  })

  it('copies priority', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.priority).toBe('High')
  })

  it('copies turnaround', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.turnaround).toBe('Rush')
  })

  it('copies delivery method', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.deliveryMethod).toBe('Delivery')
  })

  it('copies PrintSpec position', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.printSpecs.map((p) => p.position)).toEqual(['Left Chest', 'Full Back'])
  })

  it('copies PrintSpec width/height', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.printSpecs[0].widthMm).toBe(100)
    expect(result.printSpecs[0].heightMm).toBe(100)
    expect(result.printSpecs[1].widthMm).toBe(300)
    expect(result.printSpecs[1].heightMm).toBe(250)
  })

  it('copies PrintSpec offsets', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.printSpecs[0].offsetX).toBe(0.1)
    expect(result.printSpecs[0].offsetY).toBe(-0.2)
  })

  it('copies PrintSpec rotation', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.printSpecs[0].rotationDeg).toBe(15)
  })
})

describe('buildReorderFormValues — RESET', () => {
  it('resets dueDate to blank, never deriving it from the source', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.dueDate).toBe('')
  })

  it('resets paymentStatus to Unpaid regardless of the source', () => {
    const result = buildReorderFormValues(makeSourceValues({ paymentStatus: 'Paid' }))
    expect(result.paymentStatus).toBe('Unpaid')
  })

  it('resets assignedTo to unassigned', () => {
    const result = buildReorderFormValues(makeSourceValues({ assignedTo: 'staff-1' }))
    expect(result.assignedTo).toBeUndefined()
  })

  it('resets notes to blank', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.notes).toBe('')
  })

  it('resets productionNotes to blank', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.productionNotes).toBe('')
  })

  it('resets approvalNote on every copied PrintSpec', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.printSpecs.every((p) => p.approvalNote === undefined)).toBe(true)
  })

  it('resets previewStoragePath on every copied PrintSpec', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.printSpecs.every((p) => p.previewStoragePath === undefined)).toBe(true)
  })

  it('resets staffCompleted to false', () => {
    const result = buildReorderFormValues(makeSourceValues({ staffCompleted: true }))
    expect(result.staffCompleted).toBe(false)
  })

  // artworkStatus/garmentStatus/productionStatus/completedAt/orderState
  // are not OrderFormValues fields at all (they're server-defaulted
  // columns, set only by upsert_order's own `p_order_id is null` branch
  // for a genuinely new order) — nothing in this function could copy them
  // even by accident, since a brand-new order (created via
  // upsertOrder(values, null, ...), exactly how every reorder's first
  // save works) always gets the schema's own defaults.
})

describe('buildReorderFormValues — artwork/PrintSpec linkage stays intact for the later copy step', () => {
  it('carries the source artworkId through unchanged (remapping happens later, at save time)', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.printSpecs[0].artworkId).toBe('aw-1')
    expect(result.printSpecs[1].artworkId).toBe('aw-1')
  })

  it('carries source artworkFiles through unchanged for preview purposes', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.artworkFiles).toHaveLength(2)
    expect(result.artworkFiles[0].id).toBe('aw-1')
    expect(result.artworkFiles[0].storagePath).toBe('orders/src-order/artwork/aw-1/crest.png')
  })

  it('two PrintSpecs referencing the same source artwork both still reference that same id after building (dedup happens at copy time, not here)', () => {
    const result = buildReorderFormValues(makeSourceValues())
    expect(result.printSpecs[0].artworkId).toBe(result.printSpecs[1].artworkId)
  })
})

describe('buildReorderFormValues — edge cases', () => {
  it('works for an order with no artwork at all', () => {
    const source = makeSourceValues({
      artworkFiles: [],
      printSpecs: [
        {
          id: 'ps-1',
          position: 'Left Chest',
          colour: 'White',
          widthMm: 100,
          heightMm: 100,
          garmentType: undefined,
          garmentColour: undefined,
          artworkId: undefined,
          offsetX: 0,
          offsetY: 0,
          rotationDeg: 0,
          previewStoragePath: undefined,
          approvalNote: undefined,
        },
      ],
    })
    expect(() => buildReorderFormValues(source)).not.toThrow()
    const result = buildReorderFormValues(source)
    expect(result.artworkFiles).toEqual([])
    expect(result.printSpecs[0].artworkId).toBeUndefined()
  })

  it('preserves a non-previewable (PDF/AI) artwork file\'s metadata unchanged', () => {
    const result = buildReorderFormValues(makeSourceValues())
    const pdf = result.artworkFiles.find((f) => f.id === 'aw-2')
    expect(pdf?.fileType).toBe('PDF')
    expect(pdf?.fileName).toBe('sponsor.pdf')
  })

  it('handles multiple PrintSpecs (3+) independently', () => {
    const source = makeSourceValues()
    source.printSpecs.push({
      id: 'ps-3',
      position: 'Left Sleeve',
      colour: 'White',
      widthMm: 80,
      heightMm: 80,
      garmentType: 'T-shirt',
      garmentColour: 'Navy',
      artworkId: 'aw-2',
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      previewStoragePath: undefined,
      approvalNote: undefined,
    })
    const result = buildReorderFormValues(source)
    expect(result.printSpecs).toHaveLength(3)
    expect(new Set(result.printSpecs.map((p) => p.id)).size).toBe(3)
    expect(result.printSpecs[2].artworkId).toBe('aw-2')
  })

  it('preserves a historical garment type/brand/colour even if no longer active in the catalog (the value is copied as a plain string — existing catalog selectors already show an inactive current value alongside active ones)', () => {
    const source = makeSourceValues({
      garments: [
        {
          id: 'g1',
          type: 'Retired Style',
          brand: 'Discontinued Brand',
          colour: 'Navy',
          sizing: 'Adult',
          adultQuantities: { S: 0, M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0, '4XL': 0, '5XL': 0 },
          youthQuantities: { '2': 0, '4': 0, '6': 0, '8': 0, '10': 0, '12': 0, '14': 0, '16': 0, '18': 0 },
        },
      ],
    })
    const result = buildReorderFormValues(source)
    expect(result.garments[0].type).toBe('Retired Style')
    expect(result.garments[0].brand).toBe('Discontinued Brand')
  })
})

describe('buildReorderFormValues — source immutability', () => {
  it('never mutates the source OrderFormValues object', () => {
    const source = makeSourceValues()
    const sourceSnapshot = JSON.parse(JSON.stringify(source))
    buildReorderFormValues(source)
    expect(source).toEqual(sourceSnapshot)
  })

  it('mutating the result\'s garment quantities does not affect the source', () => {
    const source = makeSourceValues()
    const result = buildReorderFormValues(source)
    result.garments[0].adultQuantities.M = 999
    expect(source.garments[0].adultQuantities.M).toBe(8)
  })

  it('mutating the result\'s services array does not affect the source', () => {
    const source = makeSourceValues()
    const result = buildReorderFormValues(source)
    result.services.push('New Service')
    expect(source.services).toEqual(['Screen Printing', 'Embroidery'])
  })

  it('mutating a result PrintSpec does not affect the source PrintSpec', () => {
    const source = makeSourceValues()
    const result = buildReorderFormValues(source)
    result.printSpecs[0].widthMm = 9999
    expect(source.printSpecs[0].widthMm).toBe(100)
  })

  it('produces independent result objects across repeated calls (calling twice never shares PrintSpec ids)', () => {
    const source = makeSourceValues()
    const first = buildReorderFormValues(source)
    const second = buildReorderFormValues(source)
    expect(first.printSpecs[0].id).not.toBe(second.printSpecs[0].id)
  })
})

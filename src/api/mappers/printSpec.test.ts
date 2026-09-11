import { describe, expect, it } from 'vitest'
import {
  countAdditionalPrintSpecs,
  mapPrintSpecFormToPayload,
  mapPrintSpecRowToDomain,
  selectPrimaryPrintSpec,
  sortPrintSpecRows,
} from './printSpec'
import type { PrintSpecRow } from './printSpec'
import type { PrintSpecFormValues } from '@/schemas/orderFormSchema'
import type { PrintSpec } from '@/types'

const row: PrintSpecRow = {
  id: 'p1',
  position: 'Left Chest',
  colour: 'White',
  width_mm: 100,
  height_mm: 80,
  garment_type: 'T-shirt',
  garment_colour: 'Black',
  artwork_id: 'aw1',
  offset_x: 0.25,
  offset_y: -0.1,
  sort_order: 0,
  rotation_deg: 37,
  preview_storage_path: 'orders/o1/print-specs/p1/preview.png',
  approval_note: 'move logo up',
}

describe('mapPrintSpecRowToDomain', () => {
  it('maps every DB column to its domain field, including the Phase 3 fields', () => {
    const domain = mapPrintSpecRowToDomain(row)
    expect(domain).toEqual({
      id: 'p1',
      position: 'Left Chest',
      colour: 'White',
      widthMm: 100,
      heightMm: 80,
      garmentType: 'T-shirt',
      garmentColour: 'Black',
      artworkId: 'aw1',
      offsetX: 0.25,
      offsetY: -0.1,
      rotationDeg: 37,
      previewStoragePath: 'orders/o1/print-specs/p1/preview.png',
      approvalNote: 'move logo up',
    })
  })

  it('maps null preview/approval/optional fields to undefined, not null', () => {
    const domain = mapPrintSpecRowToDomain({
      ...row,
      garment_type: null,
      garment_colour: null,
      artwork_id: null,
      offset_x: null,
      offset_y: null,
      preview_storage_path: null,
      approval_note: null,
    })
    expect(domain.garmentType).toBeUndefined()
    expect(domain.garmentColour).toBeUndefined()
    expect(domain.artworkId).toBeUndefined()
    expect(domain.offsetX).toBeUndefined()
    expect(domain.offsetY).toBeUndefined()
    expect(domain.previewStoragePath).toBeUndefined()
    expect(domain.approvalNote).toBeUndefined()
  })

  it('rotation_deg has no null case (DB column is not null default 0) and passes through as-is', () => {
    expect(mapPrintSpecRowToDomain({ ...row, rotation_deg: 0 }).rotationDeg).toBe(0)
  })
})

describe('mapPrintSpecFormToPayload', () => {
  const formValues: PrintSpecFormValues = {
    id: 'p1',
    position: 'Left Chest',
    colour: 'White',
    widthMm: 100,
    heightMm: 80,
    garmentType: 'T-shirt',
    garmentColour: 'Black',
    artworkId: 'aw1',
    offsetX: 0.25,
    offsetY: -0.1,
    rotationDeg: 37,
    previewStoragePath: 'orders/o1/print-specs/p1/preview.png',
    approvalNote: 'move logo up',
  }

  it('includes id in the payload (Milestone 1 identity fix) so upsert_order reinserts the same row', () => {
    expect(mapPrintSpecFormToPayload(formValues).id).toBe('p1')
  })

  it('includes rotationDeg and approvalNote in the RPC payload', () => {
    const payload = mapPrintSpecFormToPayload(formValues)
    expect(payload.rotationDeg).toBe(37)
    expect(payload.approvalNote).toBe('move logo up')
  })

  it('deliberately omits previewStoragePath — it is written via a separate plain UPDATE after preview generation, never through upsert_order', () => {
    const payload = mapPrintSpecFormToPayload(formValues)
    expect(payload).not.toHaveProperty('previewStoragePath')
  })

  it('defaults offsetX/offsetY/rotationDeg to 0 when unset', () => {
    const payload = mapPrintSpecFormToPayload({ ...formValues, offsetX: undefined as unknown as number, offsetY: undefined as unknown as number, rotationDeg: undefined as unknown as number })
    expect(payload.offsetX).toBe(0)
    expect(payload.offsetY).toBe(0)
    expect(payload.rotationDeg).toBe(0)
  })
})

describe('row -> payload -> row round trip preserves every canvas-affecting field', () => {
  it('round-trips position/colour/size/garment/offsets/rotation/approvalNote exactly', () => {
    const domain = mapPrintSpecRowToDomain(row)
    const formValues: PrintSpecFormValues = {
      id: domain.id,
      position: domain.position,
      colour: domain.colour,
      widthMm: domain.widthMm,
      heightMm: domain.heightMm,
      garmentType: domain.garmentType,
      garmentColour: domain.garmentColour,
      artworkId: domain.artworkId,
      offsetX: domain.offsetX ?? 0,
      offsetY: domain.offsetY ?? 0,
      rotationDeg: domain.rotationDeg ?? 0,
      previewStoragePath: domain.previewStoragePath,
      approvalNote: domain.approvalNote,
    }
    const payload = mapPrintSpecFormToPayload(formValues)

    expect(payload.id).toBe(row.id)
    expect(payload.position).toBe(row.position)
    expect(payload.colour).toBe(row.colour)
    expect(payload.widthMm).toBe(row.width_mm)
    expect(payload.heightMm).toBe(row.height_mm)
    expect(payload.garmentType).toBe(row.garment_type)
    expect(payload.garmentColour).toBe(row.garment_colour)
    expect(payload.offsetX).toBe(row.offset_x)
    expect(payload.offsetY).toBe(row.offset_y)
    expect(payload.rotationDeg).toBe(row.rotation_deg)
    expect(payload.approvalNote).toBe(row.approval_note)
  })
})

describe('selectPrimaryPrintSpec', () => {
  const base: PrintSpec = { id: '1', position: 'Left Chest', colour: 'White', widthMm: 100, heightMm: 80, rotationDeg: 0 }

  it('picks the first spec (by array/sort order) that has a generated preview', () => {
    const specs: PrintSpec[] = [
      { ...base, id: '1' },
      { ...base, id: '2', previewStoragePath: 'orders/o/print-specs/2/preview.png' },
      { ...base, id: '3', previewStoragePath: 'orders/o/print-specs/3/preview.png' },
    ]
    expect(selectPrimaryPrintSpec(specs)?.id).toBe('2')
  })

  it('falls back to the first spec at all when none have a preview yet ("No Preview" state)', () => {
    const specs: PrintSpec[] = [{ ...base, id: '1' }, { ...base, id: '2' }]
    expect(selectPrimaryPrintSpec(specs)?.id).toBe('1')
  })

  it('returns undefined for an empty list ("Awaiting Artwork" state)', () => {
    expect(selectPrimaryPrintSpec([])).toBeUndefined()
  })
})

describe('countAdditionalPrintSpecs', () => {
  const base: PrintSpec = { id: '1', position: 'Left Chest', colour: 'White', widthMm: 100, heightMm: 80, rotationDeg: 0 }

  it('counts specs beyond the primary one for the "+N more" indicator', () => {
    const specs: PrintSpec[] = [{ ...base, id: '1' }, { ...base, id: '2' }, { ...base, id: '3' }, { ...base, id: '4' }]
    expect(countAdditionalPrintSpecs(specs)).toBe(3)
  })

  it('is zero for a single-print order', () => {
    expect(countAdditionalPrintSpecs([base])).toBe(0)
  })

  it('is zero (not negative) for an empty list', () => {
    expect(countAdditionalPrintSpecs([])).toBe(0)
  })
})

describe('sortPrintSpecRows', () => {
  it('sorts by sort_order without mutating the input array', () => {
    const rows = [{ sort_order: 2 }, { sort_order: 0 }, { sort_order: 1 }]
    const sorted = sortPrintSpecRows(rows)
    expect(sorted.map((r) => r.sort_order)).toEqual([0, 1, 2])
    expect(rows.map((r) => r.sort_order)).toEqual([2, 0, 1])
  })
})

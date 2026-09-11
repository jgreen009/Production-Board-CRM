import { describe, expect, it } from 'vitest'
import { buildGarmentTypeUpdatePatch, mapGarmentTypeRow, type GarmentTypeRow } from './settings'

const baseRow: GarmentTypeRow = {
  id: 'gt-1',
  name: 'T-shirt',
  active: true,
  sort_order: 0,
  supplier_name: null,
  supplier_product_code: null,
  supplier_url: null,
}

describe('mapGarmentTypeRow (Batch C: supplier fields DB -> domain)', () => {
  it('maps populated supplier columns through to the domain shape', () => {
    const item = mapGarmentTypeRow({
      ...baseRow,
      supplier_name: 'AS Colour',
      supplier_product_code: 'Staple Tee 5001',
      supplier_url: 'https://ascolour.com/staple-tee',
    })
    expect(item).toEqual({
      id: 'gt-1',
      name: 'T-shirt',
      active: true,
      sortOrder: 0,
      supplierName: 'AS Colour',
      supplierProductCode: 'Staple Tee 5001',
      supplierUrl: 'https://ascolour.com/staple-tee',
    })
  })

  it('maps null supplier columns to empty strings, not null/undefined', () => {
    const item = mapGarmentTypeRow(baseRow)
    expect(item.supplierName).toBe('')
    expect(item.supplierProductCode).toBe('')
    expect(item.supplierUrl).toBe('')
  })
})

describe('buildGarmentTypeUpdatePatch (Batch C: domain -> save payload)', () => {
  it('maps every supplier field to its snake_case column', () => {
    const patch = buildGarmentTypeUpdatePatch({
      supplierName: 'AS Colour',
      supplierProductCode: 'Staple Tee 5001',
      supplierUrl: 'https://ascolour.com/staple-tee',
    })
    expect(patch).toEqual({
      supplier_name: 'AS Colour',
      supplier_product_code: 'Staple Tee 5001',
      supplier_url: 'https://ascolour.com/staple-tee',
    })
  })

  it('omits fields the caller did not touch, rather than nulling them out', () => {
    const patch = buildGarmentTypeUpdatePatch({ active: false })
    expect(patch).toEqual({ active: false })
    expect('supplier_name' in patch).toBe(false)
  })

  it('a garment type with no supplier fields at all remains a valid, saveable patch', () => {
    const patch = buildGarmentTypeUpdatePatch({ name: 'T-shirt' })
    expect(patch).toEqual({ name: 'T-shirt' })
  })

  it('normalizes an empty supplier string to null rather than storing blank text', () => {
    const patch = buildGarmentTypeUpdatePatch({ supplierName: '   ', supplierProductCode: '' })
    expect(patch.supplier_name).toBeNull()
    expect(patch.supplier_product_code).toBeNull()
  })

  it('rejects an unsafe supplier URL down to null without blocking the rest of the patch', () => {
    const patch = buildGarmentTypeUpdatePatch({ name: 'T-shirt', supplierUrl: 'javascript:alert(1)' })
    expect(patch.name).toBe('T-shirt')
    expect(patch.supplier_url).toBeNull()
  })

  it('accepts a valid https supplier URL', () => {
    const patch = buildGarmentTypeUpdatePatch({ supplierUrl: 'https://ascolour.com/product' })
    expect(patch.supplier_url).toBe('https://ascolour.com/product')
  })

  it('accepts a valid http supplier URL', () => {
    const patch = buildGarmentTypeUpdatePatch({ supplierUrl: 'http://example.com/product' })
    expect(patch.supplier_url).toBe('http://example.com/product')
  })

  it('rejects a malformed URL down to null', () => {
    const patch = buildGarmentTypeUpdatePatch({ supplierUrl: 'not a url' })
    expect(patch.supplier_url).toBeNull()
  })
})

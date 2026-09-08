import { describe, expect, it } from 'vitest'
import { mapGarmentRowsToDomain } from '@/api/mappers/garment'
import type { OrderGarmentRow } from '@/api/mappers/garment'

describe('mapGarmentRowsToDomain', () => {
  it('joins quantities into adultQuantities keyed by size, sorted by sort_order', () => {
    const rows: OrderGarmentRow[] = [
      {
        id: 'g2',
        garment_type_label: 'Hoody',
        garment_brand_label: 'Gildan',
        colour: 'Black',
        sizing_type: 'Youth',
        sort_order: 1,
        garment_quantities: [
          { size: '4', quantity: 2 },
          { size: '6', quantity: 3 },
        ],
      },
      {
        id: 'g1',
        garment_type_label: 'T-shirt',
        garment_brand_label: 'AS colour',
        colour: 'Navy',
        sizing_type: 'Adult',
        sort_order: 0,
        garment_quantities: [
          { size: 'M', quantity: 5 },
          { size: 'L', quantity: 5 },
        ],
      },
    ]

    const result = mapGarmentRowsToDomain(rows)

    expect(result).toEqual([
      {
        id: 'g1',
        type: 'T-shirt',
        brand: 'AS colour',
        colour: 'Navy',
        sizing: 'Adult',
        adultQuantities: { M: 5, L: 5 },
        youthQuantities: undefined,
      },
      {
        id: 'g2',
        type: 'Hoody',
        brand: 'Gildan',
        colour: 'Black',
        sizing: 'Youth',
        adultQuantities: undefined,
        youthQuantities: { '4': 2, '6': 3 },
      },
    ])
  })

  it('returns an empty array for a garment with no quantity rows', () => {
    const rows: OrderGarmentRow[] = [
      {
        id: 'g1',
        garment_type_label: 'T-shirt',
        garment_brand_label: 'AS colour',
        colour: 'Navy',
        sizing_type: 'Adult',
        sort_order: 0,
        garment_quantities: [],
      },
    ]

    expect(mapGarmentRowsToDomain(rows)[0].adultQuantities).toEqual({})
  })
})

import type { AdultSize, GarmentBrand, GarmentItem, GarmentType, YouthSize } from '@/types'

export interface GarmentQuantityRow {
  size: string
  quantity: number
}

export interface OrderGarmentRow {
  id: string
  garment_type_label: string
  garment_brand_label: string
  colour: string
  sizing_type: 'Adult' | 'Youth'
  sort_order: number
  garment_quantities: GarmentQuantityRow[]
}

// Joins order_garments + its nested garment_quantities (via a Supabase
// nested select) into the domain GarmentItem[] shape components expect —
// one row per size becomes one key in adultQuantities/youthQuantities.
export function mapGarmentRowsToDomain(rows: OrderGarmentRow[]): GarmentItem[] {
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => {
      const quantities: Partial<Record<string, number>> = {}
      for (const q of row.garment_quantities) {
        quantities[q.size] = q.quantity
      }

      return {
        id: row.id,
        type: row.garment_type_label as GarmentType,
        brand: row.garment_brand_label as GarmentBrand,
        colour: row.colour,
        sizing: row.sizing_type,
        adultQuantities: row.sizing_type === 'Adult' ? (quantities as Partial<Record<AdultSize, number>>) : undefined,
        youthQuantities: row.sizing_type === 'Youth' ? (quantities as Partial<Record<YouthSize, number>>) : undefined,
      }
    })
}

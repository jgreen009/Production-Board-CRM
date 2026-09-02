import type { GarmentItem } from '@/types'

export function garmentTotal(garment: GarmentItem): number {
  const adult = Object.values(garment.adultQuantities ?? {}).reduce(
    (sum, n) => sum + (n ?? 0),
    0,
  )
  const youth = Object.values(garment.youthQuantities ?? {}).reduce(
    (sum, n) => sum + (n ?? 0),
    0,
  )
  return adult + youth
}

export function orderSubTotal(garments: GarmentItem[]): number {
  return garments.reduce((sum, g) => sum + garmentTotal(g), 0)
}

export function garmentSizeBreakdown(garment: GarmentItem): string {
  const parts: string[] = []
  if (garment.adultQuantities) {
    for (const [size, qty] of Object.entries(garment.adultQuantities)) {
      if (qty) parts.push(`${size} ${qty}`)
    }
  }
  if (garment.youthQuantities) {
    for (const [size, qty] of Object.entries(garment.youthQuantities)) {
      if (qty) parts.push(`Y${size} ${qty}`)
    }
  }
  return parts.join(' / ')
}

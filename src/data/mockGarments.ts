import type { GarmentBrand, GarmentCatalogItem, GarmentType } from '@/types'
import { ADULT_SIZES, YOUTH_SIZES } from '@/types'

export const GARMENT_TYPES: GarmentType[] = [
  'T-shirt',
  'Polo',
  'Shirt',
  'Hi-Viz vest',
  'Singlet',
  'Crew neck (jumper)',
  'Hoody',
  'Shorts',
  'Pants',
  'Bennie',
  'Hats',
  'Customized',
]

export const GARMENT_BRANDS: GarmentBrand[] = [
  'AS colour',
  'Gildan',
  'Bocini',
  'Sportage',
  'Aussie pacific',
  'Customized',
]

export const GARMENT_CATALOG: GarmentCatalogItem[] = [
  { type: 'T-shirt', category: 'Adult', availableSizes: ADULT_SIZES, active: true },
  { type: 'Polo', category: 'Adult', availableSizes: ADULT_SIZES, active: true },
  { type: 'Shirt', category: 'Adult', availableSizes: ADULT_SIZES, active: true },
  { type: 'Hi-Viz vest', category: 'Adult', availableSizes: ADULT_SIZES, active: true },
  { type: 'Singlet', category: 'Adult', availableSizes: ADULT_SIZES, active: true },
  { type: 'Crew neck (jumper)', category: 'Adult', availableSizes: ADULT_SIZES, active: true },
  { type: 'Hoody', category: 'Adult', availableSizes: ADULT_SIZES, active: true },
  { type: 'Shorts', category: 'Adult', availableSizes: ADULT_SIZES, active: true },
  { type: 'Pants', category: 'Adult', availableSizes: ADULT_SIZES, active: true },
  { type: 'Bennie', category: 'Accessory', availableSizes: ['One Size'], active: true },
  { type: 'Hats', category: 'Accessory', availableSizes: ['One Size'], active: true },
  { type: 'Customized', category: 'Adult', availableSizes: [...ADULT_SIZES, ...YOUTH_SIZES], active: true },
]

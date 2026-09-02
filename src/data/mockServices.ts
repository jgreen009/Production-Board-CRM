import type { ServiceName } from '@/types'

export interface ServiceCatalogItem {
  name: ServiceName
  description: string
  active: boolean
}

// Order matches the paper form exactly (2-column layout on paper).
export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  { name: 'Screen Printing', description: 'Traditional screen print, 25 unit minimum per design.', active: true },
  { name: 'Sublimation', description: 'Full-colour dye sublimation printing.', active: true },
  { name: 'Embroidery', description: 'Stitched logo/text embroidery.', active: true },
  { name: 'Custom School', description: 'School uniform / house team jobs.', active: true },
  { name: 'Direct To Film', description: 'DTF transfer printing.', active: true },
  { name: 'Custom Sports', description: 'Club and sporting team kits.', active: true },
  { name: 'Direct To Garment', description: 'DTG digital garment printing.', active: true },
  { name: 'Vinyl/Digital Transfer', description: 'Vinyl cut or digital heat transfer.', active: true },
]

export const SERVICE_NAMES: ServiceName[] = SERVICE_CATALOG.map((s) => s.name)

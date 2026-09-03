// Domain types for SALT PRINTS production management app.
// Frontend-only phase: no backend/DB shapes, just what the UI needs.

export type PaymentStatus =
  | 'Unpaid'
  | 'Deposit Paid'
  | 'Part Paid'
  | 'Paid'
  | 'On Account'

export type ArtworkStatus =
  | 'Not Started'
  | 'Artwork To Do'
  | 'Artwork Supplied'
  | 'Need Artwork'
  | 'Need Vectored'
  | 'Mockup Required'
  | 'Awaiting Approval'
  | 'Approved'
  | 'Completed'

export type GarmentStatus =
  | 'Not Required'
  | 'Need Ordering'
  | 'Ordered'
  | 'Follow Up'
  | 'Part Received'
  | 'Supplied'
  | 'Received'
  | 'Completed'

export type ProductionStatus =
  | 'New'
  | 'Ready'
  | 'Queued'
  | 'In Production'
  | 'Quality Check'
  | 'Ready for Collection'
  | 'Out for Delivery'
  | 'Completed'
  | 'On Hold'

export type Priority = 'Normal' | 'High' | 'Urgent'

export type Turnaround = 'Standard' | 'Rush' | 'Same Day' | 'Custom'

export type DeliveryMethod = 'Pick Up' | 'Delivery'

// Garment catalog (paper form dropdown values, verbatim)
export type GarmentType =
  | 'T-shirt'
  | 'Polo'
  | 'Shirt'
  | 'Hi-Viz vest'
  | 'Singlet'
  | 'Crew neck (jumper)'
  | 'Hoody'
  | 'Shorts'
  | 'Pants'
  | 'Bennie'
  | 'Hats'
  | 'Customized'

export type GarmentBrand =
  | 'AS colour'
  | 'Gildan'
  | 'Bocini'
  | 'Sportage'
  | 'Aussie pacific'
  | 'Customized'

export type AdultSize = 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL' | '4XL' | '5XL'
export type YouthSize =
  | '2'
  | '4'
  | '6'
  | '8'
  | '10'
  | '12'
  | '14'
  | '16'
  | '18'

export const ADULT_SIZES: AdultSize[] = [
  'S',
  'M',
  'L',
  'XL',
  '2XL',
  '3XL',
  '4XL',
  '5XL',
]
export const YOUTH_SIZES: YouthSize[] = [
  '2',
  '4',
  '6',
  '8',
  '10',
  '12',
  '14',
  '16',
  '18',
]

export interface GarmentCatalogItem {
  type: GarmentType
  category: 'Adult' | 'Youth' | 'Accessory'
  availableSizes: string[]
  active: boolean
}

export interface GarmentItem {
  id: string
  type: GarmentType
  brand: GarmentBrand
  colour: string
  sizing: 'Adult' | 'Youth'
  adultQuantities?: Partial<Record<AdultSize, number>>
  youthQuantities?: Partial<Record<YouthSize, number>>
}

export type ServiceName =
  | 'Screen Printing'
  | 'Sublimation'
  | 'Embroidery'
  | 'Custom School'
  | 'Direct To Film'
  | 'Custom Sports'
  | 'Direct To Garment'
  | 'Vinyl/Digital Transfer'

export interface OrderService {
  name: ServiceName
  enabled: boolean
}

// Matches the paper form's numbered Print Position diagram verbatim: front
// has 6 positions (1-6), back has 3 (1-3), each with the diagram's rough
// size preset. Numbers repeat across front/back on the paper form itself
// (e.g. front "1" and back "1" are different spots), so each value here is
// prefixed with its view to stay unambiguous as a flat list.
export type PrintPosition =
  | 'Front 1 — Right Chest (A6)'
  | 'Front 2 — Left Chest (A6)'
  | 'Front 3 — Center Chest (A4)'
  | 'Front 4 — Lower Front (A3)'
  | 'Front 5 — Right Sleeve'
  | 'Front 6 — Left Sleeve'
  | 'Back 1 — Upper Back (A4)'
  | 'Back 2 — Mid Back (A4)'
  | 'Back 3 — Lower Back (A3)'
  | 'Custom'

export interface PrintDetail {
  id: string
  position: PrintPosition
  colour: string
  widthMm: number
  heightMm: number
}

export type ArtworkFileType = 'PNG' | 'JPG' | 'WEBP' | 'SVG' | 'PDF' | 'AI'

export interface Artwork {
  id: string
  fileName: string
  fileType: ArtworkFileType
  sizeKb: number
  uploadedAt: string
  previewUrl?: string // only present for browser-previewable types
}

export interface Mockup {
  id: string
  garmentType: GarmentType
  colour: string
  view: 'Front' | 'Back'
  position: PrintPosition
  artworkId?: string
  widthMm: number
  heightMm: number
  printColours: string
  notes?: string
  thumbnailLabel: string
}

export interface OrderActivityEntry {
  id: string
  orderId: string
  timestamp: string
  message: string
  type:
    | 'created'
    | 'priority'
    | 'artwork'
    | 'garments'
    | 'production'
    | 'mockup'
    | 'payment'
}

export interface Customer {
  id: string
  name: string
  company: string
  email: string
  phone: string
  notes?: string
  createdAt: string
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  customer: string // denormalized display name
  jobName: string
  phone: string
  email: string
  createdAt: string
  dueDate: string
  turnaroundType: Turnaround
  quantity: number
  paymentStatus: PaymentStatus
  artworkStatus: ArtworkStatus
  garmentStatus: GarmentStatus
  productionStatus: ProductionStatus
  priority: Priority
  deliveryMethod: DeliveryMethod
  rushFee: boolean
  suppliesGarments: boolean
  graphicDesignServices: boolean
  specialisedApplication: boolean
  specialisedApplicationDetails?: string
  services: OrderService[]
  garments: GarmentItem[]
  printDetails: PrintDetail[]
  artwork: Artwork[]
  mockups: Mockup[]
  notes: string
  productionNotes: string
  staffCompleted: boolean
}

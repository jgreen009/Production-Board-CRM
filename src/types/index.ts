// Domain types for the Brand Fanatix production management app.
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

// Print position list: six front spots (both chests, an across-chest band,
// a generic full-front placement, and both sleeves) plus three back spots.
// Replaces the paper form's numbered A6/A4/A3 diagram with plain labels.
// This is the single authoritative list — every position control in the
// form (buttons, selects) reads from PRINT_ZONES (src/config/printZones.ts),
// never a local copy.
export type PrintPosition =
  | 'Left Chest'
  | 'Right Chest'
  | 'Across Chest'
  | 'Full Front'
  | 'Left Sleeve'
  | 'Right Sleeve'
  | 'Full Back'
  | 'Top Back'
  | 'Bottom Back'

export type ArtworkFileType = 'PNG' | 'JPG' | 'WEBP' | 'SVG' | 'PDF' | 'AI'

export interface Artwork {
  id: string
  fileName: string
  fileType: ArtworkFileType
  sizeKb: number
  uploadedAt: string
  previewUrl?: string // only present for browser-previewable types
  storagePath?: string // needed to fetch a signed preview URL on demand — never rendered directly
}

// One entry per physical print: where it sits, what ink colour, what size,
// and (optionally) which garment/colour/artwork to preview it on. A print
// detail row and its mockup preview are the same concept, so this replaces
// what used to be two separate lists (PrintDetail + Mockup).
export interface PrintSpec {
  id: string
  position: PrintPosition
  colour: string
  widthMm: number
  heightMm: number
  garmentType?: GarmentType
  garmentColour?: string
  artworkId?: string
  offsetX?: number
  offsetY?: number
  /** Degrees, 0-360, default 0 — Phase 3. Optional so Phase 1 mock/demo fixtures don't all need updating; real (DB-backed) print specs always have a value. */
  rotationDeg?: number
  /** Path to the generated clean mockup PNG in the private mockup-previews bucket — never a signed URL. Phase 3. */
  previewStoragePath?: string
  /** Per-print-location approval feedback (e.g. "Move logo 20mm higher") — Phase 3. Order-level ArtworkStatus is the approval gate; this is just a note. */
  approvalNote?: string
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
    | 'assignment'
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
  printSpecs: PrintSpec[]
  artwork: Artwork[]
  notes: string
  productionNotes: string
  staffCompleted: boolean
  // Phase 4 Milestone 2 — one optional owner per order. assignedToName/
  // assignedToActive are denormalized from the joined profiles row purely
  // for display (never written back) — assignedToActive lets a historical
  // assignee who's since been deactivated still show their name, with an
  // "Inactive" indicator, without a second lookup.
  assignedTo?: string
  assignedToName?: string | null
  assignedToActive?: boolean
  // Trigger-maintained in the DB (set when productionStatus transitions to
  // Completed, cleared if it moves off Completed again) — never written by
  // the client. undefined for any order that has never been completed.
  completedAt?: string
  /** Public Customer Order Link — 'public_form' for an order a customer submitted through a public link (no login), 'staff' for a normal internally-created order. */
  source: 'staff' | 'public_form'
}

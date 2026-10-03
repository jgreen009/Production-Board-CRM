// Customer-safe order summary. Templates receive ONLY this shape, built from
// an explicit allow-list of fields below. Internal columns (assigned staff,
// statuses, priority, production/approval notes, staff_completed, storage
// paths, activity) are never read here, so they cannot reach an email by
// accident. Keep this in sync with the customer-facing copy of the form.

export interface CustomerOrderSummary {
  orderNumber: string
  customerName: string
  companyName: string | null
  customerEmail: string
  customerPhone: string | null
  jobTitle: string
  requiredDate: string | null
  deliveryMethod: string
  garments: GarmentSummary[]
  services: string[]
  printSpecs: PrintSpecSummary[]
  customerNotes: string | null
}

export interface GarmentSummary {
  heading: string
  brand: string | null
  colour: string
  sizes: { size: string; quantity: number }[]
  totalQuantity: number
}

export interface PrintSpecSummary {
  position: string
  artworkFileName: string | null
  widthMm: number
  colour: string | null
  garmentLabel: string
  previewUrl: string | null
}

// Mirror of getPrintPositionLabel() in src/config/garmentGeometry.ts. The
// Left/Right Chest labels are deliberately swapped there (staff request), and
// the email must show the same wording the customer saw on the form. A
// Vitest check (summary.test.ts) fails if this table drifts from the source.
export const POSITION_LABELS: Record<string, string> = {
  'Left Chest': 'Right Chest',
  'Right Chest': 'Left Chest',
  'Across Chest': 'Across Chest',
  'Full Front': 'Full Front',
  'Left Sleeve': 'Left Sleeve',
  'Right Sleeve': 'Right Sleeve',
  'Left Side': 'Left Side',
  'Right Side': 'Right Side',
  'Full Back': 'Full Back',
  'Top Back': 'Top Back',
  'Bottom Back': 'Bottom Back',
  'Left Thigh': 'Left Thigh',
  'Right Thigh': 'Right Thigh',
  'Left Leg': 'Left Leg',
  'Right Leg': 'Right Leg',
  Front: 'Front',
  Back: 'Back',
}

export function positionLabel(position: string): string {
  return POSITION_LABELS[position] ?? position
}

const SIZE_ORDER = ['2', '4', '6', '8', '10', '12', '14', '16', '18', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

function compareSizes(a: string, b: string): number {
  const ia = SIZE_ORDER.indexOf(a)
  const ib = SIZE_ORDER.indexOf(b)
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  return a.localeCompare(b)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// due_date is a plain YYYY-MM-DD calendar date. Formatted by hand so that
// no timezone can shift it to the previous or next day.
export function formatRequiredDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return `${Number(match[3])} ${MONTHS[month - 1]} ${match[1]}`
}

// Shape of the Supabase select used by the loader (see email/sendOrderEmail.ts).
export interface RawOrderForEmail {
  order_number: string
  job_name: string
  email: string | null
  phone: string | null
  due_date: string | null
  delivery_method: string
  notes: string | null
  customers: { name: string; company: string | null; email: string | null; phone: string | null } | null
  order_garments: {
    garment_type_label: string
    garment_brand_label: string
    colour: string
    sort_order: number
    garment_quantities: { size: string; quantity: number }[]
  }[]
  order_services: { services: { name: string } | null }[]
  print_specs: {
    id: string
    position: string
    colour: string | null
    width_mm: number
    garment_type: string | null
    garment_colour: string | null
    sort_order: number
    preview_storage_path: string | null
    artwork: { file_name: string } | null
  }[]
}

export function buildCustomerOrderSummary(
  raw: RawOrderForEmail,
  previewUrls: Record<string, string | null>,
): CustomerOrderSummary {
  const garments: GarmentSummary[] = [...raw.order_garments]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((g) => {
      const sizes = [...g.garment_quantities]
        .filter((q) => q.quantity > 0)
        .sort((a, b) => compareSizes(a.size, b.size))
        .map((q) => ({ size: q.size, quantity: q.quantity }))
      return {
        heading: g.garment_type_label,
        brand: g.garment_brand_label && g.garment_brand_label !== 'Customized' ? g.garment_brand_label : null,
        colour: g.colour,
        sizes,
        totalQuantity: sizes.reduce((sum, s) => sum + s.quantity, 0),
      }
    })

  const services = raw.order_services
    .map((s) => s.services?.name)
    .filter((n): n is string => !!n)

  const printSpecs: PrintSpecSummary[] = [...raw.print_specs]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({
      position: positionLabel(p.position),
      artworkFileName: p.artwork?.file_name ?? null,
      widthMm: p.width_mm,
      colour: p.colour?.trim() ? p.colour.trim() : null,
      garmentLabel: [p.garment_type, p.garment_colour].filter(Boolean).join(' — '),
      previewUrl: previewUrls[p.id] ?? null,
    }))

  const customerEmail = (raw.email?.trim() || raw.customers?.email?.trim() || '')
  const customerPhone = raw.phone?.trim() || raw.customers?.phone?.trim() || null

  return {
    orderNumber: raw.order_number,
    customerName: raw.customers?.name?.trim() ?? '',
    companyName: raw.customers?.company?.trim() || null,
    customerEmail,
    customerPhone,
    jobTitle: raw.job_name,
    requiredDate: formatRequiredDate(raw.due_date),
    deliveryMethod: raw.delivery_method,
    garments,
    services,
    printSpecs,
    customerNotes: raw.notes?.trim() || null,
  }
}

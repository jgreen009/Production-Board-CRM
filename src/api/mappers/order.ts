import type {
  AdultSize,
  ArtworkStatus,
  DeliveryMethod,
  GarmentStatus,
  Order,
  PaymentStatus,
  Priority,
  ProductionStatus,
  ServiceName,
  Turnaround,
  YouthSize,
} from '@/types'
import { ADULT_SIZES, YOUTH_SIZES } from '@/types'
import type { GarmentFormValues, OrderFormValues } from '@/schemas/orderFormSchema'
import { orderSubTotal } from '@/utils/quantity'
import { mapGarmentRowsToDomain } from '@/api/mappers/garment'
import type { OrderGarmentRow } from '@/api/mappers/garment'
import { mapPrintSpecRowToDomain, mapPrintSpecFormToPayload, sortPrintSpecRows } from '@/api/mappers/printSpec'
import type { PrintSpecRow } from '@/api/mappers/printSpec'
import { mapArtworkRowToDomain } from '@/api/mappers/artwork'
import type { ArtworkRow } from '@/api/mappers/artwork'

export interface OrderRow {
  id: string
  customer_id: string | null
  order_number: string | null
  job_name: string
  phone: string | null
  email: string | null
  created_at: string
  due_date: string | null
  turnaround_type: string
  payment_status: string
  artwork_status: string
  garment_status: string
  production_status: string
  priority: string
  delivery_method: string
  rush_fee: boolean
  supplies_garments: boolean
  graphic_design_services: boolean
  specialised_application: boolean
  specialised_application_details: string | null
  notes: string | null
  production_notes: string | null
  staff_completed: boolean
  order_state: 'Draft' | 'Active'
  customers: { name: string; company: string | null } | null
  order_garments: OrderGarmentRow[]
  order_services: { services: { name: string } | null }[]
  print_specs: PrintSpecRow[]
  artwork: ArtworkRow[]
}

export function mapDatabaseOrderToDomain(row: OrderRow): Order {
  const garments = mapGarmentRowsToDomain(row.order_garments)
  const customerName = row.customers ? row.customers.company || row.customers.name : row.job_name

  return {
    id: row.id,
    orderNumber: row.order_number ?? '',
    customerId: row.customer_id ?? '',
    customer: customerName,
    jobName: row.job_name,
    phone: row.phone ?? '',
    email: row.email ?? '',
    createdAt: row.created_at,
    dueDate: row.due_date ?? '',
    turnaroundType: row.turnaround_type as Turnaround,
    quantity: orderSubTotal(garments),
    paymentStatus: row.payment_status as PaymentStatus,
    artworkStatus: row.artwork_status as ArtworkStatus,
    garmentStatus: row.garment_status as GarmentStatus,
    productionStatus: row.production_status as ProductionStatus,
    priority: row.priority as Priority,
    deliveryMethod: row.delivery_method as DeliveryMethod,
    rushFee: row.rush_fee,
    suppliesGarments: row.supplies_garments,
    graphicDesignServices: row.graphic_design_services,
    specialisedApplication: row.specialised_application,
    specialisedApplicationDetails: row.specialised_application_details ?? undefined,
    services: row.order_services
      .filter((os) => os.services)
      .map((os) => ({ name: os.services!.name as ServiceName, enabled: true })),
    garments,
    printSpecs: sortPrintSpecRows(row.print_specs).map(mapPrintSpecRowToDomain),
    artwork: row.artwork.map(mapArtworkRowToDomain),
    notes: row.notes ?? '',
    productionNotes: row.production_notes ?? '',
    staffCompleted: row.staff_completed,
  }
}

function fullAdultQuantities(partial: Partial<Record<AdultSize, number>> | undefined): GarmentFormValues['adultQuantities'] {
  const result = {} as GarmentFormValues['adultQuantities']
  for (const size of ADULT_SIZES) result[size] = partial?.[size] ?? 0
  return result
}

function fullYouthQuantities(partial: Partial<Record<YouthSize, number>> | undefined): GarmentFormValues['youthQuantities'] {
  const result = {} as GarmentFormValues['youthQuantities']
  for (const size of YOUTH_SIZES) result[size] = partial?.[size] ?? 0
  return result
}

// DB row -> OrderFormValues, for editing an existing order (Milestone 8)
// and, later, resuming a draft (Milestone 11) — both need the exact same
// reverse mapping. Consumes the raw OrderRow (not the already-mapped
// Order) because the form needs things the domain type intentionally
// drops: full per-size quantity objects (not just the non-zero ones),
// and artwork's storage_path (needed to call removeArtwork later).
// artworkFiles' previewUrl is left undefined here — signed URLs are
// fetched separately (async, short-lived) by the edit page before the
// form mounts, not baked into this pure mapper.
export function mapDatabaseOrderToFormValues(row: OrderRow): OrderFormValues {
  const garments = mapGarmentRowsToDomain(row.order_garments)

  return {
    orderDate: row.created_at.slice(0, 10),
    customerId: row.customer_id,
    newCustomerName: '',
    jobName: row.job_name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    dueDate: row.due_date ?? '',
    rushFee: row.rush_fee,
    turnaround: row.turnaround_type as Turnaround,
    deliveryMethod: row.delivery_method as DeliveryMethod,
    priority: row.priority as Priority,
    services: row.order_services.filter((os) => os.services).map((os) => os.services!.name),
    suppliesGarments: row.supplies_garments,
    graphicDesignServices: row.graphic_design_services,
    specialisedApplication: row.specialised_application,
    specialisedApplicationDetails: row.specialised_application_details ?? '',
    garments: garments.map((g) => ({
      id: g.id,
      type: g.type,
      brand: g.brand,
      colour: g.colour,
      sizing: g.sizing,
      adultQuantities: fullAdultQuantities(g.adultQuantities),
      youthQuantities: fullYouthQuantities(g.youthQuantities),
    })),
    artworkFiles: row.artwork.map((a) => ({
      id: a.id,
      fileName: a.file_name,
      fileType: a.file_type,
      sizeKb: Math.round(a.file_size_bytes / 1024),
      previewUrl: undefined,
      storagePath: a.storage_path,
    })),
    printSpecs: sortPrintSpecRows(row.print_specs).map((p) => ({
      id: p.id,
      position: p.position,
      colour: p.colour,
      widthMm: p.width_mm,
      heightMm: p.height_mm,
      garmentType: p.garment_type ?? undefined,
      garmentColour: p.garment_colour ?? undefined,
      artworkId: p.artwork_id ?? undefined,
      offsetX: p.offset_x ?? 0,
      offsetY: p.offset_y ?? 0,
    })),
    paymentStatus: row.payment_status as PaymentStatus,
    productionNotes: row.production_notes ?? '',
    notes: row.notes ?? '',
    staffCompleted: row.staff_completed,
  }
}

// OrderFormValues -> the jsonb payload upsert_order expects. Almost every
// field passes through under its existing name; `turnaround` is the one
// rename (form field name vs. the turnaround_type DB column/RPC key).
export function mapOrderFormToUpsertPayload(values: OrderFormValues) {
  return {
    jobName: values.jobName,
    customerId: values.customerId,
    phone: values.phone,
    email: values.email,
    dueDate: values.dueDate,
    turnaroundType: values.turnaround,
    deliveryMethod: values.deliveryMethod,
    priority: values.priority,
    rushFee: values.rushFee,
    suppliesGarments: values.suppliesGarments,
    graphicDesignServices: values.graphicDesignServices,
    specialisedApplication: values.specialisedApplication,
    specialisedApplicationDetails: values.specialisedApplicationDetails ?? '',
    notes: values.notes ?? '',
    productionNotes: values.productionNotes ?? '',
    paymentStatus: values.paymentStatus,
    staffCompleted: values.staffCompleted,
    garments: values.garments.map((g) => ({
      type: g.type,
      brand: g.brand,
      colour: g.colour,
      sizing: g.sizing,
      adultQuantities: g.adultQuantities,
      youthQuantities: g.youthQuantities,
    })),
    services: values.services,
    printSpecs: values.printSpecs.map(mapPrintSpecFormToPayload),
  }
}

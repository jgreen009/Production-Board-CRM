import type {
  ArtworkStatus,
  DeliveryMethod,
  GarmentStatus,
  Order,
  PaymentStatus,
  Priority,
  ProductionStatus,
  ServiceName,
  Turnaround,
} from '@/types'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { orderSubTotal } from '@/utils/quantity'
import { mapGarmentRowsToDomain } from '@/api/mappers/garment'
import type { OrderGarmentRow } from '@/api/mappers/garment'
import { mapPrintSpecRowToDomain, mapPrintSpecFormToPayload, sortPrintSpecRows } from '@/api/mappers/printSpec'
import type { PrintSpecRow } from '@/api/mappers/printSpec'

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
}

// Note: `artwork` is deliberately not selected/mapped here yet — the table
// exists (Milestone 4 needed it as print_specs' FK target) but nothing
// writes to it until Milestone 5's storage wiring lands, so every order
// gets an empty array for now rather than a half-built signed-URL mapper
// with nothing to point at.
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
    artwork: [],
    notes: row.notes ?? '',
    productionNotes: row.production_notes ?? '',
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

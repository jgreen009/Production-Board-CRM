import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type {
  ArtworkFileType,
  GarmentBrand,
  GarmentType,
  Order,
  PrintPosition,
  ServiceName,
} from '@/types'
import { mockCustomers } from '@/data/mockCustomers'
import { mockOrders } from '@/data/mockOrders'
import { orderSubTotal } from '@/utils/quantity'
import { generateId, nextOrderNumber } from '@/utils/id'
import { todayIso } from '@/utils/date'

function filterNonZero<T extends string>(map: Record<T, number>): Partial<Record<T, number>> {
  const result: Partial<Record<T, number>> = {}
  for (const [key, value] of Object.entries(map) as [T, number][]) {
    if (value > 0) result[key] = value
  }
  return result
}

export function buildOrderFromForm(values: OrderFormValues): Order {
  const customer = mockCustomers.find((c) => c.id === values.customerId)
  const customerName = customer ? customer.company || customer.name : values.newCustomerName || values.jobName

  const garments = values.garments.map((g) => ({
    id: g.id,
    type: g.type as GarmentType,
    brand: g.brand as GarmentBrand,
    colour: g.colour,
    sizing: g.sizing,
    adultQuantities: filterNonZero(g.adultQuantities),
    youthQuantities: filterNonZero(g.youthQuantities),
  }))

  return {
    id: generateId('order'),
    orderNumber: nextOrderNumber(mockOrders.map((o) => o.orderNumber)),
    customerId: values.customerId ?? generateId('cust'),
    customer: customerName,
    jobName: values.jobName,
    phone: values.phone,
    email: values.email,
    createdAt: todayIso(),
    dueDate: values.dueDate,
    turnaroundType: values.turnaround,
    quantity: orderSubTotal(garments),
    paymentStatus: values.paymentStatus,
    artworkStatus: values.artworkFiles.length > 0 ? 'Artwork Supplied' : 'Not Started',
    garmentStatus: values.suppliesGarments ? 'Need Ordering' : 'Not Required',
    productionStatus: 'New',
    priority: values.priority,
    deliveryMethod: values.deliveryMethod,
    rushFee: values.rushFee,
    suppliesGarments: values.suppliesGarments,
    graphicDesignServices: values.graphicDesignServices,
    specialisedApplication: values.specialisedApplication,
    specialisedApplicationDetails: values.specialisedApplicationDetails,
    services: values.services.map((name) => ({ name: name as ServiceName, enabled: true })),
    garments,
    printDetails: values.printDetails.map((pd) => ({
      id: pd.id,
      position: pd.position as PrintPosition,
      colour: pd.colour,
      widthMm: pd.widthMm,
      heightMm: pd.heightMm,
    })),
    artwork: values.artworkFiles.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileType: f.fileType as ArtworkFileType,
      sizeKb: f.sizeKb,
      uploadedAt: todayIso(),
      previewUrl: f.previewUrl,
    })),
    mockups: values.mockups.map((m) => ({
      id: m.id,
      garmentType: m.garmentType as GarmentType,
      colour: m.colour,
      view: m.view,
      position: m.position as PrintPosition,
      artworkId: m.artworkId,
      widthMm: m.widthMm,
      heightMm: m.heightMm,
      printColours: m.printColours,
      notes: m.notes,
      thumbnailLabel: `${m.colour} ${m.garmentType} — ${m.view}`,
    })),
    notes: values.notes ?? '',
    productionNotes: values.productionNotes ?? '',
    staffCompleted: values.staffCompleted,
  }
}

import type { OrderFormValues, GarmentFormValues, PrintSpecFormValues } from '@/schemas/orderFormSchema'
import { generateId } from '@/utils/id'
import { todayIso, addDays } from '@/utils/date'
import { PRINT_ZONES } from '@/config/printZones'
import { PRINT_SIZES } from '@/data/printSizes'

export function emptyGarment(): GarmentFormValues {
  return {
    id: generateId('garment'),
    type: 'T-shirt',
    brand: 'AS colour',
    colour: '',
    sizing: 'Adult',
    adultQuantities: { S: 0, M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0, '4XL': 0, '5XL': 0 },
    youthQuantities: { '2': 0, '4': 0, '6': 0, '8': 0, '10': 0, '12': 0, '14': 0, '16': 0, '18': 0 },
  }
}

export function emptyPrintSpec(): PrintSpecFormValues {
  const first = PRINT_ZONES[0]
  const defaultSize = PRINT_SIZES.find((s) => s.label === 'A4') ?? PRINT_SIZES[0]
  return {
    // A real UUID, not the old generateId('print') string — required so
    // this id survives upsert_order's delete+reinsert cycle unchanged
    // across every future save (Phase 3 plan §12a), the same pattern
    // ArtworkSection.tsx already uses for artworkId before first upload.
    id: crypto.randomUUID(),
    position: first.position,
    colour: '',
    widthMm: defaultSize.widthMm,
    heightMm: defaultSize.heightMm,
    garmentType: undefined,
    garmentColour: '',
    artworkId: undefined,
    offsetX: 0,
    offsetY: 0,
    rotationDeg: 0,
    previewStoragePath: undefined,
    approvalNote: undefined,
  }
}

export function defaultOrderFormValues(): OrderFormValues {
  return {
    orderDate: todayIso(),
    customerId: null,
    newCustomerName: '',
    jobName: '',
    email: '',
    phone: '',
    dueDate: addDays(todayIso(), 7),
    rushFee: false,
    turnaround: 'Standard',
    deliveryMethod: 'Pick Up',
    priority: 'Normal',
    services: [],
    suppliesGarments: false,
    graphicDesignServices: false,
    specialisedApplication: false,
    specialisedApplicationDetails: '',
    garments: [emptyGarment()],
    artworkFiles: [],
    printSpecs: [emptyPrintSpec()],
    paymentStatus: 'Unpaid',
    productionNotes: '',
    notes: '',
    staffCompleted: false,
  }
}

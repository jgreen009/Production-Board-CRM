import type { OrderFormValues, GarmentFormValues, PrintDetailFormValues } from '@/schemas/orderFormSchema'
import { generateId } from '@/utils/id'
import { todayIso, addDays } from '@/utils/date'

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

export function emptyPrintDetail(): PrintDetailFormValues {
  return {
    id: generateId('print'),
    position: 'Front Centre',
    colour: '',
    widthMm: 200,
    heightMm: 200,
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
    mockups: [],
    printDetails: [emptyPrintDetail()],
    paymentStatus: 'Unpaid',
    productionNotes: '',
    notes: '',
  }
}

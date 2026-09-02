import { z } from 'zod'

const adultQuantitiesSchema = z.object({
  S: z.number().min(0),
  M: z.number().min(0),
  L: z.number().min(0),
  XL: z.number().min(0),
  '2XL': z.number().min(0),
  '3XL': z.number().min(0),
  '4XL': z.number().min(0),
  '5XL': z.number().min(0),
})

const youthQuantitiesSchema = z.object({
  '2': z.number().min(0),
  '4': z.number().min(0),
  '6': z.number().min(0),
  '8': z.number().min(0),
  '10': z.number().min(0),
  '12': z.number().min(0),
  '14': z.number().min(0),
  '16': z.number().min(0),
  '18': z.number().min(0),
})

export const garmentFormSchema = z.object({
  id: z.string(),
  type: z.string().min(1, 'Select a garment type'),
  brand: z.string().min(1, 'Select a brand'),
  colour: z.string().min(1, 'Colour is required'),
  sizing: z.enum(['Adult', 'Youth']),
  adultQuantities: adultQuantitiesSchema,
  youthQuantities: youthQuantitiesSchema,
})

export const printDetailFormSchema = z.object({
  id: z.string(),
  position: z.string().min(1, 'Select a print position'),
  colour: z.string().min(1, 'Print colour is required'),
  widthMm: z.number().min(1, 'Width must be greater than 0'),
  heightMm: z.number().min(1, 'Height must be greater than 0'),
})

export const artworkFileFormSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  sizeKb: z.number(),
  previewUrl: z.string().optional(),
})

export const mockupFormSchema = z.object({
  id: z.string(),
  garmentType: z.string(),
  colour: z.string(),
  view: z.enum(['Front', 'Back']),
  position: z.string(),
  artworkId: z.string().optional(),
  widthMm: z.number().min(0),
  heightMm: z.number().min(0),
  printColours: z.string(),
  notes: z.string().optional(),
})

export const orderFormSchema = z
  .object({
    orderDate: z.string().min(1),
    customerId: z.string().nullable(),
    newCustomerName: z.string().optional(),
    jobName: z.string().min(2, 'Job name is required'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().min(6, 'Enter a valid phone number'),
    dueDate: z.string().min(1, 'Due date is required'),

    rushFee: z.boolean(),
    turnaround: z.enum(['Standard', 'Rush', 'Same Day', 'Custom']),
    deliveryMethod: z.enum(['Pick Up', 'Delivery']),
    priority: z.enum(['Normal', 'High', 'Urgent']),

    services: z.array(z.string()).min(1, 'Select at least one service'),
    suppliesGarments: z.boolean(),
    graphicDesignServices: z.boolean(),
    specialisedApplication: z.boolean(),
    specialisedApplicationDetails: z.string().optional(),

    garments: z.array(garmentFormSchema).min(1, 'Add at least one garment'),

    artworkFiles: z.array(artworkFileFormSchema),

    mockups: z.array(mockupFormSchema),

    printDetails: z.array(printDetailFormSchema).min(1, 'Add at least one print detail'),

    paymentStatus: z.enum(['Unpaid', 'Deposit Paid', 'Part Paid', 'Paid', 'On Account']),
    productionNotes: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => (data.customerId ? true : (data.newCustomerName?.trim().length ?? 0) > 0),
    { message: 'Select a customer or enter a name for the new customer', path: ['newCustomerName'] },
  )

export type OrderFormValues = z.infer<typeof orderFormSchema>
export type GarmentFormValues = z.infer<typeof garmentFormSchema>
export type PrintDetailFormValues = z.infer<typeof printDetailFormSchema>
export type ArtworkFileFormValues = z.infer<typeof artworkFileFormSchema>
export type MockupFormValues = z.infer<typeof mockupFormSchema>

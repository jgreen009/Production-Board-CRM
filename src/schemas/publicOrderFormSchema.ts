import { z } from 'zod'

// Public Customer Order Link — a DEDICATED schema, not a reuse/subset of
// the internal orderFormSchema. There is no staff field on this schema at
// all (no paymentStatus, artworkStatus, garmentStatus, productionStatus,
// assignedTo, priority, productionNotes, approvalNote, staffCompleted) —
// not hidden, not defaulted quietly, simply never defined here, so there
// is no field a compromised/modified public page could even attempt to
// populate for those concepts. The Edge Function independently re-enforces
// the same allow-list server-side (see supabase/functions/public-order) —
// this schema is the client-side UX layer, not the security boundary.

export const publicGarmentSchema = z.object({
  id: z.string(),
  type: z.string().min(1, 'Garment type is required'),
  brand: z.string().min(1, 'Brand is required'),
  colour: z.string().min(1, 'Colour is required'),
  sizing: z.enum(['Adult', 'Youth']),
  adultQuantities: z.record(z.string(), z.number().int().min(0)),
  youthQuantities: z.record(z.string(), z.number().int().min(0)),
})

export const publicArtworkFileSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileType: z.enum(['PNG', 'JPG', 'WEBP', 'SVG', 'PDF', 'AI']),
  previewUrl: z.string().optional(),
  file: z.instanceof(File),
})

export const publicPrintSpecSchema = z.object({
  id: z.string(),
  position: z.string().min(1, 'Print position is required'),
  garmentType: z.string().min(1),
  garmentColour: z.string().optional(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  colour: z.string().optional(),
  artworkFileId: z.string().nullable(),
})

export const publicOrderFormSchema = z
  .object({
    customerName: z.string().trim().min(1, 'Your name is required').max(200),
    company: z.string().trim().max(200).optional(),
    email: z.string().trim().email('Enter a valid email address').max(200).optional().or(z.literal('')),
    phone: z.string().trim().max(50).optional(),
    jobTitle: z.string().trim().max(200).optional(),
    dueDate: z.string().optional(),
    deliveryMethod: z.enum(['Pick Up', 'Delivery']),
    services: z.array(z.string()).default([]),
    garments: z.array(publicGarmentSchema).min(1, 'Add at least one garment'),
    artworkFiles: z.array(publicArtworkFileSchema).default([]),
    printSpecs: z.array(publicPrintSpecSchema).default([]),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((values) => values.email || values.phone, {
    message: 'Enter at least an email or a phone number so we can reach you',
    path: ['email'],
  })

export type PublicGarmentFormValues = z.infer<typeof publicGarmentSchema>
export type PublicArtworkFileFormValues = z.infer<typeof publicArtworkFileSchema>
export type PublicPrintSpecFormValues = z.infer<typeof publicPrintSpecSchema>
export type PublicOrderFormValues = z.infer<typeof publicOrderFormSchema>

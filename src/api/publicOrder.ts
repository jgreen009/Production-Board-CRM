import { supabase } from '@/lib/supabase'
import type { PublicOrderFormValues } from '@/schemas/publicOrderFormSchema'

export type PublicLinkInvalidReason = 'not_found' | 'revoked' | 'expired' | 'used'

export interface PublicGarmentTypeOption {
  name: string
  supplierUrl?: string
}

export interface PublicServiceOption {
  id: string
  name: string
}

export interface PublicLinkValidation {
  valid: boolean
  reason?: PublicLinkInvalidReason
  garmentTypes: PublicGarmentTypeOption[]
  garmentBrands: string[]
  services: PublicServiceOption[]
  businessName: string
}

// The public-order Edge Function requires no session (verify_jwt is
// disabled for this function specifically — it implements its own
// token-based authorization, see the function's own header comment) —
// `supabase.functions.invoke` still works fine unauthenticated, it just
// won't attach a bearer JWT the function never checks anyway.
export async function validatePublicOrderLink(token: string): Promise<PublicLinkValidation> {
  const { data, error } = await supabase.functions.invoke('public-order', {
    body: { action: 'validate', token },
  })
  if (error) throw error
  return {
    valid: !!data.valid,
    reason: data.reason,
    garmentTypes: data.garmentTypes ?? [],
    garmentBrands: data.garmentBrands ?? [],
    services: data.services ?? [],
    businessName: data.businessName ?? 'Brand Fanatix',
  }
}

export interface PublicOrderSubmissionResult {
  orderId: string
  orderNumber: string
}

// Pure — shapes the exact JSON the Edge Function's own sanitizer expects
// (customer/order/garments/services/printSpecs with artworkKey references
// resolved against the file list), with NO staff/internal field present
// anywhere in the shape: no paymentStatus, no artworkStatus/garmentStatus/
// productionStatus, no assignedTo, no priority, no productionNotes/
// approvalNote/staffCompleted. There is no code path in this function
// that could populate any of those, maliciously or otherwise — they are
// simply not fields this function's return type has.
export function buildPublicOrderSubmissionPayload(values: PublicOrderFormValues) {
  return {
    customer: {
      name: values.customerName,
      company: values.company ?? '',
      email: values.email ?? '',
      phone: values.phone ?? '',
    },
    order: {
      jobName: values.jobTitle || values.customerName,
      phone: values.phone ?? '',
      email: values.email ?? '',
      dueDate: values.dueDate ?? '',
      deliveryMethod: values.deliveryMethod,
      notes: values.notes ?? '',
    },
    garments: values.garments.map((g) => ({
      type: g.type,
      brand: g.brand,
      colour: g.colour,
      sizing: g.sizing,
      adultQuantities: g.adultQuantities,
      youthQuantities: g.youthQuantities,
    })),
    services: values.services,
    printSpecs: values.printSpecs.map((spec) => ({
      id: spec.id,
      position: spec.position,
      colour: spec.colour ?? '',
      widthMm: spec.widthMm,
      heightMm: spec.heightMm,
      garmentType: spec.garmentType,
      garmentColour: spec.garmentColour ?? '',
      // Resolved to a `artwork_<fileId>` form-field name by submitPublicOrder
      // below — the Edge Function maps that field name back to a real
      // artwork id after uploading the file itself.
      artworkKey: spec.artworkFileId,
    })),
  }
}

export async function submitPublicOrder(
  token: string,
  values: PublicOrderFormValues,
): Promise<PublicOrderSubmissionResult> {
  const payload = buildPublicOrderSubmissionPayload(values)

  const formData = new FormData()
  formData.set('token', token)
  formData.set('payload', JSON.stringify(payload))
  for (const artwork of values.artworkFiles) {
    formData.set(`artwork_${artwork.id}`, artwork.file, artwork.file.name)
  }

  const { data, error } = await supabase.functions.invoke('public-order', { body: formData })
  if (error) throw error
  if (!data?.orderId) throw new Error('Order submission did not return an order number')
  return { orderId: data.orderId, orderNumber: data.orderNumber }
}

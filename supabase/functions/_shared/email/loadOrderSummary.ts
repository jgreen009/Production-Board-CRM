// Single loader for customer-facing order data. Used by transactional email and
// by the public confirmation page, so both build the same CustomerOrderSummary
// from the database. Only the explicit column list below is ever read.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { buildCustomerOrderSummary, type CustomerOrderSummary, type RawOrderForEmail } from './summary.ts'

// Signed mockup links sent in email must outlive the moment of sending, since
// recipients open these messages later. Seven days is a deliberate trade-off:
// long enough to be useful, short enough that a forwarded email does not keep
// working indefinitely. Every (re)send mints fresh URLs.
export const EMAIL_PREVIEW_URL_TTL_SECONDS = 7 * 24 * 60 * 60

// The confirmation page calls with a much shorter lifetime, because it mints
// fresh URLs on every view.
export const PAGE_PREVIEW_URL_TTL_SECONDS = 15 * 60

const PREVIEW_BUCKET = 'mockup-previews'

const ORDER_SELECT = `
  order_number, job_name, email, phone, due_date, delivery_method, notes, source,
  customers ( name, company, email, phone ),
  order_garments ( garment_type_label, garment_brand_label, colour, sort_order, garment_quantities ( size, quantity ) ),
  order_services ( services ( name ) ),
  print_specs ( id, position, colour, width_mm, garment_type, garment_colour, sort_order, preview_storage_path, artwork ( file_name ) )
`

export interface LoadedOrder {
  source: string
  orderNumber: string
  summary: CustomerOrderSummary
}

export async function loadOrderSummary(
  admin: SupabaseClient,
  orderId: string,
  previewTtlSeconds: number | null,
): Promise<LoadedOrder | null> {
  const { data, error } = await admin.from('orders').select(ORDER_SELECT).eq('id', orderId).maybeSingle()
  if (error) throw error
  if (!data) return null

  const raw = data as unknown as RawOrderForEmail & { source: string }
  const previewUrls: Record<string, string | null> = {}
  for (const spec of raw.print_specs) {
    if (previewTtlSeconds === null || !spec.preview_storage_path) {
      previewUrls[spec.id] = null
      continue
    }
    const { data: signed, error: signError } = await admin.storage
      .from(PREVIEW_BUCKET)
      .createSignedUrl(spec.preview_storage_path, previewTtlSeconds)
    previewUrls[spec.id] = signError ? null : (signed?.signedUrl ?? null)
  }

  const summary = buildCustomerOrderSummary(raw, previewUrls)
  return { source: raw.source, orderNumber: raw.order_number, summary }
}

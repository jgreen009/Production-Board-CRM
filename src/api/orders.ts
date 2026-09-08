import { supabase } from '@/lib/supabase'
import type { Order } from '@/types'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { mapDatabaseOrderToDomain, mapOrderFormToUpsertPayload } from '@/api/mappers/order'
import type { OrderRow } from '@/api/mappers/order'

const ORDER_SELECT = `
  *,
  customers ( name, company ),
  order_garments ( id, garment_type_label, garment_brand_label, colour, sizing_type, sort_order,
    garment_quantities ( size, quantity ) ),
  order_services ( services ( name ) ),
  print_specs ( * )
`

// Drafts are deliberately excluded from the default list — they're not
// surfaced as active production orders anywhere (Production Board,
// dashboards, Orders List) until explicitly finalized. A dedicated drafts
// view is Milestone 11 per the plan; this just keeps today's default
// behavior (only real orders show up) correct in the meantime.
export async function listOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('order_state', 'Active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as OrderRow[]).map(mapDatabaseOrderToDomain)
}

export async function getOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapDatabaseOrderToDomain(data as unknown as OrderRow) : null
}

// The one write path behind Save Draft, Create Order, and Edit Order alike
// (spec §11) — wraps the upsert_order RPC. Returns the order's id, stable
// across repeated calls once it exists (pass it back in as `orderId` to
// update the same row instead of inserting a new one).
export async function upsertOrder(
  values: OrderFormValues,
  orderId?: string | null,
  finalize = false,
): Promise<string> {
  const payload = mapOrderFormToUpsertPayload(values)
  const { data, error } = await supabase.rpc('upsert_order', {
    payload,
    p_order_id: orderId ?? null,
    p_finalize: finalize,
  })
  if (error) throw error
  return data as string
}

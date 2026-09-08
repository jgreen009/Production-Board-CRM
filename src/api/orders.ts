import { supabase } from '@/lib/supabase'
import type { ArtworkStatus, GarmentStatus, Order, OrderActivityEntry, PaymentStatus, ProductionStatus } from '@/types'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { mapDatabaseOrderToDomain, mapOrderFormToUpsertPayload } from '@/api/mappers/order'
import type { OrderRow } from '@/api/mappers/order'
import { mapActivityRowToDomain } from '@/api/mappers/activity'
import type { ActivityRow } from '@/api/mappers/activity'

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

export async function listActivityForOrder(orderId: string): Promise<OrderActivityEntry[]> {
  const { data, error } = await supabase
    .from('order_activity')
    .select('id, order_id, activity_type, message, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ActivityRow[]).map(mapActivityRowToDomain)
}

// Shared shape behind the four status-change mutations below: update the
// column, then log one order_activity row — two sequential calls rather
// than a single RPC, since a missed activity row on rare failure is an
// acceptable risk for a log, not core business data (unlike upsert_order's
// child tables, which do need the whole-child-set-replace guarantee).
async function updateOrderStatus(
  orderId: string,
  column: 'production_status' | 'artwork_status' | 'garment_status' | 'payment_status',
  value: string,
  activityType: OrderActivityEntry['type'],
  label: string,
): Promise<void> {
  const { error: updateError } = await supabase.from('orders').update({ [column]: value }).eq('id', orderId)
  if (updateError) throw updateError

  const { data: userData } = await supabase.auth.getUser()
  const { error: activityError } = await supabase.from('order_activity').insert({
    order_id: orderId,
    user_id: userData.user?.id,
    activity_type: activityType,
    message: `${label} changed to ${value}`,
  })
  if (activityError) throw activityError
}

export function updateProductionStatus(orderId: string, status: ProductionStatus) {
  return updateOrderStatus(orderId, 'production_status', status, 'production', 'Production status')
}

export function updateArtworkStatus(orderId: string, status: ArtworkStatus) {
  return updateOrderStatus(orderId, 'artwork_status', status, 'artwork', 'Artwork status')
}

export function updateGarmentStatus(orderId: string, status: GarmentStatus) {
  return updateOrderStatus(orderId, 'garment_status', status, 'garments', 'Garment status')
}

export function updatePaymentStatus(orderId: string, status: PaymentStatus) {
  return updateOrderStatus(orderId, 'payment_status', status, 'payment', 'Payment status')
}

import { supabase } from '@/lib/supabase'
import type { ArtworkStatus, GarmentStatus, Order, OrderActivityEntry, PaymentStatus, ProductionStatus } from '@/types'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { mapDatabaseOrderToDomain, mapDatabaseOrderToFormValues, mapOrderFormToUpsertPayload } from '@/api/mappers/order'
import type { OrderRow } from '@/api/mappers/order'
import { mapActivityRowToDomain } from '@/api/mappers/activity'
import type { ActivityRow } from '@/api/mappers/activity'
import { getArtworkSignedUrl } from '@/api/artwork'

const ORDER_SELECT = `
  *,
  customers ( name, company ),
  assignee:profiles ( full_name, is_active ),
  order_garments ( id, garment_type_label, garment_brand_label, colour, sizing_type, sort_order,
    garment_quantities ( size, quantity ) ),
  order_services ( services ( name ) ),
  print_specs ( * ),
  artwork ( id, file_name, file_type, file_size_bytes, storage_path, created_at )
`

// Drafts are deliberately excluded from the default list — they're not
// surfaced as active production orders anywhere (Production Board,
// dashboards, Orders List's default view) until explicitly finalized.
// listDraftOrders below is the dedicated drafts view (Milestone 11).
export async function listOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('order_state', 'Active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as OrderRow[]).map(mapDatabaseOrderToDomain)
}

export async function listDraftOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('order_state', 'Draft')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as unknown as OrderRow[]).map(mapDatabaseOrderToDomain)
}

// Batch B: the pre-save snapshot of which PrintSpec ids exist for an order,
// used only to detect which ones a save removed (so their generated
// mockup previews can be cleaned up) — see useUpsertOrder's onMutate and
// src/api/mockupPreviews.ts. Deliberately just ids, not full rows: the
// canonical preview path is derivable from (orderId, printSpecId) alone.
export async function listPrintSpecIds(orderId: string): Promise<string[]> {
  const { data, error } = await supabase.from('print_specs').select('id').eq('order_id', orderId)
  if (error) throw error
  return (data ?? []).map((row) => row.id as string)
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

const PREVIEWABLE_ARTWORK_TYPES = ['PNG', 'JPG', 'WEBP', 'SVG']

// For editing (Milestone 8) and, later, resuming a draft (Milestone 11) —
// same reverse mapping either way. Signed preview URLs are fetched here
// (not baked into the pure mapper) so an edited order's file cards show a
// real thumbnail, same as a fresh upload would; a failed signed-url fetch
// just leaves that one file without a preview rather than failing the
// whole load.
export async function getOrderFormValues(id: string): Promise<OrderFormValues | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const values = mapDatabaseOrderToFormValues(data as unknown as OrderRow)

  const artworkFiles = await Promise.all(
    values.artworkFiles.map(async (file) => {
      if (!file.storagePath || !PREVIEWABLE_ARTWORK_TYPES.includes(file.fileType)) return file
      try {
        const previewUrl = await getArtworkSignedUrl(file.storagePath)
        return { ...file, previewUrl }
      } catch {
        return file
      }
    }),
  )

  return { ...values, artworkFiles }
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

interface ActivityDiffEntry {
  activityType: OrderActivityEntry['type']
  message: string
}

// Pure and testable (plan §12 step 5, §17) — compares the order as it was
// before an edit against the form values about to be saved, and returns
// one entry per meaningfully-changed field worth logging. Due date has no
// matching order_activity.activity_type in the schema's check constraint,
// so a due-date change isn't logged here — priority and payment status
// are the two edit-form fields that do have one.
// `newAssigneeName` is resolved by the caller (from whatever active-staff
// list it already loaded for the AssigneeSelector) rather than looked up
// here — this function stays pure/DB-free, per the doc comment above.
// Only needed when the assignment actually changed and the new value is
// non-null; omit or pass undefined otherwise.
export function diffOrderForActivity(
  previous: Order,
  values: OrderFormValues,
  newAssigneeName?: string | null,
): ActivityDiffEntry[] {
  const entries: ActivityDiffEntry[] = []
  if (previous.priority !== values.priority) {
    entries.push({ activityType: 'priority', message: `Priority changed to ${values.priority}` })
  }
  if (previous.paymentStatus !== values.paymentStatus) {
    entries.push({ activityType: 'payment', message: `Payment status changed to ${values.paymentStatus}` })
  }
  for (const spec of values.printSpecs) {
    const prevSpec = previous.printSpecs.find((s) => s.id === spec.id)
    if (prevSpec && (prevSpec.approvalNote ?? '') !== (spec.approvalNote ?? '')) {
      entries.push({ activityType: 'mockup', message: `Mockup note updated for ${spec.position}` })
    }
  }
  if ((previous.assignedTo ?? undefined) !== (values.assignedTo ?? undefined)) {
    if (!values.assignedTo) {
      entries.push({ activityType: 'assignment', message: 'Order unassigned' })
    } else if (!previous.assignedTo) {
      entries.push({ activityType: 'assignment', message: `Order assigned to ${newAssigneeName ?? 'a staff member'}` })
    } else {
      entries.push({
        activityType: 'assignment',
        message: `Order reassigned from ${previous.assignedToName ?? 'a staff member'} to ${newAssigneeName ?? 'a staff member'}`,
      })
    }
  }
  return entries
}

// Edit Order's save path: finalize the same upsert_order RPC everything
// else uses, then log activity for whatever meaningfully changed.
export async function updateOrderWithActivity(
  orderId: string,
  values: OrderFormValues,
  previous: Order,
  newAssigneeName?: string | null,
): Promise<string> {
  const id = await upsertOrder(values, orderId, true)

  const diffs = diffOrderForActivity(previous, values, newAssigneeName)
  if (diffs.length > 0) {
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('order_activity').insert(
      diffs.map((d) => ({
        order_id: orderId,
        user_id: userData.user?.id,
        activity_type: d.activityType,
        message: d.message,
      })),
    )
    if (error) throw error
  }

  return id
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

export interface RecentActivityEntry extends OrderActivityEntry {
  orderNumber: string
}

// Dashboard's "Recent Activity" feed — across all orders, not scoped to
// one, unlike listActivityForOrder above.
export async function listRecentActivity(limit: number): Promise<RecentActivityEntry[]> {
  const { data, error } = await supabase
    .from('order_activity')
    .select('id, order_id, activity_type, message, created_at, orders ( order_number )')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  return (data as unknown as (ActivityRow & { orders: { order_number: string | null } | null })[]).map((row) => ({
    ...mapActivityRowToDomain(row),
    orderNumber: row.orders?.order_number ?? '',
  }))
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

// Quick reassignment from Order Detail — same direct-update-then-log
// shape as the four status mutations above, not the full upsert_order
// path. Safe against assigning to an inactive/unknown profile even via a
// raw call: `orders_validate_assignment` (a BEFORE trigger, Phase 4
// Milestone 2) enforces that server-side regardless of which write path
// reaches this column.
export async function updateOrderAssignment(
  orderId: string,
  assignedTo: string | null,
  assigneeName: string | null,
  previousAssigneeName: string | null,
): Promise<void> {
  const { error: updateError } = await supabase.from('orders').update({ assigned_to: assignedTo }).eq('id', orderId)
  if (updateError) throw updateError

  const message = !assignedTo
    ? 'Order unassigned'
    : !previousAssigneeName
      ? `Order assigned to ${assigneeName ?? 'a staff member'}`
      : `Order reassigned from ${previousAssigneeName} to ${assigneeName ?? 'a staff member'}`

  const { data: userData } = await supabase.auth.getUser()
  const { error: activityError } = await supabase.from('order_activity').insert({
    order_id: orderId,
    user_id: userData.user?.id,
    activity_type: 'assignment',
    message,
  })
  if (activityError) throw activityError
}

import { supabase } from '@/lib/supabase'
import type { ConfirmationRecord, ConfirmationRowStatus } from '@/utils/orderConfirmation'

export interface CustomerOrderSummary {
  orderNumber: string
  customerName: string
  companyName: string | null
  customerEmail: string
  customerPhone: string | null
  jobTitle: string
  requiredDate: string | null
  deliveryMethod: string
  garments: {
    heading: string
    brand: string | null
    colour: string
    sizes: { size: string; quantity: number }[]
    totalQuantity: number
  }[]
  services: string[]
  printSpecs: {
    position: string
    artworkFileName: string | null
    widthMm: number
    colour: string | null
    garmentLabel: string
    previewUrl: string | null
  }[]
  customerNotes: string | null
}

// One query for every order's confirmation rows, shaped per order. Staff RLS
// allows read; nothing in the browser writes this table.
export async function listConfirmationRecords(): Promise<Record<string, ConfirmationRecord[]>> {
  const { data, error } = await supabase
    .from('order_confirmations')
    .select('order_id, status, sent_at, confirmed_at, customer_email, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error

  const byOrder: Record<string, ConfirmationRecord[]> = {}
  for (const r of (data ?? []) as {
    order_id: string
    status: ConfirmationRowStatus
    sent_at: string | null
    confirmed_at: string | null
    customer_email: string
    created_at: string
  }[]) {
    const record: ConfirmationRecord = {
      status: r.status,
      sentAt: r.sent_at,
      confirmedAt: r.confirmed_at,
      customerEmail: r.customer_email,
      createdAt: r.created_at,
    }
    byOrder[r.order_id] = [...(byOrder[r.order_id] ?? []), record]
  }
  return byOrder
}

// Staff only: brings the stored state in line with the order's current
// customer-facing content. Called after edits and when Order Detail opens.
export async function reconcileOrderConfirmation(orderId: string): Promise<{ superseded: boolean }> {
  const { data, error } = await supabase.functions.invoke<{ superseded: boolean }>('order-confirmation', {
    body: { action: 'reconcile', orderId },
  })
  if (error) throw error
  return data as { superseded: boolean }
}

export type PublicConfirmationState =
  | 'invalid'
  | 'superseded'
  | 'expired'
  | 'pending'
  | 'already_confirmed'
  | 'confirmed'
  | 'changed'

export interface ConfirmationReview {
  state: PublicConfirmationState
  orderNumber?: string
  summary?: CustomerOrderSummary
  summaryHash?: string
  confirmedAt?: string | null
}

// Public calls go straight to the function with the anon key. They carry no
// session, because the token in the URL is the only authorization. Using fetch
// rather than supabase.functions.invoke lets the page read the JSON body of a
// 409 "changed" response.
function functionUrl(): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/order-confirmation`
}

async function postPublic<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(functionUrl(), {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = (await response.json().catch(() => ({ state: 'invalid' }))) as T
  return json
}

export function fetchConfirmationReview(token: string): Promise<ConfirmationReview> {
  return postPublic<ConfirmationReview>({ action: 'review', token })
}

export function confirmOrder(token: string, expectedSummaryHash: string): Promise<ConfirmationReview> {
  return postPublic<ConfirmationReview>({ action: 'confirm', token, expectedSummaryHash })
}

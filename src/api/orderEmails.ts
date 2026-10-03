import { supabase } from '@/lib/supabase'

export type OrderEmailType = 'staff_order_summary' | 'customer_order_receipt'
export type OrderEmailStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced'

export interface OrderEmailRecord {
  id: string
  orderId: string
  emailType: OrderEmailType
  recipient: string
  status: OrderEmailStatus
  errorMessage: string | null
  sentAt: string | null
  failedAt: string | null
  createdAt: string
}

interface OrderEmailRow {
  id: string
  order_id: string
  email_type: OrderEmailType
  recipient: string
  status: OrderEmailStatus
  error_message: string | null
  sent_at: string | null
  failed_at: string | null
  created_at: string
}

export async function listOrderEmails(orderId: string): Promise<OrderEmailRecord[]> {
  const { data, error } = await supabase
    .from('order_emails')
    .select('id, order_id, email_type, recipient, status, error_message, sent_at, failed_at, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as OrderEmailRow[]).map((r) => ({
    id: r.id,
    orderId: r.order_id,
    emailType: r.email_type,
    recipient: r.recipient,
    status: r.status,
    errorMessage: r.error_message,
    sentAt: r.sent_at,
    failedAt: r.failed_at,
    createdAt: r.created_at,
  }))
}

export type SendOrderEmailResponse =
  | { status: 'sent'; emailId: string }
  | { status: 'failed'; errorCategory: string }
  | { status: 'skipped'; reason: string }
  | { status: 'not_found' }

// Only the order id, the email type, and a retry flag are sent. The server
// derives the recipient and the body from the database itself.
export async function requestOrderEmail(
  orderId: string,
  emailType: OrderEmailType,
  retry: boolean,
): Promise<SendOrderEmailResponse> {
  const { data, error } = await supabase.functions.invoke<SendOrderEmailResponse>('send-order-email', {
    body: { orderId, emailType, retry },
  })
  if (error) throw error
  return data as SendOrderEmailResponse
}

// Staff-facing copy only. Raw provider text, stack traces, and API details
// never reach the UI. Only the category set by the server is used.
export function orderEmailErrorMessage(category: string | null | undefined): string {
  switch (category) {
    case 'no_valid_recipient':
      return 'This order has no valid customer email address. Add one to the order, then resend.'
    case 'sender_not_configured':
      return 'Email sending is not configured yet.'
    case 'resend_rate_limited':
      return 'Too many emails were sent recently. Try again in a few minutes.'
    case 'timed_out':
      return 'The previous send timed out. You can resend now.'
    default:
      return 'The email could not be sent. You can try again.'
  }
}

export function latestAttemptByType(
  records: OrderEmailRecord[],
): Partial<Record<OrderEmailType, OrderEmailRecord>> {
  const latest: Partial<Record<OrderEmailType, OrderEmailRecord>> = {}
  for (const r of records) {
    const current = latest[r.emailType]
    if (!current || r.createdAt > current.createdAt) latest[r.emailType] = r
  }
  return latest
}

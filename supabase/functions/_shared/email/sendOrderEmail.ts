// Orchestrates one transactional order email: load → decide → record queued →
// render → send → record outcome. Runs only on the server, with the
// service-role client. It never writes to orders, so no failure here can
// change or roll back an order.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import {
  STALE_QUEUED_MS,
  decideSend,
  idempotencyKeyFor,
  isEmailTypeAllowedForOrder,
  isPlausibleEmail,
  subjectFor,
  type EmailErrorCategory,
  type EmailType,
} from './policy.ts'
import { buildCustomerOrderSummary, type RawOrderForEmail } from './summary.ts'
import { renderOrderEmailHtml, renderOrderEmailText } from './render.ts'
import { sendViaResend } from './resend.ts'

// Signed mockup links sent in email must outlive the moment of sending, since
// recipients open these messages later. Seven days is a deliberate trade-off:
// long enough to be useful, short enough that a forwarded email does not keep
// working indefinitely. Every (re)send mints fresh URLs.
export const EMAIL_PREVIEW_URL_TTL_SECONDS = 7 * 24 * 60 * 60

const PREVIEW_BUCKET = 'mockup-previews'

const ORDER_SELECT = `
  order_number, job_name, email, phone, due_date, delivery_method, notes, source,
  customers ( name, company, email, phone ),
  order_garments ( garment_type_label, garment_brand_label, colour, sort_order, garment_quantities ( size, quantity ) ),
  order_services ( services ( name ) ),
  print_specs ( id, position, colour, width_mm, garment_type, garment_colour, sort_order, preview_storage_path, artwork ( file_name ) )
`

export interface SendOrderEmailInput {
  orderId: string
  emailType: EmailType
  isRetry: boolean
}

export interface SendOrderEmailEnv {
  apiKey: string | undefined
  from: string | undefined
}

export type SendOrderEmailResult =
  | { status: 'sent'; emailId: string }
  | { status: 'failed'; errorCategory: EmailErrorCategory }
  | { status: 'skipped'; reason: 'already_sent' | 'in_progress' | 'already_attempted' | 'not_allowed' }
  | { status: 'not_found' }

export async function sendOrderEmail(
  admin: SupabaseClient,
  env: SendOrderEmailEnv,
  input: SendOrderEmailInput,
): Promise<SendOrderEmailResult> {
  const { orderId, emailType, isRetry } = input

  await admin
    .from('order_emails')
    .update({ status: 'failed', failed_at: new Date().toISOString(), error_message: 'timed_out' })
    .eq('order_id', orderId)
    .eq('email_type', emailType)
    .eq('status', 'queued')
    .lt('created_at', new Date(Date.now() - STALE_QUEUED_MS).toISOString())

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .maybeSingle()
  if (orderError) throw orderError
  if (!order) return { status: 'not_found' }

  const source = (order as unknown as { source: string }).source
  if (!isEmailTypeAllowedForOrder(emailType, source)) return { status: 'skipped', reason: 'not_allowed' }

  const { data: attempts, error: attemptsError } = await admin
    .from('order_emails')
    .select('status')
    .eq('order_id', orderId)
    .eq('email_type', emailType)
    .order('created_at', { ascending: true })
  if (attemptsError) throw attemptsError

  const decision = decideSend(attempts ?? [], isRetry)
  if (decision.action === 'skip') return { status: 'skipped', reason: decision.reason }

  const raw = order as unknown as RawOrderForEmail
  const recipient = (raw.email ?? '').trim() || (raw.customers?.email ?? '').trim()

  if (!isPlausibleEmail(recipient)) {
    await admin.from('order_emails').insert({
      order_id: orderId,
      email_type: emailType,
      recipient,
      status: 'failed',
      error_message: 'no_valid_recipient',
      failed_at: new Date().toISOString(),
    })
    return { status: 'failed', errorCategory: 'no_valid_recipient' }
  }

  const { data: queued, error: queueError } = await admin
    .from('order_emails')
    .insert({ order_id: orderId, email_type: emailType, recipient, status: 'queued' })
    .select('id')
    .single()
  if (queueError) {
    if (queueError.code === '23505') return { status: 'skipped', reason: 'in_progress' }
    throw queueError
  }

  const previewUrls: Record<string, string | null> = {}
  for (const spec of raw.print_specs) {
    if (!spec.preview_storage_path) {
      previewUrls[spec.id] = null
      continue
    }
    const { data: signed, error: signError } = await admin.storage
      .from(PREVIEW_BUCKET)
      .createSignedUrl(spec.preview_storage_path, EMAIL_PREVIEW_URL_TTL_SECONDS)
    previewUrls[spec.id] = signError ? null : (signed?.signedUrl ?? null)
  }

  const summary = buildCustomerOrderSummary(raw, previewUrls)
  const subject = subjectFor(emailType, summary.orderNumber)
  const html = renderOrderEmailHtml(summary, emailType)
  const text = renderOrderEmailText(summary, emailType)

  if (!env.apiKey || !env.from) {
    return finishFailed(admin, queued.id, 'sender_not_configured')
  }

  const result = await sendViaResend({
    apiKey: env.apiKey,
    from: env.from,
    to: recipient,
    subject,
    html,
    text,
    idempotencyKey: idempotencyKeyFor(orderId, emailType, decision.attempt),
  })

  if (!result.ok) return finishFailed(admin, queued.id, result.category)

  await admin
    .from('order_emails')
    .update({ status: 'sent', resend_email_id: result.id, sent_at: new Date().toISOString() })
    .eq('id', queued.id)
  return { status: 'sent', emailId: result.id }
}

async function finishFailed(
  admin: SupabaseClient,
  rowId: string,
  category: EmailErrorCategory,
): Promise<SendOrderEmailResult> {
  await admin
    .from('order_emails')
    .update({ status: 'failed', error_message: category, failed_at: new Date().toISOString() })
    .eq('id', rowId)
  return { status: 'failed', errorCategory: category }
}

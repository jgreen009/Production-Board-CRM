// Orchestrates one transactional order email: plan → decide → record queued →
// render → send → record outcome. Runs only on the server, with the
// service-role client. Order rows are never written here, so no failure in this
// file can change or roll back an order.
//
// Staff summaries also carry a confirmation request. The confirmation row
// (order_confirmations) and the email attempt (order_emails) are separate
// records: this file creates and rotates the confirmation, and the attempt
// row points at it.

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
import { renderOrderEmailHtml, renderOrderEmailText } from './render.ts'
import { sendViaResend } from './resend.ts'
import { loadOrderSummary, EMAIL_PREVIEW_URL_TTL_SECONDS } from './loadOrderSummary.ts'
import {
  buildConfirmationUrl,
  confirmationStateFromRows,
  customerFingerprint,
  generateRawToken,
  hashToken,
  type ConfirmationRow,
} from './confirmation.ts'

export interface SendOrderEmailInput {
  orderId: string
  emailType: EmailType
  isRetry: boolean
}

export interface SendOrderEmailEnv {
  apiKey: string | undefined
  from: string | undefined
  appPublicUrl?: string | undefined
}

export type SendOrderEmailResult =
  | { status: 'sent'; emailId: string }
  | { status: 'failed'; errorCategory: EmailErrorCategory }
  | { status: 'skipped'; reason: 'already_sent' | 'already_confirmed' | 'in_progress' | 'already_attempted' | 'not_allowed' }
  | { status: 'not_found' }

const CONFIRMATION_COLUMNS = 'id, order_id, status, summary_hash, confirmed_at, expires_at'

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

  const loaded = await loadOrderSummary(admin, orderId, null)
  if (!loaded) return { status: 'not_found' }
  if (!isEmailTypeAllowedForOrder(emailType, loaded.source)) return { status: 'skipped', reason: 'not_allowed' }

  const recipient = loaded.summary.customerEmail.trim()
  const currentHash = await customerFingerprint(loaded.summary)

  // Read-only plan first. Nothing is written until the decision is "send".
  const { data: history, error: historyError } = emailType === 'staff_order_summary'
    ? await admin
        .from('order_confirmations')
        .select(CONFIRMATION_COLUMNS)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
    : { data: [] as ConfirmationRow[], error: null }
  if (historyError) throw historyError

  const confirmationRows = (history ?? []) as ConfirmationRow[]
  const plan = confirmationStateFromRows(confirmationRows, currentHash)
  if (plan.kind === 'already_confirmed') return { status: 'skipped', reason: 'already_confirmed' }

  const pendingId = plan.kind === 'pending' ? plan.row.id : null
  const { data: attempts, error: attemptsError } = await attemptsQuery(admin, orderId, emailType, pendingId)
  if (attemptsError) throw attemptsError

  const decision = decideSend(attempts ?? [], isRetry)
  if (decision.action === 'skip') return { status: 'skipped', reason: decision.reason }

  if (!isPlausibleEmail(recipient)) {
    return recordFailed(admin, orderId, emailType, recipient, pendingId, 'no_valid_recipient')
  }

  if (!env.apiKey || !env.from) {
    return recordFailed(admin, orderId, emailType, recipient, pendingId, 'sender_not_configured')
  }
  if (emailType === 'staff_order_summary' && !env.appPublicUrl) {
    return recordFailed(admin, orderId, emailType, recipient, pendingId, 'app_url_not_configured')
  }

  let confirmationId: string | null = null
  let rawToken: string | null = null
  const isUpdate = confirmationRows.some((r) => r.status === 'superseded')

  if (emailType === 'staff_order_summary') {
    if (plan.kind === 'supersede') {
      await admin
        .from('order_confirmations')
        .update({ status: 'superseded', superseded_at: new Date().toISOString() })
        .eq('id', plan.row.id)
    }

    // A raw token cannot be recovered from storage, so each send that needs
    // a link gets a fresh one on the same pending row. A pending row with a
    // live attempt was already rejected by decideSend above, so the rotated
    // token only replaces a link that was never delivered.
    rawToken = generateRawToken()
    const tokenHash = await hashToken(rawToken)

    if (plan.kind === 'pending') {
      const { data: rotated, error: rotateError } = await admin
        .from('order_confirmations')
        .update({ token_hash: tokenHash, summary_hash: currentHash, customer_email: recipient })
        .eq('id', plan.row.id)
        .select('id')
        .single()
      if (rotateError) throw rotateError
      confirmationId = rotated.id
    } else {
      const { data: created, error: createError } = await admin
        .from('order_confirmations')
        .insert({ order_id: orderId, token_hash: tokenHash, customer_email: recipient, status: 'pending', summary_hash: currentHash })
        .select('id')
        .single()
      if (createError) {
        if (createError.code === '23505') return { status: 'skipped', reason: 'in_progress' }
        throw createError
      }
      confirmationId = created.id
    }
  }

  const { data: queued, error: queueError } = await admin
    .from('order_emails')
    .insert({ order_id: orderId, email_type: emailType, recipient, status: 'queued', confirmation_id: confirmationId })
    .select('id')
    .single()
  if (queueError) {
    if (queueError.code === '23505') return { status: 'skipped', reason: 'in_progress' }
    throw queueError
  }

  const withPreviews = await loadOrderSummary(admin, orderId, EMAIL_PREVIEW_URL_TTL_SECONDS)
  if (!withPreviews) return finishFailed(admin, queued.id, 'internal_error')

  const confirmationUrl = rawToken && env.appPublicUrl ? buildConfirmationUrl(env.appPublicUrl, rawToken) : null
  const subject = subjectFor(emailType, withPreviews.summary.orderNumber, isUpdate)
  const html = renderOrderEmailHtml(withPreviews.summary, emailType, { confirmationUrl, isUpdate })
  const text = renderOrderEmailText(withPreviews.summary, emailType, { confirmationUrl, isUpdate })

  const result = await sendViaResend({
    apiKey: env.apiKey,
    from: env.from,
    to: recipient,
    subject,
    html,
    text,
    idempotencyKey: idempotencyKeyFor(orderId, emailType, confirmationId, decision.attempt),
  })

  if (!result.ok) return finishFailed(admin, queued.id, result.category)

  const now = new Date().toISOString()
  await admin
    .from('order_emails')
    .update({ status: 'sent', resend_email_id: result.id, sent_at: now })
    .eq('id', queued.id)
  if (confirmationId) {
    await admin.from('order_confirmations').update({ sent_at: now }).eq('id', confirmationId)
  }
  return { status: 'sent', emailId: result.id }
}

function attemptsQuery(admin: SupabaseClient, orderId: string, emailType: EmailType, confirmationId: string | null) {
  const base = admin
    .from('order_emails')
    .select('status')
    .eq('order_id', orderId)
    .eq('email_type', emailType)
    .order('created_at', { ascending: true })
  return confirmationId ? base.eq('confirmation_id', confirmationId) : base.is('confirmation_id', null)
}

async function recordFailed(
  admin: SupabaseClient,
  orderId: string,
  emailType: EmailType,
  recipient: string,
  confirmationId: string | null,
  category: EmailErrorCategory,
): Promise<SendOrderEmailResult> {
  await admin.from('order_emails').insert({
    order_id: orderId,
    email_type: emailType,
    recipient,
    status: 'failed',
    error_message: category,
    failed_at: new Date().toISOString(),
    confirmation_id: confirmationId,
  })
  return { status: 'failed', errorCategory: category }
}

async function finishFailed(admin: SupabaseClient, rowId: string, category: EmailErrorCategory): Promise<SendOrderEmailResult> {
  await admin
    .from('order_emails')
    .update({ status: 'failed', error_message: category, failed_at: new Date().toISOString() })
    .eq('id', rowId)
  return { status: 'failed', errorCategory: category }
}


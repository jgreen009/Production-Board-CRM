// Customer confirmation (Batch B). Three actions, all server-side:
//
//   review      { token }                        → customer-safe summary, fresh previews
//   confirm     { token, expectedSummaryHash }   → atomic pending → confirmed
//   reconcile   { orderId }   (staff JWT)        → supersede a confirmation the order has outgrown
//
// review and confirm are public: the unguessable token in the URL is the only
// authorization. They are deployed with verify_jwt disabled, and reconcile
// re-checks a staff JWT itself. The raw token is only ever hashed, never
// stored, logged, or returned.
//
// Deployed with --no-verify-jwt. Do not re-enable JWT verification without
// also moving the review/confirm actions to a signed-in path.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { requireActiveStaff } from '../_shared/auth.ts'
import {
  confirmDecision,
  customerFingerprint,
  hashToken,
  reviewState,
  shouldSupersede,
  type ConfirmationRow,
} from '../_shared/email/confirmation.ts'
import { loadOrderSummary, PAGE_PREVIEW_URL_TTL_SECONDS } from '../_shared/email/loadOrderSummary.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROW_COLUMNS = 'id, order_id, status, summary_hash, confirmed_at, expires_at, customer_email'
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/
const HASH_PATTERN = /^[0-9a-f]{64}$/

type Row = ConfirmationRow & { customer_email: string }

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
}

function logStep(step: string, detail?: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: 'order-confirmation', step, ...detail }))
}

function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function findByToken(admin: ReturnType<typeof adminClient>, rawToken: string): Promise<Row | null> {
  if (!TOKEN_PATTERN.test(rawToken)) return null
  const { data } = await admin
    .from('order_confirmations')
    .select(ROW_COLUMNS)
    .eq('token_hash', await hashToken(rawToken))
    .maybeSingle()
  return (data as Row | null) ?? null
}

async function handleReview(admin: ReturnType<typeof adminClient>, rawToken: string) {
  const row = await findByToken(admin, rawToken)
  if (!row) return json({ state: 'invalid' }, 200)

  const current = await loadOrderSummary(admin, row.order_id, null)
  if (!current) return json({ state: 'invalid' }, 200)
  const currentHash = await customerFingerprint(current.summary)

  const state = reviewState(row, currentHash, Date.now())
  if (state === 'pending' || state === 'already_confirmed') {
    const withPreviews = await loadOrderSummary(admin, row.order_id, PAGE_PREVIEW_URL_TTL_SECONDS)
    if (!withPreviews) return json({ state: 'invalid' }, 200)
    return json(
      {
        state,
        orderNumber: withPreviews.orderNumber,
        summary: withPreviews.summary,
        summaryHash: currentHash,
        confirmedAt: state === 'already_confirmed' ? row.confirmed_at : null,
      },
      200,
    )
  }
  return json({ state }, 200)
}

async function handleConfirm(admin: ReturnType<typeof adminClient>, rawToken: string, expectedHash: string) {
  if (!HASH_PATTERN.test(expectedHash)) return json({ state: 'invalid' }, 400)

  const row = await findByToken(admin, rawToken)
  if (!row) return json({ state: 'invalid' }, 200)

  const current = await loadOrderSummary(admin, row.order_id, null)
  if (!current) return json({ state: 'invalid' }, 200)
  const currentHash = await customerFingerprint(current.summary)

  const decision = confirmDecision(row, expectedHash, currentHash, Date.now())
  if (decision.action === 'already_confirmed') {
    return json({ state: 'already_confirmed', confirmedAt: row.confirmed_at, orderNumber: current.orderNumber }, 200)
  }
  if (decision.action === 'reject') {
    const status = decision.reason === 'changed' ? 409 : 200
    return json({ state: decision.reason }, status)
  }

  const now = new Date().toISOString()
  const { data: updated } = await admin
    .from('order_confirmations')
    .update({ status: 'confirmed', confirmed_at: now, summary_hash: currentHash })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id, confirmed_at')
    .maybeSingle()

  if (!updated) {
    // Another click won the race. Report the winner's timestamp, unchanged.
    const again = await findByToken(admin, rawToken)
    if (again?.status === 'confirmed' && again.summary_hash === currentHash) {
      return json({ state: 'already_confirmed', confirmedAt: again.confirmed_at, orderNumber: current.orderNumber }, 200)
    }
    return json({ state: again?.status === 'superseded' ? 'superseded' : 'invalid' }, 200)
  }

  await admin.from('order_activity').insert({
    order_id: row.order_id,
    user_id: null,
    activity_type: 'customer_confirmation',
    message: `Customer confirmed the order (${row.customer_email}).`,
  })
  logStep('order_confirmed', { orderId: row.order_id })
  return json({ state: 'confirmed', confirmedAt: updated.confirmed_at, orderNumber: current.orderNumber }, 200)
}

async function handleReconcile(admin: ReturnType<typeof adminClient>, authHeader: string | null, orderId: unknown) {
  const auth = await requireActiveStaff(admin, authHeader)
  if (!auth.ok) return json({ error: auth.status === 401 ? 'Not signed in' : 'Not authorized' }, auth.status)
  if (typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'Invalid order' }, 400)

  const current = await loadOrderSummary(admin, orderId, null)
  if (!current) return json({ error: 'Order not found' }, 404)
  const currentHash = await customerFingerprint(current.summary)

  const { data: active } = await admin
    .from('order_confirmations')
    .select(ROW_COLUMNS)
    .eq('order_id', orderId)
    .eq('status', 'confirmed')
    .maybeSingle()

  let superseded = false
  if (active && shouldSupersede(active as Row, currentHash)) {
    await admin
      .from('order_confirmations')
      .update({ status: 'superseded', superseded_at: new Date().toISOString() })
      .eq('id', (active as Row).id)
      .eq('status', 'confirmed')
    superseded = true
    logStep('confirmation_superseded', { orderId })
  }
  return json({ superseded }, 200)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const admin = adminClient()
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return json({ error: 'Invalid request' }, 400)

    if (body.action === 'review') return await handleReview(admin, String(body.token ?? ''))
    if (body.action === 'confirm') {
      return await handleConfirm(admin, String(body.token ?? ''), String(body.expectedSummaryHash ?? ''))
    }
    if (body.action === 'reconcile') {
      return await handleReconcile(admin, req.headers.get('authorization'), body.orderId)
    }
    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    logStep('unhandled_exception', { errorCategory: err instanceof Error ? err.name : typeof err })
    console.error(err)
    return json({ error: 'This service is temporarily unavailable. Please try again.' }, 500)
  }
})

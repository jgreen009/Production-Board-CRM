// Staff-triggered transactional order email (Batch A). The browser sends only
// { orderId, emailType, retry? }. Recipient, subject, and body are all derived
// here from the database, so a caller can never choose who receives mail or
// what it says.
//
// Authorization is re-checked on every request: the JWT must verify, and the
// profile behind it must exist and be active. Customer receipts are NOT
// reachable from this function unless the order came from the public form.
// The public-order function calls the receipt path in-process after a
// successful submission, so anonymous callers have no route to it.
//
// Deployed WITH JWT verification (the default). Do not add --no-verify-jwt.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { EMAIL_TYPES, type EmailType } from '../_shared/email/policy.ts'
import { sendOrderEmail } from '../_shared/email/sendOrderEmail.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
}

function logStep(step: string, detail?: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: 'send-order-email', step, ...detail }))
}

function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const admin = adminClient()

    const authHeader = req.headers.get('authorization') ?? ''
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
    if (!jwt) return json({ error: 'Not signed in' }, 401)

    const { data: userData, error: userError } = await admin.auth.getUser(jwt)
    if (userError || !userData.user) return json({ error: 'Not signed in' }, 401)

    const { data: profile } = await admin
      .from('profiles')
      .select('is_active')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!profile || !profile.is_active) return json({ error: 'Not authorized' }, 403)

    const body = (await req.json().catch(() => null)) as { orderId?: unknown; emailType?: unknown; retry?: unknown } | null
    if (!body || typeof body.orderId !== 'string' || !UUID.test(body.orderId)) {
      return json({ error: 'Invalid order' }, 400)
    }
    if (!EMAIL_TYPES.includes(body.emailType as EmailType)) {
      return json({ error: 'Unknown email type' }, 400)
    }

    const result = await sendOrderEmail(
      admin,
      { apiKey: Deno.env.get('RESEND_API_KEY'), from: Deno.env.get('EMAIL_FROM') },
      { orderId: body.orderId, emailType: body.emailType as EmailType, isRetry: body.retry === true },
    )

    if (result.status === 'not_found') return json({ error: 'Order not found' }, 404)
    logStep('email_processed', { emailType: body.emailType, status: result.status })
    return json(result, 200)
  } catch (err) {
    logStep('unhandled_exception', { errorCategory: err instanceof Error ? err.name : typeof err })
    console.error(err)
    return json({ error: 'The email service is temporarily unavailable.' }, 500)
  }
})

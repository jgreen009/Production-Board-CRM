// Thin Resend REST client. Called only from Edge Functions, never from the
// browser. The API key arrives as an argument, so this module never reads
// the environment itself and stays runnable under Vitest. Raw provider
// responses are never returned to callers, only a categorized result.

import { categorizeResendStatus, type EmailErrorCategory } from './policy.ts'

export interface ResendSendInput {
  apiKey: string
  from: string
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
}

export type ResendSendResult =
  | { ok: true; id: string }
  | { ok: false; category: EmailErrorCategory }

const RESEND_URL = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10_000

export async function sendViaResend(input: ResendSendInput, fetchImpl: typeof fetch = fetch): Promise<ResendSendResult> {
  let response: Response
  try {
    response = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
    return { ok: false, category: timedOut ? 'timed_out' : 'network_error' }
  }

  if (!response.ok) return { ok: false, category: categorizeResendStatus(response.status) }

  const body = (await response.json().catch(() => null)) as { id?: unknown } | null
  if (!body || typeof body.id !== 'string') return { ok: false, category: 'resend_unavailable' }
  return { ok: true, id: body.id }
}

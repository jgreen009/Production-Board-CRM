// Pure decisions for transactional order email: who may send what, whether
// a send should happen at all, and how provider failures are categorized
// for storage and display. No I/O here, so every rule is directly testable.

export const EMAIL_TYPES = ['staff_order_summary', 'customer_order_receipt'] as const
export type EmailType = (typeof EMAIL_TYPES)[number]

export const EMAIL_STATUSES_LIVE = ['queued', 'sent', 'delivered'] as const

export type EmailErrorCategory =
  | 'no_valid_recipient'
  | 'sender_not_configured'
  | 'resend_rejected_request'
  | 'resend_sender_rejected'
  | 'resend_rate_limited'
  | 'resend_unavailable'
  | 'network_error'
  | 'timed_out'
  | 'internal_error'

export function subjectFor(emailType: EmailType, orderNumber: string): string {
  if (emailType === 'staff_order_summary') return `Brand Fanatix Order ${orderNumber} — Please Review`
  return `We received your Brand Fanatix order request — ${orderNumber}`
}

// Staff may send the staff summary for any order, and may retry the
// customer receipt only for an order that really came from the public form.
// Anonymous callers never reach this function at all (see send-order-email's
// JWT gate); the public-order function calls the receipt path in-process.
export function isEmailTypeAllowedForOrder(emailType: EmailType, orderSource: string): boolean {
  if (emailType === 'staff_order_summary') return true
  return orderSource === 'public_form'
}

export interface ExistingAttempt {
  status: string
}

export type SendDecision =
  | { action: 'send'; attempt: number }
  | { action: 'skip'; reason: 'already_sent' | 'in_progress' | 'already_attempted' }

// Automatic sends (the one that fires right after an order is created) only
// ever happen when there is no prior attempt at all. Explicit retries are
// allowed only when no live attempt exists, so a successful email can never
// be resent by accident, and a failed one can always be retried.
export function decideSend(existing: ExistingAttempt[], isRetry: boolean): SendDecision {
  const live = existing.find((a) => (EMAIL_STATUSES_LIVE as readonly string[]).includes(a.status))
  if (live) {
    return { action: 'skip', reason: live.status === 'queued' ? 'in_progress' : 'already_sent' }
  }
  if (!isRetry && existing.length > 0) return { action: 'skip', reason: 'already_attempted' }
  return { action: 'send', attempt: existing.length + 1 }
}

// Resend's Idempotency-Key is honoured for 24h, so every attempt gets its own
// key. Otherwise a retry after a genuine failure would be answered from the
// cached failure instead of actually sending.
export function idempotencyKeyFor(orderId: string, emailType: EmailType, attempt: number): string {
  return `order:${orderId}:${emailType}:attempt${attempt}`
}

// Cheap syntactic check only. Resend is the real judge of deliverability,
// and a bad address still produces a stored failure rather than blocking the
// order.
export function isPlausibleEmail(value: string | null | undefined): value is string {
  if (!value) return false
  const trimmed = value.trim()
  if (trimmed.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export function categorizeResendStatus(httpStatus: number): EmailErrorCategory {
  if (httpStatus === 401 || httpStatus === 403) return 'resend_sender_rejected'
  if (httpStatus === 429) return 'resend_rate_limited'
  if (httpStatus >= 500) return 'resend_unavailable'
  return 'resend_rejected_request'
}

// A queued row older than this is treated as a crashed send, not a live one,
// so it can no longer block a retry.
export const STALE_QUEUED_MS = 10 * 60 * 1000

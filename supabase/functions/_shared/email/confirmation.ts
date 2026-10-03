// Customer confirmation rules. Pure functions only (the one exception is the
// WebCrypto digest, which exists in both Deno and Node), so the state
// decisions are directly unit-testable. The Edge Functions own all I/O.

import type { CustomerOrderSummary } from './summary.ts'

export const CONFIRMATION_TOKEN_BYTES = 32

export function generateRawToken(): string {
  const bytes = new Uint8Array(CONFIRMATION_TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function hashToken(rawToken: string): Promise<string> {
  return sha256Hex(rawToken)
}

// Stable serialisation: object keys are sorted at every depth, so the same
// data always produces the same string regardless of insertion order.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
  return `{${entries.join(',')}}`
}

// The fingerprint covers exactly the customer-visible summary. Preview URLs
// are excluded because they are signed and change on every call; they show
// the same artwork, so they do not make the order different. Anything not in
// CustomerOrderSummary (assignment, statuses, priority, notes, timestamps,
// ids) is absent by construction.
export function customerFingerprint(summary: CustomerOrderSummary): Promise<string> {
  const stripped = {
    ...summary,
    printSpecs: summary.printSpecs.map(({ previewUrl: _previewUrl, ...rest }) => rest),
  }
  return sha256Hex(canonicalJson(stripped))
}

export function buildConfirmationUrl(appPublicUrl: string, rawToken: string): string {
  const base = appPublicUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//.test(base)) throw new Error('APP_PUBLIC_URL must be an absolute http(s) URL')
  return `${base}/order-confirmation/${rawToken}`
}

export type ConfirmationStatus = 'pending' | 'confirmed' | 'superseded'

export interface ConfirmationRow {
  id: string
  order_id: string
  status: ConfirmationStatus
  summary_hash: string
  confirmed_at: string | null
  expires_at: string | null
}

export type ReviewState = 'invalid' | 'superseded' | 'expired' | 'pending' | 'already_confirmed'

// Staff edits never touch the confirmed row directly; the next reconcile does.
// But a customer may open a link between an edit and that reconcile, so the
// review path compares hashes itself and never shows outdated data as current.
export function reviewState(row: ConfirmationRow | null, currentHash: string, nowMs: number): ReviewState {
  if (!row) return 'invalid'
  if (row.status === 'superseded') return 'superseded'
  if (row.expires_at && new Date(row.expires_at).getTime() < nowMs) return 'expired'
  if (row.status === 'confirmed') return row.summary_hash === currentHash ? 'already_confirmed' : 'superseded'
  return 'pending'
}

export type ConfirmDecision =
  | { action: 'confirm' }
  | { action: 'already_confirmed' }
  | { action: 'reject'; reason: 'invalid' | 'superseded' | 'expired' | 'changed' }

// Idempotent by design. A repeat click on an already confirmed order returns
// the existing state and never writes again. A pending order is confirmed only
// if the customer approved exactly what the server holds now.
export function confirmDecision(
  row: ConfirmationRow | null,
  expectedHash: string,
  currentHash: string,
  nowMs: number,
): ConfirmDecision {
  const state = reviewState(row, currentHash, nowMs)
  if (state === 'already_confirmed') return { action: 'already_confirmed' }
  if (state === 'pending') {
    return expectedHash === currentHash ? { action: 'confirm' } : { action: 'reject', reason: 'changed' }
  }
  return { action: 'reject', reason: state === 'invalid' ? 'invalid' : state }
}

// Only a confirmed approval can be superseded. A pending request is simply
// refreshed when staff next send it.
export function shouldSupersede(row: ConfirmationRow, currentHash: string): boolean {
  return row.status === 'confirmed' && row.summary_hash !== currentHash
}

export type ConfirmationPlan =
  | { kind: 'none' }
  | { kind: 'pending'; row: ConfirmationRow }
  | { kind: 'supersede'; row: ConfirmationRow }
  | { kind: 'already_confirmed'; row: ConfirmationRow }

// Newest first, as returned by the loader. At most one active row exists per
// order (partial unique index), so the first active row is the only one.
export function confirmationStateFromRows(rows: ConfirmationRow[], currentHash: string): ConfirmationPlan {
  const active = rows.find((r) => r.status === 'pending' || r.status === 'confirmed')
  if (!active) return { kind: 'none' }
  if (active.status === 'pending') return { kind: 'pending', row: active }
  if (active.summary_hash === currentHash) return { kind: 'already_confirmed', row: active }
  return { kind: 'supersede', row: active }
}

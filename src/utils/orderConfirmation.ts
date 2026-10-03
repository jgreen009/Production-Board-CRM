// Staff-facing confirmation state, derived from order_confirmations rows. Kept
// pure so the mapping is testable without Supabase. Staff see four words, never
// the internal "superseded" term.

export type ConfirmationRowStatus = 'pending' | 'confirmed' | 'superseded'

export interface ConfirmationRecord {
  status: ConfirmationRowStatus
  sentAt: string | null
  confirmedAt: string | null
  customerEmail: string
  createdAt: string
}

export type ConfirmationDisplay =
  | { state: 'not_sent' }
  | { state: 'awaiting'; sentAt: string }
  | { state: 'confirmed'; confirmedAt: string; customerEmail: string }
  | { state: 'needs_reconfirmation' }

// records: every confirmation row for one order, in any order.
export function confirmationDisplayFor(records: ConfirmationRecord[]): ConfirmationDisplay {
  const newestFirst = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const active = newestFirst.find((r) => r.status === 'pending' || r.status === 'confirmed')

  if (active?.status === 'confirmed' && active.confirmedAt) {
    return { state: 'confirmed', confirmedAt: active.confirmedAt, customerEmail: active.customerEmail }
  }
  if (active?.status === 'pending' && active.sentAt) {
    return { state: 'awaiting', sentAt: active.sentAt }
  }
  if (newestFirst.some((r) => r.status === 'superseded' || r.status === 'confirmed')) {
    return { state: 'needs_reconfirmation' }
  }
  return { state: 'not_sent' }
}

export const CONFIRMATION_LABEL: Record<ConfirmationDisplay['state'], string> = {
  not_sent: 'Not Sent',
  awaiting: 'Awaiting Confirmation',
  confirmed: 'Customer Confirmed',
  needs_reconfirmation: 'Needs Reconfirmation',
}

export const CONFIRMATION_BADGE_CLASS: Record<ConfirmationDisplay['state'], string> = {
  not_sent: 'border-zinc-200 bg-zinc-50 text-zinc-500',
  awaiting: 'border-warning/20 bg-warning-soft text-warning',
  confirmed: 'border-success/20 bg-success-soft text-success',
  needs_reconfirmation: 'border-danger/20 bg-danger-soft text-danger',
}

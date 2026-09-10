import type { Order } from '@/types'
import { daysUntil } from '@/utils/date'

// Phase 4 Milestone 3 — a pure, centralized "what should staff work on
// next" ranking, the same architecture as productionReadiness.ts
// (Batch C): no new table, no scheduling engine, nothing that writes back
// to the order. This only ever informs sort order/filter presets on the
// Production Board — it never blocks staff from opening or working any
// order regardless of its rank.

export type QueueTier = 'overdue' | 'same-day' | 'urgent-or-due-today' | 'due-tomorrow' | 'upcoming'

const TIER_RANK: Record<QueueTier, number> = {
  overdue: 0,
  'same-day': 1,
  'urgent-or-due-today': 2,
  'due-tomorrow': 3,
  upcoming: 4,
}

const TIER_LABEL: Record<QueueTier, string> = {
  overdue: 'Overdue',
  'same-day': 'Same Day',
  'urgent-or-due-today': 'Urgent / Due Today',
  'due-tomorrow': 'Due Tomorrow',
  upcoming: 'Upcoming',
}

export function queueTierLabel(tier: QueueTier): string {
  return TIER_LABEL[tier]
}

// A completed order never needs prioritizing — it's done, regardless of
// how overdue it technically looks on paper (same "finished work is never
// urgent" principle as getAttentionWarnings' Completed short-circuit).
export function getProductionQueueRank(order: Order): QueueTier {
  if (order.productionStatus === 'Completed') return 'upcoming'

  const diff = daysUntil(order.dueDate)

  if (diff < 0) return 'overdue'
  if (order.turnaroundType === 'Same Day') return 'same-day'
  if (order.priority === 'Urgent' || diff === 0) return 'urgent-or-due-today'
  if (diff === 1) return 'due-tomorrow'
  return 'upcoming'
}

// Lower rank = more urgent = sorts first.
export function compareQueueRank(a: Order, b: Order): number {
  return TIER_RANK[getProductionQueueRank(a)] - TIER_RANK[getProductionQueueRank(b)]
}

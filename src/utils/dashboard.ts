import type { Order, ProductionStatus } from '@/types'
import { daysUntil, isDueToday, isOverdue } from '@/utils/date'
import { getAttentionWarnings } from '@/utils/productionReadiness'

export function activeOrders(orders: Order[]): Order[] {
  return orders.filter((o) => o.productionStatus !== 'Completed')
}

export function dueTodayOrders(orders: Order[]): Order[] {
  return orders.filter((o) => isDueToday(o.dueDate) && o.productionStatus !== 'Completed')
}

export function urgentOrders(orders: Order[]): Order[] {
  return orders.filter((o) => o.priority === 'Urgent' && o.productionStatus !== 'Completed')
}

export function awaitingArtworkOrders(orders: Order[]): Order[] {
  return orders.filter(
    (o) => !['Approved', 'Completed'].includes(o.artworkStatus) && o.productionStatus !== 'Completed',
  )
}

export function readyForProductionOrders(orders: Order[]): Order[] {
  return orders.filter((o) => o.productionStatus === 'Ready' || o.productionStatus === 'Queued')
}

export function completedThisWeekOrders(orders: Order[]): Order[] {
  return orders.filter((o) => o.productionStatus === 'Completed' && daysUntil(o.dueDate) >= -7)
}

export interface AttentionItem {
  order: Order
  issue: string
}

// Batch C: delegates to the same getAttentionWarnings(order) logic the
// Production Board uses, so Dashboard and Board can never disagree about
// what counts as "needs attention" (two independent rule sets used to
// exist here and there — this removes that duplication). Dashboard has
// room for one line per order, so it shows only the single most severe
// warning; Production Board (via getAttentionWarnings directly) can show
// all of them.
export function ordersRequiringAttention(orders: Order[]): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const order of orders) {
    const warnings = getAttentionWarnings(order)
    if (warnings.length > 0) items.push({ order, issue: warnings[0].message })
  }

  return items.sort(
    (a, b) => new Date(a.order.dueDate).getTime() - new Date(b.order.dueDate).getTime(),
  )
}

export function upcomingDeadlines(orders: Order[], limit = 6): Order[] {
  return orders
    .filter((o) => o.productionStatus !== 'Completed')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, limit)
}

// Phase 4 Batch D — Reporting. Same "finished work is never urgent"
// principle as getAttentionWarnings/getProductionQueueRank: a Completed
// order is excluded even if its dueDate is technically in the past.
export function overdueOrders(orders: Order[]): Order[] {
  return orders.filter((o) => o.productionStatus !== 'Completed' && isOverdue(o.dueDate))
}

export interface ProductionStatusCount {
  status: ProductionStatus
  count: number
}

// Includes every status present in `orders`, even with count 0 would not
// appear (only statuses actually present are returned) — the Dashboard
// renders whatever this returns rather than a fixed hardcoded list, so a
// status with zero current orders simply doesn't show a row.
export function ordersByProductionStatus(orders: Order[]): ProductionStatusCount[] {
  const counts = new Map<ProductionStatus, number>()
  for (const order of orders) {
    counts.set(order.productionStatus, (counts.get(order.productionStatus) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
}

// Only orders with a completedAt are counted — turnaround is never
// fabricated for an order that hasn't actually finished. Turnaround for
// one order is (completedAt - createdAt) in days, as a fractional value
// (e.g. 2.5 days), not floored/ceiled to whole days. The returned average
// is rounded to 1 decimal place. Returns null when there is no completed
// order to average (rather than 0, which would misleadingly read as
// "same-day turnaround").
export function averageTurnaroundDays(orders: Order[]): number | null {
  const completed = orders.filter((o) => o.completedAt)
  if (completed.length === 0) return null

  const totalDays = completed.reduce((sum, o) => {
    const days = (new Date(o.completedAt!).getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    return sum + days
  }, 0)

  return Math.round((totalDays / completed.length) * 10) / 10
}

export interface AssigneeWorkload {
  assignedTo: string | null
  assigneeName: string
  count: number
}

// "Workload" means current active work, so Completed orders are excluded
// (matching activeOrders() above) — a finished order isn't sitting on
// anyone's plate anymore. Orders with no assignedTo are grouped under a
// single "Unassigned" bucket (assignedTo: null) rather than dropped, since
// an unassigned backlog size is itself useful to see.
export function ordersByAssignee(orders: Order[]): AssigneeWorkload[] {
  const active = orders.filter((o) => o.productionStatus !== 'Completed')
  const counts = new Map<string, AssigneeWorkload>()

  for (const order of active) {
    const key = order.assignedTo ?? '__unassigned__'
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, {
        assignedTo: order.assignedTo ?? null,
        assigneeName: order.assignedTo ? (order.assignedToName ?? 'Unknown') : 'Unassigned',
        count: 1,
      })
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count)
}

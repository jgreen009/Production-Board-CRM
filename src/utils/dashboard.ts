import type { Order } from '@/types'
import { daysUntil, isDueToday } from '@/utils/date'
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

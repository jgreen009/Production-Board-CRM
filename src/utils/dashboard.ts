import type { Order } from '@/types'
import { daysUntil, isDueToday, isOverdue } from '@/utils/date'

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

export function ordersRequiringAttention(orders: Order[]): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const order of orders) {
    if (order.productionStatus === 'Completed') continue

    let issue: string | null = null
    if (isOverdue(order.dueDate)) {
      issue = 'Order is overdue'
    } else if (order.artworkStatus === 'Need Vectored') {
      issue = 'Artwork needs vectoring'
    } else if (order.artworkStatus === 'Need Artwork') {
      issue = 'Artwork required from customer'
    } else if (order.garmentStatus === 'Follow Up') {
      issue = 'Garment supplier follow-up needed'
    } else if (order.garmentStatus === 'Need Ordering') {
      issue = 'Garments need ordering'
    } else if (order.productionStatus === 'On Hold') {
      issue = 'Production on hold'
    } else if (order.artworkStatus === 'Awaiting Approval') {
      issue = 'Waiting on customer artwork approval'
    }

    if (issue) items.push({ order, issue })
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

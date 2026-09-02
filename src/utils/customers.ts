import type { Order } from '@/types'

export function ordersForCustomer(orders: Order[], customerId: string): Order[] {
  return orders.filter((o) => o.customerId === customerId)
}

export function openOrdersCount(orders: Order[]): number {
  return orders.filter((o) => o.productionStatus !== 'Completed').length
}

export function completedOrdersCount(orders: Order[]): number {
  return orders.filter((o) => o.productionStatus === 'Completed').length
}

export function lastOrderDate(orders: Order[]): string | null {
  if (orders.length === 0) return null
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0].createdAt
}

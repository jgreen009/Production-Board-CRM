import { mockOrders } from '@/data/mockOrders'
import type { Order } from '@/types'

// Mutating the shared mock array is a pragmatic, deliberately simple choice
// for this frontend-only phase: pages import the same array reference and
// re-read it on mount, so a newly created order shows up across routes
// without introducing a global store for mock data that will be replaced by
// a real backend later.
export function addOrder(order: Order): void {
  mockOrders.unshift(order)
}

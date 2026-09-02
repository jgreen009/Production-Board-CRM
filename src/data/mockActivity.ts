import type { OrderActivityEntry } from '@/types'
import { addDays, todayIso } from '@/utils/date'

const today = todayIso()

export const mockActivity: OrderActivityEntry[] = [
  { id: 'act-1', orderId: 'order-1', timestamp: addDays(today, -12), message: 'Order created', type: 'created' },
  { id: 'act-2', orderId: 'order-1', timestamp: addDays(today, -11), message: 'Artwork uploaded — kelston-jersey-front.ai', type: 'artwork' },
  { id: 'act-3', orderId: 'order-1', timestamp: addDays(today, -9), message: 'Artwork approved by customer', type: 'artwork' },
  { id: 'act-4', orderId: 'order-1', timestamp: addDays(today, -5), message: 'Garments received from supplier', type: 'garments' },
  { id: 'act-5', orderId: 'order-1', timestamp: addDays(today, -1), message: 'Production started', type: 'production' },
  { id: 'act-6', orderId: 'order-1', timestamp: addDays(today, -1), message: 'Priority changed to Urgent — order is overdue', type: 'priority' },

  { id: 'act-7', orderId: 'order-2', timestamp: addDays(today, -2), message: 'Order created — same day turnaround requested', type: 'created' },
  { id: 'act-8', orderId: 'order-2', timestamp: addDays(today, -2), message: 'Artwork supplied and approved', type: 'artwork' },
  { id: 'act-9', orderId: 'order-2', timestamp: today, message: 'Queued for production', type: 'production' },

  { id: 'act-10', orderId: 'order-3', timestamp: addDays(today, -6), message: 'Order created', type: 'created' },
  { id: 'act-11', orderId: 'order-3', timestamp: addDays(today, -6), message: 'Artwork supplied — northside-logo.svg', type: 'artwork' },
  { id: 'act-12', orderId: 'order-3', timestamp: addDays(today, -4), message: 'Garments ordered from supplier', type: 'garments' },
  { id: 'act-13', orderId: 'order-3', timestamp: addDays(today, -1), message: 'Priority changed to Urgent', type: 'priority' },

  { id: 'act-14', orderId: 'order-4', timestamp: addDays(today, -25), message: 'Order created', type: 'created' },
  { id: 'act-15', orderId: 'order-4', timestamp: addDays(today, -20), message: 'Artwork approved', type: 'artwork' },
  { id: 'act-16', orderId: 'order-4', timestamp: addDays(today, -16), message: 'Production started', type: 'production' },
  { id: 'act-17', orderId: 'order-4', timestamp: addDays(today, -14), message: 'Order completed', type: 'production' },

  { id: 'act-18', orderId: 'order-5', timestamp: addDays(today, -1), message: 'Order created', type: 'created' },
  { id: 'act-19', orderId: 'order-5', timestamp: today, message: 'Artwork status set to Need Artwork', type: 'artwork' },

  { id: 'act-20', orderId: 'order-6', timestamp: addDays(today, -4), message: 'Order created', type: 'created' },
  { id: 'act-21', orderId: 'order-6', timestamp: addDays(today, -4), message: 'Artwork supplied — low resolution', type: 'artwork' },
  { id: 'act-22', orderId: 'order-6', timestamp: addDays(today, -3), message: 'Artwork status set to Need Vectored', type: 'artwork' },
  { id: 'act-23', orderId: 'order-6', timestamp: addDays(today, -3), message: 'Production put On Hold pending artwork', type: 'production' },

  { id: 'act-24', orderId: 'order-7', timestamp: addDays(today, -8), message: 'Order created', type: 'created' },
  { id: 'act-25', orderId: 'order-7', timestamp: addDays(today, -7), message: 'Artwork approved', type: 'artwork' },
  { id: 'act-26', orderId: 'order-7', timestamp: addDays(today, -2), message: 'Garment status changed to Follow Up — size 12 out of stock', type: 'garments' },

  { id: 'act-27', orderId: 'order-8', timestamp: addDays(today, -5), message: 'Order created — rush fee applied', type: 'created' },
  { id: 'act-28', orderId: 'order-8', timestamp: addDays(today, -5), message: 'Artwork approved', type: 'artwork' },
  { id: 'act-29', orderId: 'order-8', timestamp: addDays(today, -3), message: 'Garments received', type: 'garments' },
  { id: 'act-30', orderId: 'order-8', timestamp: addDays(today, -1), message: 'Production started', type: 'production' },

  { id: 'act-31', orderId: 'order-9', timestamp: addDays(today, -9), message: 'Order created', type: 'created' },
  { id: 'act-32', orderId: 'order-9', timestamp: addDays(today, -8), message: 'Mockup approved by customer', type: 'mockup' },
  { id: 'act-33', orderId: 'order-9', timestamp: addDays(today, -3), message: 'Production started', type: 'production' },
  { id: 'act-34', orderId: 'order-9', timestamp: addDays(today, -1), message: 'Order marked Ready for Collection', type: 'production' },

  { id: 'act-35', orderId: 'order-10', timestamp: addDays(today, -7), message: 'Order created', type: 'created' },
  { id: 'act-36', orderId: 'order-10', timestamp: addDays(today, -6), message: 'Mockup uploaded for approval', type: 'mockup' },
  { id: 'act-37', orderId: 'order-10', timestamp: addDays(today, -6), message: 'Garments ordered', type: 'garments' },

  { id: 'act-38', orderId: 'order-11', timestamp: addDays(today, -6), message: 'Order created', type: 'created' },
  { id: 'act-39', orderId: 'order-11', timestamp: addDays(today, -5), message: 'Garments received', type: 'garments' },
  { id: 'act-40', orderId: 'order-11', timestamp: today, message: 'Moved to Quality Check', type: 'production' },

  { id: 'act-41', orderId: 'order-12', timestamp: addDays(today, -1), message: 'Order created — reorder of SP-1003 artwork', type: 'created' },

  { id: 'act-42', orderId: 'order-13', timestamp: addDays(today, -10), message: 'Order created — rush fee applied', type: 'created' },
  { id: 'act-43', orderId: 'order-13', timestamp: addDays(today, -9), message: 'Artwork approved', type: 'artwork' },
  { id: 'act-44', orderId: 'order-13', timestamp: addDays(today, -5), message: 'Garments received', type: 'garments' },
  { id: 'act-45', orderId: 'order-13', timestamp: addDays(today, -3), message: 'Production completed', type: 'production' },
  { id: 'act-46', orderId: 'order-13', timestamp: addDays(today, -2), message: 'Out for delivery — courier booked', type: 'production' },

  { id: 'act-47', orderId: 'order-14', timestamp: today, message: 'Order created', type: 'created' },
]

export function getActivityForOrder(orderId: string): OrderActivityEntry[] {
  return mockActivity
    .filter((a) => a.orderId === orderId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

export function getRecentActivity(limit = 8): OrderActivityEntry[] {
  return [...mockActivity]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
}

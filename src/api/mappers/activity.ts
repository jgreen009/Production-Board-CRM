import type { OrderActivityEntry } from '@/types'

export interface ActivityRow {
  id: string
  order_id: string
  activity_type: OrderActivityEntry['type']
  message: string
  created_at: string
}

export function mapActivityRowToDomain(row: ActivityRow): OrderActivityEntry {
  return {
    id: row.id,
    orderId: row.order_id,
    timestamp: row.created_at,
    message: row.message,
    type: row.activity_type,
  }
}

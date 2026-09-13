import type { Order } from '@/types'

// Internal DB values ('staff' | 'public_form') never reach the UI directly
// — only these two staff-facing labels do. Kept separate from
// OrderSourceBadge.tsx (a component file) so both stay fast-refresh-safe.
const SOURCE_LABEL: Record<Order['source'], string> = {
  staff: 'Staff Created',
  public_form: 'Customer Submitted',
}

export function getOrderSourceLabel(source: Order['source']): string {
  return SOURCE_LABEL[source]
}

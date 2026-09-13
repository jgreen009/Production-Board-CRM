import { Badge } from '@/components/ui/Badge'
import type { Order } from '@/types'
import { getOrderSourceLabel } from '@/utils/orderSource'

// Order source is provenance metadata, not a workflow status (unlike
// StatusBadge's payment/artwork/garment/production kinds) — a separate,
// tiny component rather than another StatusBadge case. Neutral styling for
// both values — source is informational, never a warning.
const SOURCE_CLASSNAME: Record<Order['source'], string> = {
  staff: 'border-zinc-200 bg-zinc-50 text-zinc-500',
  public_form: 'border-brand-accent/30 bg-brand-accent-soft text-brand-accent',
}

export function OrderSourceBadge({ source, className }: { source: Order['source']; className?: string }) {
  return <Badge className={`${SOURCE_CLASSNAME[source]} ${className ?? ''}`}>{getOrderSourceLabel(source)}</Badge>
}

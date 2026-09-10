import type { Order } from '@/types'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ActivityTimeline } from '@/components/domain/ActivityTimeline'
import { getActivityForOrder } from '@/data/mockActivity'
import { useOrderActivity } from '@/hooks/useOrders'

interface ActivityTabProps {
  order: Order
  isRealOrder: boolean
}

export function ActivityTab({ order, isRealOrder }: ActivityTabProps) {
  const { data: realActivity, isLoading } = useOrderActivity(isRealOrder ? order.id : undefined)
  const activity = isRealOrder ? (realActivity ?? []) : getActivityForOrder(order.id)

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-zinc-800">Activity</h3>
        <p className="text-xs text-zinc-400">A history of status and detail changes on this order.</p>
      </CardHeader>
      <CardBody>
        {isRealOrder && isLoading ? (
          <p className="text-sm text-zinc-400">Loading...</p>
        ) : (
          <ActivityTimeline entries={activity} />
        )}
      </CardBody>
    </Card>
  )
}

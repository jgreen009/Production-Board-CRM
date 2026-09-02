import type { Order } from '@/types'
import { Card, CardBody } from '@/components/ui/Card'
import { ActivityTimeline } from '@/components/domain/ActivityTimeline'
import { getActivityForOrder } from '@/data/mockActivity'

export function ActivityTab({ order }: { order: Order }) {
  const activity = getActivityForOrder(order.id)

  return (
    <Card>
      <CardBody>
        <ActivityTimeline entries={activity} />
      </CardBody>
    </Card>
  )
}

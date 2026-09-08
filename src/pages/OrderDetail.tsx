import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, Pencil } from 'lucide-react'
import { mockOrders } from '@/data/mockOrders'
import { useOrder } from '@/hooks/useOrders'
import { isRealOrderId } from '@/utils/id'
import { StatCard } from '@/components/domain/StatCard'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/toast-context'
import { formatDate } from '@/utils/date'
import { OverviewTab } from '@/pages/order-detail/OverviewTab'
import { OrderFormTab } from '@/pages/order-detail/OrderFormTab'
import { GarmentsTab } from '@/pages/order-detail/GarmentsTab'
import { ArtworkMockupsTab } from '@/pages/order-detail/ArtworkMockupsTab'
import { ProductionTab } from '@/pages/order-detail/ProductionTab'
import { FilesTab } from '@/pages/order-detail/FilesTab'
import { ActivityTab } from '@/pages/order-detail/ActivityTab'
import NotFound from '@/pages/NotFound'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'order-form', label: 'Order Form' },
  { key: 'garments', label: 'Garments' },
  { key: 'artwork', label: 'Artwork & Mockups' },
  { key: 'production', label: 'Production' },
  { key: 'files', label: 'Files' },
  { key: 'activity', label: 'Activity' },
]

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [tab, setTab] = useState('overview')

  // Transitional: real orders (Milestone 6+) get real UUIDs; the demo
  // orders in mockOrders.ts use plain string ids like "order-1" and still
  // work everywhere else in the app (Production Board, Orders List,
  // Customer Detail) until those get their own real-data milestones. Only
  // attempt the real fetch for something that's actually a UUID — passing
  // "order-1" to a `uuid` column errors rather than just missing.
  const isRealId = isRealOrderId(id)
  const { data: realOrder, isLoading } = useOrder(isRealId ? id : undefined)
  const mockOrder = !isRealId ? mockOrders.find((o) => o.id === id) : undefined
  const order = realOrder ?? mockOrder

  if (isRealId && isLoading) return null
  if (!order) return <NotFound />

  return (
    <div>
      <button
        onClick={() => navigate('/orders')}
        className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={14} /> Back to Orders
      </button>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-900">{order.jobName}</h1>
            <StatusBadge kind="production" value={order.productionStatus} />
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">
            {order.orderNumber} — {order.customer}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => showToast('Full edit form arrives with backend integration.', 'info')}
          >
            <Pencil size={14} /> Edit Order
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => showToast('More actions arrive with backend integration.', 'info')}
          >
            <MoreHorizontal size={16} />
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Quantity" value={order.quantity} />
        <StatCard label="Due Date" value={formatDate(order.dueDate)} />
        <StatCard label="Payment" value={order.paymentStatus} />
        <StatCard label="Priority" value={order.priority} />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-4" />

      {tab === 'overview' && <OverviewTab order={order} />}
      {tab === 'order-form' && <OrderFormTab order={order} />}
      {tab === 'garments' && <GarmentsTab order={order} />}
      {tab === 'artwork' && <ArtworkMockupsTab order={order} />}
      {tab === 'production' && <ProductionTab order={order} isRealOrder={isRealId} />}
      {tab === 'files' && <FilesTab order={order} />}
      {tab === 'activity' && <ActivityTab order={order} isRealOrder={isRealId} />}
    </div>
  )
}

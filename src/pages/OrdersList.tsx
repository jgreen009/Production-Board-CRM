import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderCard } from '@/components/domain/OrderCard'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { mockOrders } from '@/data/mockOrders'
import { formatDateShort, dueDateLabel, isOverdue, isDueToday } from '@/utils/date'
import { clsx } from 'clsx'

type OrdersTab = 'all' | 'active' | 'completed' | 'on-hold'

const TABS: { key: OrdersTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'on-hold', label: 'On Hold' },
]

export default function OrdersList() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<OrdersTab>('all')
  const [search, setSearch] = useState('')

  const orders = useMemo(() => {
    let result = mockOrders
    if (tab === 'active') result = result.filter((o) => !['Completed', 'On Hold'].includes(o.productionStatus))
    if (tab === 'completed') result = result.filter((o) => o.productionStatus === 'Completed')
    if (tab === 'on-hold') result = result.filter((o) => o.productionStatus === 'On Hold')

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.jobName.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q),
      )
    }

    return [...result].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }, [tab, search])

  return (
    <div>
      <PageHeader
        title="Orders"
        description={`${mockOrders.length} orders total`}
        actions={
          <Button variant="primary" size="sm" onClick={() => navigate('/orders/new')}>
            <Plus size={15} />
            New Order
          </Button>
        }
      />

      <div className="mb-3 flex flex-col gap-3">
        <Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as OrdersTab)} />
        <div className="relative max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No orders found" description="Try a different tab or search term." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60 text-xs text-zinc-500">
                  <th className="px-3 py-2.5 font-medium">Order #</th>
                  <th className="px-3 py-2.5 font-medium">Job</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Qty</th>
                  <th className="px-3 py-2.5 font-medium">Created</th>
                  <th className="px-3 py-2.5 font-medium">Due</th>
                  <th className="px-3 py-2.5 font-medium">Production</th>
                  <th className="px-3 py-2.5 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="cursor-pointer border-b border-zinc-50 last:border-0 hover:bg-zinc-50"
                  >
                    <td className="px-3 py-2.5 font-medium text-zinc-800">
                      <Link to={`/orders/${order.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-600">{order.jobName}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{order.customer}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{order.quantity}</td>
                    <td className="px-3 py-2.5 text-zinc-500">{formatDateShort(order.createdAt)}</td>
                    <td
                      className={clsx(
                        'px-3 py-2.5 font-medium',
                        isOverdue(order.dueDate)
                          ? 'text-red-600'
                          : isDueToday(order.dueDate)
                            ? 'text-amber-600'
                            : 'text-zinc-500',
                      )}
                    >
                      {dueDateLabel(order.dueDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge kind="production" value={order.productionStatus} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge kind="priority" value={order.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onClick={(o) => navigate(`/orders/${o.id}`)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

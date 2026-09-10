import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, ClipboardList, ArrowUpDown } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderCard } from '@/components/domain/OrderCard'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { useOrders, useDraftOrders } from '@/hooks/useOrders'
import { formatDateShort, dueDateLabel, isOverdue, isDueToday } from '@/utils/date'
import { clsx } from 'clsx'
import type { Order } from '@/types'

type OrdersTab = 'all' | 'active' | 'completed' | 'on-hold' | 'drafts'
type SortKey = 'due' | 'orderNumber' | 'customer'

const TABS: { key: OrdersTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'on-hold', label: 'On Hold' },
  { key: 'drafts', label: 'Drafts' },
]

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'due', label: 'Due Date' },
  { key: 'orderNumber', label: 'Order #' },
  { key: 'customer', label: 'Customer' },
]

function compareOrders(a: Order, b: Order, sortKey: SortKey): number {
  switch (sortKey) {
    case 'orderNumber':
      return a.orderNumber.localeCompare(b.orderNumber)
    case 'customer':
      return a.customer.localeCompare(b.customer)
    case 'due':
    default:
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  }
}

export default function OrdersList() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<OrdersTab>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('due')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { data: allOrders = [], isLoading } = useOrders()
  const { data: draftOrders = [], isLoading: draftsLoading } = useDraftOrders()

  const isDraftsTab = tab === 'drafts'
  const sourceOrders = isDraftsTab ? draftOrders : allOrders

  const orders = useMemo(() => {
    let result = sourceOrders
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

    const sorted = [...result].sort((a, b) => compareOrders(a, b, sortKey))
    return sortDir === 'desc' ? sorted.reverse() : sorted
  }, [sourceOrders, tab, search, sortKey, sortDir])

  const handleRowClick = (orderId: string) => {
    if (isDraftsTab) navigate(`/orders/new?draft=${orderId}`)
    else navigate(`/orders/${orderId}`)
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description={`${allOrders.length} orders total`}
        actions={
          <Button variant="primary" size="sm" onClick={() => navigate('/orders/new')}>
            <Plus size={15} />
            New Order
          </Button>
        }
      />

      <div className="mb-3 flex flex-col gap-3">
        <Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as OrdersTab)} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders..."
              className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Sort orders by"
              className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-600 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              aria-label={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50"
            >
              <ArrowUpDown size={14} className={clsx(sortDir === 'desc' && 'scale-y-[-1]')} />
            </button>
          </div>
        </div>
      </div>

      {(isDraftsTab ? draftsLoading : isLoading) ? (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <TableSkeleton />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={sourceOrders.length === 0 ? (isDraftsTab ? 'No drafts' : 'No orders yet') : 'No orders found'}
          description={
            sourceOrders.length === 0
              ? isDraftsTab
                ? 'Orders you start and leave unfinished will show up here to resume.'
                : 'Create your first order to see it here.'
              : 'Try a different tab or search term.'
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60 text-xs text-zinc-500">
                  <th className="px-3 py-2.5 font-medium">Order #</th>
                  <th className="px-3 py-2.5 font-medium">Job / Customer</th>
                  <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Qty</th>
                  <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Created</th>
                  <th className="px-3 py-2.5 font-medium">Due</th>
                  <th className="px-3 py-2.5 font-medium">Production</th>
                  <th className="px-3 py-2.5 font-medium">Priority</th>
                  <th className="px-3 py-2.5 font-medium">Assignee</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => handleRowClick(order.id)}
                    className="cursor-pointer border-b border-zinc-50 last:border-0 hover:bg-zinc-50"
                  >
                    <td className="px-3 py-2.5 font-medium text-zinc-800">
                      <Link
                        to={isDraftsTab ? `/orders/new?draft=${order.id}` : `/orders/${order.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="max-w-[220px] truncate font-medium text-zinc-700">{order.jobName}</p>
                      <p className="max-w-[220px] truncate text-xs text-zinc-400">{order.customer}</p>
                    </td>
                    <td className="hidden px-3 py-2.5 text-zinc-500 lg:table-cell">{order.quantity}</td>
                    <td className="hidden px-3 py-2.5 text-zinc-500 lg:table-cell">{formatDateShort(order.createdAt)}</td>
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
                    <td className="px-3 py-2.5 text-zinc-500">
                      {order.assignedTo ? order.assignedToName || 'Unnamed staff' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={(o) => handleRowClick(o.id)}
                extra={
                  <Badge className="border-zinc-200 bg-zinc-50 text-zinc-500">
                    {order.assignedTo ? order.assignedToName || 'Unnamed staff' : 'Unassigned'}
                  </Badge>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

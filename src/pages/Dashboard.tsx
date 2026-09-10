import { Link } from 'react-router-dom'
import {
  ClipboardList,
  CalendarClock,
  AlertTriangle,
  PenTool,
  PackageCheck,
  CheckCircle2,
  Clock,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { StatCard } from '@/components/domain/StatCard'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { ActivityTimeline } from '@/components/domain/ActivityTimeline'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { useOrders, useRecentActivity } from '@/hooks/useOrders'
import { formatDateShort, dueDateLabel, isOverdue, isDueToday } from '@/utils/date'
import {
  activeOrders,
  averageTurnaroundDays,
  awaitingArtworkOrders,
  completedThisWeekOrders,
  dueTodayOrders,
  ordersByAssignee,
  ordersByProductionStatus,
  ordersRequiringAttention,
  overdueOrders,
  readyForProductionOrders,
  upcomingDeadlines,
  urgentOrders,
} from '@/utils/dashboard'
import { clsx } from 'clsx'

export default function Dashboard() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const { data: orders = [], isLoading: ordersLoading } = useOrders()
  const { data: activity = [], isLoading: activityLoading } = useRecentActivity(8)

  const attention = ordersRequiringAttention(orders).slice(0, 6)
  const deadlines = upcomingDeadlines(orders, 6)
  const orderNumbers = Object.fromEntries(activity.map((a) => [a.orderId, a.orderNumber]))
  const statusBreakdown = ordersByProductionStatus(orders)
  const turnaround = averageTurnaroundDays(orders)
  const workload = ordersByAssignee(orders)

  return (
    <div>
      <PageHeader title={`${greeting}, team`} description="Production overview across all active orders" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <StatCard
          label="Active Orders"
          value={activeOrders(orders).length}
          description="Currently in the pipeline"
          icon={ClipboardList}
        />
        <StatCard
          label="Overdue"
          value={overdueOrders(orders).length}
          description="Past due, not yet complete"
          icon={Clock}
          accent="danger"
        />
        <StatCard
          label="Due Today"
          value={dueTodayOrders(orders).length}
          description="Need to ship today"
          icon={CalendarClock}
          accent="warning"
        />
        <StatCard
          label="Urgent Orders"
          value={urgentOrders(orders).length}
          description="Flagged as urgent priority"
          icon={AlertTriangle}
          accent="danger"
        />
        <StatCard
          label="Awaiting Artwork"
          value={awaitingArtworkOrders(orders).length}
          description="Not yet approved"
          icon={PenTool}
        />
        <StatCard
          label="Ready for Production"
          value={readyForProductionOrders(orders).length}
          description="Queued or ready to start"
          icon={PackageCheck}
        />
        <StatCard
          label="Completed This Week"
          value={completedThisWeekOrders(orders).length}
          description="Finished in the last 7 days"
          icon={CheckCircle2}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Orders Requiring Attention</h2>
          </CardHeader>
          <CardBody className="p-0">
            {ordersLoading ? (
              <TableSkeleton />
            ) : attention.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title={orders.length === 0 ? 'No orders yet' : 'Nothing needs attention'}
                  description={orders.length === 0 ? 'Create your first order to see it here.' : 'All active orders are on track.'}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                      <th className="px-4 py-2 font-medium">Customer</th>
                      <th className="px-4 py-2 font-medium">Issue</th>
                      <th className="px-4 py-2 font-medium">Due</th>
                      <th className="px-4 py-2 font-medium">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attention.map(({ order, issue }) => (
                      <tr
                        key={order.id}
                        className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50"
                      >
                        <td className="px-4 py-2.5">
                          <Link to={`/orders/${order.id}`} className="font-medium text-zinc-800 hover:underline">
                            {order.customer}
                          </Link>
                          <div className="text-xs text-zinc-400">{order.orderNumber} — {order.jobName}</div>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-600">{issue}</td>
                        <td
                          className={clsx(
                            'px-4 py-2.5 font-medium',
                            isOverdue(order.dueDate)
                              ? 'text-red-600'
                              : isDueToday(order.dueDate)
                                ? 'text-amber-600'
                                : 'text-zinc-600',
                          )}
                        >
                          {dueDateLabel(order.dueDate)}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge kind="priority" value={order.priority} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-800">Upcoming Deadlines</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {ordersLoading ? (
              <p className="text-sm text-zinc-400">Loading...</p>
            ) : deadlines.length === 0 ? (
              <p className="text-sm text-zinc-400">No upcoming deadlines.</p>
            ) : (
              deadlines.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-800">{order.jobName}</p>
                  <p className="truncate text-xs text-zinc-400">{order.orderNumber} — {order.customer}</p>
                </div>
                <span
                  className={clsx(
                    'shrink-0 text-xs font-semibold',
                    isOverdue(order.dueDate)
                      ? 'text-red-600'
                      : isDueToday(order.dueDate)
                        ? 'text-amber-600'
                        : 'text-zinc-500',
                  )}
                >
                  {formatDateShort(order.dueDate)}
                </span>
              </Link>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-800">Production Status Breakdown</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            {statusBreakdown.length === 0 ? (
              <p className="text-sm text-zinc-400">No orders yet.</p>
            ) : (
              statusBreakdown.map(({ status, count }) => (
                <div key={status} className="flex items-center justify-between gap-2">
                  <StatusBadge kind="production" value={status} />
                  <span className="text-sm font-medium text-zinc-700">{count}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-800">Average Turnaround</h2>
          </CardHeader>
          <CardBody className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2 text-2xl font-semibold text-zinc-800">
              <Clock size={20} className="text-zinc-400" />
              {turnaround === null ? '—' : `${turnaround}d`}
            </div>
            <p className="text-xs text-zinc-400">
              {turnaround === null
                ? 'No completed orders yet.'
                : 'Days from order creation to completion, averaged across completed orders.'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-800">Staff Workload</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            {workload.length === 0 ? (
              <p className="text-sm text-zinc-400">No active orders.</p>
            ) : (
              workload.map((w) => (
                <div key={w.assignedTo ?? 'unassigned'} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm text-zinc-600">
                    <Users size={14} className="text-zinc-400" />
                    {w.assigneeName}
                  </span>
                  <span className="text-sm font-medium text-zinc-700">{w.count}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-800">Recent Activity</h2>
          </CardHeader>
          <CardBody>
            {activityLoading ? (
              <p className="text-sm text-zinc-400">Loading...</p>
            ) : (
              <ActivityTimeline entries={activity} showOrderNumber={orderNumbers} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

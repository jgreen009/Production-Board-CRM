import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Mail, Phone, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { StatCard } from '@/components/domain/StatCard'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { mockCustomers } from '@/data/mockCustomers'
import { mockOrders } from '@/data/mockOrders'
import { ordersForCustomer, openOrdersCount, completedOrdersCount } from '@/utils/customers'
import { formatDateShort } from '@/utils/date'
import NotFound from '@/pages/NotFound'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const customer = mockCustomers.find((c) => c.id === id)
  const [notes, setNotes] = useState(customer?.notes ?? '')

  if (!customer) return <NotFound />

  const orders = ordersForCustomer(mockOrders, customer.id)
  const recentOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <div>
      <button
        onClick={() => navigate('/customers')}
        className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={14} /> Back to Customers
      </button>

      <PageHeader
        title={customer.name}
        description={customer.company || 'Individual customer'}
      />

      <div className="mb-4 flex flex-col gap-1 text-sm text-zinc-600">
        <span className="flex items-center gap-1.5"><Mail size={14} className="text-zinc-400" /> {customer.email}</span>
        <span className="flex items-center gap-1.5"><Phone size={14} className="text-zinc-400" /> {customer.phone}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Active" value={openOrdersCount(orders)} />
        <StatCard label="Completed" value={completedOrdersCount(orders)} />
        <StatCard label="Total Orders" value={orders.length} />
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-800">Recent Orders</h2>
          </CardHeader>
          <CardBody className="p-0">
            {recentOrders.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No orders yet" description="This customer has no orders on file." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                      <th className="px-4 py-2 font-medium">Order #</th>
                      <th className="px-4 py-2 font-medium">Job</th>
                      <th className="px-4 py-2 font-medium">Created</th>
                      <th className="px-4 py-2 font-medium">Due</th>
                      <th className="px-4 py-2 font-medium">Production</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="cursor-pointer border-b border-zinc-50 last:border-0 hover:bg-zinc-50"
                      >
                        <td className="px-4 py-2.5 font-medium text-zinc-800">{order.orderNumber}</td>
                        <td className="px-4 py-2.5 text-zinc-600">{order.jobName}</td>
                        <td className="px-4 py-2.5 text-zinc-500">{formatDateShort(order.createdAt)}</td>
                        <td className="px-4 py-2.5 text-zinc-500">{formatDateShort(order.dueDate)}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge kind="production" value={order.productionStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-800">Notes</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note about this customer..."
            />
            <div>
              <Button variant="secondary" size="sm">Save Note</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

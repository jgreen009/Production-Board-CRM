import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Mail, Phone, ArrowLeft, RefreshCw, ChevronRight } from 'lucide-react'
import type { Customer } from '@/types'
import { PageHeader } from '@/components/domain/PageHeader'
import { StatCard } from '@/components/domain/StatCard'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCustomer, useUpdateCustomerNotes } from '@/hooks/useCustomers'
import { useOrders } from '@/hooks/useOrders'
import { ordersForCustomer, openOrdersCount, completedOrdersCount } from '@/utils/customers'
import { formatDateShort } from '@/utils/date'
import { garmentTotal } from '@/utils/quantity'
import { useToast } from '@/components/ui/toast-context'
import NotFound from '@/pages/NotFound'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer(id)
  const { data: allOrders = [] } = useOrders()

  if (isLoading) return null
  if (!customer) return <NotFound />

  const orders = ordersForCustomer(allOrders, customer.id)
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
              <>
                {/* Desktop/tablet: dense table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                        <th className="px-4 py-2 font-medium">Order #</th>
                        <th className="px-4 py-2 font-medium">Job</th>
                        <th className="px-4 py-2 font-medium">Created</th>
                        <th className="px-4 py-2 font-medium">Due</th>
                        <th className="px-4 py-2 font-medium">Qty</th>
                        <th className="px-4 py-2 font-medium">Garments</th>
                        <th className="px-4 py-2 font-medium">Artwork</th>
                        <th className="px-4 py-2 font-medium">Production</th>
                        <th className="px-4 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => {
                        const garmentSummary = order.garments.map((g) => `${g.type} × ${garmentTotal(g)}`).join(', ')
                        const artworkSummary =
                          order.artwork.length === 0
                            ? '—'
                            : order.artwork.length === 1
                              ? order.artwork[0].fileName
                              : `${order.artwork.length} artwork files`
                        return (
                          <tr
                            key={order.id}
                            onClick={() => navigate(`/orders/${order.id}`)}
                            className="cursor-pointer border-b border-zinc-50 last:border-0 hover:bg-zinc-50"
                          >
                            <td className="px-4 py-2.5 font-medium text-zinc-800">{order.orderNumber}</td>
                            <td className="px-4 py-2.5 text-zinc-600">{order.jobName}</td>
                            <td className="px-4 py-2.5 text-zinc-500">{formatDateShort(order.createdAt)}</td>
                            <td className="px-4 py-2.5 text-zinc-500">{formatDateShort(order.dueDate)}</td>
                            <td className="px-4 py-2.5 text-zinc-500">{order.quantity}</td>
                            <td className="px-4 py-2.5 max-w-[200px] truncate text-zinc-500" title={garmentSummary}>
                              {garmentSummary || '—'}
                            </td>
                            <td className="px-4 py-2.5 max-w-[160px] truncate text-zinc-500" title={artworkSummary}>
                              {artworkSummary}
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge kind="production" value={order.productionStatus} />
                            </td>
                            <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => navigate(`/orders/new?reorderFrom=${order.id}`)}
                              >
                                <RefreshCw size={12} /> Reorder
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: cards — this row used to have 9 columns, which
                    would either force horizontal scroll or become
                    illegible at 390px. Job/order-number lead, due date and
                    production status are the next most important signal,
                    Reorder stays a one-tap action. */}
                <div className="flex flex-col gap-2 p-3 md:hidden">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="cursor-pointer rounded-lg border border-zinc-200 bg-white p-3 active:bg-zinc-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900">{order.jobName}</p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            {order.orderNumber} · Due {formatDateShort(order.dueDate)}
                          </p>
                        </div>
                        <ChevronRight size={16} className="mt-0.5 shrink-0 text-zinc-300" />
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <StatusBadge kind="production" value={order.productionStatus} />
                        <span className="text-xs text-zinc-400">Qty {order.quantity}</span>
                      </div>

                      <div className="mt-3 border-t border-zinc-100 pt-2.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full justify-center"
                          onClick={() => navigate(`/orders/new?reorderFrom=${order.id}`)}
                        >
                          <RefreshCw size={12} /> Reorder
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <CustomerNotesCard key={customer.id} customer={customer} />
    </div>
  )
}

// Keyed by customer.id in the parent so this remounts (and re-initializes
// its draft state directly from `customer.notes`) whenever the viewed
// customer changes — no effect needed to keep a draft in sync with data
// that only ever changes via navigation, not while this card is mounted.
function CustomerNotesCard({ customer }: { customer: Customer }) {
  const { showToast } = useToast()
  const updateNotes = useUpdateCustomerNotes()
  const [notes, setNotes] = useState(customer.notes ?? '')

  const handleSaveNote = async () => {
    await updateNotes.mutateAsync({ id: customer.id, notes })
    showToast('Note saved', 'success')
  }

  return (
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
            <Button
              variant="secondary"
              size="sm"
              disabled={updateNotes.isPending || notes === (customer.notes ?? '')}
              onClick={handleSaveNote}
            >
              {updateNotes.isPending ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

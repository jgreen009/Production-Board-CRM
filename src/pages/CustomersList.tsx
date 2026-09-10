import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, Mail, Phone, Search, UserPlus, Users } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { AddCustomerDialog } from '@/components/domain/AddCustomerDialog'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { useCustomers } from '@/hooks/useCustomers'
import { useOrders } from '@/hooks/useOrders'
import { formatDateShort } from '@/utils/date'
import { lastOrderDate, ordersForCustomer, openOrdersCount } from '@/utils/customers'
import { useToast } from '@/components/ui/toast-context'

export default function CustomersList() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const { data: customers = [], isLoading } = useCustomers()
  const { data: allOrders = [] } = useOrders()

  const rows = useMemo(() => {
    return customers
      .map((customer) => {
        const orders = ordersForCustomer(allOrders, customer.id)
        return {
          customer,
          openOrders: openOrdersCount(orders),
          totalOrders: orders.length,
          lastOrder: lastOrderDate(orders),
        }
      })
      .filter(({ customer }) => {
        if (!search.trim()) return true
        const q = search.trim().toLowerCase()
        return (
          customer.name.toLowerCase().includes(q) ||
          customer.company.toLowerCase().includes(q) ||
          customer.email.toLowerCase().includes(q)
        )
      })
  }, [customers, allOrders, search])

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${customers.length} customers`}
        actions={
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus size={15} />
            Add Customer
          </Button>
        }
      />

      <div className="relative mb-3 max-w-xs">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-8 pr-3 text-sm placeholder:text-zinc-400 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
        />
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <TableSkeleton />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description={customers.length === 0 ? 'Add your first customer to get started.' : 'Try a different search term.'}
        />
      ) : (
        <>
          {/* Desktop/tablet: dense table */}
          <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60 text-xs text-zinc-500">
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Company</th>
                  <th className="px-3 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Phone</th>
                  <th className="px-3 py-2.5 font-medium">Open Orders</th>
                  <th className="px-3 py-2.5 font-medium">Total Orders</th>
                  <th className="px-3 py-2.5 font-medium">Last Order</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ customer, openOrders, totalOrders, lastOrder }) => (
                  <tr
                    key={customer.id}
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="cursor-pointer border-b border-zinc-50 last:border-0 hover:bg-zinc-50"
                  >
                    <td className="px-3 py-2.5 font-medium text-zinc-800">{customer.name}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{customer.company || '—'}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{customer.email}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{customer.phone}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{openOrders}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{totalOrders}</td>
                    <td className="px-3 py-2.5 text-zinc-500">
                      {lastOrder ? formatDateShort(lastOrder) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards — a 7-column table would either force horizontal
              scroll or squeeze illegibly, so this surfaces the same data
              reorganized around what matters most at a glance: name/company
              first, open-orders count as the headline number. */}
          <div className="flex flex-col gap-2 md:hidden">
            {rows.map(({ customer, openOrders, totalOrders, lastOrder }) => (
              <Card
                key={customer.id}
                onClick={() => navigate(`/customers/${customer.id}`)}
                className="cursor-pointer p-3.5 active:bg-zinc-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{customer.name}</p>
                    {customer.company && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
                        <Building2 size={11} className="shrink-0 text-zinc-400" />
                        {customer.company}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="mt-0.5 shrink-0 text-zinc-300" />
                </div>

                <div className="mt-2.5 flex flex-col gap-1 text-xs text-zinc-500">
                  {customer.email && (
                    <span className="flex items-center gap-1.5 truncate">
                      <Mail size={11} className="shrink-0 text-zinc-400" />
                      {customer.email}
                    </span>
                  )}
                  {customer.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone size={11} className="shrink-0 text-zinc-400" />
                      {customer.phone}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5 text-xs">
                  <span className="text-zinc-500">
                    <span className="font-semibold text-zinc-800">{openOrders}</span> open ·{' '}
                    <span className="font-semibold text-zinc-800">{totalOrders}</span> total
                  </span>
                  <span className="text-zinc-400">
                    {lastOrder ? `Last order ${formatDateShort(lastOrder)}` : 'No orders yet'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <AddCustomerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(customer) => showToast(`${customer.name} added`, 'success')}
      />
    </div>
  )
}

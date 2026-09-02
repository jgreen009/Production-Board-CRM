import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, Users } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { mockCustomers } from '@/data/mockCustomers'
import { mockOrders } from '@/data/mockOrders'
import { formatDateShort } from '@/utils/date'
import { lastOrderDate, ordersForCustomer, openOrdersCount } from '@/utils/customers'
import { useToast } from '@/components/ui/toast-context'

export default function CustomersList() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    return mockCustomers
      .map((customer) => {
        const orders = ordersForCustomer(mockOrders, customer.id)
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
  }, [search])

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${mockCustomers.length} customers`}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => showToast('Adding customers directly will be available once the backend is connected.', 'info')}
          >
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
          className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No customers found" description="Try a different search term." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
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
      )}
    </div>
  )
}

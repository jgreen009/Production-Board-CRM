import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { clsx } from 'clsx'
import { useGlobalSearch } from '@/hooks/useGlobalSearch'

interface GlobalSearchProps {
  className?: string
}

export function GlobalSearch({ className }: GlobalSearchProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useGlobalSearch(query)
  const orders = data?.orders ?? []
  const customers = data?.customers ?? []
  const hasResults = orders.length > 0 || customers.length > 0

  const goTo = (path: string) => {
    navigate(path)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={clsx('relative', className)}>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search orders, customers..."
          className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
        />
      </div>

      {open && query.trim() && (
        <div className="absolute z-30 mt-1 w-full max-w-sm rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-zinc-400">Searching...</p>
          ) : !hasResults ? (
            <p className="px-3 py-2 text-sm text-zinc-400">No matches for &quot;{query.trim()}&quot;</p>
          ) : (
            <>
              {orders.length > 0 && (
                <div className="py-1">
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Orders</p>
                  {orders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => goTo(`/orders/${order.id}`)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-zinc-800">{order.orderNumber}</span>
                        <span className="ml-1.5 text-xs text-zinc-400">{order.jobName}</span>
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400">{order.customer}</span>
                    </button>
                  ))}
                </div>
              )}
              {customers.length > 0 && (
                <div className="border-t border-zinc-100 py-1">
                  <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Customers</p>
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => goTo(`/customers/${customer.id}`)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                    >
                      <span className="font-medium text-zinc-800">{customer.name}</span>
                      {customer.company && <span className="text-xs text-zinc-400">{customer.company}</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {open && <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />}
    </div>
  )
}

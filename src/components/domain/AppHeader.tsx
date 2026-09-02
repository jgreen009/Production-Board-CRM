import { useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface AppHeaderProps {
  onOpenMobileNav: () => void
}

export function AppHeader({ onOpenMobileNav }: AppHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
      <button
        className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex flex-1 items-center gap-2">
        <div className="relative hidden max-w-sm flex-1 sm:block">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="search"
            placeholder="Search orders, customers..."
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
          />
        </div>
      </div>

      <button
        className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 sm:hidden"
        aria-label="Search"
      >
        <Search size={18} />
      </button>

      <button
        className="relative rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
        aria-label="Notifications"
      >
        <Bell size={18} />
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
      </button>

      <Button
        variant="primary"
        size="sm"
        className="hidden sm:inline-flex"
        onClick={() => navigate('/orders/new')}
      >
        <Plus size={15} />
        New Order
      </Button>

      <span className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
        SP
      </span>
    </header>
  )
}

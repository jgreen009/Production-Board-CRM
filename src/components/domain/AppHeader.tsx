import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GlobalSearch } from '@/components/domain/GlobalSearch'

interface AppHeaderProps {
  onOpenMobileNav: () => void
}

export function AppHeader({ onOpenMobileNav }: AppHeaderProps) {
  const navigate = useNavigate()
  // The icon-only mobile search button previously had no handler at all —
  // GlobalSearch was simply hidden below `sm` with no replacement. This
  // reveals the same GlobalSearch component full-width instead of hiding
  // search entirely on mobile — no new search functionality, just making
  // an already-broken affordance actually do something.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <button
          className="rounded-md p-2.5 text-zinc-500 hover:bg-zinc-100 lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex flex-1 items-center gap-2">
          <GlobalSearch className="hidden max-w-sm flex-1 sm:block" />
        </div>

        <button
          className="rounded-md p-2.5 text-zinc-500 hover:bg-zinc-100 sm:hidden"
          onClick={() => setMobileSearchOpen((o) => !o)}
          aria-label={mobileSearchOpen ? 'Close search' : 'Search'}
          aria-expanded={mobileSearchOpen}
        >
          {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
        </button>

        <button
          className="relative rounded-md p-2.5 text-zinc-500 hover:bg-zinc-100"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger" />
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

        <span className="ml-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 sm:flex">
          BF
        </span>
      </div>

      {mobileSearchOpen && (
        <div className="border-t border-zinc-100 px-3 py-2.5 sm:hidden">
          <GlobalSearch className="w-full" />
        </div>
      )}
    </header>
  )
}

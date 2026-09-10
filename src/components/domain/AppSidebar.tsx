import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  KanbanSquare,
  ClipboardList,
  Users,
  PlusCircle,
  Settings,
  HelpCircle,
  LogOut,
  Printer,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { signOut } from '@/api/auth'
import { useProfile } from '@/hooks/useProfile'

function initials(name: string | null | undefined, fallback: string) {
  if (!name) return fallback
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || fallback
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/production', label: 'Production Board', icon: KanbanSquare },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/orders/new', label: 'New Order', icon: PlusCircle },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface AppSidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function AppSidebar({ mobileOpen, onCloseMobile }: AppSidebarProps) {
  const { data: profile } = useProfile()

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-zinc-900/30 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-zinc-200 bg-white transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-accent text-white">
              <Printer size={16} />
            </span>
            <span className="text-sm font-semibold tracking-wide text-zinc-900">
              BRAND FANATIX
            </span>
          </div>
          <button
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2">
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/orders'}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-accent-soft text-brand-accent'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                    )
                  }
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-zinc-100 px-2 py-2">
          <button className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
            <HelpCircle size={16} />
            Help
          </button>
          <div className="mt-1 flex items-center gap-2.5 rounded-md px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
              {initials(profile?.fullName, 'BF')}
            </span>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-zinc-800">
                {profile?.fullName || 'Staff Account'}
              </span>
              {/* Was falling back to the business name here instead of a
                  role label — a pre-existing copy/paste bug, fixed as part
                  of this pass since it's purely a display-text issue. */}
              <span className="text-xs capitalize text-zinc-400">{profile?.role ?? 'Staff'}</span>
            </div>
            <button
              onClick={() => signOut()}
              className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

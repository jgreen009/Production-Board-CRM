import { useNavigate } from 'react-router-dom'
import { Shirt, Wrench, Tags, Layers, Building2, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { useProfile } from '@/hooks/useProfile'

interface SettingsCard {
  title: string
  description: string
  icon: LucideIcon
  path: string
  adminOnly?: boolean
}

const CARDS: SettingsCard[] = [
  { title: 'Garments', description: 'Manage the garment catalog and available sizes.', icon: Shirt, path: '/settings/garments' },
  { title: 'Services', description: 'Enable or disable the services offered to customers.', icon: Wrench, path: '/settings/services' },
  { title: 'Statuses', description: 'Review the payment, artwork, garment, and production status sets.', icon: Tags, path: '/settings/statuses' },
  { title: 'Mockup Templates', description: 'Manage garment mockup templates used in the order form.', icon: Layers, path: '/settings/mockups' },
  { title: 'Business Settings', description: 'Business details, terms, and turnaround defaults.', icon: Building2, path: '/settings/business' },
  { title: 'User Management', description: 'Staff accounts, roles, and access.', icon: Users, path: '/settings/users', adminOnly: true },
]

export default function SettingsIndex() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
  const visibleCards = CARDS.filter((card) => !card.adminOnly || isAdmin)

  return (
    <div>
      <PageHeader title="Settings" description="Configure Brand Fanatix catalogs and defaults" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((card) => (
          <Card
            key={card.title}
            className="cursor-pointer p-4 hover:border-zinc-300"
            onClick={() => navigate(card.path)}
          >
            <CardBody className="p-0">
              <card.icon size={20} className="mb-2 text-zinc-400" />
              <p className="text-sm font-semibold text-zinc-800">{card.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{card.description}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}

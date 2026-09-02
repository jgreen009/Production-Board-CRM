import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  PAYMENT_STATUSES,
  ARTWORK_STATUSES,
  GARMENT_STATUSES,
  PRODUCTION_STATUSES,
  PRIORITIES,
} from '@/data/mockStatuses'
import type { StatusConfig } from '@/data/mockStatuses'

const GROUPS: { title: string; description: string; statuses: StatusConfig<string>[] }[] = [
  { title: 'Payment', description: 'Tracks whether an order has been paid.', statuses: PAYMENT_STATUSES },
  { title: 'Artwork', description: 'Tracks artwork progress, separate from production.', statuses: ARTWORK_STATUSES },
  { title: 'Garments', description: 'Tracks garment sourcing, separate from production.', statuses: GARMENT_STATUSES },
  { title: 'Production', description: 'The operational status shown on the Production Board.', statuses: PRODUCTION_STATUSES },
  { title: 'Priority', description: 'Internal staff priority, not shown on the paper form.', statuses: PRIORITIES },
]

export default function SettingsStatuses() {
  const navigate = useNavigate()

  return (
    <div>
      <button onClick={() => navigate('/settings')} className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft size={14} /> Back to Settings
      </button>
      <PageHeader title="Statuses" description="Status sets used across orders and the production board" />

      <div className="flex flex-col gap-4">
        {GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <h3 className="text-sm font-semibold text-zinc-800">{group.title}</h3>
              <p className="text-xs text-zinc-400">{group.description}</p>
            </CardHeader>
            <CardBody className="flex flex-wrap gap-2">
              {group.statuses.map((s) => (
                <Badge key={s.value} className={s.className}>{s.label}</Badge>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}

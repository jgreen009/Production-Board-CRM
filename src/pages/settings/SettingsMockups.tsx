import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Toggle } from '@/components/ui/Field'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { GarmentMockup } from '@/components/domain/GarmentMockup'
import { useToast } from '@/components/ui/toast-context'
import { useMockupTemplates } from '@/hooks/useSettings'
import type { GarmentType } from '@/types'

export default function SettingsMockups() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { data: templates = [], isLoading, updateActive } = useMockupTemplates()

  const toggleActive = (id: string, active: boolean) => {
    updateActive.mutate({ id, active: !active }, {
      onError: (err) => showToast(err instanceof Error ? err.message : 'Failed to update', 'info'),
    })
  }

  return (
    <div>
      <button onClick={() => navigate('/settings')} className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft size={14} /> Back to Settings
      </button>
      <PageHeader title="Mockup Templates" description="Garment reference photos used in the mockup workspace" />

      {isLoading ? (
        <Card>
          <TableSkeleton />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-3">
              <div className="flex justify-center rounded-md bg-zinc-50 p-2">
                <GarmentMockup
                  garmentType={t.garmentTypeName as GarmentType}
                  colour="Zinc"
                  view={t.view}
                  position={t.view === 'Front' ? 'Full Front' : 'Full Back'}
                  offset={{ x: 0, y: 0 }}
                  onOffsetChange={() => {}}
                  widthMm={0}
                  heightMm={0}
                  size={110}
                />
              </div>
              <CardBody className="flex flex-col items-center gap-1.5 p-0 pt-2 text-center">
                <p className="text-sm font-medium text-zinc-800">{t.name}</p>
                {!t.hasImage && (
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700">Using local reference photo</Badge>
                )}
                <Toggle label="Active" checked={t.active} onChange={() => toggleActive(t.id, t.active)} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

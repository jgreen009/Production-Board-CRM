import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { GarmentMockup } from '@/components/domain/GarmentMockup'
import { useToast } from '@/components/ui/toast-context'
import type { GarmentType } from '@/types'

const TEMPLATES: { garmentType: GarmentType; view: 'Front' | 'Back' }[] = [
  { garmentType: 'T-shirt', view: 'Front' },
  { garmentType: 'T-shirt', view: 'Back' },
  { garmentType: 'Hoody', view: 'Front' },
  { garmentType: 'Hoody', view: 'Back' },
  { garmentType: 'Polo', view: 'Front' },
  { garmentType: 'Polo', view: 'Back' },
]

export default function SettingsMockups() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  return (
    <div>
      <button onClick={() => navigate('/settings')} className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft size={14} /> Back to Settings
      </button>
      <PageHeader title="Mockup Templates" description="Garment silhouettes used in the mockup workspace" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TEMPLATES.map((t) => (
          <Card key={`${t.garmentType}-${t.view}`} className="p-3">
            <div className="flex justify-center rounded-md bg-zinc-50 p-2">
              <GarmentMockup
                garmentType={t.garmentType}
                colour="Zinc"
                view={t.view}
                position="Front Centre"
                offset={{ x: 0, y: 0 }}
                onOffsetChange={() => {}}
                widthMm={0}
                heightMm={0}
                size={110}
              />
            </div>
            <CardBody className="p-0 pt-2 text-center">
              <p className="text-sm font-medium text-zinc-800">{t.garmentType} — {t.view}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 w-full"
                onClick={() => showToast('Template editing arrives with backend integration.', 'info')}
              >
                Edit
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}

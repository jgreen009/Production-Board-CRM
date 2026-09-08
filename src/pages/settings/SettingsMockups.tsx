import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { GarmentMockup } from '@/components/domain/GarmentMockup'
import { useToast } from '@/components/ui/toast-context'
import { GARMENT_TYPES } from '@/data/mockGarments'
import { GARMENT_IMAGES } from '@/data/garmentImages'
import type { GarmentType } from '@/types'

const TEMPLATES: { garmentType: GarmentType; view: 'Front' | 'Back'; hasPhoto: boolean }[] = GARMENT_TYPES.filter(
  (t) => t !== 'Customized',
).flatMap((garmentType) => {
  const hasPhoto = garmentType in GARMENT_IMAGES
  return [
    { garmentType, view: 'Front' as const, hasPhoto },
    { garmentType, view: 'Back' as const, hasPhoto },
  ]
})

export default function SettingsMockups() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  return (
    <div>
      <button onClick={() => navigate('/settings')} className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft size={14} /> Back to Settings
      </button>
      <PageHeader title="Mockup Templates" description="Garment reference photos used in the mockup workspace" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TEMPLATES.map((t) => (
          <Card key={`${t.garmentType}-${t.view}`} className="p-3">
            <div className="flex justify-center rounded-md bg-zinc-50 p-2">
              <GarmentMockup
                garmentType={t.garmentType}
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
            <CardBody className="p-0 pt-2 text-center">
              <p className="text-sm font-medium text-zinc-800">{t.garmentType} — {t.view}</p>
              {!t.hasPhoto && (
                <Badge className="mt-1 border-amber-200 bg-amber-50 text-amber-700">No reference photo</Badge>
              )}
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

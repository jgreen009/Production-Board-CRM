import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Toggle } from '@/components/ui/Field'
import { SERVICE_CATALOG } from '@/data/mockServices'

export default function SettingsServices() {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState(SERVICE_CATALOG)

  const toggleActive = (name: string) => {
    setCatalog((prev) => prev.map((s) => (s.name === name ? { ...s, active: !s.active } : s)))
  }

  return (
    <div>
      <button onClick={() => navigate('/settings')} className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft size={14} /> Back to Settings
      </button>
      <PageHeader title="Services" description="Services offered on the order form" />

      <Card>
        <CardBody className="flex flex-col gap-2">
          {catalog.map((service) => (
            <Toggle
              key={service.name}
              label={service.name}
              description={service.description}
              checked={service.active}
              onChange={() => toggleActive(service.name)}
            />
          ))}
        </CardBody>
      </Card>
    </div>
  )
}

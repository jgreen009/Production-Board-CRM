import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Toggle } from '@/components/ui/Field'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { useToast } from '@/components/ui/toast-context'
import { useServicesSettings } from '@/hooks/useSettings'
import { staffErrorMessage } from '@/utils/errorMessage'

export default function SettingsServices() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { data: catalog = [], isLoading, create, update } = useServicesSettings()
  const [newName, setNewName] = useState('')

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    create.mutate(name, {
      onSuccess: () => setNewName(''),
      onError: (err) => showToast(staffErrorMessage(err, 'Failed to add service'), 'info'),
    })
  }

  const toggleActive = (id: string, active: boolean) => {
    update.mutate({ id, patch: { active: !active } }, {
      onError: (err) => showToast(staffErrorMessage(err, 'Failed to update'), 'info'),
    })
  }

  return (
    <div>
      <button onClick={() => navigate('/settings')} className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft size={14} /> Back to Settings
      </button>
      <PageHeader
        title="Services"
        description="Services offered on the order form"
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="New service"
              className="h-9 w-44"
            />
            <Button variant="primary" size="sm" disabled={!newName.trim() || create.isPending} onClick={handleAdd}>
              <Plus size={14} /> Add
            </Button>
          </div>
        }
      />

      <Card>
        <CardBody className="flex flex-col gap-2">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            catalog.map((service) => (
              <Toggle
                key={service.id}
                label={service.name}
                checked={service.active}
                onChange={() => toggleActive(service.id, service.active)}
              />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  )
}

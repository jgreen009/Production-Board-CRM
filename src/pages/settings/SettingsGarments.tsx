import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { useToast } from '@/components/ui/toast-context'
import { useGarmentTypesSettings } from '@/hooks/useSettings'
import { staffErrorMessage } from '@/utils/errorMessage'

export default function SettingsGarments() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { data: catalog = [], isLoading, create, update } = useGarmentTypesSettings()
  const [newName, setNewName] = useState('')

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    create.mutate(name, {
      onSuccess: () => setNewName(''),
      onError: (err) => showToast(staffErrorMessage(err, 'Failed to add garment type'), 'info'),
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
        title="Garments"
        description="Garment type catalog used throughout the order form"
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="New garment type"
              className="h-9 w-44"
            />
            <Button variant="primary" size="sm" disabled={!newName.trim() || create.isPending} onClick={handleAdd}>
              <Plus size={14} /> Add
            </Button>
          </div>
        }
      />

      <Card>
        <CardBody className="overflow-x-auto p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                  <th className="px-4 py-2 font-medium">Garment Type</th>
                  <th className="px-4 py-2 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {catalog.map((g) => (
                  <tr key={g.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-zinc-800">{g.name}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => toggleActive(g.id, g.active)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${g.active ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${g.active ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

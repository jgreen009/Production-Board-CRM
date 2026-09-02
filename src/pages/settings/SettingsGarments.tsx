import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/toast-context'
import { GARMENT_CATALOG } from '@/data/mockGarments'

export default function SettingsGarments() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [catalog, setCatalog] = useState(GARMENT_CATALOG)

  const toggleActive = (type: string) => {
    setCatalog((prev) => prev.map((g) => (g.type === type ? { ...g, active: !g.active } : g)))
  }

  return (
    <div>
      <button onClick={() => navigate('/settings')} className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft size={14} /> Back to Settings
      </button>
      <PageHeader
        title="Garments"
        description="Garment catalog used throughout the order form"
        actions={
          <Button variant="primary" size="sm" onClick={() => showToast('Adding garments arrives with backend integration.', 'info')}>
            <Plus size={14} /> Add Garment
          </Button>
        }
      />

      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                <th className="px-4 py-2 font-medium">Garment</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Available Sizes</th>
                <th className="px-4 py-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((g) => (
                <tr key={g.type} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-zinc-800">{g.type}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{g.category}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{g.availableSizes.join(', ')}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleActive(g.type)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${g.active ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${g.active ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Shirt } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/toast-context'
import { useGarmentTypesSettings } from '@/hooks/useSettings'
import type { GarmentTypeItem } from '@/api/settings'
import { staffErrorMessage } from '@/utils/errorMessage'

// Mockup System V2 Batch C — optional supplier metadata, editable inline
// per garment type. Deliberately no separate "Save" step for these three
// fields: each commits on blur (only if the value actually changed),
// matching the existing active-toggle's "every interaction is already a
// save" feel rather than adding a new pending/dirty-state UI just for
// this. Supplier data is an enhancement, never required — an empty or
// unset value is always a valid, savable state.
function useSupplierFieldCommit(
  garment: GarmentTypeItem,
  update: ReturnType<typeof useGarmentTypesSettings>['update'],
  showToast: ReturnType<typeof useToast>['showToast'],
) {
  return (field: 'supplierName' | 'supplierProductCode' | 'supplierUrl', value: string) => {
    if (value === garment[field]) return
    update.mutate(
      { id: garment.id, patch: { [field]: value } },
      { onError: (err) => showToast(staffErrorMessage(err, 'Failed to update supplier info'), 'info') },
    )
  }
}

function SupplierFields({
  garment,
  update,
  showToast,
}: {
  garment: GarmentTypeItem
  update: ReturnType<typeof useGarmentTypesSettings>['update']
  showToast: ReturnType<typeof useToast>['showToast']
}) {
  const commit = useSupplierFieldCommit(garment, update, showToast)
  const [urlDraft, setUrlDraft] = useState(garment.supplierUrl)
  const urlInvalid = urlDraft.trim() !== '' && urlDraft !== garment.supplierUrl && !isLikelyUrl(urlDraft)

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Input
        defaultValue={garment.supplierName}
        onBlur={(e) => commit('supplierName', e.target.value)}
        placeholder="Supplier (e.g. AS Colour)"
        className="h-9 text-xs"
      />
      <Input
        defaultValue={garment.supplierProductCode}
        onBlur={(e) => commit('supplierProductCode', e.target.value)}
        placeholder="Product code (e.g. Staple Tee 5001)"
        className="h-9 text-xs"
      />
      <div>
        <Input
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onBlur={(e) => commit('supplierUrl', e.target.value)}
          placeholder="https://supplier.com/product"
          className="h-9 text-xs"
          error={urlInvalid ? 'Enter a valid http(s) URL' : undefined}
        />
        {urlInvalid && <p className="mt-0.5 text-[11px] text-danger">Enter a valid http(s) URL</p>}
      </div>
    </div>
  )
}

// A light client-side hint only — the real validation/rejection happens
// server-side in api/settings.ts's updateGarmentType (utils/url.ts), which
// silently stores null for anything unsafe rather than ever blocking the
// rest of the garment type from saving. This just gives faster feedback.
function isLikelyUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

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
        description="Garment type catalog used throughout the order form — optionally link each to its usual supplier product"
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

      {isLoading ? (
        <Card>
          <CardBody className="p-0">
            <TableSkeleton />
          </CardBody>
        </Card>
      ) : catalog.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState icon={Shirt} title="No garment types yet" description="Add a garment type above to make it available on the order form." />
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {catalog.map((g) => (
            <Card key={g.id}>
              <CardBody className="flex flex-col gap-2.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-zinc-800">{g.name}</p>
                  <button
                    onClick={() => toggleActive(g.id, g.active)}
                    role="switch"
                    aria-checked={g.active}
                    aria-label={`${g.active ? 'Deactivate' : 'Activate'} ${g.name}`}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${g.active ? 'bg-brand-accent' : 'bg-zinc-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${g.active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <SupplierFields garment={g} update={update} showToast={showToast} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

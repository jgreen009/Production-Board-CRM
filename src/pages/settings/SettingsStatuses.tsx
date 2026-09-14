import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Pencil, Plus, Trash2, X } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { useToast } from '@/components/ui/toast-context'
import { useProfile } from '@/hooks/useProfile'
import {
  useCreateStatusOption,
  useDeleteStatusOption,
  useStatusOptions,
  useUpdateStatusOption,
} from '@/hooks/useStatusOptions'
import type { StatusColor, StatusDimension, StatusOption } from '@/api/statusOptions'
import { staffErrorMessage } from '@/utils/errorMessage'

const GROUPS: { dimension: StatusDimension; title: string; description: string }[] = [
  { dimension: 'payment', title: 'Payment', description: 'Tracks whether an order has been paid.' },
  { dimension: 'artwork', title: 'Artwork', description: 'Tracks artwork progress, separate from production.' },
  { dimension: 'garment', title: 'Garments', description: 'Tracks garment sourcing, separate from production.' },
  { dimension: 'production', title: 'Production', description: 'The operational status shown on the Production Board.' },
  { dimension: 'priority', title: 'Priority', description: 'Internal staff priority, not shown on the paper form.' },
  { dimension: 'turnaround', title: 'Turnaround', description: 'Internal staff turnaround selection, not shown on the paper form.' },
]

const COLOR_OPTIONS: { value: StatusColor; label: string; swatchClassName: string }[] = [
  { value: 'neutral', label: 'Neutral', swatchClassName: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  { value: 'danger', label: 'Danger', swatchClassName: 'bg-danger-soft text-danger border-danger/20' },
  { value: 'warning', label: 'Warning', swatchClassName: 'bg-warning-soft text-warning border-warning/20' },
  { value: 'success', label: 'Success', swatchClassName: 'bg-success-soft text-success border-success/20' },
  { value: 'info', label: 'Info', swatchClassName: 'bg-info-soft text-info border-info/20' },
]

const CLASSNAME_BY_COLOR: Record<StatusColor, string> = Object.fromEntries(
  COLOR_OPTIONS.map((c) => [c.value, c.swatchClassName]),
) as Record<StatusColor, string>

export default function SettingsStatuses() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { data: profile } = useProfile()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  const { data: options = [], isLoading } = useStatusOptions()
  const createMutation = useCreateStatusOption()
  const updateMutation = useUpdateStatusOption()
  const deleteMutation = useDeleteStatusOption()

  const [addingDimension, setAddingDimension] = useState<StatusDimension | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState<StatusColor>('neutral')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState<StatusColor>('neutral')
  const [deleteTarget, setDeleteTarget] = useState<StatusOption | null>(null)

  const onError = (message: string) => (err: unknown) => showToast(staffErrorMessage(err, message), 'info')

  const startAdd = (dimension: StatusDimension) => {
    setAddingDimension(dimension)
    setNewLabel('')
    setNewColor('neutral')
  }

  const submitAdd = () => {
    if (!addingDimension) return
    const label = newLabel.trim()
    if (!label) return
    createMutation.mutate(
      { dimension: addingDimension, label, color: newColor },
      {
        onSuccess: () => setAddingDimension(null),
        onError: onError('Failed to add status'),
      },
    )
  }

  const startEdit = (option: StatusOption) => {
    setEditingId(option.id)
    setEditLabel(option.label)
    setEditColor(option.color)
  }

  const submitEdit = () => {
    if (!editingId) return
    const label = editLabel.trim()
    if (!label) return
    updateMutation.mutate(
      { id: editingId, patch: { label, color: editColor } },
      {
        onSuccess: () => setEditingId(null),
        onError: onError('Failed to update status'),
      },
    )
  }

  const toggleActive = (option: StatusOption) => {
    updateMutation.mutate(
      { id: option.id, patch: { active: !option.active } },
      { onError: onError('Failed to update status') },
    )
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const target = deleteTarget
    deleteMutation.mutate(target, {
      onSuccess: () => setDeleteTarget(null),
      onError: (err) => {
        setDeleteTarget(null)
        showToast(staffErrorMessage(err, `Failed to delete "${target.label}"`), 'info')
      },
    })
  }

  return (
    <div>
      <button onClick={() => navigate('/settings')} className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft size={14} /> Back to Settings
      </button>
      <PageHeader
        title="Statuses"
        description={
          isAdmin
            ? 'Add, rename, recolour, disable, or delete the status sets used across orders and the production board.'
            : 'Status sets used across orders and the production board. Only admins can edit these.'
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <div className="flex flex-col gap-4">
          {GROUPS.map((group) => {
            const statuses = options.filter((o) => o.dimension === group.dimension)
            return (
              <Card key={group.dimension}>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-800">{group.title}</h3>
                    <p className="text-xs text-zinc-400">{group.description}</p>
                  </div>
                  {isAdmin && (
                    <Button variant="secondary" size="sm" onClick={() => startAdd(group.dimension)}>
                      <Plus size={14} /> Add
                    </Button>
                  )}
                </CardHeader>
                <CardBody className="flex flex-col gap-2">
                  {addingDimension === group.dimension && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-brand-accent/30 bg-brand-accent-soft p-2.5">
                      <Input
                        autoFocus
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
                        placeholder="Status name"
                        className="h-9 w-44"
                      />
                      <Select value={newColor} onChange={(e) => setNewColor(e.target.value as StatusColor)} className="h-9 w-32">
                        {COLOR_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </Select>
                      <Button variant="primary" size="sm" disabled={!newLabel.trim() || createMutation.isPending} onClick={submitAdd}>
                        Add
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setAddingDimension(null)}>
                        <X size={14} />
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {statuses.map((s) =>
                      editingId === s.id ? (
                        <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-brand-accent/30 bg-brand-accent-soft p-2.5">
                          <Input
                            autoFocus
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submitEdit()}
                            className="h-9 w-44"
                          />
                          <Select value={editColor} onChange={(e) => setEditColor(e.target.value as StatusColor)} className="h-9 w-32">
                            {COLOR_OPTIONS.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </Select>
                          <Button variant="primary" size="sm" disabled={!editLabel.trim() || updateMutation.isPending} onClick={submitEdit}>
                            Save
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <div
                          key={s.id}
                          className={clsx(
                            'group flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-1',
                            CLASSNAME_BY_COLOR[s.color],
                            !s.active && 'opacity-50',
                          )}
                        >
                          <span className="text-xs font-medium">{s.label}</span>
                          {!s.active && <span className="text-[10px] font-normal">(disabled)</span>}
                          {isAdmin && (
                            <div className="ml-0.5 flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => startEdit(s)}
                                className="rounded-full p-1 text-current opacity-60 hover:bg-white/60 hover:opacity-100"
                                aria-label={`Rename ${s.label}`}
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleActive(s)}
                                className="px-1.5 text-[10px] font-medium text-current opacity-70 hover:opacity-100"
                              >
                                {s.active ? 'Disable' : 'Enable'}
                              </button>
                              {s.isSystem ? (
                                <span className="rounded-full p-1 text-current opacity-40" title="Built-in status — can't be deleted">
                                  <Lock size={11} />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(s)}
                                  className="rounded-full p-1 text-current opacity-60 hover:bg-white/60 hover:opacity-100"
                                  aria-label={`Delete ${s.label}`}
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ),
                    )}
                    {statuses.length === 0 && <Badge className="bg-zinc-100 text-zinc-400 border-zinc-200">No statuses yet</Badge>}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.label}"?`}
        description="This can't be undone. If this status is still in use on any order, the delete will be refused — disable it instead."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

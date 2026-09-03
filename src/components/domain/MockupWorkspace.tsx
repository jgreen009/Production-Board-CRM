import { useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import type { GarmentFormValues, ArtworkFileFormValues, MockupFormValues } from '@/schemas/orderFormSchema'
import type { GarmentType, PrintPosition } from '@/types'
import { GarmentMockup } from '@/components/domain/GarmentMockup'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { generateId } from '@/utils/id'
import { printPositionsForView, getPrintPositionConfig } from '@/data/printPositions'
import { GARMENT_TYPES } from '@/data/mockGarments'

const SIZE_PRESETS = [
  { label: 'A6', widthMm: 105, heightMm: 148 },
  { label: 'A4', widthMm: 210, heightMm: 297 },
  { label: 'A3', widthMm: 297, heightMm: 420 },
]

interface DraftState {
  garmentType: GarmentType
  colour: string
  view: 'Front' | 'Back'
  position: PrintPosition
  artworkId: string
  widthMm: number
  heightMm: number
  printColours: string
  notes: string
  offset: { x: number; y: number }
}

function defaultDraft(garments: GarmentFormValues[]): DraftState {
  const firstPosition = printPositionsForView('Front')[0]
  return {
    garmentType: (garments[0]?.type as GarmentType) ?? GARMENT_TYPES[0],
    colour: garments[0]?.colour ?? '',
    view: 'Front',
    position: firstPosition.value,
    artworkId: '',
    widthMm: firstPosition.sizePreset?.widthMm ?? 200,
    heightMm: firstPosition.sizePreset?.heightMm ?? 200,
    printColours: '',
    notes: '',
    offset: { x: 0, y: 0 },
  }
}

interface MockupWorkspaceProps {
  garments: GarmentFormValues[]
  artworkFiles: ArtworkFileFormValues[]
  mockups: MockupFormValues[]
  onAddMockup: (mockup: MockupFormValues) => void
}

export function MockupWorkspace({ garments, artworkFiles, mockups, onAddMockup }: MockupWorkspaceProps) {
  const [draft, setDraft] = useState<DraftState>(() => defaultDraft(garments))

  const activeArtwork = artworkFiles.find((f) => f.id === draft.artworkId)

  const update = (patch: Partial<DraftState>) => setDraft((prev) => ({ ...prev, ...patch }))

  const handleReset = () => setDraft(defaultDraft(garments))

  const handleSave = () => {
    const mockup: MockupFormValues = {
      id: generateId('mockup'),
      garmentType: draft.garmentType,
      colour: draft.colour,
      view: draft.view,
      position: draft.position,
      artworkId: draft.artworkId || undefined,
      widthMm: draft.widthMm,
      heightMm: draft.heightMm,
      printColours: draft.printColours,
      notes: draft.notes,
    }
    onAddMockup(mockup)
    update({ offset: { x: 0, y: 0 } })
  }

  const lastByView = (view: 'Front' | 'Back') => [...mockups].reverse().find((m) => m.view === view)
  const frontThumb = lastByView('Front')
  const backThumb = lastByView('Back')

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_240px]">
        <div className="flex flex-col gap-3">
          <FormField label="Garment" hint="Any catalog type — not limited to garments added to this order.">
            <Select
              value={draft.garmentType}
              onChange={(e) => {
                const type = e.target.value as GarmentType
                const matching = garments.find((g) => g.type === type)
                update({ garmentType: type, colour: matching?.colour ?? draft.colour })
              }}
            >
              {GARMENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Colour">
            <Input value={draft.colour} onChange={(e) => update({ colour: e.target.value })} placeholder="e.g. Navy" />
          </FormField>

          <FormField label="View">
            <div className="flex gap-1.5">
              {(['Front', 'Back'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    const firstForView = printPositionsForView(v)[0]
                    update({
                      view: v,
                      position: firstForView.value,
                      widthMm: firstForView.sizePreset?.widthMm ?? draft.widthMm,
                      heightMm: firstForView.sizePreset?.heightMm ?? draft.heightMm,
                      offset: { x: 0, y: 0 },
                    })
                  }}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-sm font-medium ${
                    draft.view === v ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Print Position" hint="Matches the paper form's numbered print position diagram.">
            <Select
              value={draft.position}
              onChange={(e) => {
                const config = getPrintPositionConfig(e.target.value as PrintPosition)
                update({
                  position: config.value,
                  widthMm: config.sizePreset?.widthMm ?? draft.widthMm,
                  heightMm: config.sizePreset?.heightMm ?? draft.heightMm,
                  offset: { x: 0, y: 0 },
                })
              }}
            >
              {printPositionsForView(draft.view).map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Artwork" hint="Select from files uploaded above">
            <Select value={draft.artworkId} onChange={(e) => update({ artworkId: e.target.value })}>
              <option value="">No artwork selected</option>
              {artworkFiles.map((f) => (
                <option key={f.id} value={f.id}>{f.fileName}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-100 bg-zinc-50/60 p-4">
          <GarmentMockup
            garmentType={draft.garmentType}
            colour={draft.colour}
            view={draft.view}
            position={draft.position}
            artworkUrl={activeArtwork?.previewUrl}
            widthMm={draft.widthMm}
            heightMm={draft.heightMm}
            offset={draft.offset}
            onOffsetChange={(offset) => update({ offset })}
          />
          <p className="mt-2 text-xs text-zinc-400">
            {activeArtwork?.previewUrl ? 'Drag the artwork to reposition it.' : 'Select a previewable artwork file to drag it on the garment.'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-sm font-medium text-zinc-700">Print Size</p>
            <div className="mb-2 flex gap-1.5">
              {SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => update({ widthMm: preset.widthMm, heightMm: preset.heightMm })}
                  className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-300"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Width (mm)">
                <Input type="number" min={0} value={draft.widthMm} onChange={(e) => update({ widthMm: Number(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Height (mm)">
                <Input type="number" min={0} value={draft.heightMm} onChange={(e) => update({ heightMm: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
          </div>

          <FormField label="Print Colours">
            <Input value={draft.printColours} onChange={(e) => update({ printColours: e.target.value })} placeholder="e.g. White, Gold" />
          </FormField>

          <FormField label="Notes">
            <Textarea rows={2} value={draft.notes} onChange={(e) => update({ notes: e.target.value })} />
          </FormField>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
              <RotateCcw size={14} /> Reset
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSave}>
              <Save size={14} /> Save Mockup
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-4 border-t border-zinc-100 pt-4">
        <ThumbnailPreview label="Front" mockup={frontThumb} artworkFiles={artworkFiles} />
        <ThumbnailPreview label="Back" mockup={backThumb} artworkFiles={artworkFiles} />
      </div>
    </div>
  )
}

function ThumbnailPreview({
  label,
  mockup,
  artworkFiles,
}: {
  label: 'Front' | 'Back'
  mockup?: MockupFormValues
  artworkFiles: ArtworkFileFormValues[]
}) {
  const artwork = artworkFiles.find((f) => f.id === mockup?.artworkId)
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="rounded-md border border-zinc-100 bg-zinc-50/60 p-2">
        {mockup ? (
          <GarmentMockup
            garmentType={mockup.garmentType as never}
            colour={mockup.colour}
            view={mockup.view}
            position={mockup.position as PrintPosition}
            artworkUrl={artwork?.previewUrl}
            widthMm={mockup.widthMm}
            heightMm={mockup.heightMm}
            offset={{ x: 0, y: 0 }}
            onOffsetChange={() => {}}
            size={90}
          />
        ) : (
          <div className="flex h-[112px] w-[90px] items-center justify-center text-xs text-zinc-300">No mockup</div>
        )}
      </div>
      <span className="text-xs font-medium text-zinc-500">{label}</span>
    </div>
  )
}

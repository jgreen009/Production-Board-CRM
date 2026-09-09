import { useFieldArray, useFormContext } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { OrderFormValues, PrintSpecFormValues } from '@/schemas/orderFormSchema'
import type { GarmentType, PrintPosition } from '@/types'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { GarmentMockup } from '@/components/domain/GarmentMockup'
import { emptyPrintSpec } from '@/pages/new-order/defaultValues'
import { PRINT_POSITIONS, getPrintPositionConfig } from '@/data/printPositions'
import { PRINT_SIZES } from '@/data/printSizes'
import { useGarmentTypesSettings, useMockupTemplates } from '@/hooks/useSettings'
import { selectableCatalogNames } from '@/utils/catalog'

export function PrintDetailsSection() {
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>()

  const { fields, append, remove } = useFieldArray({ control, name: 'printSpecs' })
  const printSpecs = watch('printSpecs')
  const garments = watch('garments')
  const artworkFiles = watch('artworkFiles')
  const { data: garmentTypesCatalog = [] } = useGarmentTypesSettings()
  const { data: mockupTemplates = [] } = useMockupTemplates()

  // A garment type is offered as a mockup preview only if it's both active
  // as a catalog entry AND has an active mockup_templates row for the
  // specific view this print spec needs (Front templates and Back
  // templates for the same garment type can be toggled independently in
  // Settings > Mockup Templates).
  const previewGarmentOptions = (view: 'Front' | 'Back') => {
    const activeForView = new Set(
      mockupTemplates.filter((t) => t.view === view && t.active).map((t) => t.garmentTypeName),
    )
    return garmentTypesCatalog.map((g) => ({ name: g.name, active: g.active && activeForView.has(g.name) }))
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-zinc-700">Print Details &amp; Mockups</p>
      <p className="mb-3 text-xs text-zinc-400">
        One entry per print — position, colour, and size — with a live preview of where it lands on the garment.
      </p>
      {errors.printSpecs?.message && <p className="mb-2 text-xs text-red-600">{errors.printSpecs.message}</p>}

      <div className="flex flex-col gap-3">
        {fields.map((field, index) => {
          const spec = printSpecs[index]
          const config = getPrintPositionConfig(spec.position as PrintPosition)
          const previewCatalog = previewGarmentOptions(config.view)
          const activeGarmentTypeNames = previewCatalog.filter((g) => g.active).map((g) => g.name)
          const effectiveGarmentType = (spec.garmentType || garments[0]?.type || activeGarmentTypeNames[0]) as GarmentType
          const effectiveColour =
            spec.garmentColour || garments.find((g) => g.type === effectiveGarmentType)?.colour || garments[0]?.colour || ''
          const artwork = artworkFiles.find((f) => f.id === spec.artworkId)

          const update = (patch: Partial<PrintSpecFormValues>) =>
            setValue(`printSpecs.${index}`, { ...spec, ...patch })

          return (
            <div key={field.id} className="rounded-lg border border-zinc-200 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-700">Print {index + 1}</p>
                <button
                  type="button"
                  disabled={fields.length <= 1}
                  onClick={() => remove(index)}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  aria-label="Remove print spec"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">POSITION</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRINT_POSITIONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => update({ position: p.value })}
                        className={clsx(
                          'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                          spec.position === p.value
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-zinc-100 bg-zinc-50/60 p-4">
                  <GarmentMockup
                    garmentType={effectiveGarmentType}
                    colour={effectiveColour}
                    view={config.view}
                    position={spec.position as PrintPosition}
                    artworkUrl={artwork?.previewUrl}
                    widthMm={spec.widthMm}
                    heightMm={spec.heightMm}
                    offset={{ x: spec.offsetX ?? 0, y: spec.offsetY ?? 0 }}
                    onOffsetChange={(offset) => update({ offsetX: offset.x, offsetY: offset.y })}
                    size={320}
                  />
                  <p className="text-center text-xs text-zinc-400">
                    {artwork ? 'Drag to reposition' : 'Select artwork to preview placement'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Print Colour">
                    <Input
                      value={spec.colour}
                      onChange={(e) => update({ colour: e.target.value })}
                      placeholder="e.g. White, Gold"
                    />
                  </FormField>
                  <FormField label="Artwork" hint="From files uploaded above">
                    <Select
                      value={spec.artworkId ?? ''}
                      onChange={(e) => update({ artworkId: e.target.value || undefined })}
                    >
                      <option value="">No artwork selected</option>
                      {artworkFiles.map((f) => (
                        <option key={f.id} value={f.id}>{f.fileName}</option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">PRINT SIZE</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PRINT_SIZES.map((size) => (
                      <button
                        key={size.label}
                        type="button"
                        onClick={() => update({ widthMm: size.widthMm, heightMm: size.heightMm })}
                        className={clsx(
                          'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                          spec.widthMm === size.widthMm && spec.heightMm === size.heightMm
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                        )}
                      >
                        {size.label}
                      </button>
                    ))}
                    <span className="ml-1 text-xs text-zinc-400">{spec.widthMm} × {spec.heightMm} mm</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    label="Preview Garment"
                    hint={`Any catalog type with an active ${config.view.toLowerCase()} mockup template.`}
                  >
                    <Select value={effectiveGarmentType} onChange={(e) => update({ garmentType: e.target.value })}>
                      {selectableCatalogNames(previewCatalog, effectiveGarmentType).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Preview Colour">
                    <Input
                      value={effectiveColour}
                      onChange={(e) => update({ garmentColour: e.target.value })}
                      placeholder="e.g. Navy"
                    />
                  </FormField>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Button type="button" variant="secondary" size="sm" className="mt-3 self-start" onClick={() => append(emptyPrintSpec())}>
        <Plus size={14} /> Add Print Spec
      </Button>
    </div>
  )
}

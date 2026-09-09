import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { clsx } from 'clsx'
import { ImageOff } from 'lucide-react'
import type { OrderFormValues, PrintSpecFormValues } from '@/schemas/orderFormSchema'
import type { GarmentType, PrintPosition } from '@/types'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { emptyPrintSpec } from '@/pages/new-order/defaultValues'
import { PRINT_ZONES, getPrintZone } from '@/config/printZones'
import { PRINT_SIZES } from '@/data/printSizes'
import { useGarmentTypesSettings, useMockupTemplates } from '@/hooks/useSettings'
import { selectableCatalogNames } from '@/utils/catalog'
import { isOverflowingZonePx, physicalSizeToPixelSize, zoneBoxPx } from '@/utils/mockupGeometry'
import { heightMmFromWidth } from '@/utils/printSizeConversion'
import type { MockupCanvasHandle, MockupTransform } from '@/components/domain/MockupCanvas'
import { PrintSpecTabs } from './PrintSpecTabs'
import { ArtworkSelector } from './ArtworkSelector'
import { TransformControls } from './TransformControls'

// Fabric.js only loads when the Mockup Studio actually mounts — Dashboard,
// Customers, Orders List, Production Board never pull it in (Batch A
// "Lazy loading"). This is the one dynamic import boundary in the app.
const MockupCanvas = lazy(() =>
  import('@/components/domain/MockupCanvas').then((m) => ({ default: m.MockupCanvas })),
)

// Fixed reference aspect ratio for the overflow pre-check (§ "Print zone
// guide"/"Overflow warnings") — matches GARMENT_VIEW_BOX (240:300) exactly,
// so the proportional comparison it produces is identical to what the real
// canvas (always kept at this same ratio) would show, independent of the
// editor's actual current pixel size.
const OVERFLOW_CHECK_WIDTH = 800
const OVERFLOW_CHECK_HEIGHT = 1000

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(Math.max(200, Math.floor(w)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}

function CanvasSkeleton({ width, height }: { width: number; height: number }) {
  return (
    <div
      style={{ width, height }}
      className="animate-pulse rounded-lg border border-zinc-100 bg-zinc-100"
      aria-hidden="true"
    />
  )
}

export function MockupStudio() {
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

  const [activeId, setActiveId] = useState<string | null>(fields[0]?.id ?? null)
  const [activeView, setActiveView] = useState<'Front' | 'Back'>(() => {
    const first = printSpecs[0]
    return first ? getPrintZone(first.position as PrintPosition).view : 'Front'
  })
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const [canvasError, setCanvasError] = useState<string | null>(null)
  // "Reset Size" restores whatever widthMm was in effect when this
  // PrintSpec/artwork was loaded into the editor — a local session
  // baseline, not a second persisted "original size" (Batch A "Reset Size
  // Behaviour").
  const [baselineWidthMm, setBaselineWidthMm] = useState<number>(0)

  const canvasRef = useRef<MockupCanvasHandle>(null)
  const { ref: containerRef, width: containerWidth } = useContainerWidth()
  const canvasWidth = Math.min(containerWidth, 420)
  const canvasHeight = Math.round((canvasWidth / 240) * 300)

  const activeIndex = fields.findIndex((f) => f.id === activeId)
  const spec = activeIndex >= 0 ? printSpecs[activeIndex] : undefined

  // Keeps the Front/Back tab bar honest when the active spec's own
  // position changes via the position buttons (not just via tab-switching
  // or Add Print) — "changing print position must derive Front/Back view."
  useEffect(() => {
    if (!spec) return
    const derived = getPrintZone(spec.position as PrintPosition).view
    setActiveView((current) => (current === derived ? current : derived))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec?.position])

  // Deliberately does NOT reset `aspectRatio` on every spec switch: two
  // different PrintSpecs can reference the same artworkId, in which case
  // MockupCanvas's artwork-load effect (keyed on the resolved URL) never
  // re-fires and never re-reports a ratio — the previously-known one is
  // still correct and must not be discarded. MockupCanvas's own effect is
  // the sole source of truth for this value, including reporting `null`
  // whenever the newly active spec genuinely has no (or different)
  // artwork. Only the session-local reset-size baseline and any stale
  // error from a previous spec are cleared here.
  useEffect(() => {
    setCanvasError(null)
    setBaselineWidthMm(spec?.widthMm ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const { frontEntries, backEntries } = useMemo(() => {
    const front: { id: string; label: string }[] = []
    const back: { id: string; label: string }[] = []
    fields.forEach((f, i) => {
      const entry = { id: f.id, label: `${printSpecs[i].position}` }
      if (getPrintZone(printSpecs[i]?.position as PrintPosition).view === 'Front') front.push(entry)
      else back.push(entry)
    })
    return { frontEntries: front, backEntries: back }
  }, [fields, printSpecs])

  const previewGarmentOptions = (view: 'Front' | 'Back') => {
    const activeForView = new Set(
      mockupTemplates.filter((t) => t.view === view && t.active).map((t) => t.garmentTypeName),
    )
    return garmentTypesCatalog.map((g) => ({ name: g.name, active: g.active && activeForView.has(g.name) }))
  }

  const handleSelect = (id: string) => {
    const idx = fields.findIndex((f) => f.id === id)
    if (idx < 0) return
    setActiveId(id)
    setActiveView(getPrintZone(printSpecs[idx].position as PrintPosition).view)
  }

  const handleViewChange = (view: 'Front' | 'Back') => {
    setActiveView(view)
    const entries = view === 'Front' ? frontEntries : backEntries
    if (entries.length > 0 && !entries.some((e) => e.id === activeId)) {
      setActiveId(entries[0].id)
    }
  }

  const handleAdd = () => {
    const fallback = PRINT_ZONES.find((z) => z.view === activeView) ?? PRINT_ZONES[0]
    const newSpec = { ...emptyPrintSpec(), position: fallback.position }
    append(newSpec)
    // useFieldArray appends synchronously to `fields` on next render; the
    // new spec's id isn't known yet here, so select it by position on the
    // upcoming render via a microtask-free effect below.
  }

  // Selects a newly-appended print spec once it shows up in `fields`.
  const previousFieldCount = useRef(fields.length)
  useEffect(() => {
    if (fields.length > previousFieldCount.current) {
      const newest = fields[fields.length - 1]
      setActiveId(newest.id)
      setActiveView(getPrintZone(printSpecs[fields.length - 1].position as PrintPosition).view)
    }
    previousFieldCount.current = fields.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.length])

  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)

  const confirmRemove = () => {
    if (!pendingRemoveId) return
    const idx = fields.findIndex((f) => f.id === pendingRemoveId)
    if (idx < 0) {
      setPendingRemoveId(null)
      return
    }
    remove(idx)
    if (activeId === pendingRemoveId) {
      const remaining = fields.filter((f) => f.id !== pendingRemoveId)
      setActiveId(remaining[0]?.id ?? null)
    }
    setPendingRemoveId(null)
  }

  if (fields.length === 0) {
    return (
      <div>
        {errors.printSpecs?.message && <p className="mb-2 text-xs text-red-600">{errors.printSpecs.message}</p>}
        <EmptyState icon={ImageOff} title="No print locations yet" description="Add a print location to begin." />
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={handleAdd}>
          Add Print
        </Button>
      </div>
    )
  }

  if (!spec) return null

  const config = getPrintZone(spec.position as PrintPosition)
  const previewCatalog = previewGarmentOptions(config.view)
  const activeGarmentTypeNames = previewCatalog.filter((g) => g.active).map((g) => g.name)
  const effectiveGarmentType = (spec.garmentType || garments[0]?.type || activeGarmentTypeNames[0]) as GarmentType
  const effectiveColour =
    spec.garmentColour || garments.find((g) => g.type === effectiveGarmentType)?.colour || garments[0]?.colour || ''
  const artwork = artworkFiles.find((f) => f.id === spec.artworkId)
  const artworkPreviewable = artwork && ['PNG', 'JPG', 'WEBP', 'SVG'].includes(artwork.fileType)

  const update = (patch: Partial<PrintSpecFormValues>) =>
    setValue(`printSpecs.${activeIndex}`, { ...spec, ...patch })

  const transform: MockupTransform = {
    offsetX: spec.offsetX ?? 0,
    offsetY: spec.offsetY ?? 0,
    rotationDeg: spec.rotationDeg ?? 0,
    widthMm: spec.widthMm,
    heightMm: spec.heightMm,
  }

  const overflowZonePx = zoneBoxPx(config, OVERFLOW_CHECK_WIDTH, OVERFLOW_CHECK_HEIGHT)
  const overflowSizePx = physicalSizeToPixelSize(spec.widthMm, spec.heightMm, config, overflowZonePx)
  const overflowing = !!artwork && isOverflowingZonePx(overflowSizePx, overflowZonePx)

  return (
    <div className="flex flex-col gap-3">
      {errors.printSpecs?.message && <p className="text-xs text-red-600">{errors.printSpecs.message}</p>}

      <PrintSpecTabs
        view={activeView}
        onViewChange={handleViewChange}
        frontEntries={frontEntries}
        backEntries={backEntries}
        activeId={activeId}
        onSelect={handleSelect}
        onAdd={handleAdd}
        onRemove={(id) => setPendingRemoveId(id)}
        canRemove={fields.length > 1}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_240px]">
        {/* LEFT: location / artwork / garment */}
        <div className="flex flex-col gap-3 order-1">
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">POSITION</p>
            <div className="flex flex-wrap gap-1.5">
              {PRINT_ZONES.map((p) => (
                <button
                  key={p.position}
                  type="button"
                  onClick={() => update({ position: p.position })}
                  className={clsx(
                    'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                    spec.position === p.position
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

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
          <FormField label="Print Colour">
            <Input
              value={spec.colour}
              onChange={(e) => update({ colour: e.target.value })}
              placeholder="e.g. White, Gold"
            />
          </FormField>

          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">ARTWORK</p>
            <ArtworkSelector
              files={artworkFiles}
              selectedId={spec.artworkId}
              onSelect={(id) => update({ artworkId: id })}
            />
          </div>

          <FormField label="Approval Note" hint="Feedback for this print location, e.g. &ldquo;Move logo 20mm higher&rdquo;">
            <Textarea
              value={spec.approvalNote ?? ''}
              onChange={(e) => update({ approvalNote: e.target.value || undefined })}
              rows={2}
              placeholder="Optional note for this print location"
            />
          </FormField>
        </div>

        {/* CENTER: canvas */}
        <div ref={containerRef} className="order-2 flex flex-col items-center gap-2">
          <div className="relative rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
            <ErrorBoundary
              fallback={(retry) => (
                <div
                  style={{ width: canvasWidth, height: canvasHeight }}
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50/60 p-4 text-center"
                >
                  <p className="text-xs text-red-600">
                    The mockup editor couldn&rsquo;t load. Check your connection and try again.
                  </p>
                  <Button type="button" variant="secondary" size="sm" onClick={retry}>
                    Retry
                  </Button>
                </div>
              )}
            >
              <Suspense fallback={<CanvasSkeleton width={canvasWidth} height={canvasHeight} />}>
                <MockupCanvas
                  ref={canvasRef}
                  width={canvasWidth}
                  height={canvasHeight}
                  garmentType={effectiveGarmentType}
                  garmentColour={effectiveColour}
                  view={config.view}
                  zone={config}
                  artworkUrl={artworkPreviewable ? artwork?.previewUrl : undefined}
                  transform={transform}
                  onTransformCommit={(t) => update(t)}
                  onArtworkAspectRatio={setAspectRatio}
                  onError={setCanvasError}
                />
              </Suspense>
            </ErrorBoundary>
            {!artwork && (
              <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md bg-white/90 px-2 py-1.5 text-center text-xs text-zinc-500">
                Upload or select artwork to preview it on the garment.
              </p>
            )}
            {artwork && !artworkPreviewable && (
              <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md bg-white/90 px-2 py-1.5 text-center text-xs text-zinc-500">
                Preview unavailable for this artwork type — the file stays attached to this print.
              </p>
            )}
          </div>
          {canvasError && <p className="text-xs text-red-600">{canvasError}</p>}

          <div>
            <p className="mb-1.5 text-center text-xs font-medium text-zinc-500">PRINT SIZE</p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
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
            </div>
          </div>
        </div>

        {/* RIGHT: transform controls */}
        <div className="order-3">
          <TransformControls
            widthMm={spec.widthMm}
            heightMm={spec.heightMm}
            rotationDeg={spec.rotationDeg ?? 0}
            disabled={!artwork}
            overflowing={overflowing}
            onWidthChange={(widthMm) =>
              update({ widthMm, heightMm: aspectRatio ? heightMmFromWidth(widthMm, aspectRatio) : spec.heightMm })
            }
            onCenterHorizontally={() => canvasRef.current?.centerHorizontally()}
            onCenterVertically={() => canvasRef.current?.centerVertically()}
            onResetPosition={() => canvasRef.current?.resetPosition()}
            onResetRotation={() => canvasRef.current?.resetRotation()}
            onResetSize={() => canvasRef.current?.resetSize(baselineWidthMm || spec.widthMm)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingRemoveId}
        title="Remove this print location?"
        description="This only removes the print placement — the original artwork file stays available for other prints."
        confirmLabel="Remove"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemoveId(null)}
      />
    </div>
  )
}

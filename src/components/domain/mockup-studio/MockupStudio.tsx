import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { clsx } from 'clsx'
import { ImageOff } from 'lucide-react'
import type { OrderFormValues, PrintSpecFormValues } from '@/schemas/orderFormSchema'
import type { GarmentType, PrintPosition } from '@/types'
import { Button } from '@/components/ui/Button'
import { FormField, Textarea } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { emptyPrintSpec } from '@/pages/new-order/defaultValues'
import {
  ALL_PRINT_POSITIONS,
  getPositionView,
  isPrintPositionSupported,
  resolvePrintZone,
} from '@/config/garmentGeometry'
import { PRINT_SIZE_PRESETS, matchPrintSizePreset } from '@/config/printSizePresets'
import { fitArtworkToCanonicalZone, isOverflowingCanonicalZoneMm } from '@/utils/mockupGeometry'
import { heightMmFromWidth } from '@/utils/printSizeConversion'
import type { MockupTransform } from '@/components/domain/MockupCanvas'
import { PrintSpecTabs } from './PrintSpecTabs'
import { ArtworkSelector } from './ArtworkSelector'

// Fabric.js only loads when the Mockup Studio actually mounts — Dashboard,
// Customers, Orders List, Production Board never pull it in (Batch A
// "Lazy loading"). This is the one dynamic import boundary in the app.
const MockupCanvas = lazy(() =>
  import('@/components/domain/MockupCanvas').then((m) => ({ default: m.MockupCanvas })),
)

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

  // Garments section is the single source of truth for what the mockup
  // preview shows — no separate garment type/colour override lives on the
  // print spec itself (previously spec.garmentType/garmentColour, now
  // unused). Computed up front since garment-specific zone resolution
  // (Batch A) needs it everywhere below, not just once near the JSX.
  const effectiveGarmentType = (garments[0]?.type || 'T-shirt') as GarmentType
  const effectiveColour = garments[0]?.colour || ''

  const [activeId, setActiveId] = useState<string | null>(fields[0]?.id ?? null)
  const [activeView, setActiveView] = useState<'Front' | 'Back'>(() => {
    const first = printSpecs[0]
    return first ? getPositionView(first.position as PrintPosition) : 'Front'
  })
  const [canvasError, setCanvasError] = useState<string | null>(null)
  // Reported by MockupCanvas once the active spec's artwork image loads —
  // drives the auto-fill effect below. null while none is loaded/known.
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)

  const { ref: containerRef, width: containerWidth } = useContainerWidth()
  const canvasWidth = Math.min(containerWidth, 360)
  const canvasHeight = Math.round((canvasWidth / 240) * 300)

  const activeIndex = fields.findIndex((f) => f.id === activeId)
  const spec = activeIndex >= 0 ? printSpecs[activeIndex] : undefined

  // Keeps the Front/Back tab bar honest when the active spec's own
  // position changes via the position buttons (not just via tab-switching
  // or Add Print) — "changing print position must derive Front/Back view."
  useEffect(() => {
    if (!spec) return
    const derived = getPositionView(spec.position as PrintPosition)
    setActiveView((current) => (current === derived ? current : derived))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec?.position])

  // Clears any stale canvas error from a previously active spec.
  useEffect(() => {
    setCanvasError(null)
  }, [activeId])

  // Manual resizing is gone — artwork auto-fills its print position the
  // moment an aspect ratio is known, and re-fills whenever the active
  // spec's artwork, position, or garment changes (switching position or
  // garment re-fits to the new garment-specific zone's box). "Contain"
  // fit: the largest size that still fits entirely inside the zone, so it
  // never overflows on its own. Unsupported garment/position combinations
  // (Batch A §16) have no zone to fit against — left untouched rather than
  // guessing a size.
  useEffect(() => {
    if (!spec || aspectRatio == null) return
    const view = getPositionView(spec.position as PrintPosition)
    const zone = resolvePrintZone(effectiveGarmentType, view, spec.position as PrintPosition)
    if (!zone) return
    const fit = fitArtworkToCanonicalZone(zone, aspectRatio)
    if (Math.abs(fit.widthMm - spec.widthMm) > 0.01 || Math.abs(fit.heightMm - spec.heightMm) > 0.01) {
      setValue(`printSpecs.${activeIndex}`, { ...spec, widthMm: fit.widthMm, heightMm: fit.heightMm })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatio, activeId, spec?.position, spec?.artworkId, effectiveGarmentType])

  const { frontEntries, backEntries } = useMemo(() => {
    const front: { id: string; label: string }[] = []
    const back: { id: string; label: string }[] = []
    fields.forEach((f, i) => {
      const entry = { id: f.id, label: `${printSpecs[i].position}` }
      if (getPositionView(printSpecs[i]?.position as PrintPosition) === 'Front') front.push(entry)
      else back.push(entry)
    })
    return { frontEntries: front, backEntries: back }
  }, [fields, printSpecs])

  const handleSelect = (id: string) => {
    const idx = fields.findIndex((f) => f.id === id)
    if (idx < 0) return
    setActiveId(id)
    setActiveView(getPositionView(printSpecs[idx].position as PrintPosition))
  }

  const handleViewChange = (view: 'Front' | 'Back') => {
    setActiveView(view)
    const entries = view === 'Front' ? frontEntries : backEntries
    if (entries.length > 0 && !entries.some((e) => e.id === activeId)) {
      setActiveId(entries[0].id)
    }
  }

  const handleAdd = () => {
    const fallback = ALL_PRINT_POSITIONS.find((p) => getPositionView(p.position) === activeView) ?? ALL_PRINT_POSITIONS[0]
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
      setActiveView(getPositionView(printSpecs[fields.length - 1].position as PrintPosition))
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

  const view = getPositionView(spec.position as PrintPosition)
  const zone = resolvePrintZone(effectiveGarmentType, view, spec.position as PrintPosition)
  const positionSupported = isPrintPositionSupported(effectiveGarmentType, spec.position as PrintPosition)
  const artwork = artworkFiles.find((f) => f.id === spec.artworkId)
  const artworkPreviewable = artwork && ['PNG', 'JPG', 'WEBP', 'SVG'].includes(artwork.fileType)

  const update = (patch: Partial<PrintSpecFormValues>) =>
    setValue(`printSpecs.${activeIndex}`, { ...spec, ...patch })

  // Paper-size-style presets, on top of the automatic zone-fit — picking
  // one sets the physical width directly (height follows the artwork's
  // own aspect ratio, same math the automatic fit already uses); it does
  // NOT clamp to the zone, matching this app's "warn on overflow, never
  // silently clip or resize" rule (see the overflow banner below) rather
  // than the old free-drag/free-resize model.
  const handleSizePreset = (widthMm: number) => {
    update({ widthMm, heightMm: heightMmFromWidth(widthMm, aspectRatio ?? 1) })
  }
  const activePreset = matchPrintSizePreset(spec.widthMm)

  // Pre-UAT product decision: the selected print position is authoritative
  // for placement — artwork always renders centered in its zone, never at
  // a manually-dragged offset. `print_specs.offset_x`/`offset_y` remain in
  // the database and on PrintSpecFormValues for backward compatibility
  // (existing historical rows, no destructive migration), but are no
  // longer read here — every spec, old or new, now renders centered.
  // Rotation was already made non-interactive in an earlier pass (no UI
  // control sets it, artwork always loads upright); rotationDeg is kept
  // at its stored value (0 for every spec created since) rather than
  // force-zeroed, since nothing can newly set it away from 0 going forward.
  const transform: MockupTransform = {
    offsetX: 0,
    offsetY: 0,
    rotationDeg: spec.rotationDeg ?? 0,
    widthMm: spec.widthMm,
    heightMm: spec.heightMm,
  }

  const overflowing = !!artwork && !!zone && isOverflowingCanonicalZoneMm(spec.widthMm, spec.heightMm, zone)

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* LEFT (mobile: first, above the canvas): location / artwork controls */}
        <div className="order-1 flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500">POSITION</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_PRINT_POSITIONS.map((p) => {
                const supported = isPrintPositionSupported(effectiveGarmentType, p.position)
                return (
                  <button
                    key={p.position}
                    type="button"
                    onClick={() => update({ position: p.position })}
                    title={supported ? undefined : `${effectiveGarmentType} doesn't have a calibrated zone for ${p.label} yet`}
                    className={clsx(
                      'min-h-9 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                      spec.position === p.position
                        ? 'border-brand-accent bg-brand-accent-soft text-brand-accent'
                        : supported
                          ? 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                          : 'border-zinc-100 bg-white text-zinc-300 hover:border-zinc-200',
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500">ARTWORK</p>
            <ArtworkSelector
              files={artworkFiles}
              selectedId={spec.artworkId}
              onSelect={(id) => update({ artworkId: id })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500">PRINT SIZE</p>
            <div className="flex flex-wrap gap-1.5">
              {PRINT_SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handleSizePreset(preset.widthMm)}
                  className={clsx(
                    'min-h-9 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    activePreset === preset.key
                      ? 'border-brand-accent bg-brand-accent-soft text-brand-accent'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER (mobile: after controls, before approval note): canvas, kept visually dominant */}
        <div ref={containerRef} className="order-2 flex flex-col items-center gap-2 lg:row-span-2">
          <div className="relative flex w-full items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <ErrorBoundary
              fallback={(retry) => (
                <div
                  style={{ width: canvasWidth, height: canvasHeight }}
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border border-danger/20 bg-danger-soft p-4 text-center"
                >
                  <p className="text-xs text-danger">
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
                  width={canvasWidth}
                  height={canvasHeight}
                  garmentType={effectiveGarmentType}
                  garmentColour={effectiveColour}
                  view={view}
                  position={spec.position as PrintPosition}
                  artworkUrl={artworkPreviewable ? artwork?.previewUrl : undefined}
                  transform={transform}
                  onArtworkAspectRatio={setAspectRatio}
                  onError={setCanvasError}
                />
              </Suspense>
            </ErrorBoundary>
            {!artwork && (
              <p className="pointer-events-none absolute inset-x-4 bottom-4 rounded-md bg-white/90 px-2 py-1.5 text-center text-xs text-zinc-500 shadow-sm">
                Upload or select artwork to preview it on the garment.
              </p>
            )}
            {artwork && !artworkPreviewable && (
              <p className="pointer-events-none absolute inset-x-4 bottom-4 rounded-md bg-white/90 px-2 py-1.5 text-center text-xs text-zinc-500 shadow-sm">
                Preview unavailable for this artwork type — the file stays attached to this print.
              </p>
            )}
          </div>
          {canvasError && <p className="text-xs text-danger">{canvasError}</p>}
          {!positionSupported && (
            <p className="rounded-md border border-warning/30 bg-warning-soft px-2.5 py-2 text-xs text-warning">
              {effectiveGarmentType} doesn&rsquo;t have a calibrated print zone for {spec.position} yet — the garment
              preview shows without a specific placement. Staff can still save this order; the mockup preview will
              improve once this garment/position combination is supported.
            </p>
          )}
          {overflowing && (
            <p className="rounded-md border border-warning/30 bg-warning-soft px-2.5 py-2 text-xs text-warning">
              Artwork extends beyond the recommended print area for this position. Staff may still save this placement.
            </p>
          )}
          {artwork && positionSupported && (
            <p className="text-center text-[11px] text-zinc-400">
              Positioned and sized automatically for this print position.
            </p>
          )}
        </div>

        {/* LEFT column continued (mobile: last, after the canvas): approval note */}
        <div className="order-3">
          <FormField label="Approval Note" hint="Feedback for this print location, e.g. &ldquo;Move logo 20mm higher&rdquo;">
            <Textarea
              value={spec.approvalNote ?? ''}
              onChange={(e) => update({ approvalNote: e.target.value || undefined })}
              rows={2}
              placeholder="Optional note for this print location"
            />
          </FormField>
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

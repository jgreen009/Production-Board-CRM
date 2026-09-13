import { Trash2, Upload, ImageOff as ImageOffIcon } from 'lucide-react'
import type { GarmentType, PrintPosition } from '@/types'
import { GarmentMockup } from '@/components/domain/GarmentMockup'
import { ArtworkSelector } from '@/components/domain/mockup-studio/ArtworkSelector'
import { PrintPositionButtons } from '@/components/domain/mockup-studio/PrintPositionButtons'
import { PrintSizePresetButtons } from '@/components/domain/mockup-studio/PrintSizePresetButtons'
import { PrintSpecTabs } from '@/components/domain/mockup-studio/PrintSpecTabs'
import { Button } from '@/components/ui/Button'
import { ALL_PRINT_POSITIONS, getPositionView, isPrintPositionSupported } from '@/config/garmentGeometry'
import { matchPrintSizePreset } from '@/config/printSizePresets'
import { heightMmFromWidth } from '@/utils/printSizeConversion'
import { validateArtworkFile } from '@/utils/artworkValidation'
import type { PublicArtworkFileFormValues, PublicPrintSpecFormValues } from '@/schemas/publicOrderFormSchema'
import { emptyPublicPrintSpec } from '@/pages/publicPrintSpecDefaults'

// Mirrors the staff Mockup Studio's exact interaction pattern (position
// buttons, artwork selector, print-size presets, front/back tabs for
// multiple print locations) reusing the same shared components — but with
// GarmentMockup (no Fabric) instead of the Fabric-based MockupCanvas, since
// this is customer specification-entry, not an internal production editor.
// The preview is ALWAYS rendered here — there is no button/toggle that
// reveals it; it's part of the normal section layout, exactly like the
// staff canvas is never hidden behind an action either.

interface PublicPrintDetailsSectionProps {
  artworkFiles: PublicArtworkFileFormValues[]
  onArtworkFilesChange: (files: PublicArtworkFileFormValues[]) => void
  printSpecs: PublicPrintSpecFormValues[]
  onPrintSpecsChange: (specs: PublicPrintSpecFormValues[]) => void
  activeSpecId: string | null
  onActiveSpecIdChange: (id: string) => void
  effectiveGarmentType: string
  effectiveColour: string
  artworkError?: string
}

let localIdCounter = 0
function localId(prefix: string): string {
  localIdCounter += 1
  return `${prefix}-${localIdCounter}-${Date.now()}`
}

export function PublicPrintDetailsSection({
  artworkFiles,
  onArtworkFilesChange,
  printSpecs,
  onPrintSpecsChange,
  activeSpecId,
  onActiveSpecIdChange,
  effectiveGarmentType,
  effectiveColour,
  artworkError,
}: PublicPrintDetailsSectionProps) {
  const handleArtworkUpload = (files: FileList | null) => {
    if (!files) return
    const additions: PublicArtworkFileFormValues[] = []
    for (const file of Array.from(files)) {
      const validation = validateArtworkFile(file)
      if (!validation.valid) continue
      additions.push({
        id: localId('artwork'),
        fileName: file.name,
        fileType: validation.fileType!,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        file,
      })
    }
    if (additions.length > 0) onArtworkFilesChange([...artworkFiles, ...additions])
  }

  const removeArtwork = (id: string) => {
    onArtworkFilesChange(artworkFiles.filter((a) => a.id !== id))
    onPrintSpecsChange(printSpecs.map((p) => (p.artworkFileId === id ? { ...p, artworkFileId: null } : p)))
  }

  const activeIndex = printSpecs.findIndex((p) => p.id === activeSpecId)
  const spec = activeIndex >= 0 ? printSpecs[activeIndex] : undefined

  const activeView = spec ? getPositionView(spec.position as PrintPosition) : 'Front'
  const frontEntries = printSpecs.filter((p) => getPositionView(p.position as PrintPosition) === 'Front').map((p) => ({ id: p.id, label: p.position }))
  const backEntries = printSpecs.filter((p) => getPositionView(p.position as PrintPosition) === 'Back').map((p) => ({ id: p.id, label: p.position }))

  const updateSpec = (patch: Partial<PublicPrintSpecFormValues>) => {
    if (activeIndex < 0) return
    onPrintSpecsChange(printSpecs.map((p, i) => (i === activeIndex ? { ...p, ...patch } : p)))
  }

  const handleAddPrintSpec = () => {
    const fallback = ALL_PRINT_POSITIONS.find((p) => getPositionView(p.position) === activeView) ?? ALL_PRINT_POSITIONS[0]
    const newSpec = { ...emptyPublicPrintSpec(effectiveGarmentType, effectiveColour), position: fallback.position }
    onPrintSpecsChange([...printSpecs, newSpec])
    onActiveSpecIdChange(newSpec.id)
  }

  const handleRemovePrintSpec = (id: string) => {
    const remaining = printSpecs.filter((p) => p.id !== id)
    onPrintSpecsChange(remaining)
    if (activeSpecId === id) onActiveSpecIdChange(remaining[0]?.id ?? '')
  }

  const handleViewChange = (view: 'Front' | 'Back') => {
    const entries = view === 'Front' ? frontEntries : backEntries
    if (entries.length > 0 && !entries.some((e) => e.id === activeSpecId)) onActiveSpecIdChange(entries[0].id)
  }

  const handleSizePreset = (widthMm: number, aspectRatio: number | null) => {
    updateSpec({ widthMm, heightMm: heightMmFromWidth(widthMm, aspectRatio ?? 1) })
  }

  const artwork = spec ? artworkFiles.find((a) => a.id === spec.artworkFileId) : undefined
  const supported = spec ? isPrintPositionSupported(effectiveGarmentType as GarmentType, spec.position as PrintPosition) : false
  const activePreset = spec ? matchPrintSizePreset(spec.widthMm) : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-zinc-700">Artwork</p>
        <p className="mb-3 text-xs text-zinc-400">Upload your logo or design files — we&rsquo;ll use these for your print locations below.</p>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-zinc-300 p-6 text-center hover:border-brand-accent">
          <Upload size={20} className="text-zinc-400" />
          <span className="text-sm font-medium text-zinc-600">Upload artwork</span>
          <span className="text-xs text-zinc-400">PNG, JPG, WEBP, SVG, PDF, AI — up to 25MB each</span>
          <input type="file" multiple className="hidden" onChange={(e) => handleArtworkUpload(e.target.files)} />
        </label>
        {artworkError && <p className="mt-1.5 text-xs font-medium text-danger">{artworkError}</p>}

        {artworkFiles.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {artworkFiles.map((a) => (
              <div key={a.id} className="relative rounded-md border border-zinc-200 p-2">
                <button
                  type="button"
                  onClick={() => removeArtwork(a.id)}
                  className="absolute right-1 top-1 rounded-full bg-white p-1 text-zinc-400 shadow hover:text-danger"
                  aria-label={`Remove ${a.fileName}`}
                >
                  <Trash2 size={12} />
                </button>
                <div className="mb-1 flex h-16 items-center justify-center overflow-hidden rounded bg-zinc-50">
                  {a.previewUrl ? (
                    <img src={a.previewUrl} alt={a.fileName} className="h-full w-full object-contain" />
                  ) : (
                    <ImageOffIcon size={16} className="text-zinc-300" />
                  )}
                </div>
                <p className="truncate text-[11px] text-zinc-500">{a.fileName}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="border-zinc-100" />

      <div>
        <p className="mb-1.5 text-sm font-medium text-zinc-700">Print Details</p>
        <p className="mb-3 text-xs text-zinc-400">One entry per print — position, artwork, and size — with a live preview of where it lands.</p>

        {printSpecs.length === 0 || !spec ? (
          <p className="text-xs text-zinc-400">Select a garment above to add a print location.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <PrintSpecTabs
              view={activeView}
              onViewChange={handleViewChange}
              frontEntries={frontEntries}
              backEntries={backEntries}
              activeId={activeSpecId}
              onSelect={onActiveSpecIdChange}
              onAdd={handleAddPrintSpec}
              onRemove={handleRemovePrintSpec}
              canRemove={printSpecs.length > 1}
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="order-1 flex flex-col gap-4">
                <div>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500">PRINT POSITION</p>
                  <PrintPositionButtons
                    value={spec.position as PrintPosition}
                    onChange={(position) => updateSpec({ position })}
                    isSupported={(position) => isPrintPositionSupported(effectiveGarmentType as GarmentType, position)}
                    unsupportedTitle={() => `${effectiveGarmentType || 'This garment'} doesn't support this position yet`}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500">ARTWORK FOR THIS PRINT</p>
                  <ArtworkSelector files={artworkFiles} selectedId={spec.artworkFileId} onSelect={(id) => updateSpec({ artworkFileId: id ?? null })} />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500">PRINT SIZE</p>
                  <PrintSizePresetButtons activeKey={activePreset} onSelect={(widthMm) => handleSizePreset(widthMm, spec.widthMm / spec.heightMm)} />
                </div>
              </div>

              {/* GarmentPreview — always rendered as part of the normal
                  section layout, full width on mobile, never behind a
                  reveal button/toggle. */}
              <div className="order-2 flex flex-col items-center gap-2 lg:row-span-2">
                <div className="flex w-full items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  {supported && effectiveGarmentType ? (
                    <GarmentMockup
                      garmentType={effectiveGarmentType as GarmentType}
                      colour={effectiveColour}
                      view={activeView}
                      position={spec.position as PrintPosition}
                      artworkUrl={artwork?.previewUrl}
                      widthMm={spec.widthMm}
                      heightMm={spec.heightMm}
                      size={260}
                    />
                  ) : (
                    <div className="flex h-64 w-52 flex-col items-center justify-center gap-1.5 text-center text-zinc-400">
                      <ImageOffIcon size={20} />
                      <p className="text-xs">
                        {effectiveGarmentType
                          ? `${effectiveGarmentType} doesn't support this print position yet — choose another.`
                          : 'Select a garment to see the preview.'}
                      </p>
                    </div>
                  )}
                </div>
                {artwork && supported && (
                  <p className="text-center text-[11px] text-zinc-400">Positioned and sized automatically for this print position.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {printSpecs.length === 0 && effectiveGarmentType && (
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={handleAddPrintSpec}>
            Add Print Location
          </Button>
        )}
      </div>
    </div>
  )
}

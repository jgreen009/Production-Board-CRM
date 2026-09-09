import { AlignCenterHorizontal, AlignCenterVertical, RotateCcw } from 'lucide-react'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

interface TransformControlsProps {
  widthMm: number
  heightMm: number
  rotationDeg: number
  onWidthChange: (widthMm: number) => void
  overflowing: boolean
  disabled: boolean
  onCenterHorizontally: () => void
  onCenterVertically: () => void
  onResetPosition: () => void
  onResetRotation: () => void
  onResetSize: () => void
}

// Batch A §"Accessibility": every canvas-driven transform also has a plain
// form control here, so canvas interaction is never the only way to set a
// value — width, rotation display, and every center/reset action all work
// without touching the canvas at all.
export function TransformControls({
  widthMm,
  heightMm,
  rotationDeg,
  onWidthChange,
  overflowing,
  disabled,
  onCenterHorizontally,
  onCenterVertically,
  onResetPosition,
  onResetRotation,
  onResetSize,
}: TransformControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Print Width (mm)" htmlFor="print-width-mm">
          <Input
            id="print-width-mm"
            type="number"
            min={1}
            value={widthMm}
            disabled={disabled}
            onChange={(e) => onWidthChange(Number(e.target.value) || 1)}
          />
        </FormField>
        <FormField label="Print Height (mm)" hint="Derived from artwork aspect ratio">
          <Input value={Math.round(heightMm * 10) / 10} disabled readOnly />
        </FormField>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-500">ROTATION</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-600">{Math.round(rotationDeg)}°</span>
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onResetRotation}>
            <RotateCcw size={13} /> Reset Rotation
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-500">PLACEMENT</p>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onCenterHorizontally}>
            <AlignCenterHorizontal size={13} /> Center Horizontally
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onCenterVertically}>
            <AlignCenterVertical size={13} /> Center Vertically
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onResetPosition}>
            Reset Position
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onResetSize}>
            Reset Size
          </Button>
        </div>
      </div>

      {overflowing && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
          Artwork extends beyond the recommended print area for this position. Staff may still save this placement.
        </p>
      )}
    </div>
  )
}

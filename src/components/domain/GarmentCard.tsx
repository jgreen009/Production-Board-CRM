import { Trash2 } from 'lucide-react'
import type { GarmentFormValues } from '@/schemas/orderFormSchema'
import { GARMENT_TYPES, GARMENT_BRANDS } from '@/data/mockGarments'
import { ADULT_SIZES, YOUTH_SIZES } from '@/types'
import { SizeQuantityGrid } from '@/components/domain/SizeQuantityGrid'
import { FormField, Input, Select } from '@/components/ui/Field'
import { garmentTotal } from '@/utils/quantity'
import { clsx } from 'clsx'

interface GarmentCardProps {
  garment: GarmentFormValues
  index: number
  canRemove: boolean
  onChange: (garment: GarmentFormValues) => void
  onRemove: () => void
  colourError?: string
}

export function GarmentCard({ garment, index, canRemove, onChange, onRemove, colourError }: GarmentCardProps) {
  const total = garmentTotal({
    id: garment.id,
    type: garment.type as never,
    brand: garment.brand as never,
    colour: garment.colour,
    sizing: garment.sizing,
    adultQuantities: garment.adultQuantities,
    youthQuantities: garment.youthQuantities,
  })

  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-700">Garment {index + 1}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">Total: {total}</span>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Remove garment"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Garment Type">
          <Select
            value={garment.type}
            onChange={(e) => onChange({ ...garment, type: e.target.value })}
          >
            {GARMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Brand">
          <Select
            value={garment.brand}
            onChange={(e) => onChange({ ...garment, brand: e.target.value })}
          >
            {GARMENT_BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Colour" error={colourError}>
          <Input
            value={garment.colour}
            onChange={(e) => onChange({ ...garment, colour: e.target.value })}
            placeholder="e.g. Navy"
            error={colourError}
          />
        </FormField>
      </div>

      <div className="mt-3 flex gap-1.5">
        {(['Adult', 'Youth'] as const).map((sizing) => (
          <button
            key={sizing}
            type="button"
            onClick={() => onChange({ ...garment, sizing })}
            className={clsx(
              'rounded-md border px-3 py-1 text-xs font-medium',
              garment.sizing === sizing
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300',
            )}
          >
            {sizing} Sizing
          </button>
        ))}
      </div>

      <div className="mt-3">
        {garment.sizing === 'Adult' ? (
          <>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">ADULT SIZES</p>
            <SizeQuantityGrid
              idPrefix={`garment-${garment.id}-adult`}
              sizes={ADULT_SIZES}
              values={garment.adultQuantities}
              onChange={(size, qty) =>
                onChange({ ...garment, adultQuantities: { ...garment.adultQuantities, [size]: qty } })
              }
            />
            <p className="mt-1.5 text-xs text-amber-600">
              Extra cost applies to sizes 3XL–7XL.
            </p>
          </>
        ) : (
          <>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">YOUTH SIZES</p>
            <SizeQuantityGrid
              idPrefix={`garment-${garment.id}-youth`}
              sizes={YOUTH_SIZES}
              values={garment.youthQuantities}
              onChange={(size, qty) =>
                onChange({ ...garment, youthQuantities: { ...garment.youthQuantities, [size]: qty } })
              }
            />
          </>
        )}
      </div>
    </div>
  )
}

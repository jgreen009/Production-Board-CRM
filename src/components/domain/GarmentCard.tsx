import { Trash2 } from 'lucide-react'
import { ADULT_SIZES, YOUTH_SIZES } from '@/types'
import { SizeQuantityGrid } from '@/components/domain/SizeQuantityGrid'
import { FormField, Input, Select } from '@/components/ui/Field'
import { garmentTotal } from '@/utils/quantity'
import { selectableCatalogNames } from '@/utils/catalog'
import { SupplierLink } from '@/components/domain/SupplierLink'
import { clsx } from 'clsx'

// A minimal, generic shape — not the staff-only GarmentFormValues
// (orderFormSchema) — so this component stays reusable by the public
// order form, whose garment state is shaped slightly differently
// (publicOrderFormSchema) but satisfies this same structural shape.
export interface GarmentCardValues {
  id: string
  type: string
  brand: string
  colour: string
  sizing: 'Adult' | 'Youth'
  adultQuantities: Record<string, number>
  youthQuantities: Record<string, number>
}

export interface GarmentCatalogEntry {
  name: string
  active: boolean
  supplierUrl?: string
}

interface GarmentCardProps {
  garment: GarmentCardValues
  index: number
  canRemove: boolean
  onChange: (garment: GarmentCardValues) => void
  onRemove: () => void
  colourError?: string
  /** Live catalog data — fetched by the caller (staff: useGarmentTypesSettings/useGarmentBrandsSettings; public: the order-link Edge Function's validate response), never by this component itself, so it works the same whether the caller is authenticated or anonymous. */
  garmentTypes: GarmentCatalogEntry[]
  garmentBrands: GarmentCatalogEntry[]
}

export function GarmentCard({ garment, index, canRemove, onChange, onRemove, colourError, garmentTypes, garmentBrands }: GarmentCardProps) {
  const typeOptions = selectableCatalogNames(garmentTypes, garment.type)
  const brandOptions = selectableCatalogNames(garmentBrands, garment.brand)
  const selectedType = garmentTypes.find((t) => t.name === garment.type)

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
              className="rounded-md p-2 text-zinc-400 hover:bg-danger-soft hover:text-danger"
              aria-label="Remove garment"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FormField label="Garment Type" required>
          <Select
            value={garment.type}
            onChange={(e) => onChange({ ...garment, type: e.target.value })}
          >
            <option value="">Select…</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          {selectedType?.supplierUrl && (
            <div className="mt-1">
              <SupplierLink url={selectedType.supplierUrl} label="View Supplier Garment" />
            </div>
          )}
        </FormField>
        <FormField label="Brand" required>
          <Select
            value={garment.brand}
            onChange={(e) => onChange({ ...garment, brand: e.target.value })}
          >
            <option value="">Select…</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Colour" required error={colourError} className="col-span-2 sm:col-span-1">
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
              'min-h-9 rounded-md border px-3 py-1.5 text-xs font-medium',
              garment.sizing === sizing
                ? 'border-brand-accent bg-brand-accent-soft text-brand-accent'
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
            <p className="mt-1.5 text-xs text-warning">
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

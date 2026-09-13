import { useFieldArray, useFormContext } from 'react-hook-form'
import { Plus } from 'lucide-react'
import type { GarmentFormValues, OrderFormValues } from '@/schemas/orderFormSchema'
import { GarmentCard } from '@/components/domain/GarmentCard'
import { Button } from '@/components/ui/Button'
import { emptyGarment } from '@/pages/new-order/defaultValues'
import { orderSubTotal } from '@/utils/quantity'
import type { GarmentItem } from '@/types'
import { useGarmentBrandsSettings, useGarmentTypesSettings } from '@/hooks/useSettings'

export function GarmentsSection() {
  const {
    control,
    watch,
    setValue,
    formState: { errors, isSubmitted },
  } = useFormContext<OrderFormValues>()

  const { fields, append, remove } = useFieldArray({ control, name: 'garments' })
  const garments = watch('garments')
  // Fetched once here and passed down — GarmentCard itself no longer
  // calls these hooks directly, which is what lets the public order form
  // reuse the exact same component with its own (anonymous-safe) catalog
  // source instead.
  const { data: garmentTypes = [] } = useGarmentTypesSettings()
  const { data: garmentBrands = [] } = useGarmentBrandsSettings()

  const subTotal = orderSubTotal(
    garments.map(
      (g) =>
        ({
          id: g.id,
          type: g.type,
          brand: g.brand,
          colour: g.colour,
          sizing: g.sizing,
          adultQuantities: g.adultQuantities,
          youthQuantities: g.youthQuantities,
        }) as GarmentItem,
    ),
  )

  return (
    <div>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-700">Garments</p>
          <p className="text-xs text-zinc-400">One card per garment type, matching the paper form's adult and youth size tables.</p>
        </div>
        <span className="text-sm font-semibold text-zinc-700">
          Sub Total: <span className="text-zinc-900">{subTotal}</span>
        </span>
      </div>
      {errors.garments?.message && <p className="mb-2 text-xs font-medium text-danger">{errors.garments.message}</p>}

      <div className="flex flex-col gap-3">
        {fields.map((field, index) => (
          <GarmentCard
            key={field.id}
            garment={garments[index]}
            index={index}
            canRemove={fields.length > 1}
            // GarmentCard is deliberately typed against a generic
            // GarmentCardValues shape (Record<string, number> quantities)
            // so the public order form can reuse it too — this cast back
            // to the staff schema's stricter per-size-key shape is safe
            // because GarmentCard only ever spreads the original object
            // and sets one of the real ADULT_SIZES/YOUTH_SIZES keys.
            onChange={(updated) => setValue(`garments.${index}`, updated as GarmentFormValues)}
            onRemove={() => remove(index)}
            colourError={isSubmitted && !garments[index].colour.trim() ? 'Colour is required' : undefined}
            garmentTypes={garmentTypes}
            garmentBrands={garmentBrands}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3 w-full self-start sm:w-auto"
        onClick={() => append(emptyGarment())}
      >
        <Plus size={14} />
        Add Another Garment
      </Button>
    </div>
  )
}

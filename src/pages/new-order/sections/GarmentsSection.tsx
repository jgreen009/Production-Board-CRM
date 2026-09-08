import { useFieldArray, useFormContext } from 'react-hook-form'
import { Plus } from 'lucide-react'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { GarmentCard } from '@/components/domain/GarmentCard'
import { Button } from '@/components/ui/Button'
import { emptyGarment } from '@/pages/new-order/defaultValues'
import { orderSubTotal } from '@/utils/quantity'
import type { GarmentItem } from '@/types'

export function GarmentsSection() {
  const {
    control,
    watch,
    setValue,
    formState: { errors, isSubmitted },
  } = useFormContext<OrderFormValues>()

  const { fields, append, remove } = useFieldArray({ control, name: 'garments' })
  const garments = watch('garments')

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
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-700">Garments</p>
          <p className="text-xs text-zinc-400">One card per garment type, matching the paper form's adult and youth size tables.</p>
        </div>
        <span className="text-sm font-semibold text-zinc-700">
          Sub Total: <span className="text-zinc-900">{subTotal}</span>
        </span>
      </div>
      {errors.garments?.message && <p className="mb-2 text-xs text-red-600">{errors.garments.message}</p>}

      <div className="flex flex-col gap-3">
        {fields.map((field, index) => (
          <GarmentCard
            key={field.id}
            garment={garments[index]}
            index={index}
            canRemove={fields.length > 1}
            onChange={(updated) => setValue(`garments.${index}`, updated)}
            onRemove={() => remove(index)}
            colourError={isSubmitted && !garments[index].colour.trim() ? 'Colour is required' : undefined}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3 self-start"
        onClick={() => append(emptyGarment())}
      >
        <Plus size={14} />
        Add Another Garment
      </Button>
    </div>
  )
}

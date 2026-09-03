import { useFieldArray, useFormContext } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type { PrintPosition } from '@/types'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { emptyPrintDetail } from '@/pages/new-order/defaultValues'
import { PRINT_POSITIONS, getPrintPositionConfig } from '@/data/printPositions'

export function PrintDetailsSection() {
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>()

  const { fields, append, remove } = useFieldArray({ control, name: 'printDetails' })
  const printDetails = watch('printDetails')

  return (
    <OrderFormSection
      step={8}
      title="Print Details"
      description="A repeating list of print specs across front and back — a job can have several."
    >
      {errors.printDetails?.message && <p className="text-xs text-red-600">{errors.printDetails.message}</p>}

      <div className="flex flex-col gap-3">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 p-3 sm:grid-cols-5 sm:items-end">
            <FormField label="Position">
              <Select
                value={printDetails[index].position}
                onChange={(e) => {
                  const config = getPrintPositionConfig(e.target.value as PrintPosition)
                  setValue(`printDetails.${index}.position`, config.value)
                  if (config.sizePreset) {
                    setValue(`printDetails.${index}.widthMm`, config.sizePreset.widthMm)
                    setValue(`printDetails.${index}.heightMm`, config.sizePreset.heightMm)
                  }
                }}
              >
                {PRINT_POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Colour">
              <Input
                value={printDetails[index].colour}
                onChange={(e) => setValue(`printDetails.${index}.colour`, e.target.value)}
                placeholder="e.g. White, Gold"
              />
            </FormField>
            <FormField label="Width (mm)">
              <Input
                type="number"
                min={0}
                value={printDetails[index].widthMm}
                onChange={(e) => setValue(`printDetails.${index}.widthMm`, Number(e.target.value) || 0)}
              />
            </FormField>
            <FormField label="Height (mm)">
              <Input
                type="number"
                min={0}
                value={printDetails[index].heightMm}
                onChange={(e) => setValue(`printDetails.${index}.heightMm`, Number(e.target.value) || 0)}
              />
            </FormField>
            <button
              type="button"
              disabled={fields.length <= 1}
              onClick={() => remove(index)}
              className="col-span-2 flex h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-200 text-sm text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 sm:col-span-1"
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => append(emptyPrintDetail())}>
        <Plus size={14} /> Add Print Spec
      </Button>
    </OrderFormSection>
  )
}

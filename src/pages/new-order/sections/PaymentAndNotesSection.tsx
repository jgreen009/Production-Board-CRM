import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { FormField, Select, Textarea } from '@/components/ui/Field'
import { PAYMENT_STATUSES } from '@/data/mockStatuses'

export function PaymentAndNotesSection() {
  const { register, watch, setValue } = useFormContext<OrderFormValues>()

  return (
    <>
      <OrderFormSection step={6} title="Payment Status" description="Tracking only — no checkout is processed in this phase.">
        <FormField label="Payment Status" htmlFor="paymentStatus">
          <Select
            id="paymentStatus"
            value={watch('paymentStatus')}
            onChange={(e) => setValue('paymentStatus', e.target.value as OrderFormValues['paymentStatus'])}
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </FormField>
      </OrderFormSection>

      <OrderFormSection step={7} title="Internal Notes">
        <FormField label="Production Notes" htmlFor="productionNotes" hint="Visible to staff managing this order.">
          <Textarea id="productionNotes" rows={3} {...register('productionNotes')} />
        </FormField>
        <FormField label="Customer Notes" htmlFor="notes" hint="Matches the paper form's single Notes box — visible on the order form.">
          <Textarea id="notes" rows={3} {...register('notes')} />
        </FormField>

        <label
          htmlFor="staffCompleted"
          className="flex items-center gap-2.5 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm cursor-pointer"
        >
          <input
            id="staffCompleted"
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20"
            {...register('staffCompleted')}
          />
          <span className="font-medium text-zinc-600">Section for staff — Completed</span>
        </label>
      </OrderFormSection>
    </>
  )
}

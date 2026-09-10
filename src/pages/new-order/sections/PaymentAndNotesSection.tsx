import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { AssigneeSelector } from '@/components/domain/AssigneeSelector'
import { Checkbox, FormField, Select, Textarea } from '@/components/ui/Field'
import { PAYMENT_STATUSES } from '@/data/mockStatuses'

interface PaymentAndNotesSectionProps {
  // Only present in edit-active mode — lets the AssigneeSelector show a
  // now-inactive current assignee's name instead of silently dropping it.
  currentAssigneeName?: string | null
  currentAssigneeActive?: boolean
}

export function PaymentAndNotesSection({ currentAssigneeName, currentAssigneeActive }: PaymentAndNotesSectionProps) {
  const { register, watch, setValue } = useFormContext<OrderFormValues>()

  return (
    <>
      <OrderFormSection step={6} title="Payment Status" description="Tracking only — no checkout is processed in this phase.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <FormField label="Assigned To" htmlFor="assignedTo" hint="Optional — the staff member responsible for this order.">
            <AssigneeSelector
              id="assignedTo"
              value={watch('assignedTo')}
              onChange={(id) => setValue('assignedTo', id)}
              currentAssigneeName={currentAssigneeName}
              currentAssigneeActive={currentAssigneeActive}
            />
          </FormField>
        </div>
      </OrderFormSection>

      <OrderFormSection step={7} title="Internal Notes">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Production Notes" htmlFor="productionNotes" hint="Visible to staff managing this order.">
            <Textarea id="productionNotes" rows={3} {...register('productionNotes')} />
          </FormField>
          <FormField label="Customer Notes" htmlFor="notes" hint="Matches the paper form's single Notes box — visible on the order form.">
            <Textarea id="notes" rows={3} {...register('notes')} />
          </FormField>
        </div>

        <Checkbox
          id="staffCompleted"
          label="Section for staff — Completed"
          {...register('staffCompleted')}
        />
      </OrderFormSection>
    </>
  )
}

import { User } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { FormField, Input } from '@/components/ui/Field'

export function CustomerJobSection() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>()

  // Plain manual entry — no customer search/autocomplete any more (staff
  // feedback: typing here should never trigger a lookup or suggestion
  // list). customerId stays null; newCustomerName mirrors the typed name
  // so the existing "customerId set OR newCustomerName non-empty" schema
  // rule (a customer record still gets created from this name on save)
  // is satisfied without any picker UI. Phone/email are no longer
  // auto-filled from a matched customer, since there's no longer a match
  // to auto-fill from — staff enter them directly, same as any other field.
  const jobName = watch('jobName') ?? ''
  const handleNameChange = (value: string) => {
    setValue('jobName', value)
    setValue('newCustomerName', value)
    setValue('customerId', null)
  }

  return (
    <OrderFormSection step={2} title="Customer / Job">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Name"
          required
          htmlFor="jobName"
          error={errors.jobName?.message || errors.newCustomerName?.message}
        >
          <div className="relative">
            <User size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              id="jobName"
              value={jobName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Customer or job name"
              className="pl-8"
            />
          </div>
        </FormField>
        <FormField label="Phone" required htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" placeholder="04xx xxx xxx" {...register('phone')} />
        </FormField>
        <FormField label="Email" required htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" placeholder="name@company.com.au" {...register('email')} />
        </FormField>
        <FormField label="Due Date" required htmlFor="dueDate" error={errors.dueDate?.message}>
          <Input id="dueDate" type="date" {...register('dueDate')} />
        </FormField>
      </div>
    </OrderFormSection>
  )
}

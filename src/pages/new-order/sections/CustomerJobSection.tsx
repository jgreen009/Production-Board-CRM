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

  const name = watch('jobName')

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
          <Input
            id="jobName"
            placeholder="e.g. Home Jersey Reprint"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
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

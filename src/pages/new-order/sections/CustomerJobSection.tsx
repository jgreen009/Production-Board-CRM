import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { CustomerSelector } from '@/components/domain/CustomerSelector'
import { FormField, Input } from '@/components/ui/Field'
import type { Customer } from '@/types'

export function CustomerJobSection() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>()

  const customerId = watch('customerId')
  const newCustomerName = watch('newCustomerName') ?? ''
  const jobName = watch('jobName')

  const handleSelectCustomer = (customer: Customer) => {
    setValue('customerId', customer.id)
    setValue('newCustomerName', '')
    setValue('email', customer.email)
    setValue('phone', customer.phone)
    if (!jobName) setValue('jobName', customer.company || customer.name)
  }

  const handleCreateNew = (name: string) => {
    setValue('customerId', null)
    setValue('newCustomerName', name)
    if (!jobName) setValue('jobName', name)
  }

  const handleClear = () => {
    setValue('customerId', null)
    setValue('newCustomerName', '')
  }

  return (
    <OrderFormSection
      step={2}
      title="Customer / Job"
      description="Search for a repeat customer or create a new one — this replaces the paper form's single Name/Job field."
    >
      <FormField label="Customer" required error={errors.newCustomerName?.message}>
        <CustomerSelector
          customerId={customerId}
          newCustomerName={newCustomerName}
          onSelectCustomer={handleSelectCustomer}
          onCreateNew={handleCreateNew}
          onClear={handleClear}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Job Name" required htmlFor="jobName" error={errors.jobName?.message} hint="Defaults to the customer name if left blank.">
          <Input id="jobName" placeholder="e.g. Home Jersey Reprint" {...register('jobName')} />
        </FormField>
        <FormField label="Order Date" htmlFor="orderDate">
          <Input id="orderDate" type="date" {...register('orderDate')} />
        </FormField>
        <FormField label="Email" required htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" placeholder="name@company.com.au" {...register('email')} />
        </FormField>
        <FormField label="Phone" required htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" placeholder="04xx xxx xxx" {...register('phone')} />
        </FormField>
        <FormField label="Due Date" required htmlFor="dueDate" error={errors.dueDate?.message}>
          <Input id="dueDate" type="date" {...register('dueDate')} />
        </FormField>
      </div>
    </OrderFormSection>
  )
}

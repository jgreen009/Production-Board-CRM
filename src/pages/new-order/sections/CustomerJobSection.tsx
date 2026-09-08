import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type { Customer } from '@/types'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { CustomerSelector } from '@/components/domain/CustomerSelector'
import { FormField, Input } from '@/components/ui/Field'

export function CustomerJobSection() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>()

  const customerId = watch('customerId')
  const newCustomerName = watch('newCustomerName') ?? ''
  // Holds the full selected Customer (name/company for display) — the form
  // field itself only stores customerId, so this is purely presentational,
  // reset whenever the picker is cleared or a different one is selected.
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const handleSelectCustomer = (customer: Customer) => {
    setValue('customerId', customer.id)
    setValue('newCustomerName', '')
    setValue('jobName', customer.company || customer.name)
    setValue('email', customer.email)
    setValue('phone', customer.phone)
    setSelectedCustomer(customer)
  }

  const handleCreateNew = (name: string) => {
    setValue('customerId', null)
    setValue('newCustomerName', name)
    setValue('jobName', name)
    setSelectedCustomer(null)
  }

  const handleClear = () => {
    setValue('customerId', null)
    setValue('newCustomerName', '')
    setSelectedCustomer(null)
  }

  return (
    <OrderFormSection step={2} title="Customer / Job">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Name"
          required
          error={errors.jobName?.message || errors.newCustomerName?.message}
        >
          <CustomerSelector
            customerId={customerId}
            newCustomerName={newCustomerName}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={handleSelectCustomer}
            onCreateNew={handleCreateNew}
            onClear={handleClear}
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

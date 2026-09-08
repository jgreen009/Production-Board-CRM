import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type { Customer } from '@/types'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { CustomerSelector } from '@/components/domain/CustomerSelector'
import { FormField, Input } from '@/components/ui/Field'
import { useCreateCustomer } from '@/hooks/useCustomers'
import { useToast } from '@/components/ui/toast-context'
import { staffErrorMessage } from '@/utils/errorMessage'

export function CustomerJobSection() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>()
  const { showToast } = useToast()
  const createCustomer = useCreateCustomer()

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

  // Inserts into customers immediately (never a client-generated fake id —
  // per spec §9/plan §11, the real UUID is what ends up on orders.customer_id).
  // Never fuzzy-matches or dedupes an existing name — an exact duplicate
  // creating a second customer row is accepted, not a bug, per the same
  // section.
  const handleCreateNew = async (name: string) => {
    setValue('jobName', name)
    try {
      const customer = await createCustomer.mutateAsync({ name })
      handleSelectCustomer(customer)
    } catch (err) {
      showToast(staffErrorMessage(err, 'Failed to create customer'), 'info')
    }
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

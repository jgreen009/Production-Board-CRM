import { useState } from 'react'
import type { Customer } from '@/types'
import { useCreateCustomer } from '@/hooks/useCustomers'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'

interface AddCustomerDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (customer: Customer) => void
}

export function AddCustomerDialog({ open, onClose, onCreated }: AddCustomerDialogProps) {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const { mutateAsync, isPending, error } = useCreateCustomer()

  if (!open) return null

  const reset = () => {
    setName('')
    setCompany('')
    setEmail('')
    setPhone('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    const customer = await mutateAsync({ name: name.trim(), company, email, phone })
    onCreated?.(customer)
    reset()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40" onClick={handleClose} />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-zinc-900">Add Customer</h3>

        <div className="mt-4 flex flex-col gap-3">
          <FormField label="Name" required htmlFor="new-customer-name">
            <Input id="new-customer-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Company" htmlFor="new-customer-company">
            <Input id="new-customer-company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </FormField>
          <FormField label="Email" htmlFor="new-customer-email">
            <Input id="new-customer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Phone" htmlFor="new-customer-phone">
            <Input id="new-customer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
          {error && <p className="text-sm text-red-600">{error instanceof Error ? error.message : 'Failed to create customer'}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!name.trim() || isPending} onClick={handleSubmit}>
            {isPending ? 'Creating...' : 'Create Customer'}
          </Button>
        </div>
      </div>
    </div>
  )
}

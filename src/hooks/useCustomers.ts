import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomerNotes,
} from '@/api/customers'
import type { CreateCustomerInput } from '@/api/customers'

export function useCustomers() {
  return useQuery({ queryKey: ['customers'], queryFn: listCustomers })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => getCustomer(id!),
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCustomerInput) => createCustomer(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateCustomerNotes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => updateCustomerNotes(id, notes),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['customers', id] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

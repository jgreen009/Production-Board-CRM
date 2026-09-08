import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCustomer,
  getCustomer,
  listCustomers,
  searchCustomers,
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

// Debounced ~250ms so fast typing doesn't fire a request per keystroke.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

export function useCustomerSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query, 250)
  return useQuery({
    queryKey: ['customers', 'search', debouncedQuery],
    queryFn: () => searchCustomers(debouncedQuery),
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

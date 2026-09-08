import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { globalSearch } from '@/api/search'

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

export function useGlobalSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query, 250)
  return useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => globalSearch(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
  })
}

import { useQuery } from '@tanstack/react-query'
import { listActiveStaff } from '@/api/staff'

export function useActiveStaff() {
  return useQuery({ queryKey: ['active-staff'], queryFn: listActiveStaff })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createUser,
  listUsers,
  resetUserPassword,
  setUserActive,
  setUserRole,
  updateUserName,
} from '@/api/adminUsers'

const USERS_KEY = ['admin-users']

export function useUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: listUsers })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useUpdateUserName() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fullName }: { id: string; fullName: string }) => updateUserName(id, fullName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useSetUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'admin' | 'staff' }) => setUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useSetUserActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setUserActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (id: string) => resetUserPassword(id),
  })
}

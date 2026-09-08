import { useQuery } from '@tanstack/react-query'
import { getProfile } from '@/api/auth'
import { useSession } from '@/hooks/useSession'

export function useProfile() {
  const { session } = useSession()
  const userId = session?.user.id

  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
  })
}

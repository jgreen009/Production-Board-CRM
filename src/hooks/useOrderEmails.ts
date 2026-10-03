import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listOrderEmails, requestOrderEmail } from '@/api/orderEmails'
import type { OrderEmailType } from '@/api/orderEmails'

export function useOrderEmails(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order-emails', orderId],
    queryFn: () => listOrderEmails(orderId!),
    enabled: !!orderId,
  })
}

export function useRequestOrderEmail(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ emailType, retry }: { emailType: OrderEmailType; retry: boolean }) =>
      requestOrderEmail(orderId, emailType, retry),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['order-emails', orderId] }),
  })
}

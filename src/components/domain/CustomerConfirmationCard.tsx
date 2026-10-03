import { useEffect } from 'react'
import { BadgeCheck } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/toast-context'
import { orderEmailErrorMessage } from '@/api/orderEmails'
import { useRequestOrderEmail } from '@/hooks/useOrderEmails'
import { useConfirmationRecords, useReconcileConfirmation } from '@/hooks/useOrderConfirmations'
import { CONFIRMATION_BADGE_CLASS, CONFIRMATION_LABEL, confirmationDisplayFor } from '@/utils/orderConfirmation'
import { formatDateTime } from '@/utils/date'
import { staffErrorMessage } from '@/utils/errorMessage'
import { clsx } from 'clsx'

// Approval state only. Delivery history lives in the Customer Email card above.
export function CustomerConfirmationCard({ orderId, isPublicOrder }: { orderId: string; isPublicOrder: boolean }) {
  const { data: byOrder = {}, isLoading } = useConfirmationRecords()
  const reconcile = useReconcileConfirmation(orderId)
  const request = useRequestOrderEmail(orderId)
  const { showToast } = useToast()
  const { mutate: reconcileNow } = reconcile

  // Brings the stored state up to date when staff open the order, so a
  // customer-visible edit made elsewhere is reflected here.
  useEffect(() => {
    reconcileNow()
  }, [orderId, reconcileNow])

  const display = confirmationDisplayFor(byOrder[orderId] ?? [])

  const sendConfirmation = () => {
    request.mutate(
      { emailType: 'staff_order_summary', retry: false },
      {
        onSuccess: (result) => {
          if (result.status === 'sent') showToast('Confirmation email sent to the customer.', 'success')
          else if (result.status === 'failed') showToast(orderEmailErrorMessage(result.errorCategory), 'info')
          else if (result.status === 'skipped' && result.reason === 'already_confirmed') {
            showToast('The customer has already confirmed this order.', 'info')
          }
        },
        onError: (err) => showToast(staffErrorMessage(err, 'Failed to send the confirmation email'), 'info'),
      },
    )
  }

  const canSend = display.state === 'not_sent' || display.state === 'needs_reconfirmation'
  const sendLabel = display.state === 'needs_reconfirmation' ? 'Send Updated Confirmation' : isPublicOrder ? 'Send Confirmation' : 'Send Confirmation Email'

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <BadgeCheck size={14} className="text-zinc-400" /> Customer Confirmation
        </h3>
        {!isLoading && (
          <span className={clsx('rounded-full border px-2.5 py-0.5 text-xs font-medium', CONFIRMATION_BADGE_CLASS[display.state])}>
            {CONFIRMATION_LABEL[display.state]}
          </span>
        )}
      </CardHeader>
      <CardBody className="flex flex-col gap-3 text-sm">
        {display.state === 'confirmed' && (
          <p className="text-zinc-700">
            Confirmed by <span className="font-medium">{display.customerEmail}</span>
            <span className="block text-xs text-zinc-500">{formatDateTime(display.confirmedAt)}</span>
          </p>
        )}
        {display.state === 'awaiting' && (
          <p className="text-zinc-700">
            Confirmation email sent {formatDateTime(display.sentAt)}. Waiting for the customer to review.
          </p>
        )}
        {display.state === 'needs_reconfirmation' && (
          <p className="text-zinc-700">
            The order has changed since the customer last confirmed it. Send an updated confirmation so they can review the current details.
          </p>
        )}
        {display.state === 'not_sent' && (
          <p className="text-zinc-500">
            {isPublicOrder
              ? 'The customer submitted this order themselves. Send a confirmation only if you want them to approve it.'
              : 'No confirmation request has been sent yet.'}
          </p>
        )}
        {canSend && (
          <div>
            <Button variant="primary" size="sm" disabled={request.isPending} onClick={sendConfirmation}>
              {sendLabel}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

import { Mail } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/toast-context'
import { latestAttemptByType, orderEmailErrorMessage } from '@/api/orderEmails'
import type { OrderEmailRecord, OrderEmailType } from '@/api/orderEmails'
import { useOrderEmails, useRequestOrderEmail } from '@/hooks/useOrderEmails'
import { formatDateTime } from '@/utils/date'
import { staffErrorMessage } from '@/utils/errorMessage'

const TYPE_LABEL: Record<OrderEmailType, string> = {
  staff_order_summary: 'Order summary (with confirmation link)',
  customer_order_receipt: 'Order request receipt',
}

export function OrderEmailStatus({ orderId, isPublicOrder }: { orderId: string; isPublicOrder: boolean }) {
  const { data: records = [], isLoading } = useOrderEmails(orderId)
  const requestEmail = useRequestOrderEmail(orderId)
  const { showToast } = useToast()
  const latest = latestAttemptByType(records)

  const types: OrderEmailType[] = isPublicOrder
    ? ['customer_order_receipt', 'staff_order_summary']
    : ['staff_order_summary']

  const send = (emailType: OrderEmailType, retry: boolean) => {
    requestEmail.mutate(
      { emailType, retry },
      {
        onSuccess: (result) => {
          if (result.status === 'sent') showToast('Customer email sent.', 'success')
          else if (result.status === 'failed') showToast(orderEmailErrorMessage(result.errorCategory), 'info')
          else if (result.status === 'skipped') showToast('That email has already been sent.', 'info')
        },
        onError: (err) => showToast(staffErrorMessage(err, 'Failed to send the email'), 'info'),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <Mail size={14} className="text-zinc-400" /> Customer Email
        </h3>
      </CardHeader>
      <CardBody className="flex flex-col gap-3 text-sm">
        {isLoading ? (
          <p className="text-xs text-zinc-400">Loading…</p>
        ) : (
          types.map((type) => (
            <EmailRow
              key={type}
              label={TYPE_LABEL[type]}
              record={latest[type]}
              busy={requestEmail.isPending}
              onSend={() => send(type, !!latest[type])}
            />
          ))
        )}
      </CardBody>
    </Card>
  )
}

function EmailRow({
  label,
  record,
  busy,
  onSend,
}: {
  label: string
  record: OrderEmailRecord | undefined
  busy: boolean
  onSend: () => void
}) {
  const canSend = !record || record.status === 'failed' || record.status === 'bounced'

  return (
    <div className="flex flex-col gap-1 rounded-md border border-zinc-100 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        {canSend && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={onSend}>
            {!record ? 'Send' : 'Resend Email'}
          </Button>
        )}
      </div>
      {!record && <p className="text-zinc-400">Not sent yet.</p>}
      {record?.status === 'sent' || record?.status === 'delivered' ? (
        <p className="text-zinc-700">
          Sent to <span className="font-medium">{record.recipient}</span>
          {record.sentAt ? ` · ${formatDateTime(record.sentAt)}` : ''}
        </p>
      ) : null}
      {record?.status === 'queued' && <p className="text-zinc-500">Sending…</p>}
      {record && (record.status === 'failed' || record.status === 'bounced') && (
        <p className="text-danger">
          {record.status === 'bounced' ? 'Bounced' : 'Failed to send'}
          {record.recipient ? ` to ${record.recipient}` : ''}
          {record.failedAt ? ` · ${formatDateTime(record.failedAt)}` : ''}
          <span className="mt-0.5 block text-xs text-zinc-500">{orderEmailErrorMessage(record.errorMessage)}</span>
        </p>
      )}
    </div>
  )
}

import { Badge } from '@/components/ui/Badge'
import { CONFIRMATION_BADGE_CLASS, CONFIRMATION_LABEL, type ConfirmationDisplay } from '@/utils/orderConfirmation'

// Compact list-row badge. Public-form orders show nothing until staff have
// actually requested a confirmation, so they never look like they are waiting
// on an approval that was never intended.
export function OrderConfirmationBadge({
  display,
  isPublicOrder,
}: {
  display: ConfirmationDisplay
  isPublicOrder: boolean
}) {
  if (isPublicOrder && display.state === 'not_sent') return null
  return <Badge className={CONFIRMATION_BADGE_CLASS[display.state]}>{CONFIRMATION_LABEL[display.state]}</Badge>
}

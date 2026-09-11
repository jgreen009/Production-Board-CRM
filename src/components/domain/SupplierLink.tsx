import { ExternalLink } from 'lucide-react'
import { isSafeHttpUrl } from '@/utils/url'

interface SupplierLinkProps {
  url: string | undefined | null
  label?: string
  className?: string
}

// Mockup System V2 Batch C — the one place a supplier URL is ever turned
// into a clickable link, used by both the New/Edit Order garment selector
// and Order Detail's Garments tab, so href-safety can't drift between the
// two. Defense in depth: garment_types.supplier_url is already validated
// at write time (utils/url.ts's normalizeSupplierUrl, called from
// api/settings.ts's updateGarmentType), but this re-checks at render time
// rather than trusting the stored value never changed by another path —
// an unsafe/malformed value renders nothing rather than a dangerous link.
export function SupplierLink({ url, label = 'View Supplier Garment', className }: SupplierLinkProps) {
  if (!url || !isSafeHttpUrl(url)) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? 'inline-flex items-center gap-1 text-xs font-medium text-brand-accent hover:underline'}
    >
      {label} <ExternalLink size={11} />
    </a>
  )
}

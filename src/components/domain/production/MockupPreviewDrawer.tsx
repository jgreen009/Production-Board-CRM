import { useState } from 'react'
import { ChevronLeft, ChevronRight, Download, ImageOff } from 'lucide-react'
import type { Order } from '@/types'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { useMockupPreviewUrl } from '@/hooks/useMockupPreviews'

interface MockupPreviewDrawerProps {
  order: Order | null
  onClose: () => void
}

// Batch C: a lightweight, READ-ONLY quick preview — clicking a Production
// Board thumbnail opens this instead of navigating away. Browsing between
// multiple PrintSpecs is supported; editing is not (that stays in Edit
// Order / Mockup Studio). Plain <img> + a signed-URL hook, same as every
// other read-only mockup surface — no Fabric here.
export function MockupPreviewDrawer({ order, onClose }: MockupPreviewDrawerProps) {
  const [index, setIndex] = useState(0)
  const [lastOrderId, setLastOrderId] = useState<string | undefined>(order?.id)

  // Reset to the first print spec whenever a different order is opened —
  // adjusted during render (React's recommended pattern) rather than an
  // effect, since it's derived from a prop change, not an external system.
  if (order?.id !== lastOrderId) {
    setLastOrderId(order?.id)
    setIndex(0)
  }

  const specs = order?.printSpecs ?? []
  const spec = specs[index]
  const artwork = order?.artwork.find((a) => a.id === spec?.artworkId)
  const { data: previewUrl, isLoading, isError } = useMockupPreviewUrl(spec?.previewStoragePath)

  return (
    <Drawer
      open={!!order}
      onClose={onClose}
      title={order ? `${order.orderNumber} — ${order.jobName}` : ''}
      subtitle={specs.length > 0 ? `Mockup ${index + 1} of ${specs.length}` : undefined}
    >
      {!order || !spec ? (
        <p className="text-sm text-zinc-400">No print locations saved for this order yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {specs.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft size={14} /> Prev
              </Button>
              <span className="text-xs font-medium text-zinc-500">{spec.position}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={index === specs.length - 1}
                onClick={() => setIndex((i) => Math.min(specs.length - 1, i + 1))}
              >
                Next <ChevronRight size={14} />
              </Button>
            </div>
          )}

          <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50">
            {isLoading ? (
              <div className="h-full w-full animate-pulse bg-zinc-100" />
            ) : previewUrl && !isError ? (
              <img src={previewUrl} alt={`${spec.position} mockup`} className="h-full w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-zinc-300">
                <ImageOff size={28} />
                <p className="text-xs text-zinc-400">
                  {spec.previewStoragePath ? 'Preview unavailable' : 'No mockup preview generated yet.'}
                </p>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <Detail label="Position" value={spec.position} />
            <Detail label="Garment" value={spec.garmentType ?? order.garments[0]?.type ?? '—'} />
            <Detail label="Garment Colour" value={spec.garmentColour || order.garments[0]?.colour || '—'} />
            <Detail label="Print Size" value={`${spec.widthMm} × ${spec.heightMm} mm`} />
            <Detail label="Print Colour" value={spec.colour} />
            <Detail label="Artwork" value={artwork?.fileName ?? '—'} />
          </dl>

          {spec.approvalNote && (
            <div>
              <p className="mb-1 text-xs font-semibold text-zinc-500">APPROVAL NOTE</p>
              <p className="rounded-md bg-zinc-50 px-2.5 py-2 text-sm text-zinc-700">{spec.approvalNote}</p>
            </div>
          )}

          {previewUrl && !isError && (
            <a
              href={previewUrl}
              download={`${order.orderNumber}-${spec.position.toLowerCase().replace(/\s+/g, '-')}-mockup.png`}
              className="flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              <Download size={14} /> Download Preview
            </a>
          )}
        </div>
      )}
    </Drawer>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="font-medium text-zinc-800">{value}</dd>
    </div>
  )
}

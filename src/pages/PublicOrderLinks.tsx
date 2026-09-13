import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, Copy, Link2, Plus, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Drawer } from '@/components/ui/Drawer'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { useToast } from '@/components/ui/toast-context'
import {
  useCreatePublicOrderLink,
  useGeneralOrderLink,
  usePublicOrderLinks,
  useRegenerateGeneralOrderLink,
  useRevokePublicOrderLink,
} from '@/hooks/usePublicOrderLinks'
import { generateOrderLinkToken, publicOrderLinkUrl } from '@/utils/publicOrderLink'
import { getPublicOrderLinkStatus } from '@/utils/publicOrderLinkStatus'
import { formatDate } from '@/utils/date'
import { staffErrorMessage } from '@/utils/errorMessage'
import { clsx } from 'clsx'

const STATUS_BADGE_CLASS: Record<string, string> = {
  Active: 'border-success/30 bg-success-soft text-success',
  Used: 'border-zinc-200 bg-zinc-100 text-zinc-500',
  Expired: 'border-warning/30 bg-warning-soft text-warning',
  Revoked: 'border-danger/30 bg-danger-soft text-danger',
}

export default function PublicOrderLinks() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { data: generalLink, isLoading: isGeneralLoading } = useGeneralOrderLink()
  const regenerate = useRegenerateGeneralOrderLink()
  const [copiedGeneral, setCopiedGeneral] = useState(false)
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false)

  const { data: links = [], isLoading } = usePublicOrderLinks()
  const oneTimeLinks = links.filter((l) => !l.isGeneral)
  const create = useCreatePublicOrderLink()
  const revoke = useRevokePublicOrderLink()

  const [showOneTime, setShowOneTime] = useState(false)
  const [newLinkUrl, setNewLinkUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null)

  const generalUrl = generalLink?.rawToken ? publicOrderLinkUrl(window.location.origin, generalLink.rawToken) : null

  const handleCopyGeneral = async () => {
    if (!generalUrl) return
    await navigator.clipboard.writeText(generalUrl)
    setCopiedGeneral(true)
    setTimeout(() => setCopiedGeneral(false), 2000)
  }

  const handleRegenerate = () => {
    if (!generalLink) return
    regenerate.mutate(generalLink, {
      onError: (err) => showToast(staffErrorMessage(err, 'Failed to regenerate the order link'), 'info'),
    })
    setConfirmingRegenerate(false)
  }

  const handleGenerate = async () => {
    try {
      const { token, tokenHash } = await generateOrderLinkToken()
      await create.mutateAsync({ tokenHash })
      setNewLinkUrl(publicOrderLinkUrl(window.location.origin, token))
      setCopied(false)
    } catch (err) {
      showToast(staffErrorMessage(err, 'Failed to generate order link'), 'info')
    }
  }

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
  }

  const handleRevoke = () => {
    if (!pendingRevokeId) return
    revoke.mutate(pendingRevokeId, {
      onError: (err) => showToast(staffErrorMessage(err, 'Failed to revoke link'), 'info'),
    })
    setPendingRevokeId(null)
  }

  return (
    <div>
      <button onClick={() => navigate('/orders')} className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft size={14} /> Back to Orders
      </button>
      <PageHeader
        title="Customer Order Link"
        description="One shareable link customers use to submit a new order without logging in — safe to share anywhere (your website, socials, email signature)."
      />

      <Card>
        <CardBody className="flex flex-col gap-3">
          {isGeneralLoading ? (
            <TableSkeleton />
          ) : generalUrl ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-success/30 bg-success-soft text-success">Active</Badge>
                <span className="text-xs text-zinc-400">
                  {generalLink!.submissionCount} order{generalLink!.submissionCount === 1 ? '' : 's'} submitted so far
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                <code className="min-w-0 flex-1 truncate text-xs text-zinc-700">{generalUrl}</code>
                <Button variant="secondary" size="sm" onClick={handleCopyGeneral}>
                  {copiedGeneral ? <Check size={14} /> : <Copy size={14} />} {copiedGeneral ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-xs text-zinc-400">
                This link has no expiry and can be used by any number of customers. If it&rsquo;s ever compromised, regenerate
                it below — the old link stops working immediately.
              </p>
              <div>
                <Button variant="secondary" size="sm" onClick={() => setConfirmingRegenerate(true)}>
                  <RefreshCw size={14} /> Regenerate Link
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-danger">Could not load the order link. Try refreshing the page.</p>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmingRegenerate}
        title="Regenerate the customer order link?"
        description="The current link stops working immediately and a new one takes its place. Anyone who still has the old link (e.g. posted on your website) will need the new one."
        confirmLabel={regenerate.isPending ? 'Regenerating…' : 'Regenerate'}
        danger
        onConfirm={handleRegenerate}
        onCancel={() => setConfirmingRegenerate(false)}
      />

      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowOneTime((v) => !v)}
          className="flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          <ChevronDown size={14} className={clsx('transition-transform', showOneTime && 'rotate-180')} />
          Advanced: one-time links {oneTimeLinks.length > 0 && `(${oneTimeLinks.length})`}
        </button>

        {showOneTime && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-xs text-zinc-400">
              A one-time link is consumed after a single order — useful for a specific customer you want to invite once,
              rather than sharing the general link above.
            </p>
            <div>
              <Button variant="secondary" size="sm" onClick={handleGenerate} disabled={create.isPending}>
                <Plus size={14} /> New One-Time Link
              </Button>
            </div>

            {isLoading ? (
              <Card>
                <CardBody className="p-0">
                  <TableSkeleton />
                </CardBody>
              </Card>
            ) : oneTimeLinks.length === 0 ? (
              <EmptyState icon={Link2} title="No one-time links yet" description="Generate one to invite a single customer to submit an order." />
            ) : (
              <div className="flex flex-col gap-2">
                {oneTimeLinks.map((link) => {
                  const status = getPublicOrderLinkStatus(link)
                  return (
                    <Card key={link.id}>
                      <CardBody className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Badge className={clsx('border', STATUS_BADGE_CLASS[status])}>{status}</Badge>
                            <span className="text-xs text-zinc-400">Created {formatDate(link.createdAt)}</span>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {link.submissionCount}/{link.maxSubmissions ?? '∞'} used
                            {link.expiresAt && ` · expires ${formatDate(link.expiresAt)}`}
                            {link.resultingOrderId && (
                              <>
                                {' '}
                                ·{' '}
                                <button
                                  type="button"
                                  onClick={() => navigate(`/orders/${link.resultingOrderId}`)}
                                  className="text-brand-accent hover:underline"
                                >
                                  View resulting order
                                </button>
                              </>
                            )}
                          </p>
                        </div>
                        {status === 'Active' && (
                          <Button variant="secondary" size="sm" onClick={() => setPendingRevokeId(link.id)}>
                            Revoke
                          </Button>
                        )}
                      </CardBody>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <Drawer open={!!newLinkUrl} onClose={() => setNewLinkUrl(null)} title="One-time link created">
        {newLinkUrl && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600">
              Copy this link now and send it to the customer — for security, it won&rsquo;t be shown again after you close this.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
              <code className="min-w-0 flex-1 truncate text-xs text-zinc-700">{newLinkUrl}</code>
              <Button variant="secondary" size="sm" onClick={() => handleCopy(newLinkUrl)}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-zinc-400">This link can be used once and has no expiry unless you revoke it.</p>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!pendingRevokeId}
        title="Revoke this order link?"
        description="The customer will see a message that this link is no longer available. This cannot be undone."
        confirmLabel="Revoke"
        danger
        onConfirm={handleRevoke}
        onCancel={() => setPendingRevokeId(null)}
      />
    </div>
  )
}

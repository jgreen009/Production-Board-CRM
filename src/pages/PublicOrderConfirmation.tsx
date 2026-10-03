import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { confirmOrder, fetchConfirmationReview, type ConfirmationReview, type CustomerOrderSummary } from '@/api/orderConfirmations'
import { formatDateTime } from '@/utils/date'

// Public, token-authorized page. Deliberately outside AppShell and RequireAuth,
// so no CRM navigation or internal data can appear here. Only the customer-safe
// summary returned by the order-confirmation function is rendered.

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'review'; review: ConfirmationReview }
  | { kind: 'confirmed'; orderNumber?: string; confirmedAt?: string | null; previouslyConfirmed: boolean }
  | { kind: 'ended'; state: 'invalid' | 'superseded' | 'expired' }

export default function PublicOrderConfirmation() {
  const { token = '' } = useParams()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const applyReview = useCallback((review: ConfirmationReview): Phase => {
    if (review.state === 'pending' || review.state === 'already_confirmed') return { kind: 'review', review }
    if (review.state === 'superseded' || review.state === 'expired' || review.state === 'invalid') {
      return { kind: 'ended', state: review.state }
    }
    return { kind: 'error' }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchConfirmationReview(token)
      .then((review) => {
        if (!cancelled) setPhase(applyReview(review))
      })
      .catch(() => {
        if (!cancelled) setPhase({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [token, applyReview])

  const reload = async () => {
    setPhase({ kind: 'loading' })
    try {
      setPhase(applyReview(await fetchConfirmationReview(token)))
    } catch {
      setPhase({ kind: 'error' })
    }
  }

  const handleConfirm = async () => {
    if (phase.kind !== 'review' || !phase.review.summaryHash) return
    setDialogOpen(false)
    setSubmitting(true)
    setNotice(null)
    try {
      const result = await confirmOrder(token, phase.review.summaryHash)
      if (result.state === 'confirmed') {
        setPhase({ kind: 'confirmed', orderNumber: result.orderNumber, confirmedAt: result.confirmedAt, previouslyConfirmed: false })
      } else if (result.state === 'already_confirmed') {
        setPhase({ kind: 'confirmed', orderNumber: result.orderNumber, confirmedAt: result.confirmedAt, previouslyConfirmed: true })
      } else if (result.state === 'changed') {
        setNotice('This order was updated while you were reviewing it. Here are the latest details — please check them and confirm again.')
        await reload()
      } else if (result.state === 'superseded' || result.state === 'expired' || result.state === 'invalid') {
        setPhase({ kind: 'ended', state: result.state })
      } else {
        setNotice('We could not confirm the order just now. Please try again.')
      }
    } catch {
      setNotice('We could not confirm the order just now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-app-bg px-4 py-6 sm:py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <div className="text-center">
          <h1 className="text-xl font-bold text-zinc-900">Brand Fanatix</h1>
          <p className="text-sm text-zinc-500">Review your order</p>
        </div>

        {phase.kind === 'loading' && <p className="text-center text-sm text-zinc-400">Loading your order…</p>}

        {phase.kind === 'error' && (
          <Message title="We couldn't load this order" body="Please try opening the link again in a moment." />
        )}

        {phase.kind === 'ended' && phase.state === 'invalid' && (
          <Message title="This link isn't valid" body="Please check the link in your email, or contact Brand Fanatix." />
        )}
        {phase.kind === 'ended' && phase.state === 'expired' && (
          <Message title="This link has expired" body="Please contact Brand Fanatix for a new confirmation." />
        )}
        {phase.kind === 'ended' && phase.state === 'superseded' && (
          <Message
            title="This confirmation link is no longer current"
            body="The order details have changed since this link was sent. Please use the latest confirmation email from Brand Fanatix."
          />
        )}

        {phase.kind === 'confirmed' && (
          <Card>
            <CardBody className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 size={36} className="text-success" />
              <h2 className="text-lg font-semibold text-zinc-900">
                {phase.previouslyConfirmed ? 'Order Already Confirmed' : 'Order Confirmed'}
              </h2>
              <p className="text-sm text-zinc-600">
                {phase.previouslyConfirmed
                  ? `This order was confirmed on ${phase.confirmedAt ? formatDateTime(phase.confirmedAt) : 'an earlier date'}.`
                  : 'Thank you. Brand Fanatix has received your confirmation.'}
              </p>
              {phase.orderNumber && <p className="text-sm font-medium text-zinc-800">Order {phase.orderNumber}</p>}
              {!phase.previouslyConfirmed && phase.confirmedAt && (
                <p className="text-xs text-zinc-400">Confirmed {formatDateTime(phase.confirmedAt)}</p>
              )}
            </CardBody>
          </Card>
        )}

        {phase.kind === 'review' && (
          <>
            {phase.review.state === 'already_confirmed' && (
              <p className="rounded-md border border-success/20 bg-success-soft px-3 py-2 text-center text-sm text-success">
                Order Already Confirmed
                {phase.review.confirmedAt ? ` — confirmed ${formatDateTime(phase.review.confirmedAt)}.` : '.'}
              </p>
            )}
            {notice && <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">{notice}</p>}
            {phase.review.summary && <SummaryView summary={phase.review.summary} />}
            {phase.review.state === 'pending' && (
              <div className="sticky bottom-0 bg-app-bg py-3">
                <Button variant="primary" className="w-full" disabled={submitting} onClick={() => setDialogOpen(true)}>
                  {submitting ? 'Confirming…' : 'Confirm Order'}
                </Button>
              </div>
            )}
          </>
        )}

        <ConfirmDialog
          open={dialogOpen}
          title="Confirm this order?"
          description="Please confirm that the order details above are correct."
          confirmLabel="Confirm Order"
          onConfirm={handleConfirm}
          onCancel={() => setDialogOpen(false)}
        />
      </div>
    </div>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-1.5 py-8 text-center">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        <p className="text-sm text-zinc-500">{body}</p>
      </CardBody>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-zinc-500">{title.toUpperCase()}</h3>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 text-zinc-500">{label}</span>
      <span className="text-zinc-900">{value}</span>
    </div>
  )
}

function SummaryView({ summary }: { summary: CustomerOrderSummary }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        <div>
          <p className="text-xs text-zinc-400">Order</p>
          <p className="text-lg font-semibold text-zinc-900">{summary.orderNumber}</p>
        </div>

        <Section title="Your details">
          <Row label="Name" value={summary.customerName} />
          <Row label="Company" value={summary.companyName} />
          <Row label="Email" value={summary.customerEmail} />
          <Row label="Phone" value={summary.customerPhone} />
        </Section>

        <Section title="Job">
          <Row label="Job title" value={summary.jobTitle} />
          <Row label="Required date" value={summary.requiredDate} />
          <Row label="Pick up / delivery" value={summary.deliveryMethod} />
        </Section>

        {summary.garments.length > 0 && (
          <Section title="Garments">
            {summary.garments.map((g, i) => (
              <div key={i} className="rounded-md border border-zinc-200 p-3">
                <p className="text-sm font-medium text-zinc-900">
                  {[g.heading, g.colour].filter(Boolean).join(' — ')}
                </p>
                {g.brand && <p className="text-xs text-zinc-500">Brand: {g.brand}</p>}
                <ul className="mt-1.5 grid grid-cols-2 gap-x-4 text-sm text-zinc-700 sm:grid-cols-3">
                  {g.sizes.map((s) => (
                    <li key={s.size}>
                      {s.size} × {s.quantity}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-zinc-500">Total: {g.totalQuantity}</p>
              </div>
            ))}
          </Section>
        )}

        {summary.services.length > 0 && (
          <Section title="Services">
            <p className="text-sm text-zinc-900">{summary.services.join(' · ')}</p>
          </Section>
        )}

        {summary.printSpecs.length > 0 && (
          <Section title="Print details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {summary.printSpecs.map((p, i) => (
                <div key={i} className="rounded-md border border-zinc-200 p-3">
                  <p className="text-sm font-medium text-zinc-900">{p.position}</p>
                  <div className="mt-2 flex h-40 items-center justify-center overflow-hidden rounded bg-zinc-50">
                    {p.previewUrl ? (
                      <img src={p.previewUrl} alt={`${p.position} mockup`} className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <ImageOff size={18} className="text-zinc-300" />
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-0.5 text-xs text-zinc-600">
                    {p.artworkFileName && <span>Artwork: {p.artworkFileName}</span>}
                    <span>Width: {p.widthMm} mm</span>
                    {p.colour && <span>Print colour: {p.colour}</span>}
                    {p.garmentLabel && <span>Garment: {p.garmentLabel}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {summary.customerNotes && (
          <Section title="Your notes">
            <p className="whitespace-pre-wrap text-sm text-zinc-900">{summary.customerNotes}</p>
          </Section>
        )}
      </CardBody>
    </Card>
  )
}

// Email templates. Table layout with inline styles only, because mail
// clients ignore <style> blocks, flexbox, and grid. Every value that came
// from a customer is escaped, and optional rows disappear entirely when
// empty, so no template ever shows a bare label with nothing after it.

import type { CustomerOrderSummary, GarmentSummary, PrintSpecSummary } from './summary.ts'
import { subjectFor, type EmailType } from './policy.ts'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const ORANGE = '#e8702a'
const TEXT = '#1f1f1f'
const MUTED = '#6b6b6b'
const RULE = '#e6e6e6'
const FONT = "Arial, Helvetica, sans-serif"

function row(label: string, value: string | null | undefined): string {
  if (!value || !value.trim()) return ''
  return `<tr><td style="padding:4px 12px 4px 0;color:${MUTED};font-size:13px;vertical-align:top;width:140px;">${escapeHtml(label)}</td><td style="padding:4px 0;color:${TEXT};font-size:14px;vertical-align:top;">${escapeHtml(value)}</td></tr>`
}

function sectionHeading(text: string): string {
  return `<p style="margin:24px 0 8px 0;font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${ORANGE};">${escapeHtml(text)}</p>`
}

function renderGarment(g: GarmentSummary): string {
  const title = [g.heading, g.colour].filter((s) => s && s.trim()).join(' — ')
  const brand = g.brand ? `<p style="margin:0 0 6px 0;font-size:13px;color:${MUTED};">Brand: ${escapeHtml(g.brand)}</p>` : ''
  const sizeRows = g.sizes
    .map((s) => `<tr><td style="padding:3px 16px 3px 0;font-size:14px;color:${TEXT};">${escapeHtml(s.size)} × ${s.quantity}</td></tr>`)
    .join('')
  return `<div style="margin:0 0 16px 0;padding:12px 14px;border:1px solid ${RULE};border-radius:6px;">
<p style="margin:0 0 4px 0;font-size:15px;font-weight:bold;color:${TEXT};">${escapeHtml(title)}</p>
${brand}
<table role="presentation" cellpadding="0" cellspacing="0" border="0">${sizeRows}</table>
<p style="margin:8px 0 0 0;font-size:13px;color:${MUTED};">Total: ${g.totalQuantity}</p>
</div>`
}

function renderPrintSpec(p: PrintSpecSummary): string {
  const image = p.previewUrl
    ? `<img src="${escapeHtml(p.previewUrl)}" alt="${escapeHtml(p.position)} mockup" width="360" style="display:block;max-width:100%;height:auto;margin:8px 0 0 0;border:1px solid ${RULE};border-radius:4px;" />`
    : ''
  return `<div style="margin:0 0 16px 0;padding:12px 14px;border:1px solid ${RULE};border-radius:6px;">
<p style="margin:0 0 6px 0;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${TEXT};">${escapeHtml(p.position)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${row('Artwork', p.artworkFileName)}
${row('Width', `${p.widthMm} mm`)}
${row('Print colour', p.colour)}
${row('Garment', p.garmentLabel)}
</table>
${image}
</div>`
}

export interface OrderEmailOptions {
  confirmationUrl?: string | null
  isUpdate?: boolean
}

function introFor(emailType: EmailType, isUpdate: boolean): string {
  if (emailType === 'customer_order_receipt') {
    return 'Thanks for submitting your order request. Below is a copy of the information you provided.'
  }
  if (isUpdate) {
    return "We've updated the order details below. Please review them, and if everything looks correct, use the button below to confirm the updated order."
  }
  return 'Please review the order details below. If everything looks correct, use the button below to confirm the order.'
}

function ctaHtml(url: string): string {
  const safe = escapeHtml(url)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
<tr><td style="border-radius:6px;background:${ORANGE};">
<a href="${safe}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">Review &amp; Confirm Order</a>
</td></tr>
</table>
<p style="margin:0 0 8px 0;font-family:${FONT};font-size:12px;color:${MUTED};">If the button doesn't work, copy and paste this link into your browser:<br><span style="word-break:break-all;">${safe}</span></p>`
}

export function renderOrderEmailHtml(
  summary: CustomerOrderSummary,
  emailType: EmailType,
  options: OrderEmailOptions = {},
): string {
  const intro = introFor(emailType, options.isUpdate === true)
  const closing =
    emailType === 'staff_order_summary'
      ? 'Please review the details above.'
      : "We'll review the details and contact you if anything needs clarification."
  const cta = emailType === 'staff_order_summary' && options.confirmationUrl ? ctaHtml(options.confirmationUrl) : ''
  const greeting = summary.customerName ? `Hi ${escapeHtml(summary.customerName)},` : 'Hello,'
  const garments = summary.garments.map(renderGarment).join('')
  const prints = summary.printSpecs.map(renderPrintSpec).join('')
  const services = summary.services.length
    ? `<p style="margin:0;font-size:14px;color:${TEXT};">${summary.services.map(escapeHtml).join(' · ')}</p>`
    : ''
  const notes = summary.customerNotes
    ? `<p style="margin:0;font-size:14px;color:${TEXT};white-space:pre-wrap;">${escapeHtml(summary.customerNotes)}</p>`
    : ''

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subjectFor(emailType, summary.orderNumber))}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;">
<tr><td style="padding:24px 28px 8px 28px;">
<p style="margin:0;font-family:${FONT};font-size:20px;font-weight:bold;color:${TEXT};">Brand Fanatix</p>
<p style="margin:6px 0 0 0;font-family:${FONT};font-size:14px;color:${MUTED};">Order ${escapeHtml(summary.orderNumber)}</p>
</td></tr>
<tr><td style="padding:12px 28px 28px 28px;font-family:${FONT};">
<p style="margin:0 0 12px 0;font-size:15px;color:${TEXT};">${greeting}</p>
<p style="margin:0 0 16px 0;font-size:15px;color:${TEXT};">${escapeHtml(intro)}</p>
${cta}

${sectionHeading('Order details')}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${row('Job / title', summary.jobTitle)}
${row('Company', summary.companyName)}
${row('Required date', summary.requiredDate)}
${row('Pick up / delivery', summary.deliveryMethod)}
${row('Phone', summary.customerPhone)}
${row('Email', summary.customerEmail)}
</table>

${garments ? sectionHeading('Garments') + garments : ''}
${services ? sectionHeading('Services') + services : ''}
${prints ? sectionHeading('Print details') + prints : ''}
${notes ? sectionHeading('Your notes') + notes : ''}

<p style="margin:24px 0 0 0;font-size:15px;color:${TEXT};">${escapeHtml(closing)}</p>
<p style="margin:16px 0 0 0;font-size:15px;color:${TEXT};">Thank you,<br>Brand Fanatix</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export function renderOrderEmailText(
  summary: CustomerOrderSummary,
  emailType: EmailType,
  options: OrderEmailOptions = {},
): string {
  const lines: string[] = []
  lines.push('Brand Fanatix', `Order ${summary.orderNumber}`, '')
  lines.push(summary.customerName ? `Hi ${summary.customerName},` : 'Hello,', '')
  lines.push(introFor(emailType, options.isUpdate === true), '')
  if (emailType === 'staff_order_summary' && options.confirmationUrl) {
    lines.push(`Review & Confirm Order: ${options.confirmationUrl}`, '')
  }
  lines.push('ORDER DETAILS')
  if (summary.jobTitle) lines.push(`Job / title: ${summary.jobTitle}`)
  if (summary.companyName) lines.push(`Company: ${summary.companyName}`)
  if (summary.requiredDate) lines.push(`Required date: ${summary.requiredDate}`)
  if (summary.deliveryMethod) lines.push(`Pick up / delivery: ${summary.deliveryMethod}`)
  if (summary.customerPhone) lines.push(`Phone: ${summary.customerPhone}`)
  if (summary.customerEmail) lines.push(`Email: ${summary.customerEmail}`)

  if (summary.garments.length) {
    lines.push('', 'GARMENTS')
    for (const g of summary.garments) {
      lines.push([g.heading, g.colour].filter(Boolean).join(' — '))
      if (g.brand) lines.push(`Brand: ${g.brand}`)
      for (const s of g.sizes) lines.push(`${s.size} × ${s.quantity}`)
      lines.push(`Total: ${g.totalQuantity}`, '')
    }
  }
  if (summary.services.length) lines.push('SERVICES', summary.services.join(', '), '')
  if (summary.printSpecs.length) {
    lines.push('PRINT DETAILS')
    for (const p of summary.printSpecs) {
      lines.push(p.position)
      if (p.artworkFileName) lines.push(`Artwork: ${p.artworkFileName}`)
      lines.push(`Width: ${p.widthMm} mm`)
      if (p.colour) lines.push(`Print colour: ${p.colour}`)
      if (p.garmentLabel) lines.push(`Garment: ${p.garmentLabel}`)
      lines.push('')
    }
  }
  if (summary.customerNotes) lines.push('YOUR NOTES', summary.customerNotes, '')
  lines.push(
    emailType === 'staff_order_summary'
      ? 'Please review the details above.'
      : "We'll review the details and contact you if anything needs clarification.",
    '',
    'Thank you,',
    'Brand Fanatix',
  )
  return lines.join('\n')
}

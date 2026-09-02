const DAY_MS = 1000 * 60 * 60 * 24

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${formatDate(iso)}, ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysUntil(iso: string, now: Date = new Date()): number {
  const due = startOfDay(new Date(iso))
  const today = startOfDay(now)
  return Math.round((due.getTime() - today.getTime()) / DAY_MS)
}

export function isOverdue(iso: string, now: Date = new Date()): boolean {
  return daysUntil(iso, now) < 0
}

export function isDueToday(iso: string, now: Date = new Date()): boolean {
  return daysUntil(iso, now) === 0
}

export function isDueSoon(iso: string, now: Date = new Date()): boolean {
  const diff = daysUntil(iso, now)
  return diff > 0 && diff <= 3
}

export function dueDateLabel(iso: string, now: Date = new Date()): string {
  const diff = daysUntil(iso, now)
  if (diff === 0) return 'Due Today'
  if (diff === 1) return 'Due Tomorrow'
  if (diff < 0) return `Overdue ${Math.abs(diff)}d`
  if (diff <= 7) return `Due in ${diff}d`
  return formatDateShort(iso)
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

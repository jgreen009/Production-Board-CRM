const DAY_MS = 1000 * 60 * 60 * 24

// All dates in this app are date-only ("YYYY-MM-DD") strings. `new
// Date(isoString)` parses date-only strings as UTC midnight, while
// `.getFullYear()`/`.getDate()` etc. read back in local time — mixing the
// two silently shifts the effective day by one in any timezone with a
// non-zero UTC offset. Every function below parses/formats using local
// date components only, so "today" always means the same calendar day the
// user's clock shows.

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateShort(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function formatDateTime(iso: string): string {
  const d = parseLocalDate(iso)
  return `${formatDate(iso)}, ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysUntil(iso: string, now: Date = new Date()): number {
  const due = startOfDay(parseLocalDate(iso))
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
  return toIsoDate(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = parseLocalDate(iso)
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

let counter = 0

export function generateId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

export function nextOrderNumber(existing: string[]): string {
  const nums = existing
    .map((n) => Number(n.replace(/[^0-9]/g, '')))
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 1000
  return `SP-${max + 1}`
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Distinguishes a real Supabase order (uuid primary key) from one of the 14
// mockOrders.ts demo rows (plain ids like "order-1") — both still resolve
// during the transition until every screen reads real data. Passing a
// non-uuid string to a `uuid` column errors rather than just missing, so
// callers must check this before querying by id.
export function isRealOrderId(id: string | null | undefined): boolean {
  return !!id && UUID_PATTERN.test(id)
}

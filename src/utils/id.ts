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

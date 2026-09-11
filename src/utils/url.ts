// Mockup System V2 Batch C — supplier-link URL safety. Admin-managed
// content (only admin/owner can write garment_types per RLS), but still
// validated at both save time (Settings form) and render time (defense in
// depth): only http/https survive, everything else (javascript:, data:,
// file:, vbscript:, a bare "not a url" string) is rejected rather than
// rendered as a clickable link.

const SAFE_PROTOCOLS = new Set(['http:', 'https:'])

// Parses and validates in one step — the only way to know a string is a
// safe, well-formed http(s) URL is to actually parse it with the URL
// constructor (regex-based scheme checks are trivially bypassed by
// malformed-but-still-dangerous strings the browser would still act on).
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return SAFE_PROTOCOLS.has(url.protocol)
  } catch {
    return false
  }
}

// Trims and returns a safe URL string, or null if empty/unsafe — the one
// place both the Settings save path and any render-time guard should call,
// so they can never disagree about what counts as "a supplier URL".
export function normalizeSupplierUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  return isSafeHttpUrl(trimmed) ? trimmed : null
}

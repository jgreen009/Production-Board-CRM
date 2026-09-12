// Public Customer Order Link — token generation, entirely client-side
// (staff browser). The raw token is generated here, shown/copyable to
// staff exactly once (at creation), and never sent anywhere except
// embedded in the public URL — only its SHA-256 hash is ever written to
// the database (public_order_links.token_hash), via the same Web Crypto
// SubtleCrypto API the public-order Edge Function uses to re-hash an
// incoming token for lookup, so the two sides can never disagree about
// what a given raw token hashes to.

const TOKEN_BYTE_LENGTH = 32 // 256 bits — matches the SHA-256 hash length conceptually, plenty of entropy against guessing

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface GeneratedOrderLinkToken {
  /** The raw token — embed in the public URL, show to staff once. Never persisted anywhere. */
  token: string
  /** SHA-256 hex digest of `token` — the only form ever written to the database. */
  tokenHash: string
}

export async function generateOrderLinkToken(): Promise<GeneratedOrderLinkToken> {
  const bytes = new Uint8Array(TOKEN_BYTE_LENGTH)
  crypto.getRandomValues(bytes)
  const token = toBase64Url(bytes)
  const tokenHash = await sha256Hex(token)
  return { token, tokenHash }
}

// Pure — takes the origin as a parameter instead of reading
// `window.location` directly, so this stays testable in a plain Node
// environment (this project's default vitest environment has no DOM).
// Callers in actual browser code pass `window.location.origin`.
export function publicOrderLinkUrl(origin: string, token: string): string {
  return `${origin}/order-request/${token}`
}

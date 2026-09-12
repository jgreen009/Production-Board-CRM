import { describe, expect, it } from 'vitest'
import { generateOrderLinkToken, publicOrderLinkUrl, sha256Hex } from './publicOrderLink'

describe('sha256Hex', () => {
  it('produces the known SHA-256 digest for a fixed input (cross-checked against a standard test vector)', async () => {
    // SHA-256("abc") is a widely published test vector.
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('is deterministic — the same input always hashes to the same digest', async () => {
    const a = await sha256Hex('some-token-value')
    const b = await sha256Hex('some-token-value')
    expect(a).toBe(b)
  })

  it('produces different digests for different inputs', async () => {
    const a = await sha256Hex('token-a')
    const b = await sha256Hex('token-b')
    expect(a).not.toBe(b)
  })
})

describe('generateOrderLinkToken', () => {
  it('generates a raw token whose hash matches sha256Hex(token) — the same function the Edge Function uses to look it up', async () => {
    const { token, tokenHash } = await generateOrderLinkToken()
    expect(await sha256Hex(token)).toBe(tokenHash)
  })

  it('never generates the same raw token twice in a row (sufficient entropy)', async () => {
    const first = await generateOrderLinkToken()
    const second = await generateOrderLinkToken()
    expect(first.token).not.toBe(second.token)
    expect(first.tokenHash).not.toBe(second.tokenHash)
  })

  it('the raw token contains no characters that would need URL-encoding (base64url)', async () => {
    const { token } = await generateOrderLinkToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('publicOrderLinkUrl', () => {
  it('embeds the origin and raw token in a /order-request/ path', () => {
    const url = publicOrderLinkUrl('https://example.com', 'abc123')
    expect(url).toBe('https://example.com/order-request/abc123')
  })
})

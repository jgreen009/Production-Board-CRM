import { describe, expect, it } from 'vitest'
import { isSafeHttpUrl, normalizeSupplierUrl } from './url'

describe('isSafeHttpUrl', () => {
  it('accepts a valid https URL', () => {
    expect(isSafeHttpUrl('https://ascolour.com/products/staple-tee-5001')).toBe(true)
  })

  it('accepts a valid http URL', () => {
    expect(isSafeHttpUrl('http://example.com')).toBe(true)
  })

  it('rejects a javascript: URL', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects a data: URL', () => {
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('rejects a file: URL', () => {
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false)
  })

  it('rejects a malformed, non-URL string', () => {
    expect(isSafeHttpUrl('not a url at all')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isSafeHttpUrl('')).toBe(false)
  })
})

describe('normalizeSupplierUrl', () => {
  it('trims and returns a valid URL', () => {
    expect(normalizeSupplierUrl('  https://example.com  ')).toBe('https://example.com')
  })

  it('returns null for an unsafe scheme', () => {
    expect(normalizeSupplierUrl('javascript:alert(1)')).toBeNull()
  })

  it('returns null for empty/undefined/null input', () => {
    expect(normalizeSupplierUrl('')).toBeNull()
    expect(normalizeSupplierUrl(undefined)).toBeNull()
    expect(normalizeSupplierUrl(null)).toBeNull()
  })
})

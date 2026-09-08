import { describe, expect, it } from 'vitest'
import { MAX_ARTWORK_FILE_SIZE_BYTES, validateArtworkFile } from '@/utils/artworkValidation'

function makeFile(name: string, sizeBytes: number, type: string): File {
  const file = new File([new Uint8Array(Math.min(sizeBytes, 1024))], name, { type })
  Object.defineProperty(file, 'size', { value: sizeBytes })
  return file
}

describe('validateArtworkFile', () => {
  it('accepts a normal PNG', () => {
    const result = validateArtworkFile(makeFile('logo.png', 1024, 'image/png'))
    expect(result).toEqual({ valid: true, fileType: 'PNG' })
  })

  it('rejects an unsupported extension', () => {
    const result = validateArtworkFile(makeFile('logo.gif', 1024, 'image/gif'))
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/Unsupported file type/)
  })

  it('rejects a file over the 25MB limit', () => {
    const result = validateArtworkFile(makeFile('huge.png', MAX_ARTWORK_FILE_SIZE_BYTES + 1, 'image/png'))
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/25MB/)
  })

  it('accepts a file exactly at the 25MB boundary', () => {
    const result = validateArtworkFile(makeFile('exact.png', MAX_ARTWORK_FILE_SIZE_BYTES, 'image/png'))
    expect(result.valid).toBe(true)
  })

  it('rejects a mismatched extension/MIME pair', () => {
    const result = validateArtworkFile(makeFile('fake.png', 1024, 'application/pdf'))
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/doesn't match/)
  })

  it('accepts an .ai file even with an empty MIME type (browsers rarely report one)', () => {
    const result = validateArtworkFile(makeFile('artwork.ai', 1024, ''))
    expect(result).toEqual({ valid: true, fileType: 'AI' })
  })

  it('is case-insensitive on the extension', () => {
    const result = validateArtworkFile(makeFile('LOGO.PNG', 1024, 'image/png'))
    expect(result.valid).toBe(true)
  })
})

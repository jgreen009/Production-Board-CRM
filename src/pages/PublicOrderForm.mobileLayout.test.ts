import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// This codebase has no DOM-rendering test infrastructure (no React
// Testing Library — every existing test is a pure-function unit test), so
// a real rendered-layout assertion isn't available. This is a deliberate,
// narrow exception: a source-structure regression guard for the specific
// "prioritize 2-column grids on mobile" requirement, so a future edit that
// accidentally reverts a field pair back to full-width stacking is caught
// by CI rather than only by a human noticing on a phone. Not a substitute
// for the manual UAT checklist's actual mobile-viewport verification.

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(import.meta.dirname, relativePath), 'utf8')
}

describe('Public order form — mobile 2-column grid structure', () => {
  it('Section 1 (Your Details) pairs Email and Phone in a 2-column grid', () => {
    const source = readSource('./PublicOrderForm.tsx')
    const emailPhoneBlock = source.slice(source.indexOf('Your Details'), source.indexOf('Business / Company Name'))
    expect(emailPhoneBlock).toContain('grid-cols-2')
    expect(emailPhoneBlock).toContain('Email')
    expect(emailPhoneBlock).toContain('Phone')
  })

  it('Section 2 (Job / Turnaround / Delivery) pairs Job Title and Required Date in a 2-column grid', () => {
    const source = readSource('./PublicOrderForm.tsx')
    const jobBlock = source.slice(source.indexOf('Job / Turnaround / Delivery'), source.indexOf('Services Required'))
    expect(jobBlock).toContain('grid-cols-2')
    expect(jobBlock).toContain('Job / Order Title')
    expect(jobBlock).toContain('Required Date')
  })

  it('GarmentCard (shared with the staff form) pairs Garment Type and Brand in a 2-column grid on mobile', () => {
    const source = readSource('../components/domain/GarmentCard.tsx')
    expect(source).toContain('grid-cols-2 gap-3 sm:grid-cols-3')
  })

  it('the Services checkbox list stays a 2-column grid (unchanged staff pattern, already mobile-compact)', () => {
    const source = readSource('../components/domain/ServiceCheckboxGrid.tsx')
    expect(source).toContain('grid-cols-2')
  })

  it('artwork upload and notes remain full-width (not forced into a 2-column layout)', () => {
    const printDetailsSource = readSource('./PublicPrintDetailsSection.tsx')
    // The artwork dropzone label has no grid-cols-2 wrapper around it.
    const dropzoneBlock = printDetailsSource.slice(
      printDetailsSource.indexOf('Upload artwork'),
      printDetailsSource.indexOf('multiple'),
    )
    expect(dropzoneBlock).not.toContain('grid-cols-2')

    const formSource = readSource('./PublicOrderForm.tsx')
    const notesBlock = formSource.slice(formSource.indexOf('Additional Instructions'), formSource.indexOf('submitError &&'))
    expect(notesBlock).not.toContain('grid-cols-2')
  })
})

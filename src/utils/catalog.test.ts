import { describe, expect, it } from 'vitest'
import { selectableCatalogNames } from '@/utils/catalog'

describe('selectableCatalogNames', () => {
  const catalog = [
    { name: 'T-shirt', active: true },
    { name: 'Polo', active: true },
    { name: 'Retired Style', active: false },
  ]

  it('returns only active names when the current value is already active', () => {
    expect(selectableCatalogNames(catalog, 'T-shirt')).toEqual(['T-shirt', 'Polo'])
  })

  it('prepends a disabled current value so it stays selectable and visible', () => {
    expect(selectableCatalogNames(catalog, 'Retired Style')).toEqual(['Retired Style', 'T-shirt', 'Polo'])
  })

  it('returns only active names when there is no current value yet', () => {
    expect(selectableCatalogNames(catalog, '')).toEqual(['T-shirt', 'Polo'])
  })
})

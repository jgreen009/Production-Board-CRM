import { describe, expect, it } from 'vitest'
import { mapCustomerRowToDomain } from '@/api/mappers/customer'

describe('mapCustomerRowToDomain', () => {
  it('maps a fully-populated row to the domain shape', () => {
    const row = {
      id: 'c1',
      name: 'Dave Kelston',
      company: 'Kelston Rugby Club',
      email: 'admin@kelstonrugby.com.au',
      phone: '0412 334 556',
      notes: 'Club jersey reorder every pre-season.',
      created_at: '2024-02-11T00:00:00Z',
    }

    expect(mapCustomerRowToDomain(row)).toEqual({
      id: 'c1',
      name: 'Dave Kelston',
      company: 'Kelston Rugby Club',
      email: 'admin@kelstonrugby.com.au',
      phone: '0412 334 556',
      notes: 'Club jersey reorder every pre-season.',
      createdAt: '2024-02-11T00:00:00Z',
    })
  })

  it('falls back nullable DB columns to empty strings, and notes to undefined', () => {
    const row = {
      id: 'c2',
      name: 'Trent Macintyre',
      company: null,
      email: null,
      phone: null,
      notes: null,
      created_at: '2024-05-01T00:00:00Z',
    }

    expect(mapCustomerRowToDomain(row)).toEqual({
      id: 'c2',
      name: 'Trent Macintyre',
      company: '',
      email: '',
      phone: '',
      notes: undefined,
      createdAt: '2024-05-01T00:00:00Z',
    })
  })
})

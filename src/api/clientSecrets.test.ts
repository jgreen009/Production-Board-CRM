import { describe, expect, it } from 'vitest'

// Email provider and service-role credentials must exist only in Edge Function
// secrets. Any mention in client source would ship them in the browser bundle.
const SERVER_ONLY_NAMES = ['RESEND_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'EMAIL_FROM', 'APP_PUBLIC_URL', 'service_role']

const sources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

describe('client source contains no server-only secrets', () => {
  it('no src file references a server-only secret name', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50)
    const offenders: string[] = []
    for (const [file, contents] of Object.entries(sources)) {
      if (file.endsWith('clientSecrets.test.ts')) continue
      for (const name of SERVER_ONLY_NAMES) {
        if (contents.includes(name)) offenders.push(`${file}: ${name}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

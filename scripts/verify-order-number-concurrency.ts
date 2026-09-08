// Acceptance test #19 — order-number uniqueness under concurrent writes.
// This is a database guarantee (a Postgres sequence's nextval() is
// concurrency-safe), not frontend logic, so it can't be a Vitest unit
// test — it needs N real concurrent calls to the actual upsert_order RPC
// over the network. Not part of build/lint/CI; run manually.
//
// Usage:
//   SUPABASE_TEST_EMAIL=you@example.com SUPABASE_TEST_PASSWORD=... \
//     npx tsx scripts/verify-order-number-concurrency.ts [concurrency]
//
// Requires a real staff account (created per Milestone 1 — Auth > Users >
// Add user) since upsert_order is restricted to the `authenticated` role.
// Every order this script creates is deleted again at the end.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function loadEnvLocal(): Record<string, string> {
  const content = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const env: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) env[match[1]] = match[2].trim()
  }
  return env
}

async function main() {
  const env = loadEnvLocal()
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  const email = process.env.SUPABASE_TEST_EMAIL
  const password = process.env.SUPABASE_TEST_PASSWORD
  const concurrency = Number(process.argv[2] ?? 20)

  if (!url || !anonKey) throw new Error('Missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY in .env.local')
  if (!email || !password) {
    throw new Error(
      'Set SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD env vars to a real staff account before running this.',
    )
  }

  const supabase = createClient(url, anonKey)
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw new Error(`Sign-in failed: ${authError.message}`)

  console.log(`Firing ${concurrency} concurrent upsert_order calls...`)

  const payload = (i: number) => ({
    jobName: `Concurrency Test Order ${i}`,
    customerId: null,
    phone: '',
    email: '',
    dueDate: null,
    turnaroundType: 'Standard',
    deliveryMethod: 'Pick Up',
    priority: 'Normal',
    rushFee: false,
    suppliesGarments: false,
    graphicDesignServices: false,
    specialisedApplication: false,
    specialisedApplicationDetails: '',
    notes: '',
    productionNotes: '',
    paymentStatus: 'Unpaid',
    staffCompleted: false,
    garments: [
      {
        type: 'T-shirt',
        brand: 'AS colour',
        colour: 'Black',
        sizing: 'Adult',
        adultQuantities: { S: 1, M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0, '4XL': 0, '5XL': 0 },
        youthQuantities: {},
      },
    ],
    services: ['Screen Printing'],
    printSpecs: [],
  })

  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, i) =>
      supabase.rpc('upsert_order', { payload: payload(i), p_order_id: null, p_finalize: true }),
    ),
  )

  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    console.error(`${errors.length} calls errored:`, errors.map((e) => e.error?.message))
    process.exitCode = 1
  }

  const orderIds = results.filter((r) => r.data).map((r) => r.data as string)

  const { data: orders, error: fetchError } = await supabase
    .from('orders')
    .select('id, order_number')
    .in('id', orderIds)
  if (fetchError) throw fetchError

  const orderNumbers = orders!.map((o) => o.order_number)
  const uniqueNumbers = new Set(orderNumbers)

  console.log(`Created ${orderIds.length} orders.`)
  console.log(`Order numbers: ${orderNumbers.sort().join(', ')}`)
  console.log(
    uniqueNumbers.size === orderNumbers.length
      ? `PASS — all ${orderNumbers.length} order numbers are unique.`
      : `FAIL — only ${uniqueNumbers.size} of ${orderNumbers.length} order numbers are unique!`,
  )

  console.log('Cleaning up test orders...')
  const { error: deleteError } = await supabase.from('orders').delete().in('id', orderIds)
  if (deleteError) throw deleteError
  console.log('Done.')

  if (uniqueNumbers.size !== orderNumbers.length) process.exitCode = 1
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1
})

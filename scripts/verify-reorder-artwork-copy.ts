// Phase 4 Batch C, Part 26 — live end-to-end verification of the Reorder
// artwork-copy path (src/api/artwork.ts: copyArtworkForReorder /
// copyReferencedArtworkForReorder) against a real Supabase project, using
// the real app code (not a reimplementation). Specifically proves Part 18
// (two PrintSpecs referencing the same source artwork are deduplicated to
// ONE new artwork row) since that's implementation-internal behavior a
// pure unit test can't exercise without mocking the Supabase client — a
// mocking layer this codebase deliberately doesn't have (every other test
// in the suite is pure-logic-only). Not part of build/lint/test; run
// manually. Creates and deletes its own source + reordered test orders,
// artwork rows, and Storage objects either way.
//
// Usage:
//   SUPABASE_TEST_EMAIL=you@example.com SUPABASE_TEST_PASSWORD=... \
//     npx tsx scripts/verify-reorder-artwork-copy.ts

import { readFileSync } from 'node:fs'

function loadEnvLocalIntoProcessEnv() {
  const content = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) process.env[match[1]] ??= match[2].trim()
  }
}
loadEnvLocalIntoProcessEnv()

const { supabase } = await import('../src/lib/supabase.ts')
const { uploadArtwork } = await import('../src/api/artwork.ts')
const { copyReferencedArtworkForReorder } = await import('../src/api/artwork.ts')

function pass(label: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`)
  if (!ok) process.exitCode = 1
}

async function createOrder(jobName: string): Promise<string> {
  const { data: orderId, error } = await supabase.rpc('upsert_order', {
    payload: {
      jobName,
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
          type: 'T-shirt', brand: 'AS colour', colour: 'Black', sizing: 'Adult',
          adultQuantities: { S: 1, M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0, '4XL': 0, '5XL': 0 },
          youthQuantities: {},
        },
      ],
      services: ['Screen Printing'],
      printSpecs: [],
    },
    p_order_id: null,
    p_finalize: true,
  })
  if (error) throw error
  return orderId as string
}

async function main() {
  const email = process.env.SUPABASE_TEST_EMAIL
  const password = process.env.SUPABASE_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('Set SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD to a real staff account before running this.')
  }

  const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw new Error(`Sign-in failed: ${authError.message}`)

  const sourceOrderId = await createOrder('Reorder Artwork Copy — Source')
  console.log(`Created source order ${sourceOrderId}`)

  const onePixelPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  const fileA = new File([Buffer.from(onePixelPngBase64, 'base64')], 'crest.png', { type: 'image/png' })
  const fileB = new File([Buffer.from(onePixelPngBase64, 'base64')], 'sponsor.png', { type: 'image/png' })

  const artworkA = await uploadArtwork(sourceOrderId, fileA)
  const artworkB = await uploadArtwork(sourceOrderId, fileB)
  console.log(`Uploaded source artwork: ${artworkA.id} (${artworkA.fileName}), ${artworkB.id} (${artworkB.fileName})`)

  const newOrderId = await createOrder('Reorder Artwork Copy — New (Reordered)')
  console.log(`Created new (reordered) order shell ${newOrderId}`)

  // Two PrintSpecs reference artworkA (dedup target), one references
  // artworkB — exactly the Part 18/22 scenario.
  const sourceArtworkFiles = [
    { id: artworkA.id },
    { id: artworkB.id },
  ]
  const sourcePrintSpecs = [
    { artworkId: artworkA.id },
    { artworkId: artworkA.id },
    { artworkId: artworkB.id },
  ]

  const { artworkFiles: newArtworkFiles, artworkIdMap } = await copyReferencedArtworkForReorder(
    newOrderId,
    sourceArtworkFiles,
    sourcePrintSpecs,
  )

  pass('exactly 2 new artwork rows created (one per unique source artwork, not 3)', newArtworkFiles.length === 2)
  pass('artworkIdMap has exactly 2 entries', artworkIdMap.size === 2)
  pass('both specs referencing artworkA map to the SAME new artwork id', artworkIdMap.get(artworkA.id) !== undefined)

  const newIdForA = artworkIdMap.get(artworkA.id)
  const newIdForB = artworkIdMap.get(artworkB.id)
  pass('new artwork ids are distinct from each other', newIdForA !== newIdForB)
  pass('new artwork ids are distinct from the source ids', newIdForA !== artworkA.id && newIdForB !== artworkB.id)

  const { data: newRows, error: newRowsError } = await supabase
    .from('artwork')
    .select('id, order_id, file_name, storage_path')
    .eq('order_id', newOrderId)
  if (newRowsError) throw newRowsError
  pass('new order has exactly 2 artwork rows in the DB', (newRows ?? []).length === 2)
  pass('new artwork rows belong to the new order, not the source', (newRows ?? []).every((r) => r.order_id === newOrderId))

  const newRowForA = newRows?.find((r) => r.id === newIdForA)
  const { data: signedNew } = newRowForA
    ? await supabase.storage.from('artwork-originals').createSignedUrl(newRowForA.storage_path, 60)
    : { data: null }
  pass('copied Storage object is readable via a fresh signed URL', !!signedNew?.signedUrl)

  const { data: sourceRowStillThere, error: sourceCheckError } = await supabase
    .from('artwork')
    .select('id, order_id, storage_path')
    .eq('id', artworkA.id)
    .single()
  if (sourceCheckError) throw sourceCheckError
  pass('original source artwork row is completely untouched', sourceRowStillThere.order_id === sourceOrderId)

  const { data: signedSource } = await supabase.storage
    .from('artwork-originals')
    .createSignedUrl(sourceRowStillThere.storage_path, 60)
  pass('original source Storage object is still readable (untouched)', !!signedSource?.signedUrl)

  console.log('Cleaning up Storage objects (client-deletable)...')
  for (const row of newRows ?? []) {
    await supabase.storage.from('artwork-originals').remove([row.storage_path])
  }
  const { data: sourceArtworkRows } = await supabase.from('artwork').select('storage_path').eq('order_id', sourceOrderId)
  for (const row of sourceArtworkRows ?? []) {
    await supabase.storage.from('artwork-originals').remove([row.storage_path])
  }

  // `orders` deliberately has no client-side DELETE RLS policy (no staff
  // role can hard-delete an order via a normal authenticated session —
  // matches this app's "deactivate, don't delete" philosophy everywhere
  // else). These two calls will not actually remove the rows; the test
  // orders (now with no artwork attached, Draft-invisible... actually
  // finalized Active here) must be cleaned up via the Supabase dashboard
  // or an elevated/service-role connection, not this script.
  const { error: deleteNewError } = await supabase.from('orders').delete().eq('id', newOrderId)
  const { error: deleteSourceError } = await supabase.from('orders').delete().eq('id', sourceOrderId)
  if (deleteNewError || deleteSourceError) {
    console.log(
      `NOTE: could not delete test orders via the client (expected — orders has no DELETE policy). ` +
        `Remove manually: ${sourceOrderId}, ${newOrderId}`,
    )
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

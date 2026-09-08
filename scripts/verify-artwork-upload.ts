// Acceptance tests #6/#7/#8 — artwork upload/storage for PNG, AI, and PDF.
// Exercises the real src/api/artwork.ts functions (not a reimplementation)
// against a real test order, over a real authenticated session. Not part
// of build/lint/CI; run manually. Creates and deletes its own test order
// and files either way.
//
// Usage:
//   SUPABASE_TEST_EMAIL=you@example.com SUPABASE_TEST_PASSWORD=... \
//     npx tsx scripts/verify-artwork-upload.ts

import { readFileSync } from 'node:fs'

function loadEnvLocalIntoProcessEnv() {
  const content = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) process.env[match[1]] ??= match[2].trim()
  }
}

// src/lib/supabase.ts reads import.meta.env in the app itself (Vite) and
// falls back to process.env under plain Node — populate that before
// importing it, so this script exercises the real src/api/artwork.ts
// functions rather than reimplementing the Supabase calls.
loadEnvLocalIntoProcessEnv()

const { supabase } = await import('../src/lib/supabase.ts')
const { uploadArtwork, getArtworkSignedUrl, removeArtwork, listArtworkForOrder } = await import('../src/api/artwork.ts')

async function main() {
  const email = process.env.SUPABASE_TEST_EMAIL
  const password = process.env.SUPABASE_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('Set SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD to a real staff account before running this.')
  }

  const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw new Error(`Sign-in failed: ${authError.message}`)

  const { data: orderId, error: orderError } = await supabase.rpc('upsert_order', {
    payload: {
      jobName: 'Artwork Upload Verification Order',
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
  if (orderError) throw orderError
  console.log(`Created test order ${orderId}`)

  // A minimal but valid 1x1 PNG, a plain-text stand-in for an AI file
  // (only the extension matters for the AI path — no preview is ever
  // attempted for it), and a minimal valid PDF.
  const onePixelPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  const pdfBytes = new TextEncoder().encode(
    '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
  )

  const files = [
    new File([Buffer.from(onePixelPngBase64, 'base64')], 'test-logo.png', { type: 'image/png' }),
    new File([new TextEncoder().encode('fake AI file content')], 'test-design.ai', { type: '' }),
    new File([pdfBytes], 'test-doc.pdf', { type: 'application/pdf' }),
  ]

  const uploaded = []
  for (const file of files) {
    const artwork = await uploadArtwork(orderId as string, file)
    console.log(`Uploaded ${artwork.fileName} (${artwork.fileType}, ${artwork.sizeKb}KB) -> artwork.id=${artwork.id}`)
    uploaded.push(artwork)
  }

  const listed = await listArtworkForOrder(orderId as string)
  console.log(`listArtworkForOrder returned ${listed.length} rows (expected ${files.length}).`)

  for (const artwork of uploaded) {
    const { data: row, error } = await supabase
      .from('artwork')
      .select('storage_path')
      .eq('id', artwork.id)
      .single()
    if (error) throw error

    const signedUrl = await getArtworkSignedUrl(row.storage_path)
    const response = await fetch(signedUrl)
    console.log(
      `${artwork.fileName}: signed URL fetch -> HTTP ${response.status} ${response.status === 200 ? 'PASS' : 'FAIL'}`,
    )
  }

  console.log('Cleaning up...')
  for (const artwork of uploaded) {
    const { data: row } = await supabase.from('artwork').select('storage_path').eq('id', artwork.id).single()
    if (row) await removeArtwork(artwork.id, row.storage_path)
  }
  await supabase.from('orders').delete().eq('id', orderId)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

// One-time asset optimization pass — Mockup System V2 Batch C.
//
// Converts src/assets/mockups/*.png (technical-flat garment sketches,
// originally 1226x1283, ~25MB total across 22 files) into *.webp at a
// target long-edge of 900px — matching mockupPreviewRenderer's own
// PREVIEW_OUTPUT_WIDTH (Batch B), so the preview-export path never needs
// to upscale past the optimized source — while preserving aspect ratio
// exactly (no independent width/height resize — see garmentFit.ts's own
// "never scaleX != scaleY" rule, which this respects at the asset level
// too).
//
// Not part of the app build or its dependencies — `sharp` is NOT a
// project dependency (deliberately: Batch C's brief explicitly says not
// to add a heavy runtime image-processing library). Run this manually,
// once, whenever the source PNGs change:
//
//   npm install --no-save sharp
//   node scripts/optimize-mockup-assets.mjs
//   npm uninstall sharp   # (or just leave it out of the next npm ci)
//
// Output lands next to the source PNGs (src/assets/mockups/*.webp) with
// the same base filename — garmentTemplates.ts imports the .webp files;
// the original .png files are kept in the repo as source/history but are
// no longer imported anywhere, so they are not emitted into dist (Vite
// only bundles assets that are actually imported).
import sharp from 'sharp'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/assets/mockups')
const TARGET_LONG_EDGE = 900

async function main() {
  const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.png'))
  let totalBefore = 0
  let totalAfter = 0

  for (const file of files) {
    const srcPath = path.join(SRC_DIR, file)
    const destPath = path.join(SRC_DIR, file.replace(/\.png$/, '.webp'))
    const before = statSync(srcPath).size
    totalBefore += before

    const img = sharp(srcPath)
    const meta = await img.metadata()
    const isLandscape = (meta.width ?? 0) > (meta.height ?? 0)
    const resizeOpts = isLandscape ? { width: TARGET_LONG_EDGE } : { height: TARGET_LONG_EDGE }

    await img.resize({ ...resizeOpts, withoutEnlargement: true }).webp({ quality: 90 }).toFile(destPath)

    const after = statSync(destPath).size
    totalAfter += after
    console.log(
      `${file.padEnd(22)} ${meta.width}x${meta.height} ${(before / 1024).toFixed(0)}KB -> ` +
        `${file.replace('.png', '.webp').padEnd(22)} ${(after / 1024).toFixed(0)}KB`,
    )
  }

  console.log('---')
  console.log(`Total before: ${(totalBefore / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Total after:  ${(totalAfter / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Reduction: ${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}%`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

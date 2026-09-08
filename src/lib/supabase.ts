import { createClient } from '@supabase/supabase-js'

// import.meta.env is populated by Vite in the app itself; scripts/*.ts run
// this same module under plain Node (via tsx, not Vite), where it's
// undefined, so those fall back to process.env — lets a verification
// script exercise the real src/api/* functions instead of reimplementing
// the Supabase calls just to work around this module.
// Referenced via globalThis (not the bare `process` identifier) so this
// compiles without Node's ambient types, which the app's tsconfig
// deliberately doesn't include (browser-only `types: ["vite/client"]`).
const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
const url = import.meta.env?.VITE_SUPABASE_URL ?? nodeEnv?.VITE_SUPABASE_URL
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? nodeEnv?.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing Supabase env vars — check .env.local against .env.example')
}

export const supabase = createClient(url, anonKey)

// Plan §16: every mutation's onError shows a generic, staff-facing toast
// message — never the raw Postgres/PostgREST error text (which can leak
// column/constraint/policy names, or just be unreadable). The real error
// still goes to the console for dev debugging. Auth errors are a
// deliberate exception (see Login.tsx) — Supabase Auth's own messages
// ("Invalid login credentials") are already generic and user-appropriate,
// unlike a raw DB error.
export function staffErrorMessage(err: unknown, fallback: string): string {
  console.error(err)
  return fallback
}

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

// A second, narrower exception to the "always show the generic fallback"
// rule above: src/api/adminUsers.ts's invokeAdminUsers() already
// translates every possible failure (a curated server-side message, a
// CORS/network failure, a relay failure) into an Error whose .message is
// itself already safe to show a staff member — never a raw Postgres/
// fetch error. Routing those through staffErrorMessage() would silently
// discard useful, already-safe text like "Cannot deactivate the last
// active administrator" in favor of a generic toast. Still falls back to
// `fallback` for the (should-never-happen) case of a non-Error throw.
export function adminActionErrorMessage(err: unknown, fallback: string): string {
  console.error(err)
  return err instanceof Error && err.message ? err.message : fallback
}

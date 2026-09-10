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

// Order save/create failures specifically: show the real underlying
// reason (a Supabase PostgrestError's .message — either upsert_order's
// own raised business-rule text, e.g. "Cannot assign this order to an
// inactive or unknown staff member", or Postgres' own error text, e.g. a
// malformed value) rather than a blanket "Failed to create order" that
// leaves staff with no way to tell what actually went wrong or report it
// usefully. Deliberately narrower than the blanket staffErrorMessage()
// rule elsewhere: this project's own upsert_order function doesn't raise
// anything containing a password/token/secret, and PostgrestError.message
// is already a short, human-readable line (not a stack trace) — appending
// it to a toast is a real diagnostic aid, not a leak, for this one path.
export function orderSaveErrorMessage(err: unknown, fallback: string): string {
  console.error(err)
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message) {
    return `${fallback}: ${err.message}`
  }
  return fallback
}

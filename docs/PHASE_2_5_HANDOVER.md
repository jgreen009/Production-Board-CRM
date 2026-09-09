# SALT PRINTS — Phase 2.5 Handover (Verification & Stabilization)

## 1. Purpose

Phase 2.5 verifies the Phase 2 backend integration actually works end-to-end
against the real, hosted Supabase project — not just that it compiles — and
fixes any genuine defects found along the way. No new features, no schema
redesign, no Phase 3 work (mockup canvas editor, etc.).

## 2. Verification environment

Hosted Supabase project `pphzbtqfttfkaphmwutr` ("Brand Fanatix",
`eu-west-1`, Postgres 17.6) — the same project Phase 2 was built against.
Frontend run locally against `.env.local`. See
`docs/PHASE_2_5_VERIFICATION_PLAN.md` for the full scoping, including which
checks this session could run directly (**[AGENT]**, via Supabase MCP + the
build toolchain) versus which require the user's own credentials or a real
browser (**[USER]** — this session has no browser-automation tool, and
Supabase credentials deliberately never pass through the chat/agent).

## 3. Baseline build/lint/test results

Run before any Phase 2.5 changes: `npm run build` (tsc -b + vite build) ✅,
`npm run lint` (oxlint) ✅ clean, `npm run test` (vitest) ✅ 29/29 passing
across 6 files. Re-run after this pass's fixes: identical result — build,
lint, and all 29 tests still pass.

## 4. Order-number concurrency result

**Script not run** — `scripts/verify-order-number-concurrency.ts` needs real
staff credentials (`SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD`), which
this session deliberately does not have. **[USER ACTION NEEDED]**: run it
yourself, e.g. `SUPABASE_TEST_EMAIL=... SUPABASE_TEST_PASSWORD=... npx tsx
scripts/verify-order-number-concurrency.ts 20`.

As a substitute, this session fired 8 sequential `upsert_order(...)` RPC
calls directly via SQL (bypassing RLS/auth, since Supabase MCP's
`execute_sql` runs as `postgres`) and confirmed:

```
SP-1009 SP-1010 SP-1011 SP-1012 SP-1013 SP-1014 SP-1015 SP-1016
```

— eight strictly unique, sequential order numbers, no collision. All 8 test
rows were deleted immediately after. This confirms the sequence/trigger
mechanism itself is correct, but **does not** exercise genuine parallel
network requests through the authenticated RPC path the way the real script
does — that verification is still outstanding.

## 5. Artwork round-trip result

**Script not run**, same credential constraint. Substitute performed via
direct SQL: both real `artwork` rows in the database were cross-checked
against `storage.objects` in both directions — every `artwork.storage_path`
resolves to a real object, and no orphaned objects exist with no matching
row. Storage path format matches spec exactly:
`orders/{orderId}/artwork/{artworkId}/{filename}`. **[USER ACTION NEEDED]**:
run the real script (or manually upload a PNG/PDF/AI file through the app)
to verify the live upload/signed-URL/delete path end-to-end, since this
substitute only checks already-persisted state, not the upload flow itself.

## 6–19. UI/workflow verification (auth, customer flow, order creation,
drafts, artwork, print specs, Production Board consistency, order editing,
global search, settings, responsive regression, full click-through)

**Not run — [USER ACTION NEEDED].** This session has no browser-automation
tool, so none of the manual click-through steps in the Phase 2.5 request
(login/logout cycles, creating orders through the actual form, dragging
artwork, watching status changes propagate across screens, testing at 5
breakpoints, the full end-to-end sequence) could be executed directly.
Everything in this category was verified only at the **code and schema
level** in Phase 2's original milestones (documented in
`docs/PHASE_2_HANDOVER.md`) and, where feasible, re-confirmed at the
**database level** this session (see §8 below) — neither is a substitute for
actually clicking through the live app. Please run the sequence in
`docs/PHASE_2_5_VERIFICATION_PLAN.md` §6 and report PASS/FAIL per step.

## 20. Bugs discovered and fixed this session

Three real defects were found via code audit (grep across `src/`) and fixed:

1. **Leftover placeholder action** — `OrderQuickView.tsx`'s "Edit" button
   (Production Board's quick-view drawer) still showed a stub toast ("Full
   edit form arrives with backend integration.") even though real order
   editing has existed since Milestone 8. Fixed: it now navigates to
   `/orders/:id/edit`, same as every other Edit entry point in the app.
2. **Dead mock-dependent code** — `src/pages/new-order/buildOrder.ts`
   (`buildOrderFromForm`) and `src/data/orderStore.ts` (`addOrder`) were
   Phase 1 leftovers with zero remaining callers anywhere in the app (the
   New Order form has used the real `upsert_order` RPC via
   `useUpsertOrder`/`useUpdateOrderWithActivity` since Milestone 6). Both
   files still imported `mockOrders`/`mockCustomers` and
   `nextOrderNumber()` — exactly the "runtime dependency on mock data" and
   "client-side order-number scanning" patterns Phase 2.5 was asked to hunt
   for. Deleted both files as dead code.
3. **Dead client-side order-number logic** — `nextOrderNumber()` in
   `src/utils/id.ts` had no remaining callers once `buildOrder.ts` was
   deleted. Removed. `generateId()` in the same file is still legitimately
   used (client-side React-key ids for in-progress garment/print-spec form
   rows before they're persisted — never used for order numbers) and was
   left alone.

No other placeholder actions, mock-data runtime dependencies, or
client-side order-number logic were found (full grep results in the
verification plan's audit).

## 21. Database migrations added

None. No verified defect required a schema change this session — the two
real bugs found (§20) were frontend-only. The two RLS/performance
migrations from Phase 2's own Milestone 11 (`rls_hardening`,
`performance_hardening`) were re-audited (see §16 below) and remain correct;
nothing new was needed.

## 22. Tests added/changed

None added this session — the three fixes were dead-code removal and a
one-line navigation fix, none of which introduced new pure logic worth a
unit test. Existing 29 tests re-verified passing after the changes.

## 23. Known remaining limitations

Everything already listed in `docs/PHASE_2_HANDOVER.md` §12, still true:
mockup canvas editor and garment reference photo cleanup remain out of
scope; main JS bundle exceeds 500kB (informational, not a functional
defect — largely garment mockup images); `garment_types.active` is `false`
for Hoody/Singlet/T-shirt by the user's explicit, confirmed decision (not a
defect — re-verified unchanged this session). Additionally: the two
`OrderDetail`/`EditOrderForm` routes still fall back to the 14 Phase 1
`mockOrders` demo rows for non-UUID ids (`isRealOrderId()` gate) — this is
the deliberate transition shim documented since Milestone 6/8, intentionally
left in place since it doesn't affect any real Supabase-backed order and
removing the Phase 1 demo dataset entirely is a product decision, not a
defect fix, and out of Phase 2.5's scope.

## 24. Deferred Phase 3 work

Advanced mockup canvas editor (Fabric.js/Konva.js or similar), garment
reference photo cleanup, any of the explicitly-out-of-scope items from
`PHASE_2_SPEC.md` §1 (payments, invoicing, customer portal, advanced
analytics, multi-tenancy). None of this was touched or started.

## 25. Two Supabase advisor warnings reviewed (not code defects)

- `upsert_order` flagged as a `SECURITY DEFINER` function callable by
  `authenticated` — this is intentional and required (it's the one RPC that
  must bypass RLS to do whole-child-set-replace across
  `order_garments`/`garment_quantities`/`order_services`/`print_specs` in
  one call); reviewed and accepted, no change made.
- "Leaked password protection disabled" — a Supabase Auth account-level
  toggle (HaveIBeenPwned check on sign-up/password-change), not something
  set via migration or exposed through any tool this session has access to.
  **[USER ACTION NEEDED]**: enable it in Supabase Dashboard → Authentication
  → Providers → Email, if desired — low-effort, real security improvement,
  but a dashboard setting outside this session's reach.
- Performance advisor: 16 "unused index" INFO-level notices (every FK index
  added in Milestone 11's `performance_hardening` migration) — expected on
  a low-traffic dev project with only 2 real orders in it; not actionable
  now, will resolve themselves as real usage accumulates.

## 26. Final recommendation

**NOT READY FOR PHASE 3 — pending user-run verification, not known defects.**

Every check this session could run directly (build/lint/test, full RLS and
storage-policy audit, database integrity queries, order-number sequence
sanity check, artwork/storage consistency check, dead-code/placeholder
grep audit) passed clean, and the three real bugs found were fixed and
re-verified. But the majority of the Phase 2.5 request — the full manual
click-through, cross-screen status-sync verification, responsive regression,
and the two verification scripts' actual authenticated/concurrent runs —
requires either a real browser session or real staff credentials, neither
of which this session has access to. That work is not optional filler; it's
the part of Phase 2.5 that actually proves the live UI behaves correctly,
as opposed to proving the schema and code are internally consistent (which
is now confirmed).

**Blockers to close before Phase 3, in priority order:**
1. Run `scripts/verify-order-number-concurrency.ts` and
   `scripts/verify-artwork-upload.ts` with real credentials (§4–5).
2. Walk the full click-through sequence in the verification plan §6 and
   report pass/fail per step — this is the one genuinely mandatory item from
   the original request that nothing here can substitute for.
3. Optional: enable leaked-password protection in the Auth dashboard (§25).

## Test matrix

| TEST | RESULT |
|---|---|
| Build / Lint / Unit tests | PASS |
| Database integrity (orphans, duplicates, invalid states) | PASS |
| RLS policy audit (all tables, no anon access) | PASS |
| Storage security (private bucket, authenticated-only policies) | PASS |
| Storage/DB artwork consistency (no orphans either direction) | PASS |
| Order-number sequence sanity (DB-level, sequential) | PASS |
| Order-number concurrency (real authenticated concurrent test) | NOT RUN — needs user credentials |
| Artwork upload/signed-URL/delete round trip (live) | NOT RUN — needs user credentials |
| Dead code / placeholder-action audit | PASS (3 defects found and fixed) |
| Auth (login/logout/redirect/session persistence) | NOT RUN — needs browser |
| Customer linking (search/select/create) | NOT RUN — needs browser |
| Order creation (standard flow) | NOT RUN — needs browser |
| Draft/resume flow | NOT RUN — needs browser |
| Order editing | NOT RUN — needs browser |
| PrintSpec persistence/hydration | NOT RUN — needs browser |
| Production status sync across screens | NOT RUN — needs browser |
| Payment/Artwork/Garment status sync | NOT RUN — needs browser |
| Global search | NOT RUN — needs browser |
| Settings persistence | NOT RUN — needs browser |
| Responsive regression (5 breakpoints) | NOT RUN — needs browser |
| Full end-to-end click-through | NOT RUN — needs browser |

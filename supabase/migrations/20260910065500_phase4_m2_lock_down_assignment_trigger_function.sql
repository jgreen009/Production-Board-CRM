-- validate_order_assignment() is a trigger function only — it should
-- never be directly callable via RPC by anyone (anon or authenticated).
-- Found live via the security advisor after Milestone 2: PostgREST
-- auto-exposes every SECURITY DEFINER function as an RPC endpoint by
-- default unless EXECUTE is explicitly revoked, which this function's
-- own migration omitted. Trigger firing is unaffected by this revoke —
-- confirmed live (a real assignment update still correctly rejects an
-- inactive/unknown profile after this change; only the direct
-- `rpc/validate_order_assignment` call is now blocked, returning 404).
revoke execute on function validate_order_assignment() from public, anon, authenticated;

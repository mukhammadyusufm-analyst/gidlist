-- =============================================================================
-- Close the billing helpers to anonymous callers.
--
-- Postgres grants EXECUTE on a new function to PUBLIC by default, and `anon`
-- inherits from PUBLIC. The previous migration granted these three to
-- `authenticated` without first revoking that default, so a signed-out caller
-- could reach them:
--
--   POST /rest/v1/rpc/board_plan  ->  200  "free"
--
-- Adding a grant does not remove a default. Every other helper in this schema
-- pairs the two — `is_board_member`, `is_board_admin`, `my_role` all revoke
-- from `public, anon` first — and these three were the omission.
--
-- Low severity: board ids are unguessable, and an unknown id returns 'free'
-- rather than an error, so this never confirmed whether a space existed. It is
-- still an unauthenticated surface with no reason to exist.
--
-- Verified by calling each endpoint with the publishable key before and after,
-- against a control: a function that does not exist answers 404 PGRST202, while
-- one that is revoked answers 401 with 'permission denied for function'. Those
-- are distinguishable, which is what makes the check meaningful.
-- =============================================================================

revoke execute on function public.board_plan(uuid)                from public, anon;
revoke execute on function public.board_has_feature(uuid, text)   from public, anon;
revoke execute on function public.board_feature_limit(uuid, text) from public, anon;

-- Re-stated so this migration is self-contained: revoking from PUBLIC also
-- removes the privilege `authenticated` held only by inheritance.
grant execute on function public.board_plan(uuid)                to authenticated;
grant execute on function public.board_has_feature(uuid, text)   to authenticated;
grant execute on function public.board_feature_limit(uuid, text) to authenticated;

notify pgrst, 'reload schema';

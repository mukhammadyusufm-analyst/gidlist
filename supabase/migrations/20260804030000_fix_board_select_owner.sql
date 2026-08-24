-- =============================================================================
-- Fix — a board's owner must be able to read it directly
--
-- Phase 1 let you read a board only via `is_board_member(id)`, which consults
-- board_members. The owner's membership row is created by an AFTER INSERT
-- trigger on boards, and Postgres fires AFTER triggers at the end of the
-- statement — after any RETURNING clause has been evaluated.
--
-- So `insert into boards (...) returning slug` failed: at the moment the
-- returned row was checked, the creator was not yet a member of the board they
-- had just created. The insert was fine; reading the result back was not.
--
-- Moving the trigger earlier is not possible — board_members has a foreign key
-- to boards, so the membership row cannot exist before the board row does.
--
-- Owning a board is therefore made sufficient on its own. This is not a
-- workaround but the more correct rule: the owner column is the ultimate
-- authority on who a board belongs to, and their access should not depend on a
-- second table agreeing. It also means a damaged or missing membership row can
-- never lock an owner out of their own data.
-- =============================================================================

begin;

drop policy if exists boards_select_member on public.boards;
create policy boards_select_member
  on public.boards
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or public.is_board_member(id)
  );

commit;

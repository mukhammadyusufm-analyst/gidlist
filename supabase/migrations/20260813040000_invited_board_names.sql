-- =============================================================================
-- Let an invitee see the name of the space they have been invited to
--
-- An invitation is not a membership, so the invitee cannot read the `boards`
-- row — correctly, since they have not accepted anything. But "You have been
-- invited to a space" with no name is not something anyone can act on.
--
-- This returns the name and nothing else, and only for spaces that have
-- actually invited the caller. It cannot be used to look up an arbitrary space:
-- the invitation row is the key, and the caller must be its subject.
-- =============================================================================

begin;

create or replace function public.invited_board_names(p_board_ids uuid[])
returns table (board_id uuid, name text)
language sql
security definer
set search_path = ''
stable
as $$
  select b.id, b.name
    from public.boards b
   where b.id = any(p_board_ids)
     and exists (
       select 1
       from public.board_members bm
       where bm.board_id = b.id
         and bm.user_id = (select auth.uid())
         and bm.status = 'invited'
     );
$$;

revoke execute on function public.invited_board_names(uuid[]) from public, anon;
grant execute on function public.invited_board_names(uuid[]) to authenticated;

commit;

notify pgrst, 'reload schema';

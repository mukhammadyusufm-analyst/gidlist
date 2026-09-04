-- RUN THIS IN: gidlist-dev
--
-- Who the caller manages here, by email.
--
-- The interface half of phase B needs this. The database already decides
-- correctly — `manages_member` gates reading and `set_submission_void` gates
-- voiding — but a screen cannot ask "may I void this one?" per row without a
-- round trip per row, and offering a control that the database is going to
-- refuse is the pattern this codebase keeps deciding against.
--
-- EMAILS, NOT MEMBERSHIP IDS, because the compliance rows already carry
-- `assignee_email` and nothing else that identifies a person. Returning
-- membership ids would mean widening the row shape and a join in the page to
-- use them, for no gain.
--
-- Not a permission, and worth being clear about that. Everything this is used
-- for is already enforced underneath: the rows a manager can read are decided
-- by RLS, and a void they should not make is refused by the function whatever
-- this returns. This exists so the screen can be honest about what it offers.
--
-- SECURITY DEFINER because it walks `board_members`, whose own visibility rules
-- are the thing being reasoned about.

begin;

create or replace function public.my_report_emails(p_board_id uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select them.invited_email
    from public.board_members me
    join public.board_member_reports(me.id, false) r on true
    join public.board_members them on them.id = r.member_id
   where me.board_id = p_board_id
     and me.user_id = (select auth.uid())
     and me.status = 'active'
     and them.status = 'active'
     and them.invited_email is not null;
$$;

comment on function public.my_report_emails(uuid) is
  'Email of every active member below the caller in this space''s reporting lines, to any depth. For deciding what a screen offers, never for deciding what is permitted.';

revoke execute on function public.my_report_emails(uuid) from public, anon;
grant execute on function public.my_report_emails(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

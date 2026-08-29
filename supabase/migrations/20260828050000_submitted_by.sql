-- =============================================================================
-- Record who actually filled a checklist in
--
-- `submissions` has carried `assignee_id` and `assignee_email` since Phase 3 —
-- who was *asked*. It has never had a column for who *did it*. The compliance
-- table therefore reports the assignee, and where a schedule named nobody it
-- reports "Anyone", which is exactly what the schema intended: the assignee
-- column's comment says null means "anyone on the board".
--
-- So a checklist filled in by a named person is recorded as filled by nobody in
-- particular. For a product whose claim is a record nobody can quietly edit,
-- that is the wrong gap to have: the record cannot answer the first question an
-- auditor asks.
--
-- WHAT THIS DOES NOT DO. It does not back-fill. Nobody recorded who completed
-- the existing rows, and choosing a plausible name would put invented evidence
-- into a compliance history — worse than the gap it papers over. Old rows keep
-- a null and the interface says so.
--
-- Note the detail was never entirely absent: `submission_items.checked_by` has
-- recorded who ticked each individual item since Phase 4. What was missing is
-- the roll-up, and a place to show it.
-- =============================================================================

begin;

alter table public.submissions
  add column if not exists submitted_by       uuid references auth.users (id) on delete set null,
  add column if not exists submitted_by_email text;

comment on column public.submissions.submitted_by is
  'Who completed this. Distinct from assignee_id, which is who was asked. Written only by submit_submission(), never by a client.';

comment on column public.submissions.submitted_by_email is
  'Denormalised at submission time, matching the assignee_email pattern: the compliance table needs a name without a join, and a record of who signed off should not change because somebody later changed their address.';

-- Null for everything completed before this migration, and for anything not yet
-- completed. Both are honest states and the interface distinguishes them.
create index if not exists submissions_submitted_by_idx
  on public.submissions (submitted_by)
  where submitted_by is not null;

-- -----------------------------------------------------------------------------
-- submit_submission, now recording the person.
--
-- Rewritten rather than patched so the whole function reads in one piece. The
-- permission check is unchanged; only the UPDATE gained two columns.
--
-- The identity comes from auth.uid() inside a SECURITY DEFINER function, never
-- from an argument. A client-supplied name on the row that proves who did the
-- work would be a signature anybody could forge.
-- -----------------------------------------------------------------------------
create or replace function public.submit_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub     record;
  v_actor uuid := (select auth.uid());
  v_email text;
begin
  select * into sub from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'That submission does not exist.' using errcode = 'no_data_found';
  end if;

  if not (
    sub.assignee_id = v_actor
    or (sub.assignee_id is null and public.is_board_member(public.checklist_board_id(sub.checklist_id)))
    or public.is_board_admin(public.checklist_board_id(sub.checklist_id))
  ) then
    raise exception 'This checklist is assigned to someone else.'
      using errcode = 'insufficient_privilege';
  end if;

  select u.email::text into v_email from auth.users u where u.id = v_actor;

  update public.submissions
     set status             = 'done',
         submitted_at       = now(),
         submitted_by       = v_actor,
         submitted_by_email = v_email
   where id = p_submission_id
     and status in ('draft', 'upcoming', 'missed');

  if not found then
    raise exception 'That submission cannot be completed from its current state.'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.submit_submission(uuid) from public, anon;
grant execute on function public.submit_submission(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

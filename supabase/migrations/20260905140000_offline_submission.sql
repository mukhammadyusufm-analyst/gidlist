-- RUN THIS IN: gidlist-dev
--
-- A checklist finished with no signal, and the two times that describes.
--
-- =============================================================================
-- WHY THERE ARE NOW TWO TIMES, AND WHY THAT SETTLES AN OLD OBJECTION
--
-- Submitting was deliberately never queued. The argument was that submitting
-- means "this is complete and I stand behind it", and a submission arriving
-- twenty minutes later from a queue would carry a time nobody chose.
--
-- That argument was right about the problem and wrong about the answer. The
-- answer is not to refuse the offline case — it is to stop pretending there is
-- one time. There are two, and they are different facts:
--
--   completed_at   when the person finished the work and pressed submit.
--                  Read from THEIR DEVICE'S CLOCK, so it is evidence of what
--                  they did, not an assertion this system can vouch for.
--   submitted_at   when it reached us. Ours, from `now()`, unchanged.
--
-- A record where these differ by four hours is not a problem to be hidden. It
-- is the true story of a night shift in a basement, and hiding it — by writing
-- either time into both columns — is what would make the record dishonest.
--
-- =============================================================================
-- THE DEVICE CLOCK IS NOT TRUSTED, AND MUST NEVER BECOME LOAD-BEARING
--
-- `completed_at` is supplied by the client. A phone's clock can be wrong by
-- accident and can be set deliberately, so this column is EVIDENCE THAT WAS
-- REPORTED, not a fact the platform stands behind. Two consequences, both
-- enforced rather than remembered:
--
--   * it can only be written at the moment of submission, never edited after;
--   * it can never be *later* than the server's own time, which would mean a
--     completion in the future. Such a value is clamped and flagged rather than
--     rejected, because refusing the submission would lose real work over a
--     wrong clock.
--
-- Anything that decides compliance keeps using `submitted_at` and `due_date`.
-- When item 36 brings in a deadline judged on tick time, it must weigh this
-- column knowing what it is. The interface labels it as device-reported.
-- =============================================================================

begin;

alter table public.submissions
  add column if not exists completed_at timestamptz,
  add column if not exists completed_clock_skewed boolean not null default false;

comment on column public.submissions.completed_at is
  'When the filler pressed submit, by their own device clock. Null when they were online, in which case submitted_at is the only time there is. Reported evidence, not a platform guarantee — see the migration.';

comment on column public.submissions.completed_clock_skewed is
  'True when the device reported a completion time later than the server''s own, i.e. its clock was wrong. The value is clamped, kept and flagged rather than refused.';


-- -----------------------------------------------------------------------------
-- Submit, optionally on behalf of a device that finished earlier.
--
-- The parameter is defaulted, so every existing caller keeps working untouched
-- and an online submission is exactly what it was.
-- -----------------------------------------------------------------------------
create or replace function public.submit_submission(
  p_submission_id uuid,
  p_completed_at  timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub       record;
  v_actor   uuid := (select auth.uid());
  v_email   text;
  v_done    timestamptz := p_completed_at;
  v_skewed  boolean := false;
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

  /*
   * A completion cannot be in the future. If a device says otherwise its clock
   * is wrong, so the value is pulled back to now and marked — losing the whole
   * submission over a mis-set clock would punish the person for their phone.
   */
  if v_done is not null and v_done > now() then
    v_done := now();
    v_skewed := true;
  end if;

  select u.email::text into v_email from auth.users u where u.id = v_actor;

  update public.submissions
     set status                 = 'done',
         submitted_at           = now(),
         completed_at           = v_done,
         completed_clock_skewed = v_skewed,
         submitted_by           = v_actor,
         submitted_by_email     = v_email
   where id = p_submission_id
     and status in ('draft', 'upcoming', 'missed');

  if not found then
    raise exception 'That submission cannot be completed from its current state.'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.submit_submission(uuid, timestamptz) from public, anon;
grant execute on function public.submit_submission(uuid, timestamptz) to authenticated;

-- The single-argument form is what every deployed build calls. Kept so the
-- minutes between this running and the new build going live are uneventful.
create or replace function public.submit_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.submit_submission(p_submission_id, null);
end;
$$;

grant execute on function public.submit_submission(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

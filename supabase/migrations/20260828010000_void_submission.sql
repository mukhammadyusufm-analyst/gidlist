-- RUN THIS IN: gidlist-dev first, then production.
-- =============================================================================
-- Voiding a submission, with a reason.
--
-- Today a record that should not count can only be deleted. That is the one
-- remaining action in the app that destroys compliance evidence: the row is
-- gone, and "the line was down for maintenance, nobody was expected to check
-- it" becomes indistinguishable from "nobody checked it and somebody tidied up
-- afterwards". An auditor cannot tell those apart, and neither can he.
--
-- VOIDING ANNOTATES, IT DOES NOT OVERWRITE. `status` is left alone and three
-- columns are added beside it. A voided record still says it was missed — what
-- changes is that somebody put their name to why it should not count. Making
-- 'void' a status instead would erase the very fact the reason is explaining.
--
-- The reason is required, not optional. A void with no reason is a deletion
-- that leaves a row behind, which is worse than either.
-- =============================================================================

alter table public.submissions
  add column if not exists voided_at   timestamptz,
  add column if not exists voided_by   uuid references auth.users (id) on delete set null,
  add column if not exists void_reason text;

comment on column public.submissions.void_reason is
  'Why this record does not count. Required when voided_at is set.';

-- Either all three are set or none are. A voided row with no reason, or a
-- reason with no void, is a state nothing in the app knows how to render.
alter table public.submissions
  drop constraint if exists submissions_void_complete;
alter table public.submissions
  add constraint submissions_void_complete check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and length(trim(coalesce(void_reason, ''))) between 3 and 500)
  );

create index if not exists submissions_voided_idx
  on public.submissions (checklist_id) where voided_at is not null;

/**
 * Void a record, or lift a void.
 *
 * Admin, not editor. An editor builds and schedules checklists; deciding that a
 * missed check should not count against the company is a governance act, and it
 * is the kind of thing somebody might later be asked to justify.
 *
 * SECURITY DEFINER because it writes a column the table's own policies do not
 * expose for update — so the permission check has to be made here explicitly.
 */
create or replace function public.set_submission_void(
  p_submission_id uuid,
  p_reason        text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board uuid;
  v_clean text := nullif(trim(coalesce(p_reason, '')), '');
begin
  v_board := public.submission_board_id(p_submission_id);

  if v_board is null then
    raise exception 'No such record.' using errcode = 'no_data_found';
  end if;

  if not public.is_board_admin(v_board) then
    raise exception 'Only a space admin can void a record.'
      using errcode = 'insufficient_privilege';
  end if;

  -- A null reason lifts the void. Anything else sets it.
  if v_clean is null then
    update public.submissions
       set voided_at = null, voided_by = null, void_reason = null
     where id = p_submission_id;
  else
    if length(v_clean) < 3 then
      raise exception 'Give a reason of at least three characters.'
        using errcode = 'check_violation';
    end if;

    update public.submissions
       set voided_at = now(),
           voided_by = (select auth.uid()),
           void_reason = left(v_clean, 500)
     where id = p_submission_id;
  end if;
end;
$$;

revoke execute on function public.set_submission_void(uuid, text) from public, anon;
grant execute on function public.set_submission_void(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------
create or replace function public.audit_submission_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if new.voided_at is not distinct from old.voided_at then
    return new;
  end if;

  select c.title into v_name from public.checklists c where c.id = new.checklist_id;

  perform public.write_audit(
    case when new.voided_at is null then 'submission.unvoided' else 'submission.voided' end,
    public.checklist_board_id(new.checklist_id),
    new.id,
    jsonb_build_object(
      'checklist', v_name,
      'due_date', new.due_date,
      'status', new.status,
      'reason', coalesce(new.void_reason, old.void_reason)
    )
  );

  return new;
end;
$$;

drop trigger if exists submissions_void_audit on public.submissions;
create trigger submissions_void_audit
  after update of voided_at on public.submissions
  for each row execute function public.audit_submission_void();

-- =============================================================================
-- Compliance
--
-- A voided record leaves the done/missed figures entirely and is reported on its
-- own. Counting it as missed would defeat the point; counting it as done would
-- be a lie. It is neither — it is a record somebody decided should not count,
-- and the dashboard should say exactly that.
-- =============================================================================

create or replace function public.compliance_counts(
  p_board_id  uuid,
  p_from      date,
  p_to        date,
  p_checklist uuid default null,
  p_assignee  text default null
)
returns table (status text, total bigint)
language sql
stable
as $$
  select case when s.voided_at is not null then 'void' else s.status end as status,
         count(*)::bigint
    from public.submissions s
    join public.checklists c on c.id = s.checklist_id
   where c.board_id = p_board_id
     and s.due_date between p_from and p_to
     and (p_checklist is null or s.checklist_id = p_checklist)
     and (p_assignee is null or s.assignee_email = p_assignee)
   group by 1;
$$;

create or replace function public.compliance_trend(
  p_board_id  uuid,
  p_from      date,
  p_to        date,
  p_checklist uuid default null,
  p_status    text default null,
  p_assignee  text default null
)
returns table (day date, done bigint, total bigint)
language sql
stable
as $$
  select s.due_date,
         count(*) filter (where s.status = 'done')::bigint,
         count(*)::bigint
    from public.submissions s
    join public.checklists c on c.id = s.checklist_id
   where c.board_id = p_board_id
     and s.due_date between p_from and p_to
     and s.status <> 'upcoming'
     -- Out of the denominator as well as the numerator: a voided day should not
     -- drag the percentage down for work nobody was expected to do.
     and s.voided_at is null
     and (p_checklist is null or s.checklist_id = p_checklist)
     and (p_status is null or s.status = p_status)
     and (p_assignee is null or s.assignee_email = p_assignee)
   group by s.due_date
   order by s.due_date;
$$;

grant execute on function public.compliance_counts(uuid, date, date, uuid, text) to authenticated;
grant execute on function public.compliance_trend(uuid, date, date, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

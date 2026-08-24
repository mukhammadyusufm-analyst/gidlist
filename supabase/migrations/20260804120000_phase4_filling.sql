-- =============================================================================
-- Phase 4 — Filling checklists in
--
-- One row per item per submission, holding whether it was done and any note
-- explaining it.
--
-- The rule from the original specification lives here: when every sub-task of a
-- task is complete, the task completes too. That is implemented as a database
-- trigger rather than in the app, for three reasons:
--
--   * the web and mobile clients must never disagree about what "complete"
--     means;
--   * a half-applied rollup would leave a checklist claiming a task was done
--     when its sub-tasks were not;
--   * it has to hold for rows written by any future import or admin tool.
-- =============================================================================

begin;

create table if not exists public.submission_items (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  item_id       uuid not null references public.checklist_items (id) on delete cascade,

  checked       boolean not null default false,
  comment       text,

  checked_at    timestamptz,
  checked_by    uuid references auth.users (id) on delete set null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.submission_items is
  'One answer per checklist item per submission. Parent rows are derived, not typed in.';

create unique index if not exists submission_items_unique
  on public.submission_items (submission_id, item_id);

create index if not exists submission_items_submission_idx
  on public.submission_items (submission_id);

drop trigger if exists submission_items_set_updated_at on public.submission_items;
create trigger submission_items_set_updated_at
  before update on public.submission_items
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- The rollup.
--
-- After an item changes, recompute its parent from that parent's children, and
-- let the trigger fire again to carry the effect further up. Recursion
-- terminates because each step moves one level towards the root, and the guard
-- on "did anything actually change" stops a no-op update from looping.
-- -----------------------------------------------------------------------------
create or replace function public.rollup_parent_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_id     uuid;
  v_all_checked   boolean;
  v_parent_row_id uuid;
  v_current       boolean;
begin
  select ci.parent_item_id into v_parent_id
    from public.checklist_items ci
   where ci.id = new.item_id;

  if v_parent_id is null then
    return new;  -- top-level item; nothing above it to update
  end if;

  -- Are all of this parent's children now checked?
  select bool_and(coalesce(si.checked, false)) into v_all_checked
    from public.checklist_items child
    left join public.submission_items si
      on si.item_id = child.id
     and si.submission_id = new.submission_id
   where child.parent_item_id = v_parent_id;

  select si.id, si.checked into v_parent_row_id, v_current
    from public.submission_items si
   where si.submission_id = new.submission_id
     and si.item_id = v_parent_id;

  if v_parent_row_id is null then
    return new;  -- parent has no row yet; nothing to roll up into
  end if;

  -- Only write when the value genuinely changes. Without this the update would
  -- re-fire this trigger endlessly.
  if v_current is distinct from coalesce(v_all_checked, false) then
    update public.submission_items
       set checked    = coalesce(v_all_checked, false),
           checked_at = case when coalesce(v_all_checked, false) then now() else null end,
           checked_by = case when coalesce(v_all_checked, false) then new.checked_by else null end
     where id = v_parent_row_id;
  end if;

  return new;
end;
$$;

drop trigger if exists submission_items_rollup on public.submission_items;
create trigger submission_items_rollup
  after insert or update of checked on public.submission_items
  for each row execute function public.rollup_parent_completion();

-- -----------------------------------------------------------------------------
-- A parent with children is derived, never typed in directly.
--
-- Allowing someone to tick a task whose sub-tasks are outstanding would make
-- the completion record a claim rather than a fact. The rollup is the only
-- thing permitted to set it.
-- -----------------------------------------------------------------------------
create or replace function public.reject_manual_parent_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- pg_trigger_depth() > 1 means we were reached from the rollup trigger rather
  -- than directly from a client statement.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if exists (
    select 1 from public.checklist_items ci where ci.parent_item_id = new.item_id
  ) then
    if new.checked is distinct from old.checked then
      raise exception 'This task completes automatically when all of its sub-tasks are done.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists submission_items_reject_manual_parent on public.submission_items;
create trigger submission_items_reject_manual_parent
  before update on public.submission_items
  for each row execute function public.reject_manual_parent_check();

-- =============================================================================
-- Opening a submission
--
-- Pins the version, creates a row per item, and moves the submission from
-- "upcoming" to "draft". Idempotent — reopening an existing draft returns it
-- untouched rather than wiping the answers already given.
-- =============================================================================
create or replace function public.start_submission(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub       record;
  v_version uuid;
begin
  select * into sub from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'That submission does not exist.' using errcode = 'no_data_found';
  end if;

  -- SECURITY DEFINER bypasses RLS, so permission is checked explicitly.
  -- Either the person it is assigned to, anyone on the board when it is
  -- unassigned, or a board admin.
  if not (
    sub.assignee_id = (select auth.uid())
    or (sub.assignee_id is null and public.is_board_member(public.checklist_board_id(sub.checklist_id)))
    or public.is_board_admin(public.checklist_board_id(sub.checklist_id))
  ) then
    raise exception 'This checklist is assigned to someone else.'
      using errcode = 'insufficient_privilege';
  end if;

  if sub.status = 'done' then
    raise exception 'That submission has already been completed.' using errcode = 'check_violation';
  end if;

  v_version := sub.checklist_version_id;

  if v_version is null then
    select cv.id into v_version
      from public.checklist_versions cv
     where cv.checklist_id = sub.checklist_id
       and cv.status = 'published'
     order by cv.version_number desc
     limit 1;

    if v_version is null then
      raise exception 'This checklist has no published version yet.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- One row per item in that exact version. `on conflict do nothing` makes
  -- reopening safe: existing answers are left alone.
  insert into public.submission_items (submission_id, item_id)
  select p_submission_id, ci.id
    from public.checklist_items ci
   where ci.version_id = v_version
  on conflict (submission_id, item_id) do nothing;

  update public.submissions
     set status = case when status = 'upcoming' then 'draft' else status end,
         checklist_version_id = v_version
   where id = p_submission_id;

  return v_version;
end;
$$;

revoke execute on function public.start_submission(uuid) from public, anon;
grant execute on function public.start_submission(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Submitting.
--
-- Incomplete submissions are allowed through deliberately: real operations have
-- items that do not apply on a given day, and forcing a tick would train people
-- to tick things they did not do. What matters for compliance is that the
-- record is honest, so the unchecked count is preserved rather than blocked.
-- -----------------------------------------------------------------------------
create or replace function public.submit_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub record;
begin
  select * into sub from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'That submission does not exist.' using errcode = 'no_data_found';
  end if;

  if not (
    sub.assignee_id = (select auth.uid())
    or (sub.assignee_id is null and public.is_board_member(public.checklist_board_id(sub.checklist_id)))
    or public.is_board_admin(public.checklist_board_id(sub.checklist_id))
  ) then
    raise exception 'This checklist is assigned to someone else.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.submissions
     set status = 'done', submitted_at = now()
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

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.submission_items enable row level security;

create or replace function public.submission_board_id(p_submission_id uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select c.board_id
    from public.submissions s
    join public.checklists c on c.id = s.checklist_id
   where s.id = p_submission_id;
$$;

revoke execute on function public.submission_board_id(uuid) from public, anon;
grant execute on function public.submission_board_id(uuid) to authenticated;

-- Everyone on the board can read answers — that is what makes the compliance
-- record useful to a supervisor.
drop policy if exists submission_items_select on public.submission_items;
create policy submission_items_select on public.submission_items
  for select to authenticated
  using (public.is_board_member(public.submission_board_id(submission_id)));

-- Writing is narrower: the assignee, anyone on the board for an unassigned
-- one, or an admin. And never once the submission is done — a completed record
-- must not be quietly edited afterwards.
drop policy if exists submission_items_update on public.submission_items;
create policy submission_items_update on public.submission_items
  for update to authenticated
  using (
    exists (
      select 1 from public.submissions s
       where s.id = submission_id
         and s.status <> 'done'
         and (
           s.assignee_id = (select auth.uid())
           or (s.assignee_id is null and public.is_board_member(public.checklist_board_id(s.checklist_id)))
           or public.is_board_admin(public.checklist_board_id(s.checklist_id))
         )
    )
  )
  with check (
    exists (
      select 1 from public.submissions s
       where s.id = submission_id
         and s.status <> 'done'
    )
  );

-- No insert or delete policy: rows are created only by start_submission(), so
-- the answer sheet always matches the version it was pinned to.

commit;

notify pgrst, 'reload schema';

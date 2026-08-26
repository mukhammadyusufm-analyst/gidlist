-- =============================================================================
-- Audit the actions that destroy or alter evidence.
--
-- The first pass recorded who has access. It did not record who removed the
-- records — and for a product whose value is proving what was checked and when,
-- that is the more important half.
--
-- Three actions can legitimately erase compliance history today:
--
--   deleting a schedule       cascades to every submission it created
--   deleting a submission     removes one record outright
--   publishing a version      changes what people are held to from then on
--
-- None left a trace. A person tidying up a schedule they no longer need would
-- silently remove months of evidence, and nothing anywhere would show it had
-- happened.
--
-- CASCADES ARE NOT LOGGED, DELIBERATE ACTIONS ARE. Deleting one schedule can
-- remove hundreds of submissions; a row for each would bury the one row that
-- matters. Each trigger below checks whether its parent still exists: if the
-- parent is gone this deletion is part of a cascade, already described by the
-- entry for the parent, and is skipped. The parent's entry carries the count
-- instead — "removed 137 records" says more than 137 rows saying "removed".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schedules
-- -----------------------------------------------------------------------------
create or replace function public.audit_schedules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board   uuid;
  v_count   integer;
  v_name    text;
begin
  if tg_op = 'DELETE' then
    -- Null when the checklist is already gone, which means this delete is part
    -- of a cascade rather than something somebody chose to do.
    v_board := public.checklist_board_id(old.checklist_id);
    if v_board is null then
      return old;
    end if;

    select count(*) into v_count from public.submissions s where s.schedule_id = old.id;
    select c.title into v_name from public.checklists c where c.id = old.checklist_id;

    perform public.write_audit('schedule.deleted', v_board, old.id,
      jsonb_build_object('checklist', v_name, 'kind', old.kind, 'records_removed', v_count));
    return old;
  end if;

  v_board := public.checklist_board_id(new.checklist_id);
  select c.title into v_name from public.checklists c where c.id = new.checklist_id;

  if tg_op = 'INSERT' then
    perform public.write_audit('schedule.created', v_board, new.id,
      jsonb_build_object('checklist', v_name, 'kind', new.kind));
  elsif new.active is distinct from old.active then
    perform public.write_audit(
      case when new.active then 'schedule.resumed' else 'schedule.paused' end,
      v_board, new.id, jsonb_build_object('checklist', v_name));
  end if;

  return new;
end;
$$;

drop trigger if exists schedules_audit on public.schedules;
create trigger schedules_audit
  after insert or update or delete on public.schedules
  for each row execute function public.audit_schedules();

-- -----------------------------------------------------------------------------
-- Submissions
--
-- Only direct deletions. When a schedule is removed its submissions cascade,
-- and by then the schedule row is gone — so the check below is false and the
-- schedule's own entry, with its count, is the record of what happened.
-- -----------------------------------------------------------------------------
create or replace function public.audit_submissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board uuid;
  v_name  text;
begin
  -- `schedule_id` is NOT NULL on this table, so its schedule either still
  -- exists — a direct deletion — or has just been removed, making this part of
  -- that cascade and already described by the schedule's own entry.
  if not exists (select 1 from public.schedules s where s.id = old.schedule_id) then
    return old;
  end if;

  v_board := public.checklist_board_id(old.checklist_id);
  if v_board is null then
    return old;
  end if;

  select c.title into v_name from public.checklists c where c.id = old.checklist_id;

  perform public.write_audit('submission.deleted', v_board, old.id,
    jsonb_build_object(
      'checklist', v_name,
      'due_date', old.due_date,
      'status', old.status,
      'assignee', old.assignee_email
    ));
  return old;
end;
$$;

drop trigger if exists submissions_audit on public.submissions;
create trigger submissions_audit
  after delete on public.submissions
  for each row execute function public.audit_submissions();

-- -----------------------------------------------------------------------------
-- Checklist versions
--
-- Publishing is the moment a version becomes what people are held to. The
-- versions table already records who and when, so the fact was never lost —
-- but it was not in the log an auditor would be shown, and "who changed the
-- fire-safety checklist" is a question that gets asked in a real dispute.
-- -----------------------------------------------------------------------------
create or replace function public.audit_checklist_versions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    select c.title into v_name from public.checklists c where c.id = new.checklist_id;

    perform public.write_audit(
      'checklist.published',
      public.checklist_board_id(new.checklist_id),
      new.checklist_id,
      jsonb_build_object('checklist', v_name, 'version', new.version_number)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists checklist_versions_audit on public.checklist_versions;
create trigger checklist_versions_audit
  after update on public.checklist_versions
  for each row execute function public.audit_checklist_versions();

-- -----------------------------------------------------------------------------
-- Checklists: archiving, same reasoning as archiving a space.
-- -----------------------------------------------------------------------------
create or replace function public.audit_checklists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    perform public.write_audit(
      case when new.archived_at is null then 'checklist.restored' else 'checklist.archived' end,
      new.board_id, new.id, jsonb_build_object('checklist', new.title)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists checklists_audit on public.checklists;
create trigger checklists_audit
  after update on public.checklists
  for each row execute function public.audit_checklists();

-- -----------------------------------------------------------------------------
-- Translations: a cross-tenant action.
--
-- Someone holding `translations` changes wording every customer reads. No space
-- owns that, so it is filed as platform history — one row per key rather than
-- per keystroke, because the editor saves a string at a time.
-- -----------------------------------------------------------------------------
create or replace function public.audit_translations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.write_audit('translation.reset', null, null,
      jsonb_build_object('locale', old.locale, 'key', old.key));
    return old;
  end if;

  perform public.write_audit(
    case when tg_op = 'INSERT' then 'translation.added' else 'translation.changed' end,
    null, null,
    jsonb_build_object('locale', new.locale, 'key', new.key)
  );
  return new;
end;
$$;

drop trigger if exists translations_audit on public.translations;
create trigger translations_audit
  after insert or update or delete on public.translations
  for each row execute function public.audit_translations();

create or replace function public.audit_app_locales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('language.added', null, null,
      jsonb_build_object('code', new.code, 'name', new.name));
  elsif tg_op = 'DELETE' then
    perform public.write_audit('language.removed', null, null,
      jsonb_build_object('code', old.code, 'name', old.name));
  elsif new.enabled is distinct from old.enabled then
    perform public.write_audit(
      case when new.enabled then 'language.enabled' else 'language.disabled' end,
      null, null, jsonb_build_object('code', new.code, 'name', new.name));
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists app_locales_audit on public.app_locales;
create trigger app_locales_audit
  after insert or update or delete on public.app_locales
  for each row execute function public.audit_app_locales();

notify pgrst, 'reload schema';

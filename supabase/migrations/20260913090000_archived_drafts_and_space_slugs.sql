-- RUN THIS IN: gidlist-dev
--
-- Two fixes in one file, so there is one thing to run:
--   A. an archived checklist's unfinished draft stayed "In progress" for ever;
--   B. a space name already used by another account could not be used.
--
-- ===================================================================
-- RUN THIS FIRST. It says whether each part is already applied.
-- ===================================================================
--
--   select
--     position('archived before this was submitted' in
--       pg_get_functiondef('public.set_checklist_archived(uuid,boolean)'::regprocedure)) > 0
--       as part_a_applied,
--     (select prosecdef from pg_proc
--       where oid = 'public.set_board_slug()'::regprocedure)
--       as part_b_applied;
--
--   Both true: nothing to do. Either false: run the whole file — every
--   statement in it is safe to run twice.
--
-- =============================================================================
-- PART A — THE DRAFT NOBODY COULD FINISH
--
-- He archived a checklist he had opened, ticked and unticked. It left Fill in,
-- as it should — and stayed in compliance as "In progress".
--
-- The previous migration cleared a checklist's untouched future obligations on
-- archive and deliberately left drafts alone, reasoning that somebody had
-- started that work and it should follow the ordinary rule: unfinished by its
-- date, a miss. That reasoning missed the one thing that matters. Once the
-- checklist is archived, NOBODY CAN REACH THE DRAFT TO FINISH IT — Fill in no
-- longer shows it. So it sat "In progress" until the nightly job turned it into
-- a miss: a failure recorded against somebody for work they were stopped from
-- doing.
--
-- A draft is one of two things, and they are treated differently:
--
--   * A DRAFT HOLDING NOTHING — no tick, no note, no photo, no file. His case:
--     ticked then unticked leaves every answer empty. That is an obligation
--     somebody glanced at, indistinguishable from one nobody opened, and it is
--     cleared the same way.
--
--   * A DRAFT HOLDING REAL WORK. Somebody ticked items or photographed
--     something before the checklist was archived. That work happened, so the
--     record is KEPT — and VOIDED, with the reason written for them: "Checklist
--     archived before this was submitted." A void takes it out of every figure,
--     and says exactly why, in the place a reviewer looks. Deleting it would
--     destroy evidence; leaving it would record a miss that was not one.
--
-- Only today and later, in each schedule's timezone. A draft from a day that
-- has already passed was unfinished while the checklist was live, and that miss
-- is real history.
--
-- =============================================================================
-- PART B — THE SAME SPACE NAME IN TWO ACCOUNTS
--
-- `boards.slug` is unique across the whole system, because it appears in links.
-- `generate_board_slug()` looked for a free slug with a SELECT, and neither it
-- nor the `set_board_slug` trigger was `security definer` — so the check ran
-- under Row Level Security and saw only the creator's own spaces. Another
-- account's "operations" was invisible, the loop called the slug free, and the
-- unique index refused the insert. That is why a name worked twice inside one
-- account and failed across two.
--
-- THE TRIGGER BECOMES `security definer`, NOT THE SLUG FUNCTION, and that choice
-- is the security part of this fix. A definer-rights slug function would be
-- callable by any signed-in user as `rpc('generate_board_slug', {p_name:
-- 'acme'})`, and the answer — "acme" or "acme-3f9c1" — would confirm whether
-- another company has a space called Acme. A trigger function cannot be called
-- that way. So the trigger runs with owner rights, the slug function it calls
-- inherits them, and nobody may call the slug function directly any more.
--
-- A RANDOM SUFFIX, NOT "-2". A numbered suffix leaks the same fact more loudly:
-- "operations-2" says exactly one other space already uses the name.
--
-- `volatile`, not `stable`. The function now calls random(), and a function
-- marked stable promises the same answer for the same input — which the planner
-- is entitled to rely on.
--
-- Names themselves carry no uniqueness at all. He confirmed two spaces in the
-- same account may share a name — two branches both called "Chilonzor" — so the
-- link is what must be unique, never the name.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- A. Archive a checklist.
-- -----------------------------------------------------------------------------
create or replace function public.set_checklist_archived(p_checklist_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sch record;
begin
  if not public.is_board_editor(public.checklist_board_id(p_checklist_id)) then
    raise exception 'You do not have permission to archive this checklist.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.checklists
     set archived_at = case when p_archived then now() else null end
   where id = p_checklist_id;

  if p_archived then
    -- Obligations nobody opened, and drafts that hold nothing. The per-row
    -- deletion audit is silenced for this one statement: archiving is already
    -- recorded on its own.
    perform set_config('gidlist.suppress_submission_audit', 'on', true);

    delete from public.submissions sub
     using public.schedules sch2
     where sub.schedule_id = sch2.id
       and sub.checklist_id = p_checklist_id
       and sub.voided_at is null
       and sub.due_date >= (now() at time zone sch2.timezone)::date
       and (
         sub.status = 'upcoming'
         or (
           sub.status = 'draft'
           and not exists (
             select 1
               from public.submission_items si
              where si.submission_id = sub.id
                and (coalesce(si.checked, false)
                     or nullif(trim(si.comment), '') is not null
                     or si.photo_path is not null
                     or si.file_path is not null)
           )
         )
       );

    perform set_config('gidlist.suppress_submission_audit', 'off', true);

    -- Drafts that hold real work: kept, and taken out of the figures with the
    -- reason written down. This IS audited — a void is a decision about a
    -- record, and the log should say it happened.
    update public.submissions sub
       set voided_at   = now(),
           voided_by   = (select auth.uid()),
           void_reason = 'Checklist archived before this was submitted.'
      from public.schedules sch2
     where sub.schedule_id = sch2.id
       and sub.checklist_id = p_checklist_id
       and sub.status = 'draft'
       and sub.voided_at is null
       and sub.due_date >= (now() at time zone sch2.timezone)::date;
  else
    -- The archive stamp above is already cleared in this transaction, so the
    -- guard in materialise_one_schedule lets these through.
    for sch in
      select id from public.schedules where checklist_id = p_checklist_id and active
    loop
      perform public.materialise_one_schedule(sch.id);
    end loop;
  end if;
end;
$$;

revoke execute on function public.set_checklist_archived(uuid, boolean) from public, anon;
grant execute on function public.set_checklist_archived(uuid, boolean) to authenticated;


-- -----------------------------------------------------------------------------
-- A. Archive a space — the same rule across all of its checklists.
-- -----------------------------------------------------------------------------
create or replace function public.set_board_archived(p_board_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sch record;
begin
  -- SECURITY DEFINER bypasses RLS, so the check RLS would have made has to be
  -- made explicitly. Owner only, not admin: archiving is not day-to-day
  -- governance, it removes a whole operation from view.
  if not public.is_board_owner(p_board_id) then
    raise exception 'Only the owner can archive a space.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.boards
     set archived_at = case when p_archived then now() else null end
   where id = p_board_id;

  if p_archived then
    perform set_config('gidlist.suppress_submission_audit', 'on', true);

    delete from public.submissions sub
     using public.schedules sch2, public.checklists c
     where sub.schedule_id = sch2.id
       and c.id = sub.checklist_id
       and c.board_id = p_board_id
       and sub.voided_at is null
       and sub.due_date >= (now() at time zone sch2.timezone)::date
       and (
         sub.status = 'upcoming'
         or (
           sub.status = 'draft'
           and not exists (
             select 1
               from public.submission_items si
              where si.submission_id = sub.id
                and (coalesce(si.checked, false)
                     or nullif(trim(si.comment), '') is not null
                     or si.photo_path is not null
                     or si.file_path is not null)
           )
         )
       );

    perform set_config('gidlist.suppress_submission_audit', 'off', true);

    update public.submissions sub
       set voided_at   = now(),
           voided_by   = (select auth.uid()),
           void_reason = 'Space archived before this was submitted.'
      from public.schedules sch2, public.checklists c
     where sub.schedule_id = sch2.id
       and c.id = sub.checklist_id
       and c.board_id = p_board_id
       and sub.status = 'draft'
       and sub.voided_at is null
       and sub.due_date >= (now() at time zone sch2.timezone)::date;
  else
    -- Checklists archived individually stay archived when their space returns;
    -- the guard in materialise_one_schedule skips them.
    for sch in
      select s.id
        from public.schedules s
        join public.checklists c on c.id = s.checklist_id
       where c.board_id = p_board_id
         and s.active
    loop
      perform public.materialise_one_schedule(sch.id);
    end loop;
  end if;
end;
$$;

revoke execute on function public.set_board_archived(uuid, boolean) from public, anon;
grant execute on function public.set_board_archived(uuid, boolean) to authenticated;


-- -----------------------------------------------------------------------------
-- A. One-time: the drafts already stuck — his test checklist among them.
-- Voided by nobody in particular: this is the migration, not a person.
-- -----------------------------------------------------------------------------
select set_config('gidlist.suppress_submission_audit', 'on', true);

delete from public.submissions sub
 using public.schedules sch, public.checklists c, public.boards b
 where sub.schedule_id = sch.id
   and c.id = sub.checklist_id
   and b.id = c.board_id
   and (c.archived_at is not null or b.archived_at is not null)
   and sub.status = 'draft'
   and sub.voided_at is null
   and sub.due_date >= (now() at time zone sch.timezone)::date
   and not exists (
     select 1
       from public.submission_items si
      where si.submission_id = sub.id
        and (coalesce(si.checked, false)
             or nullif(trim(si.comment), '') is not null
             or si.photo_path is not null
             or si.file_path is not null)
   );

select set_config('gidlist.suppress_submission_audit', 'off', true);

update public.submissions sub
   set voided_at   = now(),
       voided_by   = null,
       void_reason = case when c.archived_at is not null
                          then 'Checklist archived before this was submitted.'
                          else 'Space archived before this was submitted.' end
  from public.schedules sch, public.checklists c, public.boards b
 where sub.schedule_id = sch.id
   and c.id = sub.checklist_id
   and b.id = c.board_id
   and (c.archived_at is not null or b.archived_at is not null)
   and sub.status = 'draft'
   and sub.voided_at is null
   and sub.due_date >= (now() at time zone sch.timezone)::date;


-- -----------------------------------------------------------------------------
-- B. The slug: random suffix on collision, volatile, and not callable directly.
-- -----------------------------------------------------------------------------
create or replace function public.generate_board_slug(p_name text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  base_slug text;
  candidate text;
begin
  -- Strip accents, drop anything that is not a letter/digit, collapse runs of
  -- separators into single hyphens.
  base_slug := lower(trim(p_name));
  base_slug := translate(base_slug,
    'àáâãäåèéêëìíîïòóôõöùúûüýÿñçğışöü',
    'aaaaaaeeeeiiiiooooouuuuyyncgisou');
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  if base_slug = '' then
    base_slug := 'board';
  end if;

  base_slug := left(base_slug, 60);
  candidate := base_slug;

  -- Sees every space, because the trigger below runs with owner rights. Before
  -- this migration it saw only the creator's own, which was the bug.
  while exists (select 1 from public.boards where slug = candidate) loop
    candidate := base_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
  end loop;

  return candidate;
end;
$$;

-- Nobody calls this directly any more — see Part B above for why a direct call
-- would be a way to learn another company's space names.
revoke execute on function public.generate_board_slug(text) from public, anon, authenticated;

create or replace function public.set_board_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.generate_board_slug(new.name);
  end if;
  return new;
end;
$$;

commit;

notify pgrst, 'reload schema';


-- ===================================================================
-- AFTER RUNNING: this should return 0.
--
-- Unvoided drafts, today or later, still attached to anything archived.
-- ===================================================================

select count(*) as stuck_drafts_on_archived
  from public.submissions sub
  join public.schedules sch on sch.id = sub.schedule_id
  join public.checklists c  on c.id = sub.checklist_id
  join public.boards b      on b.id = c.board_id
 where (c.archived_at is not null or b.archived_at is not null)
   and sub.status = 'draft'
   and sub.voided_at is null
   and sub.due_date >= (now() at time zone sch.timezone)::date;

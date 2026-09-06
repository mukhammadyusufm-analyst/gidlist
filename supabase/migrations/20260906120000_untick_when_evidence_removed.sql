-- RUN THIS IN: gidlist-dev
--
-- A tick cannot outlive the evidence it depended on.
--
-- ===================================================================
-- RUN THIS FIRST. It says whether the migration is already applied.
-- ===================================================================
--
--   select case when exists (
--     select 1 from pg_trigger
--      where tgname = 'untick_when_evidence_removed'
--        and tgrelid = 'public.submission_items'::regclass
--   ) then 'ALREADY APPLIED - nothing to do'
--     else 'NOT APPLIED - run the migration below' end as state;
--
-- =============================================================================
-- THE HOLE, WHICH WAS A WAY ROUND EVERY EVIDENCE REQUIREMENT
--
-- `check_item_requirements` refuses to let an item be ticked without the
-- photograph or file it demands. It fires on one transition only — unticked to
-- ticked — which was right for what it was written to do and left the obvious
-- next move open:
--
--   1. attach the photograph
--   2. tick the item, which is allowed, because the photograph is there
--   3. delete the photograph
--
-- The item stays ticked. The record then says the work was done and the
-- evidence proving it was required, while no evidence exists. That is worse
-- than never having asked for a photograph at all: it is a compliance record
-- asserting something nobody checked, which is the one thing this product must
-- never produce. He found it by trying it.
--
-- =============================================================================
-- UNTICK RATHER THAN REFUSE, AND WHY THAT WAY ROUND
--
-- The alternative was to refuse the deletion while the item is ticked. It was
-- rejected because it is a worse account of what happened. Removing the only
-- photograph of an item that requires one does not make the deletion invalid —
-- it makes the tick untrue, and the honest thing is to say so rather than to
-- stop somebody deleting a file they have every right to delete.
--
-- Replacing a photograph is unaffected either way: an upload writes the new
-- path over the old one in a single update, so the column is never null and
-- this never fires. Only actual removal reaches it.
--
-- The position goes with it, for the same reason it is cleared on an ordinary
-- untick: a location reading attached to an item nobody claims to have done is
-- a fact about nothing.
--
-- BEFORE, not AFTER, so the rollup trigger that follows sees the corrected row
-- and a parent completed by its children is recomputed in the same statement.
-- =============================================================================

begin;

create or replace function public.untick_when_evidence_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  it record;
begin
  -- Nothing to undo on an item that is not claimed as done.
  if not coalesce(new.checked, false) then
    return new;
  end if;

  -- Only an actual removal: something to nothing. An upload replacing an
  -- earlier file moves path to path and must not be caught here.
  if not (
    (old.photo_path is not null and new.photo_path is null)
    or (old.file_path is not null and new.file_path is null)
  ) then
    return new;
  end if;

  select ci.photo_enabled, ci.photo_required,
         ci.file_enabled, ci.file_required
    into it
    from public.checklist_items ci
   where ci.id = new.item_id;

  if not found then
    return new;
  end if;

  /*
   * Only when the evidence was DEMANDED. "Enabled but not required" means
   * attach it if you have it — an item like that was legitimately ticked with
   * nothing attached, so removing an attachment cannot make the tick untrue.
   *
   * AND ONLY WHEN A PERSON REMOVED IT, WHICH IS THE SUBTLE PART.
   *
   * Retention clears exactly these columns: `expire_due_evidence` nulls
   * `photo_path` and stamps `photo_expired_at` when a board's retention window
   * passes. Without the expiry test below, this trigger would untick every item
   * on every checklist whose evidence has aged out — reaching back through
   * closed submissions and rewriting them as incomplete, months after the fact,
   * because a scheduled job did its job.
   *
   * The distinction the product already draws is the one that applies:
   * evidence that existed and was aged out is not the same as evidence that was
   * never provided, and the interface says so. A tick backed by a photograph
   * that has since expired is still true. A tick backed by a photograph
   * somebody deleted is not.
   */
  if (it.photo_enabled and it.photo_required
       and new.photo_path is null and new.photo_expired_at is null)
     or (it.file_enabled and it.file_required
       and new.file_path is null and new.file_expired_at is null) then
    new.checked             := false;
    new.checked_by          := null;
    new.location_lat        := null;
    new.location_lng        := null;
    new.location_accuracy_m := null;
    new.location_at         := null;
  end if;

  return new;
end;
$$;

drop trigger if exists untick_when_evidence_removed on public.submission_items;

create trigger untick_when_evidence_removed
  before update on public.submission_items
  for each row
  execute function public.untick_when_evidence_removed();

commit;


-- ===================================================================
-- Anything ALREADY in this state, from before the trigger existed.
--
-- Read it before deciding what to do with it. These are submissions
-- that were recorded complete against evidence that is now gone, and
-- correcting them silently would rewrite history rather than show it.
-- ===================================================================

select
  s.id            as submission_id,
  c.title         as checklist,
  ci.title        as item,
  s.status,
  s.submitted_at
from public.submission_items si
join public.checklist_items ci on ci.id = si.item_id
join public.submissions s      on s.id = si.submission_id
join public.checklists c       on c.id = s.checklist_id
where si.checked
  and (
    (ci.photo_enabled and ci.photo_required
      and si.photo_path is null and si.photo_expired_at is null)
    or (ci.file_enabled and ci.file_required
      and si.file_path is null and si.file_expired_at is null)
  )
order by s.submitted_at desc nulls first
limit 50;

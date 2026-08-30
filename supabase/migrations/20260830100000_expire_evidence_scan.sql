begin;

-- ---------------------------------------------------------------------------
-- Make the nightly retention job stop scanning the whole table.
--
-- THE PROBLEM. `expire_evidence()` opened with a CTE that selected every
-- submission item carrying a photo or a file, joined it to submissions,
-- checklists, boards, subscriptions and plans, and only then compared dates.
-- Two things followed from that order:
--
--   1. There was no index to support it, so the plan was a sequential scan of
--      `submission_items` — a table that is overwhelmingly rows with no
--      attachment at all, since most tasks never ask for one.
--
--   2. An account on a plan with indefinite retention has
--      `evidence_retention_days = null`, so its rows can never expire. They were
--      still gathered, joined and carried through the query every single night
--      before being discarded at `where e.days is not null`. The work grew with
--      the number of attachments that will never be deleted, forever.
--
-- Neither is visible today. Both become the reason the job starts timing out at
-- exactly the point there is enough data to matter, which is also the point at
-- which somebody is paying for it.
-- ---------------------------------------------------------------------------

-- A partial index over the only rows this job cares about.
--
-- Partial because attachments are the exception: a checklist item that asks for
-- a photograph is a minority of items, and once expired the paths are set to
-- null and the row leaves the index by itself. The index therefore stays roughly
-- the size of the *unexpired* evidence rather than the size of the table.
create index if not exists submission_items_unexpired_evidence_idx
  on public.submission_items (updated_at)
  where photo_path is not null or file_path is not null;

comment on index public.submission_items_unexpired_evidence_idx is
  'Supports the nightly expire_evidence() sweep. Partial: rows drop out once their paths are nulled.';

-- ---------------------------------------------------------------------------
-- The same job, driven from the small table instead of the large one.
-- ---------------------------------------------------------------------------
create or replace function public.expire_evidence()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  /*
   * Retention still comes from the plan of the account that owns the space, and
   * a space with no subscription still falls back to the free plan's window —
   * the shortest, which is the safe direction to be wrong in because the record
   * survives either way.
   *
   * What changed is the order. Boards are counted in hundreds; submission items
   * are counted in millions. Resolving each board's retention window first turns
   * the question from "every attachment in the system, how old is it?" into
   * "these boards have a window, which of their attachments are past it?" — and
   * boards whose plan keeps evidence indefinitely are excluded here, once,
   * rather than being carried through the whole query and thrown away at the end.
   */
  with board_days as (
    select b.id as board_id,
           coalesce(p.evidence_retention_days, free.evidence_retention_days) as days
      from public.boards b
      left join public.subscriptions sub on sub.owner_id = b.owner_id
      left join public.plans p           on p.code = sub.plan_code
      cross join (
        select evidence_retention_days from public.plans where code = 'free'
      ) free
     where coalesce(p.evidence_retention_days, free.evidence_retention_days) is not null
  ),
  due as (
    select si.id, si.photo_path, si.file_path
      from board_days bd
      join public.checklists c       on c.board_id = bd.board_id
      join public.submissions s      on s.checklist_id = c.id
      join public.submission_items si on si.submission_id = s.id
     where (si.photo_path is not null or si.file_path is not null)
       and si.updated_at < now() - make_interval(days => bd.days)
  ),
  queued as (
    insert into public.storage_cleanup_queue (bucket_id, object_path)
    select 'submission-evidence', path
      from due, lateral (values (due.photo_path), (due.file_path)) as v(path)
     where path is not null
    on conflict do nothing
    returning 1
  )
  update public.submission_items si
     set photo_path       = null,
         photo_expired_at = case when si.photo_path is not null then now() else si.photo_expired_at end,
         file_path        = null,
         file_expired_at  = case when si.file_path is not null then now() else si.file_expired_at end
    from due
   where si.id = due.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_evidence() from public, anon, authenticated;

comment on function public.expire_evidence() is
  'Nightly. Nulls attachment paths past their plan retention window and queues the files for deletion. The record itself is never removed.';

commit;

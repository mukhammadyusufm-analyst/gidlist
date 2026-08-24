-- =============================================================================
-- Un-assigning: release drafts rather than leaving them owned by a stranger
--
-- The previous rule deleted only `upcoming` submissions and left everything
-- else alone. That was right for done and missed — they are the historical
-- record of what happened — but wrong for drafts.
--
-- A draft is work somebody had begun and not finished. Leaving it attached to a
-- person who is no longer assigned means the Fill in list keeps showing a
-- half-finished task under the name of someone not responsible for it, and
-- nobody can finish it. Deleting it would throw away real observations already
-- recorded.
--
-- So a draft is *released*: ticks and comments stay exactly as they were, the
-- name comes off, and anyone in the space can pick it up. done and missed keep
-- their name, because there the name IS the record.
--
-- The complication
-- ----------------
-- `submissions_unique_occurrence` is (schedule_id, due_date, assignee_id) with
-- NULLS NOT DISTINCT, so there can be at most ONE unassigned submission per
-- schedule per date. That is deliberate — it stops the nightly job creating a
-- fresh unassigned row every time it runs.
--
-- But it means releasing a draft can collide: once the last assignee is
-- removed, the schedule has nobody named, so the job starts producing
-- unassigned rows for those same dates. Releasing the draft onto a date that
-- already has one is a duplicate key.
--
-- Resolved by precedence: an untouched `upcoming` row holds no information, and
-- a draft holds someone's actual answers. So the empty row gives way. Where the
-- conflicting row is NOT empty — it has been started or completed by somebody
-- else — nothing is destroyed and the draft simply keeps its name.
-- =============================================================================

begin;

create or replace function public.clear_unstarted_submissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. Nothing was ever done with these, so they should not exist.
  delete from public.submissions s
   where s.schedule_id = old.schedule_id
     and s.status = 'upcoming'
     and (
       (old.user_id is not null and s.assignee_id = old.user_id)
       or (s.assignee_id is null and lower(s.assignee_email) = lower(old.email))
     );

  -- 2. Clear the way for any draft about to be released: an empty unassigned
  --    row on the same date would block it, and holds nothing worth keeping.
  delete from public.submissions dup
   where dup.assignee_id is null
     and dup.assignee_email is null
     and dup.status = 'upcoming'
     and exists (
       select 1
       from public.submissions d
       where d.schedule_id = dup.schedule_id
         and d.due_date = dup.due_date
         and d.status = 'draft'
         and d.id <> dup.id
         and (
           (old.user_id is not null and d.assignee_id = old.user_id)
           or lower(d.assignee_email) = lower(old.email)
         )
     );

  -- 3. Release the drafts. The guard covers the case the delete above cannot:
  --    a conflicting row that has itself been started or completed. Rather than
  --    destroy either, that draft keeps its name.
  update public.submissions s
     set assignee_id = null,
         assignee_email = null
   where s.schedule_id = old.schedule_id
     and s.status = 'draft'
     and (
       (old.user_id is not null and s.assignee_id = old.user_id)
       or lower(s.assignee_email) = lower(old.email)
     )
     and not exists (
       select 1
       from public.submissions other
       where other.schedule_id = s.schedule_id
         and other.due_date = s.due_date
         and other.assignee_id is null
         and other.id <> s.id
     );

  return old;
end;
$$;

-- -----------------------------------------------------------------------------
-- Repair rows left behind by the previous version of this rule, in the same
-- order and with the same precedence.
-- -----------------------------------------------------------------------------

-- Drafts whose named assignee is no longer assigned to the schedule.
create temporary table orphan_drafts on commit drop as
select s.id, s.schedule_id, s.due_date
  from public.submissions s
 where s.status = 'draft'
   and s.assignee_email is not null
   and not exists (
     select 1
     from public.schedule_assignees sa
     where sa.schedule_id = s.schedule_id
       and lower(sa.email) = lower(s.assignee_email)
   );

-- Remove the empty unassigned rows standing in their way.
delete from public.submissions dup
 using orphan_drafts o
 where dup.schedule_id = o.schedule_id
   and dup.due_date = o.due_date
   and dup.id <> o.id
   and dup.assignee_id is null
   and dup.assignee_email is null
   and dup.status = 'upcoming';

update public.submissions s
   set assignee_id = null,
       assignee_email = null
  from orphan_drafts o
 where s.id = o.id
   and not exists (
     select 1
     from public.submissions other
     where other.schedule_id = s.schedule_id
       and other.due_date = s.due_date
       and other.assignee_id is null
       and other.id <> s.id
   );

commit;

notify pgrst, 'reload schema';

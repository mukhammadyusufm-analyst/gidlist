-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- In production, run after gidlist-migration-practice-space-delete.txt.
-- =============================================================================
-- A practice space holds its practice checklist and nothing else.
--
-- The practice space is free of the space limit. If it also accepted new
-- checklists, it would be a second working space on the free plan — the limit
-- would be one space plus a practice space nobody ever deletes. So no checklist
-- can be created in it. The one it starts with is created by
-- ensure_getting_started(), which raises the same transaction-local setting the
-- tutorial-flag guard already checks, and is therefore let through.
--
-- A trigger rather than an RLS policy, so the refusal carries a sentence the app
-- can translate instead of "new row violates row-level security policy".
-- =============================================================================

begin;

create or replace function public.guard_practice_space_checklists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.boards b where b.id = new.board_id and b.is_tutorial)
     and coalesce(current_setting('gidlist.seeding_tutorial', true), '') <> 'on' then
    raise exception 'A practice space cannot hold new checklists. Create your own space for your checklists.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists checklists_guard_practice_space on public.checklists;
create trigger checklists_guard_practice_space
  before insert on public.checklists
  for each row execute function public.guard_practice_space_checklists();

commit;

-- STATE CHECK — expect one row: checklists_guard_practice_space | O
select tgname, tgenabled::text
  from pg_trigger
 where tgname = 'checklists_guard_practice_space';

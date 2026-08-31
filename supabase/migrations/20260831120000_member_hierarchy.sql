-- =============================================================================
-- Reporting lines inside a space
--
-- README item 11, and the foundation the OKR work needs: today a space is a flat
-- list of people, so there is no way to express "my team" — which is the unit
-- almost every objective is actually owned by.
--
-- WHAT THIS DOES NOT DO, DELIBERATELY.
--
-- It does not change who can see what. The item says "design it before building
-- it", and the reason is that visibility today has exactly two cases — a member
-- sees themselves, an editor sees everything — while a hierarchy introduces a
-- third, "mine and my reports'", which every submission and compliance policy
-- would have to express. Rewriting those policies in the same migration that
-- introduces the data would mean shipping a change to who can read compliance
-- history with no way to test the model separately from the rules built on it.
--
-- So this migration is additive and inert: it records the lines and offers the
-- functions to walk them. Nothing reads them yet. Phase B is the visibility
-- rewrite, and it is a separate piece of work with its own review.
--
-- WHY manager_id REFERENCES board_members AND NOT auth.users. A reporting line
-- belongs to a space, not to the world: the same two people can be manager and
-- report in one space and peers in another. Pointing at the membership row makes
-- that structurally true rather than a rule somebody has to remember, and it
-- keeps pending invitees — who have no user_id yet — able to hold a place in the
-- chart before they accept.
-- =============================================================================

begin;

alter table public.board_members
  add column if not exists manager_id uuid
    references public.board_members (id) on delete set null;

comment on column public.board_members.manager_id is
  'Who this member reports to, within the same space. Null for the top of a chart, which may have several. Set null rather than cascading on delete, so removing a manager orphans their reports upward instead of deleting the team.';

-- Reports are looked up far more often than managers are, and always by manager.
create index if not exists board_members_manager_idx
  on public.board_members (manager_id) where manager_id is not null;

-- -----------------------------------------------------------------------------
-- The two rules that keep a chart a chart
-- -----------------------------------------------------------------------------

/**
 * A manager must be in the same space, and nobody may report to themselves.
 *
 * The same-space rule cannot be a foreign key — the key only says the row
 * exists, not that it belongs here — so it is a trigger. Without it a reporting
 * line could point into another customer's space entirely, which would make the
 * chart a cross-tenant reference and eventually a leak.
 */
create or replace function public.check_member_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager_board uuid;
  v_cursor        uuid;
  v_hops          integer := 0;
begin
  if new.manager_id is null then
    return new;
  end if;

  if new.manager_id = new.id then
    raise exception 'Somebody cannot report to themselves.'
      using errcode = 'check_violation';
  end if;

  select board_id into v_manager_board
    from public.board_members where id = new.manager_id;

  if v_manager_board is null or v_manager_board <> new.board_id then
    raise exception 'A manager has to be a member of the same space.'
      using errcode = 'check_violation';
  end if;

  /*
   * Cycles. A -> B -> A is not a hierarchy, and every recursive walk over this
   * table afterwards would loop forever — so it is refused at the point of
   * writing rather than defended against at every read.
   *
   * The hop limit is a second belt: if a cycle somehow already exists in the
   * data, this loop still terminates and reports rather than hanging.
   */
  v_cursor := new.manager_id;
  while v_cursor is not null and v_hops < 100 loop
    if v_cursor = new.id then
      raise exception 'That would make a loop in the reporting lines.'
        using errcode = 'check_violation';
    end if;
    select manager_id into v_cursor from public.board_members where id = v_cursor;
    v_hops := v_hops + 1;
  end loop;

  if v_hops >= 100 then
    raise exception 'The reporting lines are nested too deeply to be valid.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists board_members_check_manager on public.board_members;
create trigger board_members_check_manager
  before insert or update of manager_id on public.board_members
  for each row execute function public.check_member_manager();

-- -----------------------------------------------------------------------------
-- Walking the chart
-- -----------------------------------------------------------------------------

/**
 * Everyone below a member, to any depth.
 *
 * Returns membership ids, not user ids: a pending invitee has no user id and
 * still occupies a place in the chart. Callers that need people join outward.
 *
 * `p_include_self` because both questions are asked in practice — "my team" for
 * a roll-up usually means me and everyone under me, while "my reports" for a
 * delegation list does not.
 */
create or replace function public.board_member_reports(
  p_member_id    uuid,
  p_include_self boolean default false
)
returns table (member_id uuid, depth integer)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive tree as (
    select bm.id, 0 as depth
      from public.board_members bm
     where bm.id = p_member_id

    union all

    select child.id, tree.depth + 1
      from public.board_members child
      join tree on child.manager_id = tree.id
     -- Bounded even if a cycle were somehow written past the trigger above.
     where tree.depth < 100
  )
  select tree.id, tree.depth
    from tree
   where p_include_self or tree.depth > 0;
$$;

comment on function public.board_member_reports(uuid, boolean) is
  'Every membership below one member, to any depth. The building block for "my team" — not yet used by any visibility policy; see README item 11.';

grant execute on function public.board_member_reports(uuid, boolean) to authenticated;

/**
 * Whether one member sits anywhere above another.
 *
 * The question a future visibility policy will actually ask, expressed once here
 * so that when those policies are written they cannot each answer it slightly
 * differently.
 */
create or replace function public.is_manager_of(p_manager_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.board_member_reports(p_manager_id, false) r
     where r.member_id = p_member_id
  );
$$;

comment on function public.is_manager_of(uuid, uuid) is
  'True when the first membership is an ancestor of the second in the same space''s reporting lines.';

grant execute on function public.is_manager_of(uuid, uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

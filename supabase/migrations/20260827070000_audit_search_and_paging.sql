-- =============================================================================
-- Traceability, search and paging for the log and access views.
--
-- TWO PROBLEMS WITH WHAT SHIPPED.
--
-- The log identified an actor by display name alone. Names are not identities:
-- two people called Alisher Karimov produce identical rows, and the one record
-- meant to settle "who did this" would settle nothing. Worse, a display name is
-- user-editable — someone can change theirs after acting, and every historical
-- row follows, because the name was resolved at read time rather than stored.
-- Email and the account id are now returned alongside it. The id is what
-- actually distinguishes; the email is what a person can recognise.
--
-- And every view returned a fixed slice with no way to look past it or into it.
-- A log holding a year of activity that only shows the newest fifty rows is a
-- log nobody can use to answer a question about March.
--
-- Each function now takes a search string, an optional action filter, and a
-- window — and returns the total count alongside, so the interface can say
-- "showing 1-25 of 340" rather than leaving people guessing whether there is
-- more.
-- =============================================================================

-- Return types change, so the old definitions have to go first.
drop function if exists public.board_audit_log(uuid, integer);
drop function if exists public.platform_audit_log(integer);
drop function if exists public.platform_people();

/**
 * One space's history.
 *
 * `p_search` matches the actor's name or email, the action, and the detail —
 * the detail as text on purpose, so searching for a colleague's address finds
 * the rows about them as well as the rows by them, which is usually what
 * somebody is actually looking for.
 */
create or replace function public.board_audit_log(
  p_board_id uuid,
  p_search   text default null,
  p_action   text default null,
  p_limit    integer default 25,
  p_offset   integer default 0
)
returns table (
  id          bigint,
  action      text,
  actor_id    uuid,
  actor_name  text,
  actor_email text,
  detail      jsonb,
  created_at  timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_action text := nullif(trim(coalesce(p_action, '')), '');
begin
  if not public.is_board_admin(p_board_id) then
    raise exception 'You do not have permission to view this space''s history.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  with matched as (
    select a.id, a.action, a.actor_id, p.full_name, u.email::text as email,
           a.detail, a.created_at
    from public.audit_log a
    left join auth.users u on u.id = a.actor_id
    left join public.profiles p on p.id = a.actor_id
    where a.board_id = p_board_id
      and (v_action is null or a.action = v_action)
      and (
        v_search is null
        or p.full_name ilike '%' || v_search || '%'
        or u.email::text ilike '%' || v_search || '%'
        or a.action ilike '%' || v_search || '%'
        or a.detail::text ilike '%' || v_search || '%'
      )
  )
  select m.id, m.action, m.actor_id,
         coalesce(m.full_name, m.email, 'system'),
         m.email,
         m.detail, m.created_at,
         count(*) over () as total_count
  from matched m
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.platform_audit_log(
  p_search text default null,
  p_action text default null,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  id          bigint,
  action      text,
  actor_id    uuid,
  actor_name  text,
  actor_email text,
  detail      jsonb,
  created_at  timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_action text := nullif(trim(coalesce(p_action, '')), '');
begin
  if not public.has_platform_capability('grants') then
    raise exception 'You do not have permission to view platform history.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  with matched as (
    select a.id, a.action, a.actor_id, p.full_name, u.email::text as email,
           a.detail, a.created_at
    from public.audit_log a
    left join auth.users u on u.id = a.actor_id
    left join public.profiles p on p.id = a.actor_id
    where a.board_id is null
      and (v_action is null or a.action = v_action)
      and (
        v_search is null
        or p.full_name ilike '%' || v_search || '%'
        or u.email::text ilike '%' || v_search || '%'
        or a.action ilike '%' || v_search || '%'
        or a.detail::text ilike '%' || v_search || '%'
      )
  )
  select m.id, m.action, m.actor_id,
         coalesce(m.full_name, m.email, 'system'),
         m.email,
         m.detail, m.created_at,
         count(*) over () as total_count
  from matched m
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

/**
 * Which actions actually appear, for a filter that only offers real choices.
 *
 * Built from the data rather than a hard-coded list: a dropdown offering
 * actions that never occur wastes the reader's attention, and one missing an
 * action a new trigger writes would hide rows from somebody searching for them.
 */
create or replace function public.audit_actions(p_board_id uuid default null)
returns table (action text, uses bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_board_id is null then
    if not public.has_platform_capability('grants') then
      raise exception 'You do not have permission to view platform history.'
        using errcode = 'insufficient_privilege';
    end if;
  elsif not public.is_board_admin(p_board_id) then
    raise exception 'You do not have permission to view this space''s history.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select a.action, count(*)
  from public.audit_log a
  where (p_board_id is null and a.board_id is null)
     or (a.board_id = p_board_id)
  group by a.action
  order by a.action;
end;
$$;

/**
 * People and their platform access.
 *
 * Paged for the same reason as the logs: this lists every account that has ever
 * signed up, and that number only grows.
 */
create or replace function public.platform_people(
  p_search text default null,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  user_id      uuid,
  email        text,
  full_name    text,
  capabilities text[],
  total_count  bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.has_platform_capability('grants') then
    raise exception 'You do not have permission to manage access.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  with people as (
    select u.id, u.email::text as email, p.full_name, u.created_at,
           coalesce(
             array_agg(g.capability order by g.capability)
               filter (where g.capability is not null),
             '{}'::text[]
           ) as caps
    from auth.users u
    join public.profiles p on p.id = u.id
    left join public.platform_grants g on g.user_id = u.id
    where v_search is null
       or p.full_name ilike '%' || v_search || '%'
       or u.email::text ilike '%' || v_search || '%'
    group by u.id, u.email, p.full_name, u.created_at
  )
  select pe.id, pe.email, pe.full_name, pe.caps, count(*) over ()
  from people pe
  -- People who hold something first: this page exists to review access, and
  -- the accounts with access are what somebody came to look at.
  order by cardinality(pe.caps) desc, pe.created_at
  limit least(greatest(coalesce(p_limit, 25), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.board_audit_log(uuid, text, text, integer, integer) from public, anon;
revoke execute on function public.platform_audit_log(text, text, integer, integer)    from public, anon;
revoke execute on function public.platform_people(text, integer, integer)             from public, anon;
revoke execute on function public.audit_actions(uuid)                                 from public, anon;

grant execute on function public.board_audit_log(uuid, text, text, integer, integer) to authenticated;
grant execute on function public.platform_audit_log(text, text, integer, integer)    to authenticated;
grant execute on function public.platform_people(text, integer, integer)             to authenticated;
grant execute on function public.audit_actions(uuid)                                 to authenticated;

notify pgrst, 'reload schema';

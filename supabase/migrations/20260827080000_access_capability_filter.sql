-- =============================================================================
-- Filter the access page by capability.
--
-- The page lists every account that has ever signed up, and the question it
-- exists to answer is "who holds access" — a handful of rows among all of them.
-- Search by name finds a person you already suspect; this finds the set you
-- came to review, which is the more common reason to open the page at all.
--
-- Two parameters rather than one with a magic value. A single `p_capability`
-- taking 'any' as a sentinel alongside real capability codes would break the
-- day somebody adds a capability called `any`, and would read as a bug in the
-- meantime.
-- =============================================================================

drop function if exists public.platform_people(text, integer, integer);

create or replace function public.platform_people(
  p_search     text default null,
  p_capability text default null,
  p_with_access boolean default false,
  p_limit      integer default 25,
  p_offset     integer default 0
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
  v_cap    text := nullif(trim(coalesce(p_capability, '')), '');
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
  ),
  filtered as (
    -- Applied after aggregation, not in the join. Filtering the join would drop
    -- a person's other capabilities from the array, so someone found by holding
    -- `accounts` would appear to hold only that.
    select * from people pe
    where (v_cap is null or v_cap = any(pe.caps))
      and (not coalesce(p_with_access, false) or cardinality(pe.caps) > 0)
  )
  select f.id, f.email, f.full_name, f.caps, count(*) over ()
  from filtered f
  order by cardinality(f.caps) desc, f.created_at
  limit least(greatest(coalesce(p_limit, 25), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

/**
 * How many people hold each capability.
 *
 * So the filter can show "accounts (2)" rather than offering choices that turn
 * out to match nobody — the same reasoning as building the audit action filter
 * from the data instead of a fixed list.
 */
create or replace function public.platform_capability_counts()
returns table (capability text, holders bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_capability('grants') then
    raise exception 'You do not have permission to manage access.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select c.code, count(g.user_id)
  from public.platform_capabilities c
  left join public.platform_grants g on g.capability = c.code
  group by c.code, c.sort_order
  order by c.sort_order;
end;
$$;

revoke execute on function public.platform_people(text, text, boolean, integer, integer)
  from public, anon;
revoke execute on function public.platform_capability_counts() from public, anon;

grant execute on function public.platform_people(text, text, boolean, integer, integer)
  to authenticated;
grant execute on function public.platform_capability_counts() to authenticated;

notify pgrst, 'reload schema';

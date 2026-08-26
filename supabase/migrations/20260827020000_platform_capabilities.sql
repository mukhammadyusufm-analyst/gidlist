-- =============================================================================
-- Platform access, split into capabilities.
--
-- `profiles.is_platform_admin` was one boolean: hold it and you could do
-- everything administrative, from rewriting every customer's button labels to
-- reading revenue. That is fine while one person holds it and wrong the moment
-- a second does. A translator should be able to fix Uzbek wording without
-- seeing what customers pay.
--
-- CAPABILITIES, NOT ROLES. A role is a bundle, and a bundle is always slightly
-- wrong for somebody — you end up making "translator plus billing" and then
-- "translator plus billing minus refunds". Capabilities compose instead, and a
-- new one is a row rather than a rewrite.
--
-- THE ROOT STAYS OUT OF THE APP. `grants` — the capability to give and take
-- capabilities — can only be set with SQL. A master can hand out `translations`
-- and `accounts`; they cannot mint another master, and nobody can promote
-- themselves. That is the property `is_platform_admin` had by virtue of being
-- SQL-only, and it is the one worth keeping while making everything below it
-- delegable.
--
-- Enforcement is in Row Level Security, as everywhere else here, so a
-- translator calling the API directly still cannot read accounts.
-- =============================================================================

create table if not exists public.platform_capabilities (
  code        text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name        text not null check (length(trim(name)) between 1 and 60),
  description text,
  -- True only for `grants`. Flagged rather than hard-coded by name so the rule
  -- is visible in the data, and so a second root-like capability could never be
  -- introduced by accident.
  is_root     boolean not null default false,
  sort_order  integer not null default 0
);

comment on table public.platform_capabilities is
  'What platform access can be granted. Rows, not code — a new capability is an insert.';

insert into public.platform_capabilities (code, name, description, is_root, sort_order)
values
  ('translations', 'Translations',
   'Edit the interface wording every customer sees.', false, 1),
  ('accounts', 'Accounts and revenue',
   'See customer accounts, their plans, and what they pay.', false, 2),
  ('grants', 'Manage access',
   'Give and take platform access. Can only be set with SQL.', true, 0)
on conflict (code) do nothing;

create table if not exists public.platform_grants (
  user_id    uuid not null references auth.users (id) on delete cascade,
  capability text not null references public.platform_capabilities (code) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, capability)
);

comment on table public.platform_grants is
  'Who holds which platform capability. The `grants` capability is settable only by SQL.';

create index if not exists platform_grants_capability_idx
  on public.platform_grants (capability);

-- -----------------------------------------------------------------------------
-- Carry over whoever already had the old flag.
--
-- They get everything, including the root, so nothing anyone can do today stops
-- working. This is the only path by which `grants` is ever handed out
-- automatically, and it runs once against accounts that already held unlimited
-- administrative power.
-- -----------------------------------------------------------------------------
insert into public.platform_grants (user_id, capability)
select p.id, c.code
from public.profiles p
cross join public.platform_capabilities c
where p.is_platform_admin
on conflict do nothing;

-- =============================================================================
-- Functions
-- =============================================================================

create or replace function public.has_platform_capability(p_capability text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.platform_grants g
    where g.user_id = (select auth.uid())
      and g.capability = p_capability
  );
$$;

comment on function public.has_platform_capability(text) is
  'Whether the caller holds a platform capability. Stable and definer, so it works inside RLS policies.';

-- Kept, redefined, and now meaning "holds the root". Existing policies and app
-- code reference it, and quietly widening it to "holds anything" would give a
-- translator administrative reach the moment this migration ran.
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.has_platform_capability('grants');
$$;

comment on function public.is_platform_admin() is
  'Holds the root `grants` capability. Prefer has_platform_capability() for anything narrower.';

-- What the caller may do, for deciding what to render.
create or replace function public.my_platform_capabilities()
returns setof text
language sql
security definer
set search_path = ''
stable
as $$
  select g.capability
  from public.platform_grants g
  where g.user_id = (select auth.uid());
$$;

/**
 * Grant and revoke, for a master to use from inside the app.
 *
 * Refuses the root capability outright. Without that line this function would
 * be a way to mint masters, and the whole point of keeping `grants` in SQL is
 * that the set of people who can hand out power changes only deliberately, by
 * someone at a database console.
 */
create or replace function public.set_platform_grant(
  p_user_id    uuid,
  p_capability text,
  p_granted    boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_root boolean;
begin
  if not public.has_platform_capability('grants') then
    raise exception 'You do not have permission to manage platform access.'
      using errcode = 'insufficient_privilege';
  end if;

  select c.is_root into v_is_root
  from public.platform_capabilities c
  where c.code = p_capability;

  if v_is_root is null then
    raise exception 'Unknown capability.' using errcode = 'check_violation';
  end if;

  if v_is_root then
    raise exception 'This capability can only be granted directly in the database.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_granted then
    insert into public.platform_grants (user_id, capability, granted_by)
    values (p_user_id, p_capability, (select auth.uid()))
    on conflict (user_id, capability) do nothing;
  else
    delete from public.platform_grants
    where user_id = p_user_id and capability = p_capability;
  end if;
end;
$$;

-- =============================================================================
-- Row Level Security
--
-- Translations move off `is_platform_admin` and onto the narrower capability,
-- which is the point of the whole change: holding `translations` must not carry
-- any reach beyond wording.
-- =============================================================================

alter table public.platform_capabilities enable row level security;
alter table public.platform_grants       enable row level security;

drop policy if exists platform_capabilities_read on public.platform_capabilities;
create policy platform_capabilities_read on public.platform_capabilities
  for select to authenticated using (true);

-- Visible to whoever manages access, and to each person for their own row —
-- someone should be able to see what they hold without being able to see who
-- else holds what.
drop policy if exists platform_grants_read on public.platform_grants;
create policy platform_grants_read on public.platform_grants
  for select to authenticated
  using (user_id = (select auth.uid()) or public.has_platform_capability('grants'));

-- No write policies. Grants change only through set_platform_grant(), which
-- refuses the root capability. A direct insert would bypass that check.

drop policy if exists app_locales_write on public.app_locales;
create policy app_locales_write on public.app_locales
  for all to authenticated
  using (public.has_platform_capability('translations'))
  with check (public.has_platform_capability('translations'));

drop policy if exists translations_write on public.translations;
create policy translations_write on public.translations
  for all to authenticated
  using (public.has_platform_capability('translations'))
  with check (public.has_platform_capability('translations'));

revoke execute on function public.has_platform_capability(text)          from public, anon;
revoke execute on function public.is_platform_admin()                    from public, anon;
revoke execute on function public.my_platform_capabilities()             from public, anon;
revoke execute on function public.set_platform_grant(uuid, text, boolean) from public, anon;

grant execute on function public.has_platform_capability(text)          to authenticated;
grant execute on function public.is_platform_admin()                    to authenticated;
grant execute on function public.my_platform_capabilities()             to authenticated;
grant execute on function public.set_platform_grant(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';

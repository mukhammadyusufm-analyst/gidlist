-- =============================================================================
-- In-app translation management
--
-- Lets the people running the product add languages and correct wording without
-- a code change and a redeploy.
--
-- Two tables and one new privilege level:
--
--   app_locales  — which languages are offered
--   translations — overrides for individual strings
--
-- Overrides sit ON TOP of the catalogue shipped with the app rather than
-- replacing it. That means a new language works from the moment it is added
-- (untranslated strings fall back to English), and a bad edit can be undone by
-- deleting the override rather than by hunting for the original text.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Platform administrators
--
-- Deliberately NOT the same thing as a space owner. Space owners administer
-- their own company's data; interface wording is shared by every customer, so
-- letting a space owner edit it would let one customer change what all the
-- others read.
--
-- There is no way to grant this from inside the app, by design. The first
-- administrator is set with a SQL statement; a self-service path would mean
-- anyone who registered could promote themselves.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

comment on column public.profiles.is_platform_admin is
  'Grants access to app-wide settings such as translations. Set manually via SQL, never from the app.';

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- app_locales
-- -----------------------------------------------------------------------------
create table if not exists public.app_locales (
  code       text primary key check (code ~ '^[a-z]{2}(-[A-Za-z0-9]{2,8})?$'),
  name       text not null check (length(trim(name)) between 1 and 60),
  enabled    boolean not null default true,
  -- True for the three that ship with the app. They have a bundled catalogue,
  -- so they still work if the database is unreachable, and they cannot be
  -- deleted out from under a user whose profile points at them.
  is_builtin boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.app_locales is
  'Languages offered in the interface. Built-in ones ship with the app; others are added here.';

insert into public.app_locales (code, name, is_builtin)
values ('en', 'English', true),
       ('uz', 'O''zbekcha', true),
       ('ru', 'Русский', true)
on conflict (code) do update set is_builtin = true, name = excluded.name;

-- A built-in language must not be deleted: profiles reference these codes, and
-- the shipped catalogue assumes they exist.
create or replace function public.protect_builtin_locale()
returns trigger
language plpgsql
as $$
begin
  if old.is_builtin then
    raise exception 'Built-in languages cannot be removed.' using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists app_locales_protect_builtin on public.app_locales;
create trigger app_locales_protect_builtin
  before delete on public.app_locales
  for each row execute function public.protect_builtin_locale();

-- -----------------------------------------------------------------------------
-- translations
-- -----------------------------------------------------------------------------
create table if not exists public.translations (
  id         uuid primary key default gen_random_uuid(),
  locale     text not null references public.app_locales (code) on delete cascade,
  key        text not null check (length(trim(key)) between 1 and 200),
  value      text not null check (length(value) <= 2000),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.translations is
  'Per-string overrides layered over the catalogue shipped with the app.';

create unique index if not exists translations_locale_key_idx
  on public.translations (locale, key);

-- The load path is "every override for one locale", so this is the index that
-- matters — it is read on every page render.
create index if not exists translations_locale_idx on public.translations (locale);

drop trigger if exists translations_set_updated_at on public.translations;
create trigger translations_set_updated_at
  before update on public.translations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.app_locales enable row level security;
alter table public.translations enable row level security;

-- Readable by everyone including signed-out visitors: the sign-in page needs
-- its own translations, and there is nothing private in a button label.
drop policy if exists app_locales_read on public.app_locales;
create policy app_locales_read on public.app_locales
  for select to public using (true);

drop policy if exists translations_read on public.translations;
create policy translations_read on public.translations
  for select to public using (true);

drop policy if exists app_locales_write on public.app_locales;
create policy app_locales_write on public.app_locales
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists translations_write on public.translations;
create policy translations_write on public.translations
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

commit;

notify pgrst, 'reload schema';

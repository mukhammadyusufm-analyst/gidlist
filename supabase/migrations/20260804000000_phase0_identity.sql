-- =============================================================================
-- Phase 0 — Identity
--
-- Supabase owns the `auth.users` table and we never write to it directly.
-- `public.profiles` is our own mirror, holding the application-level fields
-- (display name, avatar, preferred language) that auth.users has no place for.
--
-- The two are linked 1:1 by primary key so a profile can never outlive its
-- user, and `on delete cascade` means deleting the auth user cleans up here
-- automatically.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared helper: keep updated_at honest.
-- Doing this in a trigger rather than in application code means it stays
-- correct no matter which client wrote the row — web, mobile, or SQL console.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null default '',
  avatar_url  text,
  -- Drives the i18n layer in Phase 6. Kept here rather than in localStorage so
  -- a user's language follows them from desktop to the mobile app.
  locale      text        not null default 'en',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Application-level user data. One row per auth.users row, created automatically on signup.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Auto-create a profile when someone signs up.
--
-- SECURITY DEFINER is required: the inserting session is the brand-new user,
-- who by design has no INSERT rights on profiles. `search_path = ''` is the
-- companion safety measure — without it, a malicious schema earlier on the
-- path could shadow `profiles` and capture the insert, so every name below is
-- fully qualified.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- RLS is the real access control for this product. The app's screens are a
-- convenience layer; a bug in a query, a forged request, or a leaked anon key
-- still cannot read another user's row because the database itself refuses.
--
-- `(select auth.uid())` rather than a bare `auth.uid()` is deliberate: the
-- subquery form is evaluated once per statement instead of once per row, which
-- matters a great deal once these tables are large.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Note the policies that are deliberately absent:
--
--   INSERT — profiles are created only by handle_new_user(). Denying INSERT to
--            clients removes any way to forge a profile for another user id.
--   DELETE — profiles die with their auth.users row via cascade. Letting a
--            client delete its profile directly would orphan boards it owns.

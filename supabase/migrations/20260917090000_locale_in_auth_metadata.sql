-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- =============================================================================
-- Emails from Supabase Auth in the person's language.
--
-- Supabase has one template per email, not one per language. What a template
-- CAN do is branch on `{{ .Data }}`, which is the user's `user_metadata`. So the
-- language has to be there: `locale` in `auth.users.raw_user_meta_data`.
--
--   * Sign-up already writes it (the app passes the language on screen).
--   * This trigger keeps it equal to `profiles.locale` whenever that changes —
--     choosing a language, or the guided start saving the first one.
--   * The backfill below gives every existing account its language now.
--
-- Only UPDATE, not INSERT: a new profile is created with the default 'en'
-- before anyone has chosen, and copying that over the language sign-up just
-- wrote would send the confirmation email in English.
-- =============================================================================

begin;

create or replace function public.sync_locale_to_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users u
     set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
                              || jsonb_build_object('locale', new.locale)
   where u.id = new.id
     and (u.raw_user_meta_data ->> 'locale') is distinct from new.locale;
  return new;
end;
$$;

revoke execute on function public.sync_locale_to_auth_metadata() from public, anon, authenticated;

drop trigger if exists profiles_sync_locale_to_auth on public.profiles;
create trigger profiles_sync_locale_to_auth
  after update of locale on public.profiles
  for each row execute function public.sync_locale_to_auth_metadata();

-- Every existing account, now.
update auth.users u
   set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
                            || jsonb_build_object('locale', p.locale)
  from public.profiles p
 where p.id = u.id
   and (u.raw_user_meta_data ->> 'locale') is distinct from p.locale;

commit;

-- STATE CHECK — expect one row: t | 0
--   has_trigger, accounts_without_language
select
  exists (select 1 from pg_trigger where tgname = 'profiles_sync_locale_to_auth') as has_trigger,
  (select count(*)
     from auth.users u
     join public.profiles p on p.id = u.id
    where (u.raw_user_meta_data ->> 'locale') is distinct from p.locale)         as accounts_without_language;

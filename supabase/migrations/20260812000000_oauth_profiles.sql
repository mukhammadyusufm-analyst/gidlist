-- =============================================================================
-- Make profile creation work for OAuth sign-ups
--
-- Phase 0's handle_new_user() read exactly one field:
--
--   new.raw_user_meta_data ->> 'full_name'
--
-- That is what the email signup form sends. Google sends its own shape —
-- `name`, `given_name`, `picture` — so a Google sign-up would have produced a
-- profile with a blank name and no avatar, and the person would appear as an
-- empty row in every member list.
--
-- Providers disagree on these key names, so each is tried in turn rather than
-- assuming one.
-- =============================================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text;
  v_avatar text;
begin
  -- `full_name` is our own signup form and Supabase's normalised field;
  -- `name` is what Google actually sends. The given/family pair is the
  -- fallback for providers that send no combined name at all.
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(
      trim(
        concat_ws(
          ' ',
          new.raw_user_meta_data ->> 'given_name',
          new.raw_user_meta_data ->> 'family_name'
        )
      ),
      ''
    ),
    ''
  );

  -- Google calls it `picture`; Supabase normalises some providers to
  -- `avatar_url`. Either is a usable image URL.
  v_avatar := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'picture'), '')
  );

  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, v_name, v_avatar)
  on conflict (id) do update
    -- A conflict means the row already exists — which happens when someone who
    -- signed up by email later links Google. Only fill blanks; never overwrite
    -- a name the person has since edited themselves.
    set full_name  = case
                       when trim(public.profiles.full_name) = '' then excluded.full_name
                       else public.profiles.full_name
                     end,
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Backfill anyone who already signed up without a name being captured.
-- -----------------------------------------------------------------------------
update public.profiles p
   set full_name = coalesce(
         nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
         nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
         p.full_name
       ),
       avatar_url = coalesce(
         p.avatar_url,
         nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), ''),
         nullif(trim(u.raw_user_meta_data ->> 'picture'), '')
       )
  from auth.users u
 where u.id = p.id
   and (trim(p.full_name) = '' or p.avatar_url is null);

commit;

notify pgrst, 'reload schema';

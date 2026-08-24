-- =============================================================================
-- Board descriptions, and identifying imagery for boards and checklists
--
-- Adds:
--   * boards.description and boards.banner_url
--   * checklists.avatar_url (banner_url already exists from Phase 2)
--   * two more storage buckets, and one consolidated set of storage policies
--
-- The four media buckets all answer the same authorisation question — "is the
-- caller an admin of the board this file belongs to?" — so they now share one
-- set of policies rather than four near-identical copies that would drift.
-- =============================================================================

begin;

alter table public.boards
  add column if not exists description text,
  add column if not exists banner_url  text;

comment on column public.boards.description is
  'Short description shown under the board name.';

alter table public.checklists
  add column if not exists avatar_url text;

comment on column public.checklists.avatar_url is
  'Small square image, so checklists are distinguishable at a glance in a list.';

-- Length guards. Applied as NOT VALID so the statement cannot fail on existing
-- rows, then validated separately — there is no existing data to violate them,
-- but this is the habit that keeps a migration from stalling on live data later.
alter table public.boards
  drop constraint if exists boards_description_length;
alter table public.boards
  add constraint boards_description_length check (description is null or length(description) <= 500)
  not valid;
alter table public.boards validate constraint boards_description_length;

-- =============================================================================
-- Storage
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('board-banners', 'board-banners', true, 5242880,
   array['image/png', 'image/jpeg', 'image/webp']),
  ('checklist-avatars', 'checklist-avatars', true, 2097152,
   array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Banners exclude SVG deliberately, as in Phase 2: they are displayed large,
-- SVG can carry script, and nothing about a photograph needs vector format.
-- Avatars follow the same rule for the same reason.

-- Replace the per-bucket policies with one pair covering all four. Every file
-- is stored as `<board_id>/<filename>`, so the first path segment is the
-- authorisation key in every case.
drop policy if exists board_logos_read on storage.objects;
drop policy if exists board_logos_insert on storage.objects;
drop policy if exists board_logos_update on storage.objects;
drop policy if exists board_logos_delete on storage.objects;
drop policy if exists checklist_banners_read on storage.objects;
drop policy if exists checklist_banners_write on storage.objects;

drop policy if exists board_media_read on storage.objects;
create policy board_media_read
  on storage.objects
  for select
  to public
  using (
    bucket_id in ('board-logos', 'board-banners', 'checklist-banners', 'checklist-avatars')
  );

drop policy if exists board_media_write on storage.objects;
create policy board_media_write
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id in ('board-logos', 'board-banners', 'checklist-banners', 'checklist-avatars')
    and public.is_board_admin(public.storage_board_id(name))
  )
  with check (
    bucket_id in ('board-logos', 'board-banners', 'checklist-banners', 'checklist-avatars')
    and public.is_board_admin(public.storage_board_id(name))
  );

commit;

notify pgrst, 'reload schema';

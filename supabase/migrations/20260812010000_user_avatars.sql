-- =============================================================================
-- Storage for personal avatars
--
-- Every existing bucket is authorised by BOARD: the first path segment is a
-- board id, and the policy asks "is the caller an admin of that board?". A
-- personal avatar belongs to a person, not to a space, so it needs its own
-- bucket with its own rule — the first path segment is the user's own id.
--
-- Reusing a board bucket would have meant a space admin could overwrite a
-- colleague's personal photograph, which is not a permission anyone asked for.
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  true,
  2097152,  -- 2 MB
  -- No SVG. An avatar is shown beside a person's name across the product, and
  -- SVG can carry script; there is no reason to accept it for a photograph.
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Readable by anyone signed in: avatars appear in member lists and on
-- submissions, so a colleague has to be able to load them.
drop policy if exists user_avatars_read on storage.objects;
create policy user_avatars_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'user-avatars');

-- Writable only within your own folder. `(storage.foldername(name))[1]` is the
-- first path segment; comparing it to auth.uid() is what stops one person
-- replacing another's avatar.
drop policy if exists user_avatars_write on storage.objects;
create policy user_avatars_write
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;

notify pgrst, 'reload schema';

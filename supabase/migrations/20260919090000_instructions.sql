-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- =============================================================================
-- Instructions on a checklist and on its items (README item 57).
--
-- A checklist becomes an SOP: the author writes how the work is done, and the
-- person filling it in reads it where they do it.
--
-- NOT A NEW TABLE, AND NOT EVIDENCE. Evidence is uploaded by whoever fills a
-- checklist in, once per submission, and lives in `submission_items`.
-- Instructions are written once by the author and shown to everyone, so they
-- belong to the version: a list on `checklist_items` and on
-- `checklist_versions`. That choice buys three things for free — they are
-- frozen with the published version, `create_checklist_draft()` already copies
-- whole rows so a new draft carries them, and the RLS policies on those tables
-- already say who may read and write them.
--
-- SHAPE. A JSON array of blocks, in display order:
--   {"type":"text",  "text":"..."}
--   {"type":"image", "path":"<board>/<checklist>/<file>", "name":"...", "size":123}
--   {"type":"file",  "path":"<board>/<checklist>/<file>", "name":"...", "size":123}
--   {"type":"video", "url":"https://...", "title":"...", "thumb":"<path>|null"}
-- Only the array-ness is enforced here; the app writes the blocks and reads
-- them defensively, because a check constraint on every field would have to be
-- migrated every time a block type is added.
--
-- FILES ARE PRIVATE, AND NARROWER THAN THE SPACE (his decision, 17 Sep 2026):
-- only the people the checklist is actually given to — anyone holding a
-- submission for it — plus the editors who build it. Video is a link, never an
-- upload: a 10 MB bucket cannot hold video, and the hosting bill for one that
-- could is not something this product should take on quietly.
-- =============================================================================

begin;

alter table public.checklist_items
  add column if not exists instructions jsonb not null default '[]'::jsonb;

alter table public.checklist_versions
  add column if not exists instructions jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checklist_items_instructions_array') then
    alter table public.checklist_items
      add constraint checklist_items_instructions_array check (jsonb_typeof(instructions) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'checklist_versions_instructions_array') then
    alter table public.checklist_versions
      add constraint checklist_versions_instructions_array check (jsonb_typeof(instructions) = 'array');
  end if;
end;
$$;

comment on column public.checklist_items.instructions is
  'How to do this item: an ordered JSON array of text, image, file and video blocks. Written by the author, frozen with the version, never by the person filling it in.';
comment on column public.checklist_versions.instructions is
  'How to do this checklist as a whole. Same shape as checklist_items.instructions.';

-- -----------------------------------------------------------------------------
-- Which checklist a stored file belongs to.
--
-- `storage_board_id` already reads the first path segment; instruction files are
-- `<board_id>/<checklist_id>/<file>`, so the second segment decides who may read
-- it. Invalid input returns null rather than raising: a policy must never error
-- on a malformed object name, it must simply not match.
-- -----------------------------------------------------------------------------
create or replace function public.storage_checklist_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(split_part(p_name, '/', 2), '')::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function public.storage_checklist_id(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checklist-instructions',
  'checklist-instructions',
  -- Private. A company's procedure is not public, and a forwarded link should
  -- not open it.
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Read: the editors who build the checklist, and the people it is given to —
-- anyone who holds a submission for it, including the unassigned case where the
-- obligation belongs to any member of the space.
drop policy if exists checklist_instructions_read on storage.objects;
create policy checklist_instructions_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'checklist-instructions'
    and (
      public.is_board_editor(public.storage_board_id(name))
      or exists (
        select 1
          from public.submissions s
         where s.checklist_id = public.storage_checklist_id(name)
           and (
             s.assignee_id = (select auth.uid())
             or (s.assignee_id is null and public.is_board_member(public.storage_board_id(name)))
           )
      )
    )
  );

-- Write: editors only. Instructions are content, and content is the editor's.
drop policy if exists checklist_instructions_write on storage.objects;
create policy checklist_instructions_write
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'checklist-instructions'
    and public.is_board_editor(public.storage_board_id(name))
  )
  with check (
    bucket_id = 'checklist-instructions'
    and public.is_board_editor(public.storage_board_id(name))
  );

commit;

notify pgrst, 'reload schema';

-- STATE CHECK — expect one row: t | t | t | t
--   item_column, version_column, bucket_private, read_policy
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'checklist_items' and column_name = 'instructions') as item_column,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'checklist_versions' and column_name = 'instructions') as version_column,
  exists (select 1 from storage.buckets where id = 'checklist-instructions' and not public)                    as bucket_private,
  exists (select 1 from pg_policies where policyname = 'checklist_instructions_read')                          as read_policy;

-- =============================================================================
-- Photo and file evidence on a checklist item
--
-- An item can ask for a photograph or a document alongside the tick. On a phone
-- the browser opens the camera directly, so there is no native app to write and
-- none is needed.
--
-- WHAT THIS DOES NOT CLAIM. A photograph proves something was photographed. It
-- does not prove it was photographed here, or now, or of the right thing: EXIF
-- can be stripped or forged, and a photograph of a photograph works. This is far
-- stronger than nothing and much weaker than proof, and the interface must not
-- describe it as proof — the product's real claim is that the *record* cannot be
-- quietly edited, which stays true.
--
-- THE BUCKET IS PRIVATE, unlike every other bucket in this schema. Logos and
-- banners are public because they are decoration. A photograph of a shop floor,
-- a signed delivery note or a fridge thermometer is that customer's operational
-- data, and a public bucket would make it readable by anybody holding the URL —
-- and those URLs are guessable enough to matter. Reading requires a signed URL
-- minted server-side for somebody who is already a member of the space.
--
-- Requiring evidence before an item may be ticked is deliberately NOT here. That
-- is README item 30, and it has decisions attached — what happens on a loading
-- dock with no signal, whether a parent item can require it, how a submission
-- blocked for missing evidence differs from a missed one. Attaching first means
-- those can be answered against something real.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- The template side.
--
-- On `checklist_items`, which belong to a version — so this is versioned with
-- everything else for free. Adding a photo requirement in March cannot change
-- what a January submission was asked for, which is the whole reason versions
-- exist.
-- -----------------------------------------------------------------------------
alter table public.checklist_items
  add column if not exists evidence text not null default 'none';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checklist_items_evidence_valid') then
    alter table public.checklist_items
      add constraint checklist_items_evidence_valid
      check (evidence in ('none', 'photo', 'file'));
  end if;
end;
$$;

comment on column public.checklist_items.evidence is
  'Whether this item invites a photograph, any file, or nothing. Versioned with the template. Does not yet make it mandatory — that is item 30.';

-- -----------------------------------------------------------------------------
-- The answer side.
--
-- One file per answer. A gallery per item is a different feature with its own
-- questions about ordering and deletion, and adding a second column later is
-- cheaper than unpicking a design nobody asked for.
-- -----------------------------------------------------------------------------
alter table public.submission_items
  add column if not exists evidence_path        text,
  add column if not exists evidence_uploaded_at timestamptz,
  add column if not exists evidence_uploaded_by uuid references auth.users (id) on delete set null;

comment on column public.submission_items.evidence_path is
  'Object name in the submission-evidence bucket, as <board_id>/<submission_id>/<file>. The first segment is what storage policies authorise on.';

-- =============================================================================
-- Storage
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'submission-evidence',
    'submission-evidence',
    -- PRIVATE. The one bucket in this schema that is.
    false,
    -- 10 MB. A modern phone photograph is 2–5 MB and this is filled in on
    -- mobile data on a shop floor; a limit generous enough for a PDF scan and
    -- mean enough to refuse a video.
    10485760,
    array[
      'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf'
    ]
  )
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- SVG is excluded, as everywhere else: it can carry script, and nothing about a
-- photograph of a fridge needs vector format. HEIC is included because that is
-- what an iPhone produces by default.

-- Read is membership, not administration. Everybody working in a space can see
-- the evidence attached to that space's checklists — that is the point of it.
drop policy if exists submission_evidence_read on storage.objects;
create policy submission_evidence_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'submission-evidence'
    and public.is_board_member(public.storage_board_id(name))
  );

-- Write is also membership: the person filling a checklist in is a member, and
-- may not be an admin. Which answers they may attach to is governed by the RLS
-- already on `submission_items`.
drop policy if exists submission_evidence_write on storage.objects;
create policy submission_evidence_write
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'submission-evidence'
    and public.is_board_member(public.storage_board_id(name))
  )
  with check (
    bucket_id = 'submission-evidence'
    and public.is_board_member(public.storage_board_id(name))
  );

commit;

notify pgrst, 'reload schema';

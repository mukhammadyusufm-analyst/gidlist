-- =============================================================================
-- Phase 2 — Checklists, versions, groups and items
--
-- The central design decision of this product lives here: a checklist template
-- is NOT edited in place. It has versions, and a version becomes immutable the
-- moment it is published.
--
-- Why that matters. Suppose a January checklist has 12 items and someone
-- removes 3 of them in March. If submissions pointed at the template, every
-- January submission would retroactively claim to have covered 9 items — and a
-- compliance record that rewrites itself is worse than no record at all. It is
-- also unfixable after the fact, because the old structure is simply gone.
--
-- So: submissions (Phase 4) will reference a *version*, never a checklist.
-- Editing a published checklist produces a new draft; publishing that draft
-- leaves every earlier version, and every submission against it, untouched.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- checklists — the durable identity of a template.
-- Holds nothing that can change the meaning of a past submission.
-- -----------------------------------------------------------------------------
create table if not exists public.checklists (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 200),
  description text,

  -- Optional header image, shown at the top when filling the checklist.
  banner_url  text,

  created_by  uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.checklists is
  'A checklist template. Its structure lives in checklist_versions, not here.';

create index if not exists checklists_board_id_idx on public.checklists (board_id);

drop trigger if exists checklists_set_updated_at on public.checklists;
create trigger checklists_set_updated_at
  before update on public.checklists
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- checklist_versions
--
-- Exactly one draft may exist per checklist at a time; published versions
-- accumulate forever and are never modified.
-- -----------------------------------------------------------------------------
create table if not exists public.checklist_versions (
  id             uuid primary key default gen_random_uuid(),
  checklist_id   uuid not null references public.checklists (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status         text not null default 'draft' check (status in ('draft', 'published')),
  published_at   timestamptz,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),

  constraint checklist_versions_published_has_timestamp check (
    (status = 'draft' and published_at is null)
    or (status = 'published' and published_at is not null)
  )
);

create unique index if not exists checklist_versions_number_key
  on public.checklist_versions (checklist_id, version_number);

-- The rule that keeps editing sane: one draft at a time, so there is never any
-- ambiguity about which version "edit this checklist" means.
create unique index if not exists checklist_versions_single_draft_key
  on public.checklist_versions (checklist_id)
  where status = 'draft';

create index if not exists checklist_versions_checklist_idx
  on public.checklist_versions (checklist_id, version_number desc);

-- -----------------------------------------------------------------------------
-- checklist_groups — logical sections within a version.
-- -----------------------------------------------------------------------------
create table if not exists public.checklist_groups (
  id         uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.checklist_versions (id) on delete cascade,
  title      text not null check (length(trim(title)) between 1 and 200),

  -- Sparse ordering (10, 20, 30...). Dragging one row between two others then
  -- usually rewrites a single value instead of renumbering the whole list.
  position   integer not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists checklist_groups_version_idx
  on public.checklist_groups (version_id, position);

-- -----------------------------------------------------------------------------
-- checklist_items — the tree, up to 5 levels deep.
--
-- Adjacency list (each row points at its parent) with a cached `depth`. A
-- materialised path would make subtree reads cheaper, but every move would then
-- have to rewrite the paths of all descendants; with a hard cap of 5 levels the
-- recursion is trivially bounded and not worth that cost.
-- -----------------------------------------------------------------------------
create table if not exists public.checklist_items (
  id             uuid primary key default gen_random_uuid(),
  version_id     uuid not null references public.checklist_versions (id) on delete cascade,
  group_id       uuid references public.checklist_groups (id) on delete cascade,
  parent_item_id uuid references public.checklist_items (id) on delete cascade,

  title          text not null check (length(trim(title)) between 1 and 500),
  description    text,

  position       integer not null default 0,

  -- Derived, never supplied by the client. See set_checklist_item_depth().
  depth          integer not null default 1 check (depth between 1 and 5),

  created_at     timestamptz not null default now()
);

create index if not exists checklist_items_version_idx
  on public.checklist_items (version_id, group_id, position);

create index if not exists checklist_items_parent_idx
  on public.checklist_items (parent_item_id) where parent_item_id is not null;

-- -----------------------------------------------------------------------------
-- Depth is computed, and the 5-level cap is enforced here.
--
-- The UI also stops at 5, but that is a courtesy. This is the rule: a crafted
-- request, a bug in a future mobile client, or a hand-written SQL insert all
-- hit this same check.
--
-- The trigger also refuses a parent from a different version, which would
-- otherwise splice two templates together and corrupt both.
-- -----------------------------------------------------------------------------
create or replace function public.set_checklist_item_depth()
returns trigger
language plpgsql
as $$
declare
  parent_depth   integer;
  parent_version uuid;
begin
  if new.parent_item_id is null then
    new.depth := 1;
  else
    select ci.depth, ci.version_id
      into parent_depth, parent_version
      from public.checklist_items ci
     where ci.id = new.parent_item_id;

    if parent_depth is null then
      raise exception 'Parent item does not exist.'
        using errcode = 'foreign_key_violation';
    end if;

    if parent_version <> new.version_id then
      raise exception 'An item cannot be nested under an item from a different version.'
        using errcode = 'check_violation';
    end if;

    new.depth := parent_depth + 1;

    if new.depth > 5 then
      raise exception 'Checklist items can only be nested 5 levels deep.'
        using errcode = 'check_violation';
    end if;

    -- Children inherit their parent's group, so a sub-task can never drift into
    -- a different section from the task it belongs to.
    new.group_id := (
      select ci.group_id from public.checklist_items ci where ci.id = new.parent_item_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists checklist_items_set_depth on public.checklist_items;
create trigger checklist_items_set_depth
  before insert or update of parent_item_id, version_id on public.checklist_items
  for each row execute function public.set_checklist_item_depth();

-- -----------------------------------------------------------------------------
-- Published versions are frozen.
--
-- Enforced in the database rather than the app because this is the guarantee
-- the entire compliance history rests on. Anything that can edit a published
-- version can silently rewrite the past.
-- -----------------------------------------------------------------------------
create or replace function public.reject_if_version_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_version uuid;
  version_status text;
begin
  if tg_op = 'DELETE' then
    target_version := old.version_id;
  else
    target_version := new.version_id;
  end if;

  select cv.status into version_status
    from public.checklist_versions cv
   where cv.id = target_version;

  -- A null status means the parent version row is itself already gone from this
  -- statement's snapshot — i.e. the version or checklist is being deleted and
  -- this is the cascade. Raising here would make published checklists
  -- permanently undeletable, the same trap as the board-owner rule in Phase 1.
  if version_status = 'published' then
    raise exception 'This version is published and can no longer be changed. Create a new draft instead.'
      using errcode = 'restrict_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists checklist_groups_frozen on public.checklist_groups;
create trigger checklist_groups_frozen
  before insert or update or delete on public.checklist_groups
  for each row execute function public.reject_if_version_published();

drop trigger if exists checklist_items_frozen on public.checklist_items;
create trigger checklist_items_frozen
  before insert or update or delete on public.checklist_items
  for each row execute function public.reject_if_version_published();

-- A published version may never return to draft, and its number cannot move.
create or replace function public.protect_published_version()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' then
    if new.status <> 'published'
       or new.version_number <> old.version_number
       or new.checklist_id <> old.checklist_id then
      raise exception 'A published version cannot be altered.'
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists checklist_versions_protect_published on public.checklist_versions;
create trigger checklist_versions_protect_published
  before update on public.checklist_versions
  for each row execute function public.protect_published_version();

-- =============================================================================
-- Row Level Security
--
-- Groups and items are two and three joins away from a board. Rather than write
-- that join into every policy, one SECURITY DEFINER helper resolves a version
-- to its board, and the policies stay readable.
-- =============================================================================
create or replace function public.checklist_version_board_id(p_version_id uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select c.board_id
    from public.checklist_versions cv
    join public.checklists c on c.id = cv.checklist_id
   where cv.id = p_version_id;
$$;

create or replace function public.checklist_board_id(p_checklist_id uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select c.board_id from public.checklists c where c.id = p_checklist_id;
$$;

revoke execute on function public.checklist_version_board_id(uuid) from public, anon;
revoke execute on function public.checklist_board_id(uuid) from public, anon;
grant execute on function public.checklist_version_board_id(uuid) to authenticated;
grant execute on function public.checklist_board_id(uuid) to authenticated;

alter table public.checklists         enable row level security;
alter table public.checklist_versions enable row level security;
alter table public.checklist_groups   enable row level security;
alter table public.checklist_items    enable row level security;

-- --- checklists --------------------------------------------------------------
drop policy if exists checklists_select on public.checklists;
create policy checklists_select on public.checklists
  for select to authenticated
  using (public.is_board_member(board_id));

drop policy if exists checklists_write on public.checklists;
create policy checklists_write on public.checklists
  for all to authenticated
  using (public.is_board_admin(board_id))
  with check (public.is_board_admin(board_id));

-- --- checklist_versions ------------------------------------------------------
drop policy if exists checklist_versions_select on public.checklist_versions;
create policy checklist_versions_select on public.checklist_versions
  for select to authenticated
  using (public.is_board_member(public.checklist_board_id(checklist_id)));

drop policy if exists checklist_versions_write on public.checklist_versions;
create policy checklist_versions_write on public.checklist_versions
  for all to authenticated
  using (public.is_board_admin(public.checklist_board_id(checklist_id)))
  with check (public.is_board_admin(public.checklist_board_id(checklist_id)));

-- --- checklist_groups --------------------------------------------------------
drop policy if exists checklist_groups_select on public.checklist_groups;
create policy checklist_groups_select on public.checklist_groups
  for select to authenticated
  using (public.is_board_member(public.checklist_version_board_id(version_id)));

drop policy if exists checklist_groups_write on public.checklist_groups;
create policy checklist_groups_write on public.checklist_groups
  for all to authenticated
  using (public.is_board_admin(public.checklist_version_board_id(version_id)))
  with check (public.is_board_admin(public.checklist_version_board_id(version_id)));

-- --- checklist_items ---------------------------------------------------------
drop policy if exists checklist_items_select on public.checklist_items;
create policy checklist_items_select on public.checklist_items
  for select to authenticated
  using (public.is_board_member(public.checklist_version_board_id(version_id)));

drop policy if exists checklist_items_write on public.checklist_items;
create policy checklist_items_write on public.checklist_items
  for all to authenticated
  using (public.is_board_admin(public.checklist_version_board_id(version_id)))
  with check (public.is_board_admin(public.checklist_version_board_id(version_id)));

-- =============================================================================
-- Creating a checklist gives it an empty version 1 draft.
--
-- Same reasoning as the board-owner membership trigger: without it, a freshly
-- created checklist has nowhere to put its first group, and every client would
-- have to remember to create one.
-- =============================================================================
create or replace function public.add_initial_checklist_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.checklist_versions (checklist_id, version_number, status, created_by)
  values (new.id, 1, 'draft', new.created_by);
  return new;
end;
$$;

drop trigger if exists checklists_add_initial_version on public.checklists;
create trigger checklists_add_initial_version
  after insert on public.checklists
  for each row execute function public.add_initial_checklist_version();

-- =============================================================================
-- Storage — checklist banner images
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checklist-banners',
  'checklist-banners',
  true,
  5242880,  -- 5 MB; banners are wider than logos
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Note: SVG is absent here on purpose. A banner is displayed large and comes
-- from a less trusted path than a logo; SVG can carry script, and there is no
-- reason to accept it for a photograph-shaped image.

drop policy if exists checklist_banners_read on storage.objects;
create policy checklist_banners_read on storage.objects
  for select to public
  using (bucket_id = 'checklist-banners');

drop policy if exists checklist_banners_write on storage.objects;
create policy checklist_banners_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'checklist-banners'
    and public.is_board_admin(public.storage_board_id(name))
  )
  with check (
    bucket_id = 'checklist-banners'
    and public.is_board_admin(public.storage_board_id(name))
  );

commit;

-- =============================================================================
-- Phase 1 — Boards (workspaces)
--
-- A board is a company or department. It owns everything else in the product:
-- checklists, schedules and submissions all hang off exactly one board, and
-- that is what keeps one customer's data away from another's.
--
-- Membership is a separate table rather than a column on boards, because a
-- board has many people with different roles and someone may be invited by
-- email before they have an account at all.
--
-- Wrapped in a transaction: if any statement fails, the whole migration undoes
-- itself rather than leaving half a schema behind. Safe to re-run from the top
-- after a fix.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- boards
-- -----------------------------------------------------------------------------
create table if not exists public.boards (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 120),

  -- Used in URLs (/b/acme-foods). Generated from the name by trigger below.
  -- Unique across the whole system, not per user, because it appears in links
  -- that get shared.
  slug       text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),

  logo_url   text,

  -- `restrict`, not `cascade`: deleting a person must not silently destroy a
  -- company's entire checklist history. Ownership has to be transferred first.
  -- Phase 7 adds that transfer flow; until then this simply refuses.
  owner_id   uuid not null references auth.users (id) on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.boards is
  'A workspace — a company or department. The tenancy boundary for all other data.';

create index if not exists boards_owner_id_idx on public.boards (owner_id);

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- board_members
--
-- `user_id` is null for someone invited who has not registered yet. The email
-- is always recorded, and is what links a pending invite to an account when
-- that person eventually signs up.
-- -----------------------------------------------------------------------------
create table if not exists public.board_members (
  id            uuid primary key default gen_random_uuid(),
  board_id      uuid not null references public.boards (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete cascade,

  -- Always stored lowercase — see the normalisation trigger below. Email
  -- addresses are case-insensitive in practice, and "Ali@x.com" inviting
  -- someone who signs up as "ali@x.com" must still match.
  --
  -- Nullable, because it exists to match a *pending* invite to a future
  -- account. A member who is already registered needs no email here, and
  -- auth.users.email is itself null for phone-only or some OAuth signups —
  -- requiring it would make board creation fail outright for those users.
  invited_email text,

  role          text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status        text not null default 'invited' check (status in ('invited', 'active')),

  invited_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,

  -- A row is meaningless unless it identifies somebody: either a real account,
  -- or an address a future account can be matched against.
  constraint board_members_identifies_someone check (
    user_id is not null
    or (invited_email is not null and position('@' in invited_email) > 1)
  )
);

comment on table public.board_members is
  'Who belongs to a board and with what role. Rows may exist before the person registers.';

-- One membership per email per board. Uses the raw column because the
-- normalisation trigger guarantees it is already lowercase. Partial, so the
-- several members who legitimately have no email do not collide with each other.
create unique index if not exists board_members_board_email_key
  on public.board_members (board_id, invited_email)
  where invited_email is not null;

-- A registered user cannot hold two memberships on one board.
create unique index if not exists board_members_board_user_key
  on public.board_members (board_id, user_id)
  where user_id is not null;

create index if not exists board_members_user_id_idx
  on public.board_members (user_id) where user_id is not null;

-- Lets the signup hook find pending invites cheaply.
create index if not exists board_members_pending_email_idx
  on public.board_members (invited_email) where user_id is null;

create or replace function public.normalise_board_member_email()
returns trigger
language plpgsql
as $$
begin
  new.invited_email = lower(trim(new.invited_email));
  return new;
end;
$$;

drop trigger if exists board_members_normalise_email on public.board_members;
create trigger board_members_normalise_email
  before insert or update of invited_email on public.board_members
  for each row execute function public.normalise_board_member_email();

-- -----------------------------------------------------------------------------
-- Membership checks.
--
-- These exist to break a circular dependency. The natural policy on
-- board_members is "you may read rows for boards you belong to" — but working
-- that out means reading board_members, which re-triggers the same policy, and
-- Postgres aborts with infinite recursion.
--
-- SECURITY DEFINER makes these functions run as their owner, for whom RLS does
-- not apply, so the lookup inside completes without re-entering the policy.
-- This is the standard escape from that trap, and the reason both functions
-- are written to answer one narrow question and nothing more.
-- -----------------------------------------------------------------------------
create or replace function public.is_board_member(p_board_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = p_board_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
  );
$$;

create or replace function public.is_board_admin(p_board_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = p_board_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.role in ('owner', 'admin')
  );
$$;

-- Only the owner may do the irreversible things: delete the board, or change
-- who owns it.
create or replace function public.is_board_owner(p_board_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.boards b
    where b.id = p_board_id
      and b.owner_id = (select auth.uid())
  );
$$;

-- Lock these down. A SECURITY DEFINER function is a privilege escalation if the
-- wrong role can call it with arbitrary arguments; these only ever answer about
-- the *calling* user, but there is no reason for anonymous visitors to call them.
revoke execute on function public.is_board_member(uuid) from public, anon;
revoke execute on function public.is_board_admin(uuid) from public, anon;
revoke execute on function public.is_board_owner(uuid) from public, anon;
grant execute on function public.is_board_member(uuid) to authenticated;
grant execute on function public.is_board_admin(uuid) to authenticated;
grant execute on function public.is_board_owner(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Slug generation.
--
-- Done in the database rather than the app so that two people creating
-- "Operations" at the same moment cannot both be told the slug was free. The
-- loop retries against the unique index, which is the only authority.
-- -----------------------------------------------------------------------------
create or replace function public.generate_board_slug(p_name text)
returns text
language plpgsql
stable
as $$
declare
  base_slug text;
  candidate text;
  suffix    integer := 1;
begin
  -- Strip accents, drop anything that is not a letter/digit, collapse runs of
  -- separators into single hyphens.
  base_slug := lower(trim(p_name));
  base_slug := translate(base_slug,
    'àáâãäåèéêëìíîïòóôõöùúûüýÿñçğışöü',
    'aaaaaaeeeeiiiiooooouuuuyyncgisou');
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  if base_slug = '' then
    base_slug := 'board';
  end if;

  base_slug := left(base_slug, 60);
  candidate := base_slug;

  while exists (select 1 from public.boards where slug = candidate) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  return candidate;
end;
$$;

create or replace function public.set_board_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.generate_board_slug(new.name);
  end if;
  return new;
end;
$$;

drop trigger if exists boards_set_slug on public.boards;
create trigger boards_set_slug
  before insert on public.boards
  for each row execute function public.set_board_slug();

-- -----------------------------------------------------------------------------
-- The creator becomes the owner member.
--
-- Without this the person who just created a board would immediately fail the
-- is_board_member() check and be unable to see their own board. Done as a
-- trigger so it cannot be forgotten by any code path — web, mobile, or SQL.
-- -----------------------------------------------------------------------------
create or replace function public.add_board_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_email text;
begin
  select u.email into owner_email
  from auth.users u
  where u.id = new.owner_id;

  insert into public.board_members (board_id, user_id, invited_email, role, status, accepted_at)
  values (new.id, new.owner_id, coalesce(owner_email, ''), 'owner', 'active', now())
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists boards_add_owner_membership on public.boards;
create trigger boards_add_owner_membership
  after insert on public.boards
  for each row execute function public.add_board_owner_membership();

-- -----------------------------------------------------------------------------
-- Claim pending invitations at signup.
--
-- Someone can be invited to a board before they have an account. When they
-- register with that same address, their invites become live memberships.
-- Runs as a second trigger on auth.users rather than by editing Phase 0's
-- handle_new_user(), so each migration stays independently readable.
-- -----------------------------------------------------------------------------
create or replace function public.claim_board_invitations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.board_members
     set user_id     = new.id,
         status      = 'active',
         accepted_at = now()
   where user_id is null
     and invited_email = lower(trim(new.email));

  return new;
end;
$$;

drop trigger if exists on_auth_user_claim_invites on auth.users;
create trigger on_auth_user_claim_invites
  after insert on auth.users
  for each row execute function public.claim_board_invitations();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.boards enable row level security;
alter table public.board_members enable row level security;

-- --- boards ------------------------------------------------------------------

drop policy if exists boards_select_member on public.boards;
create policy boards_select_member
  on public.boards
  for select
  to authenticated
  using (public.is_board_member(id));

-- You may only create a board you own. Without the check, a client could set
-- owner_id to somebody else and plant a board in their account.
drop policy if exists boards_insert_own on public.boards;
create policy boards_insert_own
  on public.boards
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- Admins may rename and rebrand. Guarding owner_id against being rewritten is
-- done by a trigger rather than here: a WITH CHECK cannot see the row's old
-- value, and a subquery back to boards would resolve `id` against the subquery's
-- own table, silently comparing the column to itself and matching every row.
drop policy if exists boards_update_admin on public.boards;
create policy boards_update_admin
  on public.boards
  for update
  to authenticated
  using (public.is_board_admin(id))
  with check (public.is_board_admin(id));

-- Only the current owner may hand a board to someone else, and only to an
-- existing active member. OLD and NEW are both available here, which is exactly
-- what the policy above could not do.
create or replace function public.protect_board_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    if old.owner_id <> (select auth.uid()) then
      raise exception 'Only the current owner can transfer ownership of a board.'
        using errcode = 'insufficient_privilege';
    end if;

    if not exists (
      select 1 from public.board_members bm
      where bm.board_id = old.id
        and bm.user_id = new.owner_id
        and bm.status = 'active'
    ) then
      raise exception 'Ownership can only be transferred to an active member of the board.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists boards_protect_ownership on public.boards;
create trigger boards_protect_ownership
  before update on public.boards
  for each row execute function public.protect_board_ownership();

drop policy if exists boards_delete_owner on public.boards;
create policy boards_delete_owner
  on public.boards
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- --- board_members -----------------------------------------------------------

-- Members can see who else is on their boards. A pending invitee can also see
-- their own row, which is how the app shows "you have been invited to X"
-- before they have accepted anything.
drop policy if exists board_members_select on public.board_members;
create policy board_members_select
  on public.board_members
  for select
  to authenticated
  using (
    public.is_board_member(board_id)
    or user_id = (select auth.uid())
  );

drop policy if exists board_members_insert_admin on public.board_members;
create policy board_members_insert_admin
  on public.board_members
  for insert
  to authenticated
  with check (
    public.is_board_admin(board_id)
    -- Only the owner may mint another owner.
    and (role <> 'owner' or public.is_board_owner(board_id))
  );

drop policy if exists board_members_update_admin on public.board_members;
create policy board_members_update_admin
  on public.board_members
  for update
  to authenticated
  using (public.is_board_admin(board_id))
  with check (
    public.is_board_admin(board_id)
    and (role <> 'owner' or public.is_board_owner(board_id))
  );

-- An admin may remove people; anyone may remove themselves (leave a board).
-- The owner's own membership is protected by the trigger below.
drop policy if exists board_members_delete on public.board_members;
create policy board_members_delete
  on public.board_members
  for delete
  to authenticated
  using (
    public.is_board_admin(board_id)
    or user_id = (select auth.uid())
  );

-- -----------------------------------------------------------------------------
-- A board must never be left without its owner.
--
-- RLS decides *who* may act; it cannot express "this particular row is
-- structural". A trigger can, and it applies to every path into the database
-- including the service-role key, which ignores RLS entirely.
-- -----------------------------------------------------------------------------
create or replace function public.protect_board_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The `exists` guard is essential, not defensive. Deleting a board cascades
  -- into board_members, which fires this trigger for the owner's own row —
  -- without the guard, the exception would make boards permanently
  -- undeletable. By the time a cascade reaches here the parent row is already
  -- gone from this statement's snapshot, so its absence distinguishes
  -- "the board is being deleted" from "someone is removing the owner".
  if old.role = 'owner'
     and exists (select 1 from public.boards b where b.id = old.board_id) then
    raise exception 'The board owner cannot be removed. Transfer ownership first.'
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists board_members_protect_owner on public.board_members;
create trigger board_members_protect_owner
  before delete on public.board_members
  for each row execute function public.protect_board_owner_membership();

-- =============================================================================
-- Storage — board logos
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-logos',
  'board-logos',
  true,  -- readable without a token, so logos render in <img> and in emails
  2097152,  -- 2 MB; a logo has no business being larger
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files are stored as `<board_id>/<filename>`, so the first path segment is the
-- authorisation key. The regex guard runs before the cast — without it, a
-- non-UUID folder name raises a type error instead of cleanly denying.
create or replace function public.storage_board_id(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when (storage.foldername(object_name))[1] ~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
    else null
  end;
$$;

drop policy if exists board_logos_read on storage.objects;
create policy board_logos_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'board-logos');

drop policy if exists board_logos_insert on storage.objects;
create policy board_logos_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'board-logos'
    and public.is_board_admin(public.storage_board_id(name))
  );

drop policy if exists board_logos_update on storage.objects;
create policy board_logos_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'board-logos'
    and public.is_board_admin(public.storage_board_id(name))
  );

drop policy if exists board_logos_delete on storage.objects;
create policy board_logos_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'board-logos'
    and public.is_board_admin(public.storage_board_id(name))
  );

commit;

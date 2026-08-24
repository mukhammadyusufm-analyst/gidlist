-- =============================================================================
-- Fix — invitations and assignments must link people who already have accounts
--
-- Phase 1 and Phase 3 both recorded an email and left user_id null, relying on
-- a trigger that fires when that address signs up. That covers the person who
-- has not registered yet, and completely misses the person who has: they would
-- sit as "invited" forever, never gain access, and nobody would understand why.
--
-- The lookup has to happen here. auth.users is not readable from the API, so an
-- application-side resolution is impossible — which is why the original code
-- silently did nothing.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Board members: normalise the email, then link it to an existing account.
--
-- Replaces the normalisation-only trigger from Phase 1. Doing both in one
-- function avoids depending on trigger firing order — Postgres fires triggers
-- alphabetically by name, which is a fragile thing to build a rule on.
-- -----------------------------------------------------------------------------
create or replace function public.normalise_board_member_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.invited_email = lower(trim(new.invited_email));

  if new.user_id is null and new.invited_email is not null then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = new.invited_email;

    -- Someone who already has an account has nothing to accept. Leaving them
    -- as 'invited' would mean is_board_member() returns false and they cannot
    -- see the board they were just added to.
    if new.user_id is not null then
      new.status := 'active';
      new.accepted_at := coalesce(new.accepted_at, now());
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Schedule assignees: same treatment.
-- -----------------------------------------------------------------------------
create or replace function public.normalise_assignee_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email = lower(trim(new.email));

  if new.user_id is null then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = new.email;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Repair rows created before this fix.
--
-- Anyone already invited who turns out to have an account gets linked and
-- activated now, rather than waiting for a signup that will never come because
-- they signed up months ago.
-- -----------------------------------------------------------------------------
update public.board_members bm
   set user_id     = u.id,
       status      = 'active',
       accepted_at = coalesce(bm.accepted_at, now())
  from auth.users u
 where bm.user_id is null
   and bm.invited_email is not null
   and lower(u.email) = bm.invited_email;

update public.schedule_assignees sa
   set user_id = u.id
  from auth.users u
 where sa.user_id is null
   and lower(u.email) = sa.email;

-- Submissions already addressed to an email but not to a person.
update public.submissions sub
   set assignee_id = u.id
  from auth.users u
 where sub.assignee_id is null
   and sub.assignee_email is not null
   and lower(u.email) = sub.assignee_email;

commit;

notify pgrst, 'reload schema';

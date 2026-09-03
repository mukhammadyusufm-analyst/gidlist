-- RUN THIS IN: gidlist-dev first, then production.
-- =============================================================================
-- What each account is actually doing, and a way to remove the ones that are not
--
-- The Accounts page could say who exists and what they pay. It could not answer
-- the questions actually being asked of it: who registered and never came back,
-- who is using this daily, and which of these are bots.
--
-- Four columns added:
--
--   confirmed        whether the email was ever confirmed. An unconfirmed
--                    account cannot sign in at all, which is the single
--                    clearest bot signal and was invisible here.
--   last_sign_in_at  null means registered and never returned.
--   checklists       how much they have built.
--   submissions_30d  how much has actually been filled in lately. Built rather
--                    than used is the interesting distinction, and neither
--                    number means much without the other.
--
-- ACTIVITY IS COUNTED OVER THEIR SPACES, NOT THEIR OWN TICKS. An owner who set
-- up a space for fourteen people and never fills a checklist personally is not
-- an inactive account — the space is busy, which is what matters commercially.
--
-- The return type changes, so the function is dropped first: `create or replace`
-- cannot alter the row type its OUT parameters define, and Postgres refuses with
-- 42P13 rather than guessing.
-- =============================================================================

begin;

/** Checklists an account has, across every space it owns. Archived excluded. */
create or replace function public.account_checklist_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.checklists c
  join public.boards b on b.id = c.board_id
  where b.owner_id = p_user_id
    and c.archived_at is null;
$$;

revoke execute on function public.account_checklist_count(uuid) from public, anon;
grant execute on function public.account_checklist_count(uuid) to authenticated;

/**
 * Submissions completed in this account's spaces in the last 30 days.
 *
 * Counted on `submitted_at`, not on creation: an obligation the nightly job
 * generated and nobody touched is not activity, and counting it would make a
 * dormant account look busy purely because its schedules keep firing.
 */
create or replace function public.account_activity_30d(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.submissions s
  join public.checklists c on c.id = s.checklist_id
  join public.boards b on b.id = c.board_id
  where b.owner_id = p_user_id
    and s.submitted_at is not null
    and s.submitted_at > now() - interval '30 days';
$$;

revoke execute on function public.account_activity_30d(uuid) from public, anon;
grant execute on function public.account_activity_30d(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- The listing, now with the four extra columns
-- -----------------------------------------------------------------------------
drop function if exists public.platform_accounts();

create function public.platform_accounts()
returns table (
  owner_id        uuid,
  email           text,
  full_name       text,
  plan_code       text,
  plan_name       text,
  price_minor     integer,
  currency        text,
  used_members    integer,
  max_members     integer,
  used_spaces     integer,
  max_spaces      integer,
  status          text,
  period_end      date,
  joined_at       timestamptz,
  confirmed       boolean,
  last_sign_in_at timestamptz,
  checklists      integer,
  submissions_30d integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_capability('accounts') then
    raise exception 'You do not have permission to view accounts.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.full_name,
    pl.code,
    pl.name,
    pl.price_minor,
    pl.currency,
    public.account_member_count(u.id),
    pl.max_members,
    public.account_space_count(u.id),
    pl.max_spaces,
    coalesce(s.status, 'active'),
    s.current_period_end,
    u.created_at,
    u.email_confirmed_at is not null,
    u.last_sign_in_at,
    public.account_checklist_count(u.id),
    public.account_activity_30d(u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  join public.plans pl on pl.code = public.account_plan(u.id)
  left join public.subscriptions s on s.owner_id = u.id
  order by pl.price_minor desc, u.created_at desc;
end;
$$;

revoke execute on function public.platform_accounts() from public, anon;
grant execute on function public.platform_accounts() to authenticated;

-- -----------------------------------------------------------------------------
-- Removing an account
-- -----------------------------------------------------------------------------

/**
 * Delete an account outright. For bot registrations and mistakes.
 *
 * THREE THINGS IT REFUSES, and each is deliberate.
 *
 * Your own account. Nobody should be able to remove the login they are using to
 * remove it — the mistake is instant and there is no way back through the
 * interface.
 *
 * An account that owns a space. `boards.owner_id` is `on delete restrict`, so
 * the database would refuse anyway; catching it here turns a foreign-key error
 * into a sentence explaining that a space holds compliance history and has to
 * be dealt with first.
 *
 * An account holding a platform capability. Somebody with admin access is not
 * a bot, and removing them from this screen would be a way to lock colleagues
 * out of the product.
 *
 * Everything else about the account goes with it by cascade: profile,
 * memberships, unlimited grant. That is the correct outcome for a row that
 * should never have existed.
 */
create or replace function public.delete_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_capability('accounts') then
    raise exception 'You do not have permission to delete accounts.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot delete the account you are signed in with.'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.boards b where b.owner_id = p_user_id) then
    raise exception 'This account owns a space, which holds compliance history. Remove or transfer the space first.'
      using errcode = 'restrict_violation';
  end if;

  if exists (select 1 from public.platform_grants g where g.user_id = p_user_id) then
    raise exception 'This account holds platform access. Remove that first if you really mean to delete it.'
      using errcode = 'restrict_violation';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

comment on function public.delete_account(uuid) is
  'Remove an account that should not exist. Refuses your own account, any account owning a space, and any account holding platform access.';

revoke execute on function public.delete_account(uuid) from public, anon;
grant execute on function public.delete_account(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

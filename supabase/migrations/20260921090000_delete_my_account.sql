-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- =============================================================================
-- People can delete their own account.
--
-- Until now only the platform admin could (`delete_account`, Admin → Accounts).
-- Google Play requires that an app which lets people create an account also
-- lets them delete it, from inside the app and from a web link — so this is a
-- precondition of the store listing, and a right people have regardless.
--
-- THE SAME RULES AS THE ADMIN PATH, applied to oneself:
--   * An account that OWNS a company space is refused, and told why. That
--     space's submissions are the company's compliance record, not the
--     person's; deleting its owner would orphan it. There is no ownership
--     transfer in the app yet, so an owner asks support, who hand the space over
--     or close it and then delete the account (admin path). Google accepts a
--     deletion request handled by the developer, alongside in-app deletion.
--   * An account holding platform access is refused, so the operator cannot
--     remove themselves by accident.
--   * The practice space goes with the account, through the same safe routine.
--
-- What they filled in stays in their company's records: Compliance keeps who
-- submitted by email, exactly as it does when the admin deletes an account.
-- =============================================================================

begin;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v record;
begin
  if v_uid is null then
    raise exception 'Sign in to delete your account.' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from public.boards b where b.owner_id = v_uid and not b.is_tutorial) then
    raise exception 'You own a space, which holds your company''s records. Ask Gidlist support to delete this account, so the space can be handed over or closed properly.'
      using errcode = 'restrict_violation';
  end if;

  if exists (select 1 from public.platform_grants g where g.user_id = v_uid) then
    raise exception 'This account holds platform access. Remove that first if you really mean to delete it.'
      using errcode = 'restrict_violation';
  end if;

  for v in select b.id from public.boards b where b.owner_id = v_uid and b.is_tutorial loop
    perform public.purge_practice_board(v.id);
  end loop;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

notify pgrst, 'reload schema';

-- STATE CHECK — expect: t
select exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'delete_my_account' and p.prosecdef
) as delete_my_account_ready;

-- =============================================================================
-- Let prices be changed without SQL
--
-- `plans` has had RLS with a read-only policy since it was created, and no
-- admin screen. That was a sound default for prices and a bad end state: the
-- only way to change what the product charges is a statement typed into the
-- production SQL Editor, which is the same shape as archiving with no list of
-- archived spaces and an audit log with nothing to read it — a mechanism with
-- no way to reach it.
--
-- Three things here, and the narrowness is the point:
--
--   1. A `billing` capability, separate from `accounts`. Seeing what customers
--      pay and changing what they will pay are different jobs; `accounts` is
--      already handed out for the first.
--   2. UPDATE only. No insert, no delete. A new plan code is not a pricing
--      decision — it needs `plan_features` rows, a `pricing.ts` entry and a
--      place in the interface — so inventing one from a form would produce a
--      plan that renders nowhere and sells nothing.
--   3. `code` and `is_free` are frozen. `code` is a foreign key from
--      `subscriptions`; editing it would orphan live customers. `is_free`
--      decides whether checkout is offered at all, so flipping it by accident
--      would either start charging people on the free tier or stop charging
--      everyone else.
--
-- Every change is recorded in `audit_log`, because a price is exactly the kind
-- of thing somebody may later be asked to justify.
-- =============================================================================

begin;

insert into public.platform_capabilities (code, name, description, is_root, sort_order)
values
  ('billing', 'Plans and pricing',
   'Change what each plan costs and the limits it carries.', false, 4)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- What may change, enforced in the database rather than in the form.
-- -----------------------------------------------------------------------------
create or replace function public.guard_plan_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'A plan code cannot be changed: subscriptions reference it.'
      using errcode = 'check_violation';
  end if;

  if new.is_free is distinct from old.is_free then
    raise exception 'Whether a plan is free is not a pricing edit. Change it deliberately in SQL.'
      using errcode = 'check_violation';
  end if;

  -- A free plan priced above zero would offer checkout for something the
  -- interface calls free. Cheaper to refuse than to reconcile later.
  if new.is_free and new.price_minor <> 0 then
    raise exception 'The free plan must cost nothing.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists plans_guard_update on public.plans;
create trigger plans_guard_update
  before update on public.plans
  for each row execute function public.guard_plan_update();

-- -----------------------------------------------------------------------------
-- Audit. A price change is governance, not content.
-- -----------------------------------------------------------------------------
create or replace function public.audit_plan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only when something worth recording actually moved. An idempotent save
  -- from a form should not fill the log with entries that changed nothing.
  if new.price_minor is distinct from old.price_minor
     or new.max_members is distinct from old.max_members
     or new.max_spaces is distinct from old.max_spaces
     or new.name is distinct from old.name
     or new.is_offerable is distinct from old.is_offerable
  then
    perform public.write_audit(
      'plan.changed',
      null,
      null,
      jsonb_build_object(
        'code', new.code,
        'before', jsonb_build_object(
          'name', old.name,
          'price_minor', old.price_minor,
          'currency', old.currency,
          'max_members', old.max_members,
          'max_spaces', old.max_spaces,
          'is_offerable', old.is_offerable
        ),
        'after', jsonb_build_object(
          'name', new.name,
          'price_minor', new.price_minor,
          'currency', new.currency,
          'max_members', new.max_members,
          'max_spaces', new.max_spaces,
          'is_offerable', new.is_offerable
        )
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists plans_audit_change on public.plans;
create trigger plans_audit_change
  after update on public.plans
  for each row execute function public.audit_plan_change();

-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- The existing read policy stays: the pricing page is public. This adds update
-- and nothing else, so insert and delete remain impossible through the API for
-- everyone, capability or not.
-- -----------------------------------------------------------------------------
drop policy if exists plans_update on public.plans;
create policy plans_update on public.plans
  for update to authenticated
  using (public.has_platform_capability('billing'))
  with check (public.has_platform_capability('billing'));

commit;

notify pgrst, 'reload schema';

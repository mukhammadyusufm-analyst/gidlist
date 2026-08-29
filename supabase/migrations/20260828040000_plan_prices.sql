-- =============================================================================
-- Per-currency pricing
--
-- `plans` carries one `price_minor` and one `currency`, so the product could
-- only ever be priced in one currency. Selling to Uzbek companies in so'm and
-- to everyone else in dollars needs a price per plan per currency — the shape
-- `addon_prices` has used since it was written.
--
-- THE SO'M FIGURES ARE NOT CONVERSIONS AND MUST NOT BE RECOMPUTED. They are a
-- deliberate local price list. Re-deriving them from the dollar prices at some
-- future exchange rate would silently reprice every Uzbek customer, and the
-- rate moves.
--
-- MINOR UNITS DIFFER BY CURRENCY, and this is the detail that will bite.
-- `packages/core/src/money.ts` is the authority: USD has an exponent of 2, so
-- $5.00 is 500. UZS has an exponent of 0, because the tiyin is no longer used
-- in practice — so 59,250 so'm is 59250, NOT 5925000. Treating UZS as two
-- decimal places would inflate every Uzbek price a hundredfold, which looks
-- like a pricing decision rather than a bug.
--
-- No VAT is added anywhere. The company is an IT Park resident, and prices are
-- what the customer pays.
-- =============================================================================

begin;

create table if not exists public.plan_prices (
  plan_code   text not null references public.plans (code) on delete cascade,
  currency    text not null check (currency ~ '^[A-Z]{3}$'),
  price_minor integer not null check (price_minor >= 0),
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (plan_code, currency)
);

comment on table public.plan_prices is
  'What each plan costs in each currency. Deliberate local price lists, never conversions. Minor units follow the currency exponent in packages/core/src/money.ts — UZS is 0, USD is 2.';

drop trigger if exists plan_prices_set_updated_at on public.plan_prices;
create trigger plan_prices_set_updated_at
  before update on public.plan_prices
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Seed
--
-- USD is taken from the existing `plans` rows rather than retyped, so this
-- migration cannot introduce a disagreement with what the product already
-- charges on the day it runs.
-- -----------------------------------------------------------------------------
insert into public.plan_prices (plan_code, currency, price_minor)
select p.code, p.currency, p.price_minor
from public.plans p
on conflict (plan_code, currency) do nothing;

-- So'm, chosen for the local market.
insert into public.plan_prices (plan_code, currency, price_minor)
values
  ('free',     'UZS', 0),
  ('starter',  'UZS', 59250),
  ('team',     'UZS', 177750),
  ('business', 'UZS', 474000)
on conflict (plan_code, currency) do nothing;

-- -----------------------------------------------------------------------------
-- Audit, matching `plans`. A price is a price wherever it is stored.
-- -----------------------------------------------------------------------------
create or replace function public.audit_plan_price_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.price_minor is not distinct from old.price_minor then
    return new;
  end if;

  perform public.write_audit(
    'plan.price_changed',
    null,
    null,
    jsonb_build_object(
      'code', new.plan_code,
      'currency', new.currency,
      'before', case when tg_op = 'UPDATE' then old.price_minor else null end,
      'after', new.price_minor
    )
  );

  return new;
end;
$$;

drop trigger if exists plan_prices_audit on public.plan_prices;
create trigger plan_prices_audit
  after insert or update on public.plan_prices
  for each row execute function public.audit_plan_price_change();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.plan_prices enable row level security;

-- Public: the pricing page is public, and the marketing site reads this with
-- the anonymous key.
drop policy if exists plan_prices_read on public.plan_prices;
create policy plan_prices_read on public.plan_prices
  for select to public using (true);

-- Update only, like `plans`. Adding a currency means adding a locale mapping,
-- a formatter check and a payment provider that settles it — a code change, not
-- a form.
drop policy if exists plan_prices_update on public.plan_prices;
create policy plan_prices_update on public.plan_prices
  for update to authenticated
  using (public.has_platform_capability('billing'))
  with check (public.has_platform_capability('billing'));

commit;

notify pgrst, 'reload schema';

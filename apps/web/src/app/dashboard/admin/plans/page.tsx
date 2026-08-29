import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { hasCapability } from '@/lib/platform/access';
import { createClient } from '@/lib/supabase/server';

import { PlanForm, type PlanRow } from './plan-form';

export const metadata: Metadata = { title: 'Plans and pricing' };

export default async function PlansPage() {
  // The specific capability. Holding `accounts` means seeing what customers
  // pay; changing what they will pay is a different job and a different grant.
  if (!(await hasCapability('billing'))) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from('plans')
    .select('code, name, price_minor, currency, max_members, max_spaces, is_free, is_offerable')
    .order('sort_order');

  const plans: PlanRow[] = (data ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    priceMinor: p.price_minor,
    currency: p.currency,
    maxMembers: p.max_members,
    maxSpaces: p.max_spaces,
    isFree: p.is_free,
    isOfferable: p.is_offerable,
  }));

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plans and pricing</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          What each plan costs and the capacity it carries. Every change is recorded in the
          platform history with the old and new values.
        </p>

        {/*
          The one thing that will bite whoever uses this. The marketing site
          cannot read `plans` — it is a separate deployment with no database
          connection for pricing — so its figures are mirrored by hand in
          apps/site/src/lib/pricing.ts. Changing a price here and not there
          leaves gidlist.com advertising a price the product does not charge,
          which is the worst kind of wrong: one a customer can point at.
          Item 25 removes the duplication.
        */}
        <p className="mt-3 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-sm">
          <strong>gidlist.com does not follow this page.</strong> Its prices are held separately in{' '}
          <code className="font-mono text-xs">apps/site/src/lib/pricing.ts</code> and need the same
          change, or the site will advertise a price the product does not charge.
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          No plans found.
        </p>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <PlanForm key={plan.code} plan={plan} />
          ))}
        </div>
      )}

      <p className="text-sm text-[var(--color-muted-foreground)]">
        Adding or removing a plan is not possible here, deliberately. A new plan code needs feature
        rows and a place in the interface, so it is a code change rather than a form.
      </p>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { savePlan } from '@/lib/billing/plan-actions';
import type { PlanCode } from '@/lib/supabase/database.types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';

export type PlanRow = {
  code: PlanCode;
  name: string;
  priceMinor: number;
  currency: string;
  maxMembers: number | null;
  maxSpaces: number | null;
  isFree: boolean;
  isOfferable: boolean;
};

/**
 * One plan.
 *
 * The price is entered in whole currency units and converted to minor units on
 * submit, because nobody thinks in cents — and `price_minor` is exactly where a
 * missing decimal point turns $40 into $4,000 without looking any different.
 * The conversion is `Math.round(value * 100)` rather than a string operation,
 * so `15.1` cannot become `1510`.
 */
export function PlanForm({ plan }: { plan: PlanRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState((plan.priceMinor / 100).toString());
  const [members, setMembers] = useState(plan.maxMembers?.toString() ?? '');
  const [spaces, setSpaces] = useState(plan.maxSpaces?.toString() ?? '');
  const [offerable, setOfferable] = useState(plan.isOfferable);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const major = Number(price);
    if (!Number.isFinite(major) || major < 0) {
      setError('The price must be a number.');
      return;
    }

    startTransition(async () => {
      const result = await savePlan({
        code: plan.code,
        name,
        priceMinor: Math.round(major * 100),
        // Empty means unlimited, which is null in the database — deliberately
        // not zero, which would be a plan nobody can use.
        maxMembers: members.trim() === '' ? null : Number(members),
        maxSpaces: spaces.trim() === '' ? null : Number(spaces),
        isOfferable: offerable,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{plan.name}</h2>
        <code className="font-mono text-xs text-[var(--color-muted-foreground)]">{plan.code}</code>
      </div>

      {error ? (
        <div className="mt-3">
          <FormNotice kind="error">{error}</FormNotice>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Price ({plan.currency} per month)
          </span>
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            disabled={plan.isFree}
          />
          {plan.isFree ? (
            <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
              The free plan must cost nothing. The database refuses anything else.
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Members</span>
          <Input
            value={members}
            onChange={(e) => setMembers(e.target.value)}
            inputMode="numeric"
            placeholder="Unlimited"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Spaces</span>
          <Input
            value={spaces}
            onChange={(e) => setSpaces(e.target.value)}
            inputMode="numeric"
            placeholder="Unlimited"
          />
        </label>
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={offerable}
          onChange={(e) => setOfferable(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span>
          Offer this plan to new customers
          <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
            Turning this off hides it from the billing page. Anyone already on it stays on it —
            it is not a cancellation.
          </span>
        </span>
      </label>

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {saved ? <span className="text-sm text-[var(--color-success)]">Saved</span> : null}
      </div>
    </form>
  );
}

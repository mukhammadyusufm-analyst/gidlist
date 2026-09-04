'use client';

import { useActionState, useState } from 'react';

import { clearAccountLimits, setAccountLimits, type GrantResult } from '@/lib/platform/actions';
import { Button } from '@/components/ui/button';

export type AccountAgreement = {
  maxSpaces: number | null;
  maxMembers: number | null;
  expiresAt: string | null;
  note: string | null;
};

/**
 * What an account was sold: spaces, people, and until when.
 *
 * Replaces a single "Set unlimited" button. That button could express one deal
 * — everything, forever — and the deals actually being signed are "five spaces
 * and a hundred and twenty people, for a year". Unlimited is still here; it is
 * now the case where both boxes are left empty rather than a separate feature.
 *
 * EMPTY MEANS UNLIMITED, and the form says so in words rather than leaving it
 * to be discovered. A number box whose blank state silently means *infinity*
 * is the kind of control somebody clears by accident and only finds out about
 * when a customer creates their fortieth space.
 *
 * Deliberately not a plan change: the account keeps its plan and its invoices,
 * and only the ceilings move. Making it a plan change would rewrite the billing
 * history, and "why did this customer stop being invoiced" is a worse question
 * to be left with than "why is this one uncapped".
 *
 * Gated on `billing` rather than `accounts`, matching the database — this page
 * is readable with `accounts`, which exists so somebody can see what customers
 * pay without being able to change it.
 */
export function AccountLimits({
  ownerId,
  accountName,
  agreement,
  planSpaces,
  planMembers,
  canChange,
}: {
  ownerId: string;
  accountName: string;
  /** Null when this account is on its plan's own limits. */
  agreement: AccountAgreement | null;
  planSpaces: number | null;
  planMembers: number | null;
  /** False for a viewer holding `accounts` but not `billing`. */
  canChange: boolean;
}) {
  const [saveState, save, saving] = useActionState<GrantResult, FormData>(setAccountLimits, {});
  const [clearState, clear, clearing] = useActionState<GrantResult, FormData>(
    clearAccountLimits,
    {},
  );
  const [open, setOpen] = useState(false);

  const expired = Boolean(agreement?.expiresAt && new Date(agreement.expiresAt) <= new Date());
  const error = saveState.error ?? clearState.error;

  if (!open) {
    return (
      <div className="space-y-1">
        <Summary agreement={agreement} expired={expired} />
        {canChange ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            {agreement ? 'Change' : 'Set limits'}
          </Button>
        ) : null}
        {error ? <p className="text-xs text-[var(--color-destructive)]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="w-64 space-y-2 rounded-lg border border-[var(--color-border)] p-2">
      <form action={save} className="space-y-2">
        <input type="hidden" name="ownerId" value={ownerId} />

        <Field
          name="maxSpaces"
          label="Spaces"
          defaultValue={agreement?.maxSpaces}
          placeholder={planSpaces === null ? 'unlimited' : String(planSpaces)}
        />
        <Field
          name="maxMembers"
          label="People"
          defaultValue={agreement?.maxMembers}
          placeholder={planMembers === null ? 'unlimited' : String(planMembers)}
        />

        <label className="block">
          <span className="text-xs text-[var(--color-muted-foreground)]">Until</span>
          <input
            type="date"
            name="expiresAt"
            defaultValue={agreement?.expiresAt ? agreement.expiresAt.slice(0, 10) : ''}
            className="w-full rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-xs"
          />
        </label>

        <label className="block">
          <span className="text-xs text-[var(--color-muted-foreground)]">Note</span>
          <input
            type="text"
            name="note"
            defaultValue={agreement?.note ?? ''}
            placeholder="contract reference"
            className="w-full rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-xs"
          />
        </label>

        {/* Said plainly, because a blank number box meaning "infinity" is not
            something anybody should have to infer. */}
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Leave a box empty for unlimited. Leave <em>Until</em> empty for no end date.
        </p>

        <div className="flex gap-1">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? '…' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>

      {agreement ? (
        <form action={clear}>
          <input type="hidden" name="ownerId" value={ownerId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={clearing}
            aria-label={`Put ${accountName} back on plan limits`}
          >
            {clearing ? '…' : 'Back to plan limits'}
          </Button>
        </form>
      ) : null}

      {error ? <p className="text-xs text-[var(--color-destructive)]">{error}</p> : null}
    </div>
  );
}

/** One number, or blank for unlimited. */
function Field({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: number | null | undefined;
  /** The plan's own figure, so the box shows what it is overriding. */
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--color-muted-foreground)]">{label}</span>
      <input
        type="number"
        name={name}
        min={0}
        inputMode="numeric"
        defaultValue={defaultValue ?? ''}
        placeholder={`plan: ${placeholder}`}
        className="w-full rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-xs tabular-nums"
      />
    </label>
  );
}

/** The state in one line, which is all the column has room for. */
function Summary({ agreement, expired }: { agreement: AccountAgreement | null; expired: boolean }) {
  if (!agreement) {
    return <span className="text-xs text-[var(--color-muted-foreground)]">Plan limits</span>;
  }

  const spaces = agreement.maxSpaces ?? '∞';
  const members = agreement.maxMembers ?? '∞';

  return (
    <div className="text-xs">
      <span className={expired ? 'text-[var(--color-muted-foreground)] line-through' : 'text-[var(--color-primary)]'}>
        {spaces} / {members}
      </span>
      {agreement.expiresAt ? (
        <span
          className={
            expired
              ? 'ml-1.5 text-[var(--color-destructive)]'
              : 'ml-1.5 text-[var(--color-muted-foreground)]'
          }
        >
          {expired ? 'expired' : `to ${agreement.expiresAt.slice(0, 10)}`}
        </span>
      ) : null}
      {agreement.note ? (
        <div className="truncate text-[var(--color-muted-foreground)]" title={agreement.note}>
          {agreement.note}
        </div>
      ) : null}
    </div>
  );
}

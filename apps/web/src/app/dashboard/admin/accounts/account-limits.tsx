'use client';

import { useActionState, useState } from 'react';

import { clearAccountLimits, setAccountLimits, type GrantResult } from '@/lib/platform/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AccountAgreement = {
  maxSpaces: number | null;
  maxMembers: number | null;
  expiresAt: string | null;
  note: string | null;
};

/** The three deals this product actually signs. */
type Mode = 'plan' | 'unlimited' | 'custom';

/**
 * What an account was sold: spaces, people, and until when.
 *
 * =============================================================================
 * ONE CONTROL, THREE DEALS
 *
 * The shape here has been wrong twice in opposite directions, and the second
 * correction is worth recording because it looks like a reversal of the first.
 *
 * It began as a single "Set unlimited" button, which could express exactly one
 * agreement — everything, forever — while the deals being signed were "five
 * spaces and a hundred and twenty people, for a year". So it became a form of
 * numbers, and unlimited became the case where the boxes are left empty.
 *
 * That was right about capability and wrong about the reading. A blank number
 * box silently meaning *infinity* is a state somebody reaches by accident, and
 * the three cases that actually exist — the plan decides, nothing is capped, a
 * negotiated size — became indistinguishable at a glance: all three are "some
 * boxes with something or nothing in them".
 *
 * They are now three named choices. Nothing about what can be expressed has
 * changed; what has changed is that the intent is stated rather than inferred
 * from emptiness, and the default — the plan decides — is the one selected
 * where no agreement exists.
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
  /** Null when this account is on its plan's own limits. */
  agreement: AccountAgreement | null;
  accountName: string;
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
  const [mode, setMode] = useState<Mode>(() => modeOf(agreement));

  const expired = Boolean(agreement?.expiresAt && new Date(agreement.expiresAt) <= new Date());
  const error = saveState.error ?? clearState.error;

  if (!open) {
    return (
      <div className="space-y-1">
        <Summary agreement={agreement} expired={expired} />
        {canChange ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              // Re-read the saved state on open rather than keeping whatever was
              // last chosen: the panel closes after a save, and reopening should
              // show what the account IS, not what somebody was mid-way through.
              setMode(modeOf(agreement));
              setOpen(true);
            }}
          >
            {agreement ? 'Change' : 'Set limits'}
          </Button>
        ) : null}
        {error ? <p className="text-xs text-[var(--color-destructive)]">{error}</p> : null}
      </div>
    );
  }

  /*
   * The action is chosen by the mode, because "back on plan limits" is a
   * different operation — it withdraws the agreement row rather than writing
   * one with everything blank. Those are not the same thing: an agreement of
   * all-nulls is a deliberate uncapping that survives a plan change, and no
   * agreement means the plan decides from now on, whatever the plan becomes.
   */
  const action = mode === 'plan' ? clear : save;
  const busy = mode === 'plan' ? clearing : saving;

  return (
    <div className="w-64 space-y-2 rounded-lg border border-[var(--color-border)] p-2">
      <form action={action} className="space-y-2">
        <input type="hidden" name="ownerId" value={ownerId} />

        <div
          role="group"
          aria-label={`Limits for ${accountName}`}
          className="flex rounded-md border border-[var(--color-border)] p-0.5"
        >
          {(
            [
              ['plan', 'Plan'],
              ['unlimited', 'Unlimited'],
              ['custom', 'Custom'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                'flex-1 rounded px-1.5 py-1 text-xs transition-colors',
                mode === value
                  ? 'bg-[var(--color-secondary)] text-[var(--color-foreground)]'
                  : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'plan' ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            The account&rsquo;s plan decides: {planSpaces ?? '∞'} spaces, {planMembers ?? '∞'}{' '}
            people. Any agreement on this account is withdrawn.
          </p>
        ) : null}

        {/*
          Omitted entirely in `unlimited`, not merely emptied. The action reads a
          missing field as null and null is uncapped, so the absent input says
          exactly what the choice above says — and there is no blank box left on
          screen inviting somebody to read it as "not set yet".
        */}
        {mode === 'custom' ? (
          <>
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
          </>
        ) : null}

        {/*
          An end date belongs to both sold states, not only the negotiated one.
          "Uncapped until the pilot ends in March" is an ordinary agreement, and
          the earlier form could not express it without also inventing numbers.
        */}
        {mode !== 'plan' ? (
          <>
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Until</span>
              <input
                type="date"
                name="expiresAt"
                defaultValue={agreement?.expiresAt ? agreement.expiresAt.slice(0, 10) : ''}
                className="w-full rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-base sm:text-xs"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Note</span>
              <input
                type="text"
                name="note"
                defaultValue={agreement?.note ?? ''}
                placeholder="contract reference"
                className="w-full rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-base sm:text-xs"
              />
            </label>

            <p className="text-xs text-[var(--color-muted-foreground)]">
              Leave <em>Until</em> empty for no end date.
            </p>
          </>
        ) : null}

        <div className="flex gap-1">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? '…' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>

      {error ? <p className="text-xs text-[var(--color-destructive)]">{error}</p> : null}
    </div>
  );
}

/** Which of the three an existing row represents. */
function modeOf(agreement: AccountAgreement | null): Mode {
  if (!agreement) return 'plan';
  return agreement.maxSpaces === null && agreement.maxMembers === null ? 'unlimited' : 'custom';
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
        className="w-full rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-base sm:text-xs tabular-nums"
      />
    </label>
  );
}

/** The state in one line, which is all the column has room for. */
function Summary({ agreement, expired }: { agreement: AccountAgreement | null; expired: boolean }) {
  if (!agreement) {
    return <span className="text-xs text-[var(--color-muted-foreground)]">Plan limits</span>;
  }

  // Named rather than rendered as "∞ / ∞", so the deliberately uncapped account
  // reads as a decision somebody made rather than as two missing numbers.
  const uncapped = agreement.maxSpaces === null && agreement.maxMembers === null;

  return (
    <div className="text-xs">
      <span
        className={
          expired
            ? 'text-[var(--color-muted-foreground)] line-through'
            : 'text-[var(--color-primary)]'
        }
      >
        {uncapped ? 'Unlimited' : `${agreement.maxSpaces ?? '∞'} / ${agreement.maxMembers ?? '∞'}`}
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

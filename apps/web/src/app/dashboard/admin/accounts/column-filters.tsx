'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * A filter under each column heading.
 *
 * Replaces the shared `ListFilter` panel that used to sit above this table.
 * One surface, not two: the panel offered a search box and a state dropdown,
 * and every other question you might ask of this list — which plan, registered
 * when, seen when, has it actually been used — had no control at all. Putting
 * each filter under the column it filters means the question and the answer are
 * in the same place, and there is nowhere for two copies of the same control to
 * disagree.
 *
 * State lives in the URL, so a filtered list is a link. That matters here more
 * than elsewhere: this page is where "which accounts registered and never came
 * back" gets answered, and that answer is usually being sent to somebody.
 *
 * The text box commits on Enter or on leaving the field rather than on every
 * keystroke — each commit is a server round trip that re-renders the whole
 * table, and eleven of them while typing an email address is eleven renders
 * to arrive at one answer.
 */
export function AccountColumnFilters({
  columns,
  states,
  plans,
  current,
}: {
  /** How many columns the table has, so the reset cell spans correctly. */
  columns: number;
  /** Only the states that actually occur, with counts, so no option is a dead end. */
  states: { value: string; label: string; count: number }[];
  plans: string[];
  current: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(current.q ?? '');

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    router.push(`/dashboard/admin/accounts${qs ? `?${qs}` : ''}`);
  }

  const cell = 'px-3 py-2 align-top';
  const control =
    'w-full min-w-0 rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-xs';

  /** A numeric floor. Blank means no floor, and 0 is the same as blank. */
  function numberFilter(name: string, label: string) {
    return (
      <input
        type="number"
        min={0}
        inputMode="numeric"
        className={`${control} tabular-nums`}
        aria-label={label}
        placeholder="0+"
        defaultValue={current[name] ?? ''}
        onChange={(e) => update({ [name]: e.target.value === '0' ? undefined : e.target.value })}
      />
    );
  }

  const anyFilterSet = Object.entries(current).some(([, v]) => Boolean(v));

  return (
    <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40">
      <td className={cell}>
        <input
          type="search"
          className={control}
          aria-label="Search by name or email"
          placeholder="Name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => update({ q: query.trim() || undefined })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              update({ q: query.trim() || undefined });
            }
          }}
        />
      </td>

      <td className={cell}>
        <select
          className={control}
          aria-label="Filter by state"
          value={current.state ?? ''}
          onChange={(e) => update({ state: e.target.value || undefined })}
        >
          <option value="">Any state</option>
          {states.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} ({s.count})
            </option>
          ))}
        </select>
      </td>

      {/* Registered and Last seen are windows, not dates. Nobody asks "who
          registered on the 14th"; they ask "who has arrived this month" and
          "who has not been back". */}
      <td className={cell}>
        <select
          className={control}
          aria-label="Filter by when the account registered"
          value={current.joined ?? ''}
          onChange={(e) => update({ joined: e.target.value || undefined })}
        >
          <option value="">Any time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </td>

      <td className={cell}>
        <select
          className={control}
          aria-label="Filter by when the account was last seen"
          value={current.seen ?? ''}
          onChange={(e) => update({ seen: e.target.value || undefined })}
        >
          <option value="">Any time</option>
          <option value="never">Never</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          {/* The one that finds churn before it is churn. */}
          <option value="stale">Over 30 days ago</option>
        </select>
      </td>

      <td className={cell}>
        <select
          className={control}
          aria-label="Filter by plan"
          value={current.plan ?? ''}
          onChange={(e) => update({ plan: e.target.value || undefined })}
        >
          <option value="">Any plan</option>
          {plans.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>

      <td className={cell}>{numberFilter('minMembers', 'Minimum members')}</td>
      <td className={cell}>{numberFilter('minSpaces', 'Minimum spaces')}</td>
      <td className={cell}>{numberFilter('minChecklists', 'Minimum checklists')}</td>
      <td className={cell}>{numberFilter('minActivity', 'Minimum 30-day activity')}</td>

      <td className={cell}>
        <select
          className={control}
          aria-label="Filter by whether limits are lifted"
          value={current.limits ?? ''}
          onChange={(e) => update({ limits: e.target.value || undefined })}
        >
          <option value="">Any</option>
          <option value="unlimited">Lifted</option>
          <option value="plan">Plan limits</option>
        </select>
      </td>

      <td className={cell}>
        <select
          className={control}
          aria-label="Filter by whether the account pays"
          value={current.paying ?? ''}
          onChange={(e) => update({ paying: e.target.value || undefined })}
        >
          <option value="">Any</option>
          <option value="yes">Paying</option>
          <option value="no">Free</option>
        </select>
      </td>

      {/* The one column with no filter earns its cell as the way out.
          Eleven controls need a single reset, and a row of filters with no
          reset is a row you escape by editing the address bar. */}
      <td className={cell} colSpan={Math.max(1, columns - 11)}>
        {anyFilterSet ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              router.push('/dashboard/admin/accounts');
            }}
            className="rounded-md px-2 py-1 text-xs underline underline-offset-4 hover:bg-[var(--color-accent)]"
          >
            Clear
          </button>
        ) : null}
      </td>
    </tr>
  );
}

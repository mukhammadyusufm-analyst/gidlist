import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { formatMoney, money } from '@app/core';

import { hasCapability } from '@/lib/platform/access';
import { UnlimitedToggle } from './unlimited-toggle';
import { DeleteAccount } from './delete-account';
import { AccountColumnFilters } from './column-filters';
import { createClient } from '@/lib/supabase/server';
import { getTranslations } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Accounts' };

/**
 * What an account is doing, in one word.
 *
 * Ordered by how much it should worry you, and the first match wins. An
 * unconfirmed address cannot sign in at all, which is both the clearest bot
 * signal and the reason none of the later states would mean anything for it.
 */
type AccountState = 'unconfirmed' | 'never' | 'dormant' | 'near-limit' | 'active';

function accountState(a: {
  confirmed: boolean;
  last_sign_in_at: string | null;
  submissions_30d: number;
  used_members: number;
  max_members: number | null;
  used_spaces: number;
  max_spaces: number | null;
}): AccountState {
  if (!a.confirmed) return 'unconfirmed';
  if (!a.last_sign_in_at) return 'never';

  // Four fifths of either ceiling, the same threshold the revenue figures use
  // for "near a limit" — this is the upgrade conversation.
  const nearMembers = a.max_members !== null && a.used_members >= a.max_members * 0.8;
  const nearSpaces = a.max_spaces !== null && a.used_spaces >= a.max_spaces * 0.8;
  if (nearMembers || nearSpaces) return 'near-limit';

  return a.submissions_30d > 0 ? 'active' : 'dormant';
}

const STATE_LABELS: Record<AccountState, string> = {
  unconfirmed: 'Unconfirmed',
  never: 'Never signed in',
  dormant: 'Dormant',
  'near-limit': 'Near a limit',
  active: 'Active',
};

function StateBadge({ state }: { state: AccountState }) {
  const tone =
    state === 'active'
      ? 'text-[var(--color-success)]'
      : state === 'near-limit'
        ? 'text-[var(--color-warning)]'
        : state === 'unconfirmed'
          ? 'text-[var(--color-destructive)]'
          : 'text-[var(--color-muted-foreground)]';

  return <span className={`text-xs whitespace-nowrap ${tone}`}>{STATE_LABELS[state]}</span>;
}

/** A date, no time. The hour an account registered has never mattered here. */
function formatDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/**
 * Every account, what it pays, and what it is actually doing.
 *
 * Gated on `accounts`, not on being an administrator — the whole point of
 * splitting platform access was that someone editing Uzbek wording should never
 * reach this page. The database refuses it too; this check only decides whether
 * rendering is worth attempting.
 *
 * Free accounts sit beside paying ones on purpose: they are the pipeline. The
 * states are what earn their keep — an account near a limit is a conversation
 * to have this week, and one that registered and never signed in is either a
 * bot or a person the product lost in its first minute. Neither was visible
 * before, and nothing else in the product surfaces them.
 */
/** How many days ago, from an ISO timestamp. Whole days, local calendar. */
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** A `min…` parameter, as a number. Rubbish and zero both mean "no floor". */
function floorOf(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    state?: string;
    joined?: string;
    seen?: string;
    plan?: string;
    minMembers?: string;
    minSpaces?: string;
    minChecklists?: string;
    minActivity?: string;
    limits?: string;
    paying?: string;
  }>;
}) {
  if (!(await hasCapability('accounts'))) notFound();

  const sp = await searchParams;
  const search = sp.q?.trim().toLowerCase() ?? '';

  const supabase = await createClient();
  const [{ data: accounts }, { data: revenue }, { locale }, canChangeLimits] = await Promise.all([
    supabase.rpc('platform_accounts'),
    supabase.rpc('platform_revenue'),
    getTranslations(),
    // Reading this page needs `accounts`; changing a limit needs `billing`.
    hasCapability('billing'),
  ]);

  const totals = revenue?.[0];
  const rows = accounts ?? [];

  // One query for the whole page rather than one per row.
  const { data: unlimitedRows } = await supabase.from('unlimited_accounts').select('user_id');
  const unlimited = new Set((unlimitedRows ?? []).map((u) => u.user_id));

  /*
   * Filtering happens here rather than in SQL because the function already
   * returns every account and the counts beside each filter have to be computed
   * over the whole set anyway — a filtered query would need a second one just to
   * label its own options. That holds at this scale; when the listing grows a
   * limit and an offset, this moves into the database with it.
   */
  const stateCounts = new Map<AccountState, number>();
  for (const row of rows) {
    const s = accountState(row);
    stateCounts.set(s, (stateCounts.get(s) ?? 0) + 1);
  }

  /*
   * The state counts and the plan list are computed over EVERY account, not
   * over the visible ones — deliberately. An option labelled with the count of
   * rows that would survive the filters already applied changes its own label
   * as you use it, and an option whose count has fallen to zero disappears, so
   * the way to widen a search vanishes exactly when you need it.
   */
  const plans = [...new Set(rows.map((r) => r.plan_name))].sort();

  const minMembers = floorOf(sp.minMembers);
  const minSpaces = floorOf(sp.minSpaces);
  const minChecklists = floorOf(sp.minChecklists);
  const minActivity = floorOf(sp.minActivity);

  const visible = rows.filter((row) => {
    if (sp.state && accountState(row) !== sp.state) return false;
    if (sp.plan && row.plan_name !== sp.plan) return false;

    if (sp.joined) {
      const within = Number(sp.joined);
      if (Number.isFinite(within) && daysSince(row.joined_at) > within) return false;
    }

    if (sp.seen === 'never') {
      if (row.last_sign_in_at) return false;
    } else if (sp.seen === 'stale') {
      // Never signed in is excluded rather than included. "Over 30 days ago"
      // is a claim about a last visit, and an account with no visit at all has
      // no answer to it — it has its own option, and its own state badge.
      if (!row.last_sign_in_at || daysSince(row.last_sign_in_at) <= 30) return false;
    } else if (sp.seen) {
      const within = Number(sp.seen);
      if (!row.last_sign_in_at) return false;
      if (Number.isFinite(within) && daysSince(row.last_sign_in_at) > within) return false;
    }

    if (row.used_members < minMembers) return false;
    if (row.used_spaces < minSpaces) return false;
    if (row.checklists < minChecklists) return false;
    if (row.submissions_30d < minActivity) return false;

    if (sp.limits === 'unlimited' && !unlimited.has(row.owner_id)) return false;
    if (sp.limits === 'plan' && unlimited.has(row.owner_id)) return false;

    if (sp.paying === 'yes' && row.price_minor <= 0) return false;
    if (sp.paying === 'no' && row.price_minor > 0) return false;

    if (!search) return true;
    return (
      row.email.toLowerCase().includes(search) ||
      (row.full_name ?? '').toLowerCase().includes(search)
    );
  });

  const stateOptions = (Object.keys(STATE_LABELS) as AccountState[])
    .filter((s) => (stateCounts.get(s) ?? 0) > 0)
    .map((s) => ({ value: s, label: STATE_LABELS[s], count: stateCounts.get(s) ?? 0 }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          One row per registered account — what it pays, what it has built, and
          whether anyone is using it. Someone who only belongs to another
          company&apos;s space also appears here, with no plan of their own, and
          is counted again inside that space&apos;s member figure.
        </p>
      </div>

      {totals ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={<TrendingUp className="size-4" aria-hidden="true" />}
            label="Monthly recurring"
            value={formatMoney(money(Number(totals.mrr_minor), totals.currency), locale)}
            hint={`${totals.paying_accounts} paying`}
          />
          {/* Registered people rather than free accounts: most people who use
              this will never own a space, so counting only owners makes the
              product look smaller than it is. Free accounts sit in the hint. */}
          <Stat
            icon={<Users className="size-4" aria-hidden="true" />}
            label="Registered people"
            value={String(totals.registered_people)}
            hint={`${totals.free_accounts} free ${totals.free_accounts === 1 ? 'account' : 'accounts'}`}
          />
          <Stat
            icon={<AlertTriangle className="size-4" aria-hidden="true" />}
            label="Near a limit"
            value={String(totals.near_limit)}
            hint="upgrade conversations"
            emphasis={totals.near_limit > 0}
          />
          <Stat
            icon={<AlertTriangle className="size-4" aria-hidden="true" />}
            label="Payment overdue"
            value={String(totals.past_due)}
            hint="still have access"
            emphasis={totals.past_due > 0}
          />
        </div>
      ) : null}

      <p className="text-sm text-[var(--color-muted-foreground)] tabular-nums">
        Showing {visible.length} of {rows.length}
      </p>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full min-w-5xl text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
              <th className="px-4 py-2.5 font-normal">Account</th>
              <th className="px-4 py-2.5 font-normal">State</th>
              <th className="px-4 py-2.5 font-normal">Registered</th>
              <th className="px-4 py-2.5 font-normal">Last seen</th>
              <th className="px-4 py-2.5 font-normal">Plan</th>
              <th className="px-4 py-2.5 font-normal">Members</th>
              <th className="px-4 py-2.5 font-normal">Spaces</th>
              <th className="px-4 py-2.5 font-normal">Checklists</th>
              <th className="px-4 py-2.5 font-normal">30-day activity</th>
              <th className="px-4 py-2.5 font-normal">Limits</th>
              <th className="px-4 py-2.5 text-right font-normal">Per month</th>
              <th className="px-4 py-2.5 font-normal"><span className="sr-only">Delete</span></th>
            </tr>

            <AccountColumnFilters
              columns={12}
              states={stateOptions}
              plans={plans}
              current={{
                q: sp.q,
                state: sp.state,
                joined: sp.joined,
                seen: sp.seen,
                plan: sp.plan,
                minMembers: sp.minMembers,
                minSpaces: sp.minSpaces,
                minChecklists: sp.minChecklists,
                minActivity: sp.minActivity,
                limits: sp.limits,
                paying: sp.paying,
              }}
            />
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-[var(--color-muted-foreground)]">
                  {rows.length === 0 ? 'No accounts yet.' : 'No accounts match these filters.'}
                </td>
              </tr>
            ) : (
              visible.map((account) => (
                <tr key={account.owner_id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{account.full_name ?? '—'}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">{account.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StateBadge state={accountState(account)} />
                  </td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                    {formatDay(account.joined_at, locale)}
                  </td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                    {account.last_sign_in_at ? (
                      formatDay(account.last_sign_in_at, locale)
                    ) : (
                      <span className="text-[var(--color-muted-foreground)]">never</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {account.plan_name}
                    {account.status !== 'active' ? (
                      <span className="ml-2 text-xs text-[var(--color-warning)]">{account.status}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Usage used={account.used_members} limit={account.max_members} />
                  </td>
                  <td className="px-4 py-3">
                    <Usage used={account.used_spaces} limit={account.max_spaces} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{account.checklists}</td>
                  {/* Built and used are different things. An account with nine
                      checklists and no submissions set something up and walked
                      away, which is a different conversation from one with two
                      checklists filled in every day. */}
                  <td className="px-4 py-3 tabular-nums">{account.submissions_30d}</td>
                  <td className="px-4 py-3">
                    <UnlimitedToggle
                      ownerId={account.owner_id}
                      accountName={account.full_name ?? account.email}
                      unlimited={unlimited.has(account.owner_id)}
                      canChange={canChangeLimits}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(money(account.price_minor, account.currency), locale)}
                  </td>
                  <td className="px-4 py-3">
                    <DeleteAccount
                      userId={account.owner_id}
                      label={account.full_name ?? account.email}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  emphasis,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
        {icon}
        {label}
      </div>
      <p
        className={
          emphasis
            ? 'mt-1 text-2xl font-semibold tabular-nums text-[var(--color-warning)]'
            : 'mt-1 text-2xl font-semibold tabular-nums'
        }
      >
        {value}
      </p>
      <p className="text-xs text-[var(--color-muted-foreground)]">{hint}</p>
    </div>
  );
}

/** Usage against a limit, marked when it is close enough to act on. */
function Usage({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) return <span className="tabular-nums">{used}</span>;
  const near = used >= limit * 0.8;

  return (
    <span
      className={near ? 'tabular-nums text-[var(--color-warning)]' : 'tabular-nums'}
      title={near ? 'Close to the plan limit' : undefined}
    >
      {used} / {limit}
    </span>
  );
}

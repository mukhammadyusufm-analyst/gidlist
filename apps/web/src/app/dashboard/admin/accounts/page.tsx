import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { formatMoney, money } from '@app/core';

import { hasCapability } from '@/lib/platform/access';
import { createClient } from '@/lib/supabase/server';
import { getTranslations } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Accounts' };

/**
 * Customers and revenue.
 *
 * Gated on `accounts`, not on being an administrator — the whole point of
 * splitting platform access was that someone editing Uzbek wording should never
 * reach this page. The database refuses it too; this check only decides whether
 * rendering is worth attempting.
 *
 * Free accounts are shown alongside paying ones on purpose. They are the
 * pipeline, and the near-limit count below is the part that earns its keep: an
 * account at nine of ten members is a conversation to have this week, and
 * nothing else in the product surfaces that.
 */
export default async function AccountsPage() {
  if (!(await hasCapability('accounts'))) notFound();

  const supabase = await createClient();
  const [{ data: accounts }, { data: revenue }, { locale }] = await Promise.all([
    supabase.rpc('platform_accounts'),
    supabase.rpc('platform_revenue'),
    getTranslations(),
  ]);

  const totals = revenue?.[0];
  const rows = accounts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Every account with a live space, and what it pays.
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
          <Stat
            icon={<Users className="size-4" aria-hidden="true" />}
            label="Free accounts"
            value={String(totals.free_accounts)}
            hint="the pipeline"
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

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full min-w-3xl text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
              <th className="px-4 py-2.5 font-normal">Account</th>
              <th className="px-4 py-2.5 font-normal">Plan</th>
              <th className="px-4 py-2.5 font-normal">Members</th>
              <th className="px-4 py-2.5 font-normal">Spaces</th>
              <th className="px-4 py-2.5 text-right font-normal">Per month</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-muted-foreground)]">
                  No accounts with a live space yet.
                </td>
              </tr>
            ) : (
              rows.map((account) => (
                <tr key={account.owner_id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{account.full_name ?? '—'}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">{account.email}</div>
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
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(money(account.price_minor, account.currency), locale)}
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

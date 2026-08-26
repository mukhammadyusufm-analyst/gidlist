import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

import { hasCapability } from '@/lib/platform/access';
import { createClient } from '@/lib/supabase/server';

import { GrantToggle } from './grant-toggle';

export const metadata: Metadata = { title: 'Access' };

/**
 * Who holds which platform capability.
 *
 * Gated on `grants` rather than `accounts`: this lists every person who has
 * ever signed up, which is a more sensitive thing than a list of customers.
 *
 * The root capability shows as read-only. It can only be set with SQL, which is
 * what stops this page from being a way to escalate to full control — the
 * database refuses it regardless of what the interface offers.
 */
export default async function AccessPage() {
  if (!(await hasCapability('grants'))) notFound();

  const supabase = await createClient();
  const [{ data: people }, { data: capabilities }] = await Promise.all([
    supabase.rpc('platform_people'),
    supabase.from('platform_capabilities').select('*').order('sort_order'),
  ]);

  const caps = capabilities ?? [];
  const rows = people ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform access</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          What each person may do across every customer. Nothing here is space-level — space
          owners manage their own people separately.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
          What each capability allows
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          {caps.map((cap) => (
            <div key={cap.code} className="flex flex-wrap gap-x-2">
              <dt className="font-medium">{cap.name}</dt>
              <dd className="text-[var(--color-muted-foreground)]">{cap.description}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full min-w-2xl text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
              <th className="px-4 py-2.5 font-normal">Person</th>
              {caps.map((cap) => (
                <th key={cap.code} className="px-4 py-2.5 font-normal">
                  {cap.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((person) => (
              <tr key={person.user_id} className="border-b border-[var(--color-border)] last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{person.full_name ?? '—'}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">{person.email}</div>
                </td>
                {caps.map((cap) => (
                  <td key={cap.code} className="px-4 py-3">
                    <GrantToggle
                      userId={person.user_id}
                      capability={cap.code}
                      capabilityName={cap.name}
                      granted={person.capabilities.includes(cap.code)}
                      isRoot={cap.is_root}
                      personName={person.full_name ?? person.email}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

import { hasCapability } from '@/lib/platform/access';
import { createClient } from '@/lib/supabase/server';

import { ListFilter, Pagination } from '@/components/ui/list-controls';

import { GrantToggle } from './grant-toggle';
import { GrantAllToggle } from './grant-all-toggle';

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
const PAGE_SIZE = 25;

/** The filter value meaning "holds something, no matter what". */
const ANY_ACCESS = 'any';

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; offset?: string }>;
}) {
  if (!(await hasCapability('grants'))) notFound();

  // Named `action` in the URL because the shared filter control uses that key.
  // Here it holds a capability code, or ANY_ACCESS.
  const { q, action: filter, offset: offsetParam } = await searchParams;
  const search = q?.trim() ?? '';
  const offset = Math.max(Number(offsetParam ?? 0) || 0, 0);

  const supabase = await createClient();
  const [{ data: people }, { data: capabilities }, { data: counts }] = await Promise.all([
    supabase.rpc('platform_people', {
      p_search: search || undefined,
      p_capability: filter && filter !== ANY_ACCESS ? filter : undefined,
      p_with_access: filter === ANY_ACCESS,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }),
    supabase.from('platform_capabilities').select('*').order('sort_order'),
    supabase.rpc('platform_capability_counts'),
  ]);

  const caps = capabilities ?? [];
  // What "all" means for the grant-all control: everything except root, which
  // stays SQL-only. Derived from is_root in the data, never from a name list.
  const grantableCodes = caps.filter((c) => !c.is_root).map((c) => c.code);
  const rows = people ?? [];
  const total = rows[0]?.total_count ?? 0;

  // "Anyone with access" first: it is the reason this page usually gets opened,
  // and scanning hundreds of accounts for the few that hold something is the
  // work the filter exists to remove.
  const withAccess = (counts ?? []).reduce((sum, c) => sum + Number(c.holders), 0);
  const filterOptions = [
    { action: ANY_ACCESS, uses: withAccess },
    ...(counts ?? []).map((c) => ({ action: c.capability, uses: Number(c.holders) })),
  ];

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

      <ListFilter
        action="/dashboard/admin/access"
        search={search}
        searchLabel="Search by name or email"
        actions={filterOptions}
        selectedAction={filter}
        actionLabel="Holds"
        allLabel="Everyone"
        optionLabel={(value) =>
          value === ANY_ACCESS
            ? 'Any access'
            : (caps.find((c) => c.code === value)?.name ?? value)
        }
        submitLabel="Search"
      />

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
              <th className="px-4 py-2.5 font-normal">Everything</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                {/* Person, one column per capability, and the grant-all column. */}
                <td
                  colSpan={caps.length + 2}
                  className="px-4 py-8 text-center text-[var(--color-muted-foreground)]"
                >
                  {search || filter ? 'Nobody matches that.' : 'No accounts yet.'}
                </td>
              </tr>
            ) : null}
            {rows.map((person) => (
              <tr key={person.user_id} className="border-b border-[var(--color-border)] last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{person.full_name ?? '—'}</div>
                  {/* Email always shown, and the account id on hover. Two people
                      can share a display name, and a name can be changed after
                      the fact — neither is true of these. */}
                  <div
                    className="text-xs text-[var(--color-muted-foreground)]"
                    title={person.user_id}
                  >
                    {person.email}
                  </div>
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
                <td className="px-4 py-3">
                  <GrantAllToggle
                    userId={person.user_id}
                    personName={person.full_name ?? person.email}
                    hasAll={grantableCodes.every((code) => person.capabilities.includes(code))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/dashboard/admin/access"
        params={{ q: search, action: filter }}
        offset={offset}
        limit={PAGE_SIZE}
        total={total}
        label={`Showing ${total === 0 ? 0 : offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`}
      />
    </div>
  );
}

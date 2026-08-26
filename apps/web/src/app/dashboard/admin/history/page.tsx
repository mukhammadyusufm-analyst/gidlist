import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { hasCapability } from '@/lib/platform/access';
import { createClient } from '@/lib/supabase/server';
import { getTranslations } from '@/lib/i18n/server';
import { AuditList, type AuditEntry } from '@/components/audit/audit-list';

export const metadata: Metadata = { title: 'History' };

/**
 * Platform history: capability grants and billing.
 *
 * Gated on `grants`, the same capability that can change access. Whoever hands
 * out power should be the one who can see it handed out — and nobody else
 * should read a list of who administers what.
 *
 * English, like the rest of the admin area. These pages have one audience.
 */
export default async function PlatformHistoryPage() {
  if (!(await hasCapability('grants'))) notFound();

  const supabase = await createClient();
  const [{ data }, { locale }] = await Promise.all([
    supabase.rpc('platform_audit_log', { p_limit: 200 }),
    getTranslations(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform history</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Access changes and billing, newest first. Written by the database, so nothing that
          happened is missing from it.
        </p>
      </div>

      <AuditList
        entries={(data ?? []) as AuditEntry[]}
        emptyLabel="Nothing recorded yet."
        locale={locale}
        phrase={platformPhrase}
      />
    </div>
  );
}

function platformPhrase(entry: AuditEntry): string {
  const who = entry.actor_name;
  const d = entry.detail ?? {};

  switch (entry.action) {
    case 'access.granted':
      return `${who} granted ${d.capability} access`;
    case 'access.revoked':
      return `${who} revoked ${d.capability} access`;
    case 'billing.started':
      return `${who} started on the ${d.plan} plan`;
    case 'billing.changed':
      return d.plan_from !== d.plan_to
        ? `${who} moved from ${d.plan_from} to ${d.plan_to}`
        : `${who}: subscription is now ${d.status_to}`;
    case 'space.deleted':
      return `${who} deleted the space "${d.name}"`;
    case 'translation.added':
    case 'translation.changed':
      return `${who} changed the ${d.locale} wording for ${d.key}`;
    case 'translation.reset':
      return `${who} reset ${d.key} in ${d.locale} to the original`;
    case 'language.added':
      return `${who} added ${d.name} (${d.code})`;
    case 'language.removed':
      return `${who} removed ${d.name} (${d.code})`;
    case 'language.enabled':
      return `${who} enabled ${d.name}`;
    case 'language.disabled':
      return `${who} disabled ${d.name}`;
    default:
      // Deliberately still rendered. A trigger added later without matching
      // wording here should show something imperfect, not disappear.
      return `${who} — ${entry.action} ${JSON.stringify(d)}`;
  }
}

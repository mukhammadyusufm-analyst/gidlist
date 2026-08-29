import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Globe, History, Languages, ShieldCheck, Tag, TrendingUp } from 'lucide-react';

import { myCapabilities } from '@/lib/platform/access';
import { JobHealth } from '@/components/admin/job-health';

export const metadata: Metadata = { title: 'Admin' };

/**
 * The way in to the platform tools.
 *
 * Only sections the viewer can actually reach are listed. A link that 404s
 * teaches nothing except that something is being kept from you, which is worse
 * than the section simply not existing as far as this person is concerned.
 *
 * The layout above has already established that they hold something, so this
 * page never renders empty.
 */
export default async function AdminPage() {
  const caps = await myCapabilities();

  const sections = [
    {
      capability: 'accounts' as const,
      href: '/dashboard/admin/accounts',
      icon: TrendingUp,
      title: 'Accounts and revenue',
      description: 'Every account with a live space, what it pays, and who is near a limit.',
    },
    {
      capability: 'translations' as const,
      href: '/dashboard/admin/translations',
      icon: Languages,
      title: 'Translations',
      description: 'The interface wording every customer reads.',
    },
    {
      capability: 'billing' as const,
      href: '/dashboard/admin/plans',
      icon: Tag,
      title: 'Plans and pricing',
      description: 'What each plan costs and the capacity it carries.',
    },
    {
      capability: 'site' as const,
      href: '/dashboard/admin/site',
      icon: Globe,
      title: 'Marketing site',
      description: 'The wording on gidlist.com, in all three languages.',
    },
    {
      capability: 'grants' as const,
      href: '/dashboard/admin/access',
      icon: ShieldCheck,
      title: 'Platform access',
      description: 'Who may do what across every customer.',
    },
    {
      capability: 'grants' as const,
      href: '/dashboard/admin/history',
      icon: History,
      title: 'Platform history',
      description: 'Access changes and billing, recorded by the database.',
    },
  ].filter((section) => caps.has(section.capability));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Tools that reach across every customer. Separate from anything a space owner controls.
        </p>
      </div>

      {/* Above the sections, and renders nothing when all is well. A silent
          failure has to be put in front of somebody; nobody navigates to a
          health page. */}
      <JobHealth />

      <ul className="space-y-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:bg-[var(--color-accent)]"
              >
                <span className="flex items-start gap-3">
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-[var(--color-muted-foreground)]"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-sm font-medium">{section.title}</span>
                    <span className="block text-xs text-[var(--color-muted-foreground)]">
                      {section.description}
                    </span>
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-[var(--color-muted-foreground)]"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

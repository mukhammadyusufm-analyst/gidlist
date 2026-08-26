'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CreditCard, ListChecks, Settings, SquareCheckBig, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useT } from '@/components/i18n/provider';

/**
 * Space navigation.
 *
 * Icons ride alongside the labels rather than replacing them: this app is used
 * in three languages, and an icon alone would be a guess in any of them. The
 * pairing is what makes a tab findable at a glance once someone knows it.
 *
 * Hiding Settings from non-admins is a courtesy, not a control — typing the URL
 * still reaches the page, which is why that page checks the role itself and the
 * database refuses regardless.
 */
export function BoardTabs({
  slug,
  canManage,
  canEdit,
}: {
  slug: string;
  /** Governance: space settings. */
  canManage: boolean;
  /** Content: building and scheduling checklists. */
  canEdit: boolean;
}) {
  const pathname = usePathname();
  const { t } = useT();
  const base = `/dashboard/boards/${slug}`;

  const tabs = [
    // The Checklists tab leads to the builder, schedules and checklist details
    // — all editor work. Someone who only fills checklists in has no use for
    // it, and a tab whose every page refuses them is worse than no tab.
    ...(canEdit ? [{ href: base, label: t('space.checklists'), icon: ListChecks }] : []),
    { href: `${base}/fill`, label: t('space.fillIn'), icon: SquareCheckBig },
    { href: `${base}/compliance`, label: t('space.compliance'), icon: BarChart3 },
    // The staff list is not a member's business. They still see their own role
    // and their own record; the roster belongs to whoever runs the space.
    ...(canEdit ? [{ href: `${base}/members`, label: t('space.members'), icon: Users }] : []),
    // Governance, like Settings: what a space costs is the owner's business,
    // not the staff's. Last, because it is the tab visited least often.
    ...(canManage ? [{ href: `${base}/settings`, label: t('space.settings'), icon: Settings }] : []),
    ...(canManage
      ? [{ href: `${base}/billing`, label: t('space.billing'), icon: CreditCard }]
      : []),
  ];

  return (
    <nav className="-mx-4 mt-6 overflow-x-auto px-4">
      <div className="flex min-w-max gap-1 border-b border-[var(--color-border)]">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-[var(--color-primary)] text-[var(--color-foreground)]'
                  : 'border-transparent text-[var(--color-muted-foreground)] hover:border-[var(--color-border)] hover:text-[var(--color-foreground)]',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ListChecks, Settings, SquareCheckBig, Users } from 'lucide-react';

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
    /*
     * Fill in comes first, for everybody.
     *
     * It is the only tab most people in a space ever need, and the one they open
     * every day — the others are for whoever set the space up. Ordering by who
     * builds rather than by who uses puts the daily task second for an editor and
     * makes the first tab something a member cannot even open.
     */
    { href: `${base}/fill`, label: t('space.fillIn'), icon: SquareCheckBig },
    // The Checklists tab leads to the builder, schedules and checklist details
    // — all editor work. Someone who only fills checklists in has no use for
    // it, and a tab whose every page refuses them is worse than no tab.
    ...(canEdit
      ? [{ href: `${base}/checklists`, label: t('space.checklists'), icon: ListChecks }]
      : []),
    { href: `${base}/compliance`, label: t('space.compliance'), icon: BarChart3 },
    // The staff list is not a member's business. They still see their own role
    // and their own record; the roster belongs to whoever runs the space.
    ...(canEdit ? [{ href: `${base}/members`, label: t('space.members'), icon: Users }] : []),
    ...(canManage ? [{ href: `${base}/settings`, label: t('space.settings'), icon: Settings }] : []),
    // No billing tab here on purpose. A plan covers every space an owner has,
    // so putting it on one space would suggest each is billed separately —
    // which is the model this deliberately moved away from. It lives on the
    // account, reached from the header.
  ];

  return (
    <nav className="-mx-4 mt-6 overflow-x-auto px-4">
      <div className="flex min-w-max gap-1 border-b border-[var(--color-border)]">
        {tabs.map((tab) => {
          /*
           * A tab is current for its whole subtree, not just its own address.
           *
           * Both Fill in and Checklists lead somewhere deeper — a submission,
           * a checklist's builder and schedules — and on those pages an exact
           * comparison left no tab marked at all, so the bar stopped saying
           * where you were exactly when you had navigated furthest.
           *
           * Prefixed with a slash so `/fill` cannot claim a sibling that
           * merely starts with the same letters.
           */
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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

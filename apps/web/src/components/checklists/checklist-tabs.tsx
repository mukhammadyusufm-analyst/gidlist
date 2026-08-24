'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, ListTree, SlidersHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useT } from '@/components/i18n/provider';

export function ChecklistTabs({ slug, checklistId }: { slug: string; checklistId: string }) {
  const pathname = usePathname();
  const { t } = useT();
  const base = `/dashboard/boards/${slug}/checklists/${checklistId}`;

  const tabs = [
    { href: base, label: t('checklist.structure'), icon: ListTree },
    { href: `${base}/schedules`, label: t('checklist.schedules'), icon: CalendarClock },
    { href: `${base}/details`, label: t('checklist.details'), icon: SlidersHorizontal },
  ];

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] px-1">
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
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

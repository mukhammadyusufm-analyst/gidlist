'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, Moon, Sun } from 'lucide-react';
import { THEMES, type Theme } from '@app/core/theme';

import { setTheme } from '@/lib/theme/actions';
import { cn } from '@/lib/utils';
import { useT } from '@/components/i18n/provider';

const ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABELS: Record<Theme, string> = {
  light: 'theme.light',
  dark: 'theme.dark',
  system: 'theme.system',
};

/**
 * The full choice, including the one the header cannot afford to show.
 *
 * The header toggle is two buttons — day and night — because a phone screen has
 * no room for a third, and because "match device" is the default state rather
 * than a thing people go looking for. The cost of that trim was a one-way door:
 * once somebody chose light or dark there was no way back to following their
 * phone, and a setting you can leave but not return to is a trap.
 *
 * This is where it comes back. Not as a fourth icon in a crowded strip, but in
 * the one place where an option can carry a sentence explaining what it does —
 * which is what "match device" needs and what an icon can never give it.
 *
 * Written to the same cookie as the header, so the two can never disagree.
 */
export function ThemeChoice({ current }: { current: Theme }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(current, (_c, next: Theme) => next);
  const { t } = useT();

  return (
    <div role="group" aria-label={t('theme.label')} className="flex flex-wrap gap-2">
      {THEMES.map((theme) => {
        const Icon = ICONS[theme];
        const active = optimistic === theme;

        return (
          <button
            key={theme}
            type="button"
            aria-pressed={active}
            onClick={() => {
              startTransition(async () => {
                setOptimistic(theme);
                await setTheme(theme);
                // The cookie is read during the server render, so the tree has
                // to be refetched for the new attribute to appear.
                router.refresh();
              });
            }}
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
              'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none',
              active
                ? 'border-[var(--color-primary)] bg-[var(--color-secondary)]'
                : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(LABELS[theme])}
          </button>
        );
      })}
    </div>
  );
}

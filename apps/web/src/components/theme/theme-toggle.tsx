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

const TITLE_KEYS: Record<Theme, string> = {
  light: 'theme.light',
  dark: 'theme.dark',
  system: 'theme.system',
};

/**
 * A three-way segmented control rather than a two-state switch.
 *
 * "Match device" has to be reachable: someone whose phone flips to dark at
 * sunset wants the app to follow, and a plain light/dark toggle silently takes
 * that away the first time it is touched.
 */
export function ThemeToggle({ current }: { current: Theme }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(current, (_c, next: Theme) => next);
  const { t } = useT();

  return (
    <div
      role="group"
      aria-label={t('theme.label')}
      className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-0.5"
    >
      {THEMES.map((theme) => {
        const Icon = ICONS[theme];
        const active = optimistic === theme;

        return (
          <button
            key={theme}
            type="button"
            title={t(TITLE_KEYS[theme])}
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
              'flex size-8 items-center justify-center rounded-md transition-colors',
              'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none',
              active
                ? 'bg-[var(--color-secondary)] text-[var(--color-foreground)]'
                : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="sr-only">{t(TITLE_KEYS[theme])}</span>
          </button>
        );
      })}
    </div>
  );
}

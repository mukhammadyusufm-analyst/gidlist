'use client';

import { useOptimistic, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import type { Theme } from '@app/core/theme';

import { setTheme } from '@/lib/theme/actions';
import { cn } from '@/lib/utils';
import { useT } from '@/components/i18n/provider';

/**
 * Day and night. Two buttons, not three.
 *
 * =============================================================================
 * "MATCH DEVICE" IS STILL THERE — IT IS JUST NOT A BUTTON ANY MORE
 *
 * The previous version argued that a third control had to exist, because
 * somebody whose phone flips to dark at sunset wants the app to follow, and a
 * plain toggle takes that away the first time it is touched.
 *
 * That was right about the behaviour and wrong about the interface. Following
 * the device is the DEFAULT — `DEFAULT_THEME` is `system`, so every account
 * starts there and stays there until somebody deliberately chooses otherwise.
 * The third button was a control for the state you are already in, occupying
 * width in a header that overflows a phone screen.
 *
 * What is genuinely lost: no way back to "follow my device" once a choice is
 * made. That belongs on the account page, where a setting can be explained,
 * rather than in a strip of icons with no room to explain anything.
 *
 * =============================================================================
 * WHICH BUTTON LOOKS ACTIVE WHILE THE SETTING IS `system`
 *
 * Neither, if this only read the cookie — and a pair of buttons where neither
 * is pressed reads as broken. So while the setting is `system` the effective
 * theme is resolved from the device itself, and that button is shown as active.
 * It tells the truth about what is on screen, which is what somebody looking at
 * a toggle is actually asking.
 */
export function ThemeToggle({ current }: { current: Theme }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(current, (_c, next: Theme) => next);
  const { t } = useT();

  const prefersDark = usePrefersDark();

  // What the person is actually looking at, which is not always what is stored.
  const effective: Exclude<Theme, 'system'> =
    optimistic === 'system' ? (prefersDark ? 'dark' : 'light') : optimistic;

  return (
    <div
      role="group"
      aria-label={t('theme.label')}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-0.5"
    >
      {(['light', 'dark'] as const).map((theme) => {
        const Icon = theme === 'light' ? Sun : Moon;
        const active = effective === theme;

        return (
          <button
            key={theme}
            type="button"
            title={t(theme === 'light' ? 'theme.light' : 'theme.dark')}
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
            <span className="sr-only">{t(theme === 'light' ? 'theme.light' : 'theme.dark')}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * What the device asks for, kept in step with it.
 *
 * `useSyncExternalStore` rather than an effect: this is an external system with
 * a subscribe method, which is exactly what the hook is for, and it avoids
 * setting state during render on the server — where `matchMedia` does not
 * exist and the honest answer is "assume light".
 */
function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      query.addEventListener('change', fn);
      return () => query.removeEventListener('change', fn);
    },
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    () => false,
  );
}

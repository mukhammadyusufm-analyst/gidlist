'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { setLocale } from '@/lib/i18n/actions';
import { useT } from './provider';

/**
 * The list of languages is passed in rather than imported from a constant —
 * administrators can add languages in the app, so it is data, not code.
 */
export function LanguageSwitcher({
  locales,
}: {
  locales: { code: string; name: string }[];
}) {
  const { locale, t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (locales.length < 2) return null;

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(async () => {
            await setLocale(next);
            // The server action revalidates, but the router still holds the
            // previously rendered tree — without this the page keeps the old
            // language until the next navigation.
            router.refresh();
          });
        }}
        // Matched to the theme toggle beside it: same 36px height as the
        // header's icon buttons, same border token, same card background.
        // It previously used min-h-11 — the 44px touch minimum the Button base
        // sets — which made it stand a head taller than everything around it.
        // The header is not a gloved-hand surface; the controls that live in it
        // are all 36px on purpose, and consistency there beats the rule.
        className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 text-sm transition-colors hover:bg-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none disabled:opacity-50"
      >
        {locales.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.name}
          </option>
        ))}
      </select>
    </label>
  );
}

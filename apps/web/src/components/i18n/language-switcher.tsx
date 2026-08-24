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
        className="min-h-11 rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-sm disabled:opacity-50"
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

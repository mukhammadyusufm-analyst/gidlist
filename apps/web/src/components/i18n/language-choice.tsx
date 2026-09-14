'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { setLocale } from '@/lib/i18n/actions';
import { cn } from '@/lib/utils';
import { useT } from './provider';

/**
 * The language choice on the sign-in and sign-up pages.
 *
 * Not the header's compact `LanguageSwitcher`. Here it is the FIRST decision on
 * the page, above the fields, at full button size and with the languages
 * written out — because it decides more than the labels: the practice space a
 * new account starts with is written in it, and it is saved to the account.
 * A two-letter dropdown under the form was easy to miss, and somebody who
 * missed it got everything in English.
 *
 * Each language is named in itself ("Oʻzbekcha", "Русский"), which is the one
 * form a person can recognise without already reading the current language.
 */
export function LanguageChoice({ locales }: { locales: { code: string; name: string }[] }) {
  const { locale, t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (locales.length < 2) return null;

  return (
    <fieldset className="mb-6 border-b border-[var(--color-border)] pb-6">
      <legend className="text-sm font-medium">{t('auth.chooseLanguage')}</legend>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        {t('auth.chooseLanguageHint')}
      </p>

      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${locales.length}, minmax(0, 1fr))` }}>
        {locales.map((entry) => {
          const active = entry.code === locale;
          return (
            <button
              key={entry.code}
              type="button"
              lang={entry.code}
              aria-pressed={active}
              disabled={pending}
              onClick={() => {
                if (active) return;
                startTransition(async () => {
                  await setLocale(entry.code);
                  router.refresh();
                });
              }}
              className={cn(
                // The same 44px minimum and radius as every other button on the
                // form, so it reads as a control of equal weight.
                'inline-flex min-h-11 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-60',
                active
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'border-[var(--color-input)] bg-[var(--color-card)] hover:bg-[var(--color-accent)]',
              )}
            >
              {entry.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

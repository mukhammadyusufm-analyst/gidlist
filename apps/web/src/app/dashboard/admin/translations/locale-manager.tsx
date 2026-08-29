'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { addLocale, setLocaleEnabled } from '@/lib/translations/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormNotice } from '@/components/ui/field-error';
import { cn } from '@/lib/utils';
import { useT } from '@/components/i18n/provider';

type AppLocale = { code: string; name: string; enabled: boolean; is_builtin: boolean };

export function LocaleManager({
  locales,
  editing,
}: {
  locales: AppLocale[];
  editing: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useT();

  function run(fn: () => Promise<{ error?: string; notice?: string }>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      if (result.notice) setNotice(result.notice);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{t('admin.languages')}</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? t('common.cancel') : t('admin.addLanguage')}
        </Button>
      </div>

      {error ? <FormNotice kind="error">{error}</FormNotice> : null}
      {notice ? <FormNotice kind="info">{notice}</FormNotice> : null}

      {/* The languages are a selector, and previously did not look like one:
          the name was plain text with no hover, no pointer and no pressed
          state, while the "Hide" link beside it was underlined — so the only
          thing on the row that looked clickable was the one that did not change
          what you were editing. Reported as "it only shows Uzbek", which is the
          default, because there was no visible way to pick anything else. */}
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t('admin.chooseLanguageToEdit')}
      </p>

      <ul className="flex flex-wrap gap-2">
        {locales.map((locale) => (
          <li key={locale.code}>
            <div
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
                locale.code === editing
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]',
              )}
            >
              <button
                type="button"
                onClick={() => router.push(`/dashboard/admin/translations?locale=${locale.code}`)}
                aria-pressed={locale.code === editing}
                className="cursor-pointer font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              >
                {locale.name}
                {locale.code === editing ? (
                  <span className="sr-only"> ({t('admin.currentlyEditing')})</span>
                ) : null}
              </button>
              <code className="text-xs text-[var(--color-muted-foreground)]">{locale.code}</code>

              {locale.is_builtin ? (
                <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {t('admin.builtin')}
                </span>
              ) : null}

              {/* English cannot be switched off — it is the fallback every other
                  language relies on, so disabling it would leave untranslated
                  strings with nothing to fall back to. */}
              {locale.code === 'en' ? null : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setLocaleEnabled(locale.code, !locale.enabled))}
                  className="text-xs text-[var(--color-muted-foreground)] underline underline-offset-2"
                >
                  {locale.enabled ? 'Hide' : 'Show'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {showAdd ? (
        <form
          ref={formRef}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(async () => {
              const result = await addLocale({
                code: String(data.get('code') ?? ''),
                name: String(data.get('name') ?? ''),
              });
              if (!result.error) formRef.current?.reset();
              return result;
            });
          }}
        >
          <div className="w-28">
            <Label htmlFor="code">{t('admin.languageCode')}</Label>
            <Input id="code" name="code" required placeholder="kk" maxLength={8} />
          </div>
          <div className="min-w-48 flex-1">
            <Label htmlFor="name">{t('admin.languageName')}</Label>
            <Input id="name" name="name" required placeholder="Қазақша" />
          </div>
          <Button type="submit" disabled={pending}>
            {t('checklist.add')}
          </Button>
          <p className="w-full text-xs text-[var(--color-muted-foreground)]">
            {t('admin.newLanguageNote')}
          </p>
        </form>
      ) : null}
    </section>
  );
}

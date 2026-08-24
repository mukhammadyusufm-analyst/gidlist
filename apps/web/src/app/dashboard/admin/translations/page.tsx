import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getTranslations, isPlatformAdmin } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';
import { CATALOGUE } from '@/lib/i18n/catalogue';
import { en } from '@/messages/en';

import { LocaleManager } from './locale-manager';
import { StringEditor } from './string-editor';

export const metadata: Metadata = { title: 'Translations' };

export default async function TranslationsPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  // Not a redirect to the dashboard: a 404 does not confirm to a curious
  // signed-in user that an admin area exists at this address.
  if (!(await isPlatformAdmin())) notFound();

  const { t } = await getTranslations();
  const { locale: requested } = await searchParams;

  const supabase = await createClient();

  // Unfiltered, unlike the public list — an administrator needs to see and
  // re-enable a language they have switched off.
  const { data: locales } = await supabase
    .from('app_locales')
    .select('code, name, enabled, is_builtin')
    .order('is_builtin', { ascending: false })
    .order('name');

  const all = locales ?? [];
  // Default to the first language that is not English: English is the source,
  // so there is rarely anything to correct there.
  const editing = all.find((l) => l.code === requested)?.code ?? all.find((l) => l.code !== 'en')?.code ?? 'en';

  const { data: overrides } = await supabase
    .from('translations')
    .select('key, value')
    .eq('locale', editing);

  const overrideMap = new Map((overrides ?? []).map((row) => [row.key, row.value]));
  const shipped = CATALOGUE[editing] ?? {};

  const rows = Object.keys(en).map((key) => ({
    key,
    english: en[key as keyof typeof en],
    shipped: shipped[key] ?? '',
    override: overrideMap.get(key) ?? '',
  }));

  const editingName = all.find((l) => l.code === editing)?.name ?? editing;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin.translations')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          {t('admin.translationsIntro')}
        </p>
      </div>

      <LocaleManager locales={all} editing={editing} />

      <StringEditor
        locale={editing}
        localeName={editingName}
        rows={rows}
        labels={{
          heading: t('admin.editing', { name: editingName }),
          english: t('admin.sourceEnglish'),
          value: t('admin.currentValue'),
          edited: t('admin.edited'),
          reset: t('admin.resetToDefault'),
          search: t('admin.searchStrings'),
          editedOnly: t('admin.editedOnly'),
          untranslatedOnly: t('admin.untranslatedOnly'),
          none: t('admin.noStrings'),
        }}
      />
    </div>
  );
}

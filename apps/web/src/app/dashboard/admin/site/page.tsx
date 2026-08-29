import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { BUILTIN_LOCALE_NAMES, MESSAGES, siteContentSections } from '@app/core';
import { hasCapability } from '@/lib/platform/access';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

import { ContentEditor, type ContentRow } from './content-editor';

export const metadata: Metadata = { title: 'Marketing site' };

/** The three languages gidlist.com has routes for. Not `app_locales`. */
const SITE_LOCALES = ['uz', 'ru', 'en'] as const;

/** Read one dotted path out of the shipped catalogue. */
function shippedValue(locale: string, key: string): string {
  const messages = MESSAGES[locale as keyof typeof MESSAGES];
  let current: unknown = messages;

  for (const segment of key.split('.')) {
    if (!current || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === 'string' ? current : '';
}

export default async function SiteContentPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  // The specific capability, not "is an administrator". The layout above only
  // established that this person holds something, and holding `accounts` is no
  // reason to be able to rewrite the front page.
  //
  // A 404 rather than a redirect, so the response does not confirm to a curious
  // signed-in user that this exists.
  if (!(await hasCapability('site'))) notFound();

  const { locale: requested } = await searchParams;
  const editing = SITE_LOCALES.includes(requested as (typeof SITE_LOCALES)[number])
    ? (requested as (typeof SITE_LOCALES)[number])
    : 'uz';

  const supabase = await createClient();
  const { data: overrides } = await supabase
    .from('site_content')
    .select('key, value')
    .eq('locale', editing);

  const overrideMap = new Map((overrides ?? []).map((row) => [row.key, row.value]));

  // Grouped by where each string appears on the page, in page order. The flat
  // alphabetical list this replaced was complete and unusable: changing the
  // hero meant knowing the hero is called `headline` and `subhead`.
  const sections = siteContentSections().map((section) => ({
    id: section.id,
    title: section.title,
    rows: section.keys.map(
      (key): ContentRow => ({
        key,
        shipped: shippedValue(editing, key),
        override: overrideMap.get(key) ?? '',
      }),
    ),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing site</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          The wording on gidlist.com. Leave a box empty to use the text the site ships with —
          clearing an edit is how you undo it.
        </p>
        {/*
          Said plainly rather than left to be discovered. The site is a separate
          deployment that rebuilds on its own schedule, so an edit saved here is
          not live the moment it is saved. Somebody who does not know that will
          reload gidlist.com, see the old headline, and reasonably conclude the
          editor is broken.
        */}
        <p className="mt-3 max-w-2xl rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
          Saved edits appear on gidlist.com within about five minutes. The site is built ahead of
          time and refreshes on a schedule, so it will not change the instant you save.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1" aria-label="Language">
        {SITE_LOCALES.map((code) => (
          <Link
            key={code}
            href={`/dashboard/admin/site?locale=${code}`}
            aria-current={code === editing ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              code === editing
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'border border-[var(--color-input)] hover:bg-[var(--color-accent)]',
            )}
          >
            {BUILTIN_LOCALE_NAMES[code]}
          </Link>
        ))}
      </nav>

      <ContentEditor
        locale={editing}
        localeName={BUILTIN_LOCALE_NAMES[editing]}
        sections={sections}
      />
    </div>
  );
}

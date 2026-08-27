import Link from 'next/link';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n/server';

import { NewBoardForm } from './new-board-form';

// Translated, so the browser tab matches the language the app is being read in.
// Static `metadata` cannot do this: it is evaluated without a request, so it
// has no way to know which locale the cookie asked for.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('space.createSpace') };
}

export default async function NewBoardPage() {
  const { t } = await getTranslations();

  return (
    <div className="mx-auto max-w-md">
      <Link
        href="/dashboard"
        className="text-sm text-[var(--color-muted-foreground)] underline underline-offset-4"
      >
        {t('space.spaces')}
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t('space.createSpace')}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('space.nameHint')}</p>

      <div className="mt-6">
        <NewBoardForm />
      </div>
    </div>
  );
}

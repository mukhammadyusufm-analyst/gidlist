import Link from 'next/link';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n/server';

import { NewBoardForm } from './new-board-form';

export const metadata: Metadata = { title: 'New space' };

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

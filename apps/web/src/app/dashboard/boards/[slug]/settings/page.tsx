import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { Avatar } from '@/components/ui/avatar';
import { getTranslations } from '@/lib/i18n/server';
import { canGovern } from '@app/core';
import { BannerPicker } from '@/components/ui/banner-picker';
import { ImageUploadForm } from '@/components/ui/image-upload-form';

import { BoardDetailsForm } from './rename-board-form';

export const metadata: Metadata = { title: 'Space settings' };

export default async function BoardSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const board = await getBoardBySlug(slug);
  if (!board) notFound();

  // Repeated here rather than relying on the hidden tab. Someone can navigate
  // straight to this URL, and the page should not render management controls
  // that the database is only going to reject.
  const role = await getMyRole(board.id);
  if (!canGovern(role)) notFound();

  const { t } = await getTranslations();

  return (
    <div className="max-w-lg space-y-10">
      <section>
        <h2 className="text-lg font-semibold tracking-tight">{t('space.details')}</h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
          The board&apos;s web address stays as{' '}
          <code className="rounded bg-[var(--color-muted)] px-1 py-0.5 text-xs">/{board.slug}</code>{' '}
          when you rename it, so existing links keep working.
        </p>
        <BoardDetailsForm
          boardId={board.id}
          currentName={board.name}
          currentDescription={board.description}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">{t('space.logo')}</h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
          A small square mark, shown beside the space name.
        </p>
        <div className="mb-4 flex items-center gap-3">
          <Avatar
            name={board.name}
            imageUrl={board.logo_url}
            seed={board.id}
            className="size-16"
          />
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {board.logo_url
              ? t('media.currentLogo')
              : t('space.generatedImage')}
          </span>
        </div>
        <ImageUploadForm
          bucket="board-logos"
          target={{ kind: 'board', boardId: board.id, slug: board.slug }}
          prefix="logo"
          label={t('media.uploadLogo')}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">{t('space.banner')}</h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
          A wide image across the top of the space.
        </p>
        <BannerPicker
          current={board.banner_url}
          target={{ kind: 'board', boardId: board.id, slug: board.slug }}
          prefix="banner"
        />
      </section>
    </div>
  );
}

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { getChecklist } from '@/lib/checklists/queries';
import { Avatar } from '@/components/ui/avatar';
import { getTranslations } from '@/lib/i18n/server';
import { canEditContent } from '@app/core';
import { BannerPicker } from '@/components/ui/banner-picker';
import { ImageUploadForm } from '@/components/ui/image-upload-form';

import { ChecklistDetailsForm } from './checklist-details-form';

export const metadata: Metadata = { title: 'Checklist details' };

export default async function ChecklistDetailsPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const [board, checklist] = await Promise.all([getBoardBySlug(slug), getChecklist(id)]);
  if (!board || !checklist || checklist.board_id !== board.id) notFound();

  const role = await getMyRole(board.id);
  // A checklist's title and imagery are content, so editors may change them.
  if (!canEditContent(role)) notFound();

  const { t } = await getTranslations();

  return (
    <div className="max-w-lg space-y-10">
      <section>
        <h3 className="text-lg font-semibold tracking-tight">{t('checklist.details')}</h3>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
          {t('checklist.detailsIntro')}
        </p>
        <ChecklistDetailsForm
          checklistId={checklist.id}
          currentTitle={checklist.title}
          currentDescription={checklist.description}
        />
      </section>

      <section>
        <h3 className="text-lg font-semibold tracking-tight">{t('checklist.image')}</h3>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
          {t('checklist.imageIntro')}
        </p>
        <div className="mb-4 flex items-center gap-3">
          <Avatar
            name={checklist.title}
            imageUrl={checklist.avatar_url}
            seed={checklist.id}
            className="size-16"
          />
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {checklist.avatar_url ? t('checklist.currentImage') : t('space.generatedImage')}
          </span>
        </div>
        <ImageUploadForm
          bucket="checklist-avatars"
          target={{ kind: 'checklist', boardId: board.id, checklistId: checklist.id }}
          prefix={`avatar-${checklist.id}`}
          label={t('media.uploadImage')}
        />
      </section>

      <section>
        <h3 className="text-lg font-semibold tracking-tight">{t('space.banner')}</h3>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
          {t('checklist.bannerIntro')}
        </p>
        <BannerPicker
          current={checklist.banner_url}
          target={{ kind: 'checklist', boardId: board.id, checklistId: checklist.id }}
          prefix={`banner-${checklist.id}`}
        />
      </section>
    </div>
  );
}

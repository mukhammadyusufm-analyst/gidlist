import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { getChecklist, getVersionContent } from '@/lib/checklists/queries';
import { ChecklistPreview } from '@/components/checklists/checklist-preview';
import { Avatar } from '@/components/ui/avatar';
import { getTranslations } from '@/lib/i18n/server';
import { canEditContent } from '@app/core';
import { BannerPicker } from '@/components/ui/banner-picker';
import { ImageUploadForm } from '@/components/ui/image-upload-form';

import { ChecklistDetailsForm } from './checklist-details-form';

// Translated, so the browser tab matches the language the app is being read in.
// Static `metadata` cannot do this: it is evaluated without a request, so it
// has no way to know which locale the cookie asked for.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('checklist.details') };
}

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

  /**
   * Preview the draft when there is one, otherwise what is published.
   *
   * The draft is the version an editor is about to commit people to, so "does
   * this read correctly" is a question about the draft. Falling back to the
   * published version means the preview is never empty on a checklist that is
   * already in use.
   */
  const previewVersion = checklist.draft ?? checklist.latestPublished;
  const preview = previewVersion ? await getVersionContent(previewVersion.id) : null;

  return (
    // The editing controls stay in a narrow, readable column. The preview below
    // does not: it is a picture of the fill page, and cramming it into form
    // width would misrepresent the thing it exists to show.
    <div className="space-y-10">
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

      {/* Last on the page: it is something to look at, not something to change,
          and the editing controls are why somebody opened this tab. */}
      {preview && previewVersion ? (
        <section className="max-w-2xl">
          <h3 className="text-lg font-semibold tracking-tight">{t('checklist.preview')}</h3>
          <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
            {previewVersion.status === 'draft'
              ? t('checklist.previewDraftIntro', { version: previewVersion.version_number })
              : t('checklist.previewPublishedIntro', { version: previewVersion.version_number })}
          </p>
          <ChecklistPreview
            groups={preview.groups}
            checklist={checklist}
            slug={slug}
            emptyLabel={t('checklist.previewEmpty')}
          />
        </section>
      ) : null}
    </div>
  );
}

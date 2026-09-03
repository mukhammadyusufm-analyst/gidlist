import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { Avatar } from '@/components/ui/avatar';
import { getTranslations } from '@/lib/i18n/server';
import { canGovern } from '@app/core';
import { BannerPicker } from '@/components/ui/banner-picker';
import { ImageUploadForm } from '@/components/ui/image-upload-form';

import { createClient } from '@/lib/supabase/server';

import { BoardDetailsForm } from './rename-board-form';
import { ArchiveBoard } from './archive-board';
import { SpaceHistory } from './space-history';

// Translated, so the browser tab matches the language the app is being read in.
// Static `metadata` cannot do this: it is evaluated without a request, so it
// has no way to know which locale the cookie asked for.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('space.settings') };
}

export default async function BoardSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; action?: string; offset?: string }>;
}) {
  const { slug } = await params;
  const { q, action: auditAction, offset: offsetParam } = await searchParams;
  const board = await getBoardBySlug(slug);
  if (!board) notFound();

  // Repeated here rather than relying on the hidden tab. Someone can navigate
  // straight to this URL, and the page should not render management controls
  // that the database is only going to reject.
  const role = await getMyRole(board.id);
  if (!canGovern(role)) notFound();

  const { t } = await getTranslations();

  // Whether deletion is even possible. The database refuses once any submission
  // exists — this asks the same question so the button is never offered when it
  // would only fail. `head: true` fetches the count without the rows.
  const supabase = await createClient();
  const { count } = await supabase
    .from('submissions')
    .select('id, checklists!inner(board_id)', { count: 'exact', head: true })
    .eq('checklists.board_id', board.id);

  const hasHistory = (count ?? 0) > 0;

  return (
    <div className="max-w-lg space-y-10">
      <section>
        <h2 className="text-lg font-semibold tracking-tight">{t('space.details')}</h2>
        {/* The sentence is translated; the address itself is data, so it sits
            beside the sentence in a code chip rather than being interpolated
            into it — a placeholder inside the string would have to survive
            three translations to keep the chip. */}
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
          {t('space.slugKept')}{' '}
          <code className="rounded bg-[var(--color-muted)] px-1 py-0.5 text-xs">/{board.slug}</code>
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
          {t('space.logoIntro')}
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
          {t('space.bannerIntro')}
        </p>
        <BannerPicker
          current={board.banner_url}
          target={{ kind: 'board', boardId: board.id, slug: board.slug }}
          prefix="banner"
        />
      </section>

      {/* Admins, not only owners: "who removed that person" is a question
          whoever runs the space day to day needs answered. The database agrees
          — board_audit_log checks for admin, not ownership. */}
      <SpaceHistory
        boardId={board.id}
        slug={board.slug}
        search={q?.trim() ?? ''}
        action={auditAction}
        offset={Math.max(Number(offsetParam ?? 0) || 0, 0)}
      />

      {/* Owner only. An admin runs the space day to day; removing it from view
          entirely is the owner's decision, and the database agrees. */}
      {role === 'owner' ? (
        <section>
          <ArchiveBoard
            boardId={board.id}
            boardName={board.name}
            isArchived={board.archived_at !== null}
            canDelete={!hasHistory}
          />
        </section>
      ) : null}
    </div>
  );
}

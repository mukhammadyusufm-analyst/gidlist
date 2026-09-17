import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { getChecklist } from '@/lib/checklists/queries';
import { checklistHasSchedule } from '@/lib/schedules/queries';
import { getTranslations } from '@/lib/i18n/server';
import { VersionBadge } from '@/components/checklists/version-badge';
import { VersionActions } from '@/components/checklists/version-actions';
import { ChecklistTabs } from '@/components/checklists/checklist-tabs';
import { Avatar } from '@/components/ui/avatar';
import { Banner } from '@/components/ui/banner';
import { canEditContent } from '@app/core';

export default async function ChecklistLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const [board, checklist] = await Promise.all([getBoardBySlug(slug), getChecklist(id)]);

  // The board check is not redundant with the checklist check: without it,
  // someone could reach a checklist they can see by pairing it with a different
  // board's slug in the URL, and the page would render under the wrong heading.
  if (!board || !checklist || checklist.board_id !== board.id) notFound();

  const [role, { t }] = await Promise.all([getMyRole(board.id), getTranslations()]);
  const canManage = canEditContent(role);

  // Every page under here — the builder, schedules, details — is editor work.
  // Gating the layout rather than each page keeps the three consistent: before
  // this, two were readable and the third returned 404, which just looked
  // broken. Members reach checklists through Fill in.
  if (!canManage) notFound();

  const version = (canManage ? checklist.draft : null) ?? checklist.latestPublished ?? checklist.versions[0];
  if (!version) notFound();

  // Publishing without a schedule is refused by the database, so the header has
  // to know before it offers the button. Only asked for a draft: on a published
  // version the answer changes nothing on screen.
  const hasSchedule = version.status === 'draft' ? await checklistHasSchedule(checklist.id) : true;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/boards/${slug}/checklists`}
          className="text-sm text-[var(--color-muted-foreground)] underline underline-offset-4"
        >
          {t('checklist.backToList')}
        </Link>

        {/* The checklist's own banner, shown where it is edited.
            Without this the framing controls on the Details tab wrote to a
            row nothing on screen rendered, so adjusting the crop looked like
            it did nothing — the image only appeared on the fill sheet, which
            is not where the person adjusting it is standing. */}
        {checklist.banner_url ? (
          <div className="mt-3">
            <Banner value={checklist.banner_url} alt={t('checklist.bannerAlt', { title: checklist.title })} />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <Avatar
              name={checklist.title}
              imageUrl={checklist.avatar_url}
              seed={checklist.id}
              className="size-11"
            />
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
                <span>{checklist.title}</span>
                {board.is_tutorial ? (
                  <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs font-normal text-[var(--color-muted-foreground)]">
                    {t('space.practice')}
                  </span>
                ) : null}
              </h2>
              {checklist.description ? (
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                  {checklist.description}
                </p>
              ) : null}
              <div className="mt-2">
                <VersionBadge status={version.status} number={version.version_number} />
              </div>
            </div>
          </div>

          {/* No "edit as draft" on a practice checklist: the database refuses
              new versions of it. */}
          {canManage && !board.is_tutorial ? (
            <VersionActions
              checklistId={checklist.id}
              versionId={version.id}
              status={version.status}
              hasDraft={Boolean(checklist.draft)}
              scheduleHref={`/dashboard/boards/${slug}/checklists/${checklist.id}/schedules`}
              hasSchedule={hasSchedule}
            />
          ) : null}
        </div>
      </div>

      <ChecklistTabs slug={slug} checklistId={checklist.id} />

      {children}
    </div>
  );
}

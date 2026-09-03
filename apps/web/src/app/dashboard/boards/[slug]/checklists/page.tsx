import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight, ListChecks } from 'lucide-react';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { listChecklists } from '@/lib/checklists/queries';
import { getTranslations } from '@/lib/i18n/server';
import { NewChecklistPanel } from '@/components/checklists/new-checklist-panel';
import { VersionBadge } from '@/components/checklists/version-badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { canEditContent } from '@app/core';

/**
 * The checklist library for a space.
 *
 * This used to be the space's own root, which meant opening a space landed an
 * editor on the builder's list rather than on the day's work. It moved here so
 * the root can redirect to Fill in — see the note in `../page.tsx`.
 */
export default async function BoardChecklistsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const board = await getBoardBySlug(slug);
  if (!board) notFound();

  const [role, checklists, { t }] = await Promise.all([
    getMyRole(board.id),
    listChecklists(board.id),
    getTranslations(),
  ]);
  // Creating checklists is content work, so editors get it too. Members never
  // reach this page — the tab is hidden and the route refuses them.
  const canManage = canEditContent(role);
  if (!canManage) redirect(`/dashboard/boards/${slug}/fill`);

  return (
    <div className="space-y-5">
      {/* The list leads; creating is an action in the header. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {t('space.checklists')}{' '}
          <span className="font-normal text-[var(--color-muted-foreground)] tabular-nums">
            {checklists.length}
          </span>
        </h2>

        {canManage ? <NewChecklistPanel boardId={board.id} slug={board.slug} /> : null}
      </div>

      {checklists.length === 0 ? (
        <EmptyState icon={ListChecks} title={t('checklist.none')} />
      ) : (
        <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-e1">
          {checklists.map((checklist) => (
            <li key={checklist.id}>
              <Link
                href={`/dashboard/boards/${board.slug}/checklists/${checklist.id}`}
                className="group flex items-center gap-3 p-4 transition-colors hover:bg-[var(--color-accent)] focus-visible:bg-[var(--color-accent)] focus-visible:outline-none"
              >
                <Avatar
                  name={checklist.title}
                  imageUrl={checklist.avatar_url}
                  seed={checklist.id}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{checklist.title}</span>
                  {checklist.description ? (
                    <span className="block truncate text-sm text-[var(--color-muted-foreground)]">
                      {checklist.description}
                    </span>
                  ) : null}
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  {checklist.latestPublished ? (
                    <VersionBadge
                      status="published"
                      number={checklist.latestPublished.version_number}
                    />
                  ) : null}
                  {checklist.draft ? (
                    <VersionBadge status="draft" number={checklist.draft.version_number} />
                  ) : null}
                  <ChevronRight
                    className="size-4 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

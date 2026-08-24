import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { getChecklist } from '@/lib/checklists/queries';
import { VersionBadge } from '@/components/checklists/version-badge';
import { VersionActions } from '@/components/checklists/version-actions';
import { ChecklistTabs } from '@/components/checklists/checklist-tabs';
import { Avatar } from '@/components/ui/avatar';
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

  const role = await getMyRole(board.id);
  const canManage = canEditContent(role);

  // Every page under here — the builder, schedules, details — is editor work.
  // Gating the layout rather than each page keeps the three consistent: before
  // this, two were readable and the third returned 404, which just looked
  // broken. Members reach checklists through Fill in.
  if (!canManage) notFound();

  const version = (canManage ? checklist.draft : null) ?? checklist.latestPublished ?? checklist.versions[0];
  if (!version) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/boards/${slug}`}
          className="text-sm text-[var(--color-muted-foreground)] underline underline-offset-4"
        >
          Back to checklists
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <Avatar
              name={checklist.title}
              imageUrl={checklist.avatar_url}
              seed={checklist.id}
              className="size-11"
            />
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight">{checklist.title}</h2>
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

          {canManage ? (
            <VersionActions
              checklistId={checklist.id}
              versionId={version.id}
              status={version.status}
              hasDraft={Boolean(checklist.draft)}
            />
          ) : null}
        </div>
      </div>

      <ChecklistTabs slug={slug} checklistId={checklist.id} />

      {children}
    </div>
  );
}

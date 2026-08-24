import { notFound } from 'next/navigation';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { getChecklist, getVersionContent } from '@/lib/checklists/queries';
import { ChecklistBuilder } from '@/components/checklists/checklist-builder';
import { getTranslations } from '@/lib/i18n/server';
import { canEditContent } from '@app/core';

export default async function ChecklistStructurePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const [board, checklist] = await Promise.all([getBoardBySlug(slug), getChecklist(id)]);
  if (!board || !checklist || checklist.board_id !== board.id) notFound();

  const role = await getMyRole(board.id);
  const canManage = canEditContent(role);

  const version =
    (canManage ? checklist.draft : null) ?? checklist.latestPublished ?? checklist.versions[0];
  if (!version) notFound();

  const content = await getVersionContent(version.id);
  const editable = canManage && version.status === 'draft';
  const { t } = await getTranslations();

  return (
    <div className="space-y-6">
      {version.status === 'published' ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
          {t('checklist.frozen')}
        </p>
      ) : null}

      <ChecklistBuilder versionId={version.id} groups={content.groups} editable={editable} />
    </div>
  );
}

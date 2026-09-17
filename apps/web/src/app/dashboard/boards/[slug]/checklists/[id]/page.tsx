import { notFound } from 'next/navigation';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { getChecklist, getVersionContent } from '@/lib/checklists/queries';
import { ChecklistBuilder } from '@/components/checklists/checklist-builder';
import { getTranslations } from '@/lib/i18n/server';
import { canEditContent, parseInstructions, type InstructionBlock } from '@app/core';
import { signInstructionUrls } from '@/lib/checklists/instructions';
import { InstructionsEditor } from '@/components/checklists/instructions-editor';
import { InstructionsView } from '@/components/checklists/instructions-view';

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

  // Instruction files live in a private bucket, so the page mints the links for
  // everything it is about to render — the checklist's own instructions and
  // every item's — in one call.
  const checklistBlocks = parseInstructions(version.instructions);
  const itemBlocks = content.groups.flatMap((g) =>
    g.items.flatMap(function collect(item): InstructionBlock[] {
      return [...parseInstructions(item.instructions), ...item.children.flatMap(collect)];
    }),
  );
  const urls = await signInstructionUrls(
    [...checklistBlocks, ...itemBlocks].flatMap((b) => ('path' in b ? [b.path] : [])),
  );

  return (
    <div className="space-y-6">
      {version.status === 'published' ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
          {t('checklist.frozen')}
        </p>
      ) : null}

      {/* On a frozen version with nothing written, the section would be a
          heading over an empty box, so it stays away until there is either
          something to read or somewhere to type. */}
      {editable || checklistBlocks.length > 0 ? (
        <section className="rounded-xl border border-[var(--color-border)] p-4">
          <h3 className="text-sm font-medium">{t('instructions.checklistTitle')}</h3>
          {editable ? (
            <>
              <p className="mt-1 mb-3 text-sm text-[var(--color-muted-foreground)]">
                {t('instructions.checklistIntro')}
              </p>
              <InstructionsEditor
                scope="version"
                id={version.id}
                checklistId={checklist.id}
                boardId={board.id}
                initial={checklistBlocks}
                urls={urls}
              />
            </>
          ) : (
            <div className="mt-3">
              <InstructionsView blocks={checklistBlocks} urls={urls} />
            </div>
          )}
        </section>
      ) : null}

      <ChecklistBuilder
        versionId={version.id}
        groups={content.groups}
        editable={editable}
        checklistId={checklist.id}
        boardId={board.id}
        instructionUrls={urls}
      />
    </div>
  );
}

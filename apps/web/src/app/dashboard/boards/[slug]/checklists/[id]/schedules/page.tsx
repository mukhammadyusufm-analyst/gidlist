import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getBoardBySlug, getMyRole, listBoardMembers } from '@/lib/boards/queries';
import { getChecklist } from '@/lib/checklists/queries';
import { listSchedules } from '@/lib/schedules/queries';
import { ScheduleForm } from '@/components/schedules/schedule-form';
import { ScheduleCard } from '@/components/schedules/schedule-card';
import { getTranslations } from '@/lib/i18n/server';
import { canEditContent } from '@app/core';

// Translated, so the browser tab matches the language the app is being read in.
// Static `metadata` cannot do this: it is evaluated without a request, so it
// has no way to know which locale the cookie asked for.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('checklist.schedules') };
}

export default async function SchedulesPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const [board, checklist] = await Promise.all([getBoardBySlug(slug), getChecklist(id)]);
  if (!board || !checklist || checklist.board_id !== board.id) notFound();

  const [role, schedules, members, { t }] = await Promise.all([
    getMyRole(board.id),
    listSchedules(checklist.id),
    listBoardMembers(board.id),
    getTranslations(),
  ]);
  const canManage = canEditContent(role);

  // Only people who are actually in the space can be assigned — the database
  // enforces it, so offering anyone else would just produce an error.
  const candidates = members
    .map((m) => ({
      email: m.invited_email ?? '',
      name: m.full_name?.trim() || m.invited_email || '',
      // "Pending" means the invitation is unanswered, not merely that they have
      // no account yet. Until they accept, assigning them produces no work —
      // so this is what an admin actually needs to know.
      pending: m.status !== 'active',
    }))
    .filter((m) => m.email !== '');

  const activeEmails = new Set(
    members.filter((m) => m.status === 'active').map((m) => (m.invited_email ?? '').toLowerCase()),
  );

  return (
    <div className="max-w-2xl space-y-8">
      {!checklist.latestPublished ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
          {t('schedule.notPublished')}
        </p>
      ) : null}

      {canManage ? (
        <section>
          <h3 className="text-lg font-semibold tracking-tight">{t('schedule.add')}</h3>
          <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
            {t('schedule.addIntro')}
          </p>
          <ScheduleForm checklistId={checklist.id} candidates={candidates} />
        </section>
      ) : null}

      <section>
        <h3 className="text-lg font-semibold tracking-tight">
          {t('schedule.count', { count: schedules.length })}
        </h3>

        {schedules.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
            {t('schedule.none')}
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {schedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                canManage={canManage}
                boardId={board.id}
                candidates={candidates}
                activeEmails={[...activeEmails]}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

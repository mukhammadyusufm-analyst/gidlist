import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getBoardBySlug, getMyRole, listBoardMembers } from '@/lib/boards/queries';

import { InviteMemberForm } from './invite-member-form';
import { MemberRow } from './member-row';
import { getTranslations } from '@/lib/i18n/server';
import { canEditContent, canGovern } from '@app/core';

// Translated, so the browser tab matches the language the app is being read in.
// Static `metadata` cannot do this: it is evaluated without a request, so it
// has no way to know which locale the cookie asked for.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('space.members') };
}

export default async function BoardMembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await getBoardBySlug(slug);
  if (!board) notFound();

  const [role, members, { t }] = await Promise.all([
    getMyRole(board.id),
    listBoardMembers(board.id),
    getTranslations(),
  ]);
  // Editors may see the roster (they assign schedules from it); only admins may
  // change it. A plain member sees neither.
  if (!canEditContent(role)) notFound();
  const canManage = canGovern(role);

  return (
    <div className="max-w-2xl space-y-8">
      {canManage ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">{t('members.invite')}</h2>
          <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
            {t('members.inviteIntro')}
          </p>
          <InviteMemberForm boardId={board.id} />
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          {t('members.count', { count: members.length })}
        </h2>

        <ul className="mt-4 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              boardId={board.id}
              canManage={canManage}
              viewerIsOwner={role === 'owner'}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

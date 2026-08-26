import Link from 'next/link';
import type { Metadata } from 'next';
import { LayoutGrid, Plus } from 'lucide-react';

import { listArchivedBoards, listMyBoards } from '@/lib/boards/queries';
import { getUser } from '@/lib/supabase/server';
import { getTranslations } from '@/lib/i18n/server';
import { listPendingInvitations } from '@/lib/invitations/queries';
import { InvitationList } from '@/components/invitations/invitation-list';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SpaceCard } from '@/components/boards/space-card';
import { ArchivedSpaces } from '@/components/boards/archived-spaces';

export const metadata: Metadata = { title: 'Spaces' };

export default async function DashboardPage() {
  const [boards, archived, invitations, { t }, user] = await Promise.all([
    listMyBoards(),
    listArchivedBoards(),
    listPendingInvitations(),
    getTranslations(),
    getUser(),
  ]);

  /**
   * Split by ownership, because the two are different kinds of thing.
   *
   * A space someone owns is theirs to run and to pay for; one they were invited
   * to belongs to somebody else's company. Mixed together, an owner cannot see
   * at a glance which spaces count against their plan — and that is exactly the
   * question the billing page raises.
   */
  const owned = boards.filter((b) => b.owner_id === user?.id);
  const shared = boards.filter((b) => b.owner_id !== user?.id);

  return (
    <div>
      {/* Above the spaces list: an unanswered invitation is the most actionable
          thing on this page, and burying it under the spaces someone already
          has would mean it goes unnoticed. Renders nothing when there are none. */}
      {invitations.length > 0 ? (
        <div className="mb-8">
          <InvitationList invitations={invitations} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('space.spaces')}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('space.intro')}</p>
        </div>

        <Link href="/dashboard/boards/new" className={buttonVariants()}>
          <Plus aria-hidden="true" />
          {t('space.newSpace')}
        </Link>
      </div>

      {boards.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={LayoutGrid}
          title={t('space.none')}
          description={t('space.noneHint')}
          action={
            <Link href="/dashboard/boards/new" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              {t('space.createFirst')}
            </Link>
          }
        />
      ) : (
        <>
          {/* Headings appear only when there is something to distinguish. With
              spaces of just one kind, a lone "Your spaces" heading above the
              only list is noise. */}
          {owned.length > 0 ? (
            <section className="mt-6">
              {shared.length > 0 ? (
                <h2 className="mb-3 text-sm font-medium text-[var(--color-muted-foreground)]">
                  {t('space.owned')}
                </h2>
              ) : null}
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {owned.map((board) => (
                  <li key={board.id}>
                    <SpaceCard board={board} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {shared.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-medium text-[var(--color-muted-foreground)]">
                {t('space.shared')}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shared.map((board) => (
                  <li key={board.id}>
                    <SpaceCard board={board} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {/* Renders nothing when there is nothing archived. Without it, archiving
          is one-way: the space leaves this list and its Settings page, which
          holds the only Restore button, becomes unreachable. */}
      <ArchivedSpaces boards={archived} />
    </div>
  );
}

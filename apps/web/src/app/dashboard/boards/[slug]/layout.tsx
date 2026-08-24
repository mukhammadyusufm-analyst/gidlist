import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { Avatar } from '@/components/ui/avatar';
import { canEditContent, canGovern } from '@app/core';
import { BoardTabs } from '@/components/boards/board-tabs';
import { Banner } from '@/components/ui/banner';

export default async function BoardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const board = await getBoardBySlug(slug);

  // Null covers both "no such board" and "not yours". Showing the same 404 for
  // each is intentional — a distinct "forbidden" page would confirm to an
  // outsider that a given board exists.
  if (!board) notFound();

  const role = await getMyRole(board.id);
  // Governance, not content: the Settings tab is space branding and people.
  const canManage = canGovern(role);

  return (
    <div>
      {board.banner_url ? (
        <div className="mb-4">
          <Banner value={board.banner_url} alt={`${board.name} banner`} />
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Avatar name={board.name} imageUrl={board.logo_url} seed={board.id} className="size-12" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{board.name}</h1>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            <Link href="/dashboard" className="underline underline-offset-4">
              Spaces
            </Link>
            <span className="mx-1.5">/</span>
            <span>{board.slug}</span>
            {role ? <span className="ml-2 capitalize">· {role}</span> : null}
          </p>
        </div>
      </div>

      {board.description ? (
        <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          {board.description}
        </p>
      ) : null}

      <BoardTabs slug={board.slug} canManage={canManage} canEdit={canEditContent(role)} />

      <div className="mt-6">{children}</div>
    </div>
  );
}

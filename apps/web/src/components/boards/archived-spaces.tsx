'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore } from 'lucide-react';

import { setBoardArchived, type ActionState } from '@/lib/boards/actions';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';
import type { Board } from '@/lib/supabase/database.types';

/**
 * Archived spaces, and the way back.
 *
 * A collapsed `<details>` rather than a section: these are deliberately out of
 * the way, and someone looking at their spaces should not have to scroll past
 * the ones they stopped using. It renders nothing at all when there are none.
 *
 * Restore lives here rather than only on the space's Settings page. That page
 * is unreachable once the space leaves the list, which made archiving a
 * one-way trip — the archive was written before anything could read it back.
 */
export function ArchivedSpaces({ boards }: { boards: Board[] }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(setBoardArchived, {});

  if (boards.length === 0) return null;

  return (
    <details className="mt-10 rounded-xl border border-[var(--color-border)]">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm text-[var(--color-muted-foreground)] marker:content-['']">
        <Archive className="size-4" aria-hidden="true" />
        {t('archive.listTitle', { count: boards.length })}
      </summary>

      <ul className="border-t border-[var(--color-border)]">
        {boards.map((board) => (
          <li
            key={board.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0">
              {/* Still openable: the space is hidden, not gone, and its
                  compliance history is often the reason someone kept it. */}
              <Link
                href={`/dashboard/boards/${board.slug}`}
                className="truncate text-sm font-medium underline-offset-4 hover:underline"
              >
                {board.name}
              </Link>
              {board.archived_at ? (
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {t('archive.archivedOn', {
                    date: new Date(board.archived_at).toLocaleDateString(),
                  })}
                </p>
              ) : null}
            </div>

            <form action={action}>
              <input type="hidden" name="boardId" value={board.id} />
              <input type="hidden" name="archived" value="false" />
              <Button type="submit" variant="ghost" size="sm" disabled={pending}>
                <ArchiveRestore className="size-4" aria-hidden="true" />
                {t('archive.restore')}
              </Button>
            </form>
          </li>
        ))}
      </ul>

      {state.formError ? (
        <p className="px-4 py-3 text-sm text-[var(--color-destructive)]">{state.formError}</p>
      ) : null}
    </details>
  );
}

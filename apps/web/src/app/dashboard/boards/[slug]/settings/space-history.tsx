import { createClient } from '@/lib/supabase/server';
import { getTranslations } from '@/lib/i18n/server';
import { AuditList, type AuditEntry } from '@/components/audit/audit-list';
import { ListFilter, Pagination } from '@/components/ui/list-controls';

/**
 * What has happened in this space.
 *
 * Shown to whoever governs it, because "who removed that person" and "who
 * changed their role" are questions a manager asks about their own company —
 * and until now the product had no answer.
 *
 * Translated, unlike the platform history: this one is read by customers.
 */
const PAGE_SIZE = 25;

export async function SpaceHistory({
  boardId,
  slug,
  search,
  action,
  offset,
}: {
  boardId: string;
  slug: string;
  search: string;
  action?: string;
  offset: number;
}) {
  const supabase = await createClient();
  const [{ data }, { data: actions }, { t, locale }] = await Promise.all([
    supabase.rpc('board_audit_log', {
      p_board_id: boardId,
      p_search: search || undefined,
      p_action: action || undefined,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }),
    supabase.rpc('audit_actions', { p_board_id: boardId }),
    getTranslations(),
  ]);

  const entries = (data ?? []) as AuditEntry[];
  // Every row carries the same window-function total; no rows, nothing to total.
  const total = entries[0]?.total_count ?? 0;
  const basePath = `/dashboard/boards/${slug}/settings`;

  const phrase = (entry: AuditEntry): string => {
    const who = entry.actor_name;
    const d = entry.detail ?? {};
    const email = d.email ?? '';

    switch (entry.action) {
      case 'member.invited':
        return t('audit.memberInvited', { actor: who, email });
      case 'member.role_changed':
        return t('audit.memberRoleChanged', {
          actor: who,
          email,
          from: d.from ?? '',
          to: d.to ?? '',
        });
      case 'member.status_changed':
        return t('audit.memberStatusChanged', { actor: who, email, status: d.to ?? '' });
      case 'member.removed':
        return t('audit.memberRemoved', { actor: who, email });
      case 'space.created':
        return t('audit.spaceCreated', { actor: who });
      case 'space.archived':
        return t('audit.spaceArchived', { actor: who });
      case 'space.restored':
        return t('audit.spaceRestored', { actor: who });
      case 'checklist.published':
        return t('audit.checklistPublished', {
          actor: who,
          checklist: d.checklist ?? '',
          version: d.version ?? '',
        });
      case 'checklist.archived':
        return t('audit.checklistArchived', { actor: who, checklist: d.checklist ?? '' });
      case 'checklist.restored':
        return t('audit.checklistRestored', { actor: who, checklist: d.checklist ?? '' });
      case 'schedule.created':
        return t('audit.scheduleCreated', { actor: who, checklist: d.checklist ?? '' });
      case 'schedule.paused':
        return t('audit.schedulePaused', { actor: who, checklist: d.checklist ?? '' });
      case 'schedule.resumed':
        return t('audit.scheduleResumed', { actor: who, checklist: d.checklist ?? '' });
      // The count is the point of this row: one schedule deletion can take
      // months of records with it, and the number is what makes that visible.
      case 'schedule.deleted':
        return t('audit.scheduleDeleted', {
          actor: who,
          checklist: d.checklist ?? '',
          count: d.records_removed ?? '0',
        });
      case 'submission.deleted':
        return t('audit.submissionDeleted', {
          actor: who,
          checklist: d.checklist ?? '',
          date: d.due_date ?? '',
        });
      default:
        // Rendered rather than hidden. A missing audit row and an action that
        // never happened look identical, and only one of them is acceptable.
        return `${who} — ${entry.action}`;
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t('audit.title')}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('audit.intro')}</p>
      </div>

      {/* The filter is offered only once there is enough history for it to be
          useful. A search box above four rows is furniture. */}
      {total > PAGE_SIZE || search || action ? (
        <ListFilter
          action={basePath}
          search={search}
          searchLabel={t('audit.searchLabel')}
          actions={actions ?? []}
          selectedAction={action}
          actionLabel={t('audit.actionLabel')}
          allLabel={t('audit.allActions')}
          submitLabel={t('audit.search')}
        />
      ) : null}

      <AuditList
        entries={entries}
        emptyLabel={search || action ? t('audit.noMatches') : t('audit.empty')}
        locale={locale}
        phrase={phrase}
      />

      <Pagination
        basePath={basePath}
        params={{ q: search, action }}
        offset={offset}
        limit={PAGE_SIZE}
        total={total}
        label={t('audit.showing', {
          from: total === 0 ? 0 : offset + 1,
          to: Math.min(offset + PAGE_SIZE, total),
          total,
        })}
      />
    </section>
  );
}

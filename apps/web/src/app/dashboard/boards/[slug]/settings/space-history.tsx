import { createClient } from '@/lib/supabase/server';
import { getTranslations } from '@/lib/i18n/server';
import { AuditList, type AuditEntry } from '@/components/audit/audit-list';

/**
 * What has happened in this space.
 *
 * Shown to whoever governs it, because "who removed that person" and "who
 * changed their role" are questions a manager asks about their own company —
 * and until now the product had no answer.
 *
 * Translated, unlike the platform history: this one is read by customers.
 */
export async function SpaceHistory({ boardId }: { boardId: string }) {
  const supabase = await createClient();
  const [{ data }, { t, locale }] = await Promise.all([
    supabase.rpc('board_audit_log', { p_board_id: boardId, p_limit: 50 }),
    getTranslations(),
  ]);

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
    <section>
      <h2 className="text-lg font-semibold tracking-tight">{t('audit.title')}</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">{t('audit.intro')}</p>

      <AuditList
        entries={(data ?? []) as AuditEntry[]}
        emptyLabel={t('audit.empty')}
        locale={locale}
        phrase={phrase}
      />
    </section>
  );
}

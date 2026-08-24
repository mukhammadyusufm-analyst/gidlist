'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';
import { NewChecklistForm } from './new-checklist-form';

/**
 * Creation, kept out of the way until asked for.
 *
 * The page previously opened with the create form, so the first thing anyone
 * saw was data entry rather than their own checklists — and the more checklists
 * a space accumulated, the further the useful content was pushed down. Creating
 * happens once; reading happens every day, so reading goes first.
 *
 * The form still appears inline rather than in a modal: it is two fields, and a
 * dialog would be more ceremony than the task deserves.
 */
export function NewChecklistPanel({ boardId, slug }: { boardId: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useT();

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        {t('checklist.new')}
      </Button>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-e1 sm:min-w-96">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('checklist.new')}</h2>
          <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
            {t('checklist.newIntro')}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setOpen(false)}
          aria-label={t('common.cancel')}
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <NewChecklistForm boardId={boardId} slug={slug} />
    </section>
  );
}

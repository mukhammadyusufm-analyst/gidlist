'use client';

import { useActionState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CHECKLIST_TEMPLATES, templateText } from '@app/core';

import { createChecklistFromTemplate, type ActionState } from '@/lib/checklists/actions';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

/**
 * The ready-made checklists, one tap each.
 *
 * One form with a submit button per template: the button's own name/value is
 * what says which template was chosen, so there is no client state to keep.
 */
export function TemplatePicker({ boardId, slug }: { boardId: string; slug: string }) {
  const [state, action, pending] = useActionState(createChecklistFromTemplate, initialState);
  const { t, locale } = useT();

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="slug" value={slug} />

      <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)]">
        {CHECKLIST_TEMPLATES.map((template) => (
          <li key={template.key}>
            <button
              type="submit"
              name="template"
              value={template.key}
              disabled={pending}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-accent)] focus-visible:bg-[var(--color-accent)] focus-visible:outline-none disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {templateText(template.title, locale)}
                </span>
                <span className="block text-sm text-[var(--color-muted-foreground)]">
                  {templateText(template.description, locale)}
                </span>
              </span>
              <span className="shrink-0 text-xs text-[var(--color-muted-foreground)] tabular-nums">
                {t('checklist.templateItems', { n: template.items.length })}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-[var(--color-muted-foreground)]"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>

      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}
    </form>
  );
}

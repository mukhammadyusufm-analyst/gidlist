'use client';

import { useActionState, useState, useTransition } from 'react';
import { Check, Lock, MessageSquarePlus, Send } from 'lucide-react';

import {
  saveComment,
  setItemChecked,
  submitSubmission,
  type ActionState,
} from '@/lib/submissions/actions';
import type { AnsweredItem } from '@/lib/submissions/queries';
import type { ChecklistGroup } from '@/lib/supabase/database.types';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { ProgressBar, ProgressRing } from '@/components/ui/progress';
import { useT } from '@/components/i18n/provider';
import { cn } from '@/lib/utils';

const initialState: ActionState = {};

type GroupWithAnswers = ChecklistGroup & { items: AnsweredItem[] };

/** Counts every level, not just the top — a section is only done when its sub-tasks are. */
function countProgress(items: AnsweredItem[]): { done: number; total: number } {
  return items.reduce(
    (acc, item) => {
      const child = countProgress(item.children);
      return {
        done: acc.done + (item.answer?.checked ? 1 : 0) + child.done,
        total: acc.total + 1 + child.total,
      };
    },
    { done: 0, total: 0 },
  );
}

export function FillSheet({
  submissionId,
  slug,
  groups,
  readOnly,
  totalItems,
  checkedItems,
}: {
  submissionId: string;
  slug: string;
  groups: GroupWithAnswers[];
  readOnly: boolean;
  totalItems: number;
  checkedItems: number;
}) {
  const [submitState, submitAction] = useActionState(submitSubmission, initialState);
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();

  const remaining = totalItems - checkedItems;

  return (
    <div className="space-y-4">
      {/* Progress sits directly above the list and stays put while scrolling.
          On a long checklist the single most useful thing to know is how much
          is left, and burying that at the bottom means scrolling to find it. */}
      <div className="sticky top-14 z-20 -mx-4 border-y border-[var(--color-border)] bg-[var(--color-background)]/90 px-4 py-2.5 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex items-center gap-3">
          <ProgressRing value={checkedItems} total={totalItems} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {t('fill.ticked', { done: checkedItems, total: totalItems })}
            </p>
            <ProgressBar
              className="mt-1.5"
              value={checkedItems}
              total={totalItems}
              tone={remaining === 0 ? 'success' : 'primary'}
              label={t('fill.ticked', { done: checkedItems, total: totalItems })}
            />
          </div>
        </div>
      </div>

      {error ? <FormNotice kind="error">{error}</FormNotice> : null}
      {submitState.formError ? <FormNotice kind="error">{submitState.formError}</FormNotice> : null}

      {groups.map((group) => {
        const progress = countProgress(group.items);
        const complete = progress.total > 0 && progress.done === progress.total;

        return (
          <section
            key={group.id}
            className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-e1"
          >
            <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
              <h3 className="font-medium">{group.title}</h3>
              <span
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium tabular-nums',
                  complete
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--color-muted-foreground)]',
                )}
              >
                {complete ? <Check className="size-3.5" aria-hidden="true" /> : null}
                {progress.done}/{progress.total}
              </span>
            </header>

            <div className="divide-y divide-[var(--color-border)]">
              <ItemList items={group.items} readOnly={readOnly} onError={setError} depth={0} />
            </div>
          </section>
        );
      })}

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('fill.noItems')}
        </p>
      ) : null}

      {!readOnly ? (
        // Sticky at the bottom, clear of the home indicator. Someone finishing
        // the last item should not have to scroll back down to submit.
        <div className="pb-safe sticky bottom-0 -mx-4 border-t border-[var(--color-border)] bg-[var(--color-background)]/90 px-4 pt-3 backdrop-blur-md sm:mx-0">
          <form action={submitAction} className="space-y-2">
            <input type="hidden" name="submissionId" value={submissionId} />
            <input type="hidden" name="slug" value={slug} />

            {remaining > 0 ? (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {t('fill.notTicked', { count: remaining })}
              </p>
            ) : null}

            <Button type="submit" size="full" className="min-h-12">
              <Send aria-hidden="true" />
              {t('fill.submit')}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function ItemList({
  items,
  readOnly,
  onError,
  depth,
}: {
  items: AnsweredItem[];
  readOnly: boolean;
  onError: (message: string | null) => void;
  depth: number;
}) {
  return (
    <>
      {items.map((item) => (
        <ItemRow key={item.id} item={item} readOnly={readOnly} onError={onError} depth={depth} />
      ))}
    </>
  );
}

function ItemRow({
  item,
  readOnly,
  onError,
  depth,
}: {
  item: AnsweredItem;
  readOnly: boolean;
  onError: (message: string | null) => void;
  depth: number;
}) {
  const [pending, startTransition] = useTransition();
  const [showComment, setShowComment] = useState(Boolean(item.answer?.comment));
  const { t } = useT();

  const hasChildren = item.children.length > 0;
  const checked = item.answer?.checked ?? false;
  const answerId = item.answer?.id;
  const interactive = Boolean(answerId) && !readOnly && !hasChildren;

  function toggle() {
    if (!interactive || !answerId) return;
    onError(null);
    startTransition(async () => {
      const result = await setItemChecked(answerId, !checked);
      if (result.error) onError(result.error);
    });
  }

  function onCommentBlur(value: string) {
    if (!answerId || readOnly) return;
    if ((item.answer?.comment ?? '') === value.trim()) return;

    startTransition(async () => {
      const result = await saveComment(answerId, value);
      if (result.error) onError(result.error);
    });
  }

  // Indentation is the cue for nesting, and it has to survive five levels on a
  // phone. A 1.25rem step reaches 5rem at the deepest level — noticeable, but
  // still leaving room for the text rather than squeezing it into a column.
  const indent = depth > 0 ? { paddingLeft: `${depth * 1.25}rem` } : undefined;

  return (
    <div>
      <div style={indent}>
        {/* The whole row is the tap target, not just the box. This is filled in
            with gloves on — a 20px checkbox is not a realistic thing to hit. */}
        <label
          className={cn(
            'flex cursor-pointer items-start gap-3 px-3 py-3 transition-colors',
            interactive && 'hover:bg-[var(--color-accent)] active:bg-[var(--color-accent)]',
            !interactive && 'cursor-default',
            pending && 'opacity-60',
          )}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={toggle}
            disabled={!interactive || pending}
            className="sr-only"
          />

          <span
            aria-hidden="true"
            className={cn(
              'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
              checked
                ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white'
                : 'border-[var(--color-input)] bg-transparent',
              hasChildren && 'border-dashed',
            )}
          >
            {checked ? <Check className="size-4" strokeWidth={3} /> : null}
            {!checked && hasChildren ? (
              <Lock className="size-3 text-[var(--color-muted-foreground)]" />
            ) : null}
          </span>

          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block',
                checked && 'text-[var(--color-muted-foreground)] line-through',
              )}
            >
              {item.title}
            </span>

            {item.description ? (
              <span className="mt-0.5 block text-sm text-[var(--color-muted-foreground)]">
                {item.description}
              </span>
            ) : null}

            {hasChildren ? (
              <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                {t('fill.autoCompletes')}
              </span>
            ) : null}
          </span>
        </label>

        <div className="px-3 pb-3">
          {showComment ? (
            <textarea
              defaultValue={item.answer?.comment ?? ''}
              readOnly={readOnly}
              rows={2}
              placeholder={t('fill.addNote')}
              onBlur={(e) => onCommentBlur(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] px-3 py-2 text-base sm:text-sm"
            />
          ) : !readOnly ? (
            <button
              type="button"
              onClick={() => setShowComment(true)}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              <MessageSquarePlus className="size-3.5" aria-hidden="true" />
              {t('fill.addNote')}
            </button>
          ) : null}
        </div>
      </div>

      {hasChildren ? (
        <div className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          <ItemList
            items={item.children}
            readOnly={readOnly}
            onError={onError}
            depth={depth + 1}
          />
        </div>
      ) : null}
    </div>
  );
}

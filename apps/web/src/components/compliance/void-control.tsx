'use client';

import { useActionState, useState } from 'react';
import { Ban, RotateCcw } from 'lucide-react';

import { setSubmissionVoid, type VoidState } from '@/lib/submissions/void-actions';
import { useT } from '@/components/i18n/provider';

/**
 * Void a record, or lift a void, from the compliance table.
 *
 * The reason is asked for in place rather than behind a dialog. A dialog would
 * be a second thing to build and to translate, and the field is one line — but
 * more to the point, an explanation typed next to the row it explains is more
 * likely to be about that row.
 *
 * Nothing here decides who may do this. The database refuses anyone who is not
 * a space admin, and the control is simply not rendered for anyone else.
 */
export function VoidControl({
  submissionId,
  voidedAt,
  voidReason,
}: {
  submissionId: string;
  voidedAt: string | null;
  voidReason: string | null;
}) {
  const { t } = useT();
  const [state, action, pending] = useActionState<VoidState, FormData>(setSubmissionVoid, {});
  const [open, setOpen] = useState(false);

  if (voidedAt) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {/* The reason is shown, not hidden behind a tooltip. It is the whole
            point of voiding, and a compliance record whose exception you have
            to hover to read is not much better than one with no exception. */}
        <span className="text-xs text-[var(--color-muted-foreground)]">{voidReason}</span>
        <form action={action}>
          <input type="hidden" name="submissionId" value={submissionId} />
          <input type="hidden" name="lift" value="true" />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] disabled:opacity-50"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            {t('compliance.unvoid')}
          </button>
        </form>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)]"
      >
        <Ban className="size-3" aria-hidden="true" />
        {t('compliance.void')}
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input
        type="text"
        name="reason"
        required
        minLength={3}
        maxLength={500}
        autoFocus
        placeholder={t('compliance.voidReasonPlaceholder')}
        aria-label={t('compliance.voidReason')}
        // text-base below sm, or iOS zooms the page when the field is focused.
        className="min-w-40 flex-1 rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-2 py-1 text-base sm:text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--color-primary)] px-2 py-1 text-xs text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {t('compliance.void')}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md px-2 py-1 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
      >
        {t('common.cancel')}
      </button>
      {state.error ? (
        <span className="w-full text-xs text-[var(--color-destructive)]">{state.error}</span>
      ) : null}
    </form>
  );
}

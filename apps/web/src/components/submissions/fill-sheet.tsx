'use client';

import { useActionState, useState, useTransition } from 'react';
import { Check, Lock, MessageSquarePlus, Paperclip, Send } from 'lucide-react';

import {
  saveComment,
  setItemChecked,
  submitSubmission,
  type ActionState,
  type TickPosition,
} from '@/lib/submissions/actions';
import { removeEvidence, uploadEvidence } from '@/lib/submissions/evidence';
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

  // Enabled means "record where this was ticked". Required means "and refuse
  // if it is not inside the radius". Only the second one may stop anybody.
  const recordsLocation = item.location_enabled;
  const locationRequired = item.location_enabled && item.location_required;

  /**
   * Read the browser's position, for items that are pinned to a place.
   *
   * `enableHighAccuracy` asks for GPS rather than the cheaper network estimate,
   * which is the difference between tens of metres and hundreds. The timeout is
   * generous because a cold GPS fix indoors genuinely takes that long, and
   * `maximumAge: 0` refuses a cached position — a reading from where the phone
   * was ten minutes ago is exactly the thing this must not accept.
   */
  function readPosition(): Promise<TickPosition> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error(t('fill.locationUnsupported')));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        /*
         * The three failures need three different actions, so they get three
         * different messages. "Could not read your location" told somebody
         * nothing about whether to change a setting, walk outside, or wait.
         *
         * PERMISSION_DENIED is the one that catches people on an installed app:
         * a PWA has no entry of its own in Android's app permissions, so the
         * setting lives under Chrome's per-site permissions for this address,
         * not under a Gidlist app.
         */
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            reject(new Error(t('fill.locationDenied')));
          } else if (err.code === err.TIMEOUT) {
            reject(new Error(t('fill.locationTimeout')));
          } else {
            reject(new Error(t('fill.locationUnavailable')));
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    });
  }

  function toggle() {
    if (!interactive || !answerId) return;
    onError(null);

    startTransition(async () => {
      let position: TickPosition | undefined;

      /*
       * Only when ticking, and only when the item asks for it. Reading a
       * position to *un*-tick something would prompt for permission to record
       * where somebody was when they changed their mind.
       *
       * THE FAILURE IS ONLY FATAL WHEN THE LOCATION IS ENFORCED. Enabled but not
       * required means "record it if you can" — so a denied prompt, a device
       * with no fix, or a basement leaves the position null and the tick goes
       * ahead. Blocking there was the bug: it made a switch labelled optional
       * behave exactly like the mandatory one.
       */
      if (!checked && recordsLocation) {
        try {
          position = await readPosition();
        } catch (e) {
          if (locationRequired) {
            onError(e instanceof Error ? e.message : t('fill.locationDenied'));
            return;
          }
          // Not required: proceed with no reading rather than stopping the work.
        }
      }

      const result = await setItemChecked(answerId, !checked, position);
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

            {/* Said before the tick, not after it is refused. The database
                enforces the window regardless, but discovering the rule from an
                error message is discovering it too late to act on. */}
            {item.window_enabled && item.window_start && item.window_end ? (
              <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                {t(item.window_required ? 'fill.windowRequired' : 'fill.windowExpected', {
                  from: item.window_start.slice(0, 5),
                  to: item.window_end.slice(0, 5),
                })}
              </span>
            ) : null}
          </span>
        </label>

        {/* Attachments sit above the note, because an item that asks for a
            photograph is asking for the photograph first.

            `capture="environment"` opens the rear camera directly on a phone
            rather than a file browser, which is the difference between taking
            the photo where the work is and remembering to do it later. On a
            desktop the attribute is ignored and it behaves as a file picker. */}
        {/* Two independent controls, because an item can ask for both — a
            photograph of the fridge and a signed delivery note are different
            evidence, and one does not satisfy a demand for the other. */}
        {answerId && (item.photo_enabled || item.file_enabled) ? (
          <div className="space-y-2 px-3 pb-2">
            {item.photo_enabled ? (
              <EvidenceControl
                answerId={answerId}
                kind="photo"
                required={item.photo_required}
                url={item.photoUrl}
                hasFile={Boolean(item.answer?.photo_path)}
                expiredAt={item.answer?.photo_expired_at ?? null}
                readOnly={readOnly}
                onError={onError}
              />
            ) : null}

            {item.file_enabled ? (
              <EvidenceControl
                answerId={answerId}
                kind="file"
                required={item.file_required}
                url={item.fileUrl}
                hasFile={Boolean(item.answer?.file_path)}
                expiredAt={item.answer?.file_expired_at ?? null}
                readOnly={readOnly}
                onError={onError}
              />
            ) : null}
          </div>
        ) : null}

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

/**
 * The attachment on one answer.
 *
 * Uploads on selection rather than behind a separate button. Somebody wearing
 * gloves on a shop floor has already made the decision by the time the camera
 * closes; asking them to press Upload afterwards is a step that only exists to
 * be forgotten.
 *
 * Never claims more than it knows. The label says "Photo attached", not
 * "verified" — a photograph proves something was photographed, not that it was
 * photographed here or now.
 */
function EvidenceControl({
  answerId,
  kind,
  required,
  url,
  hasFile,
  expiredAt,
  readOnly,
  onError,
}: {
  answerId: string;
  kind: 'photo' | 'file';
  /** Whether the item cannot be ticked without it. Shown here, enforced in the database. */
  required: boolean;
  url: string | null;
  hasFile: boolean;
  /** Set when retention removed the file. The record of it still stands. */
  expiredAt: string | null;
  readOnly: boolean;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const { t, locale } = useT();

  function upload(file: File) {
    onError(null);
    const data = new FormData();
    data.set('answerId', answerId);
    data.set('kind', kind);
    data.set('file', file);

    startTransition(async () => {
      const result = await uploadEvidence(data);
      if (result.error) onError(result.error);
    });
  }

  function remove() {
    onError(null);
    const data = new FormData();
    data.set('answerId', answerId);
    data.set('kind', kind);

    startTransition(async () => {
      const result = await removeEvidence(data);
      if (result.error) onError(result.error);
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border)] p-2.5">
      {hasFile ? (
        <div className="flex items-center gap-3">
          {/* An image preview where there is one; a link otherwise, because a
              PDF has nothing to show inline. eslint-disable because these are
              signed URLs on a private bucket that next/image cannot fetch. */}
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
              {/* A plain <img>, not next/image: these are short-lived signed
                  URLs on a private bucket, which the image optimiser cannot
                  fetch and should not cache. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={t('fill.evidenceAttached')}
                className="size-16 rounded-md border border-[var(--color-border)] object-cover"
              />
            </a>
          ) : null}

          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{t('fill.evidenceAttached')}</p>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline underline-offset-4"
              >
                {t('fill.evidenceOpen')}
              </a>
            ) : (
              // Signing failed. Saying so beats a broken image, and the file
              // itself is still attached.
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {t('fill.evidenceUnavailable')}
              </p>
            )}
          </div>

          {!readOnly ? (
            <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={pending}>
              {t('common.delete')}
            </Button>
          ) : null}
        </div>
      ) : expiredAt ? (
        /* An attachment that existed and was aged out reads differently from
           one that was never made. Collapsing the two would quietly erase the
           fact evidence was provided, which is the opposite of what a
           compliance record is for. */
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('fill.evidenceExpired', {
            date: new Date(expiredAt).toLocaleDateString(locale),
          })}
        </p>
      ) : readOnly ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {kind === 'photo' ? t('fill.evidenceWantsPhoto') : t('fill.evidenceWantsFile')}
        </p>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Paperclip className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {required ? <span className="text-[var(--color-destructive)]">* </span> : null}
            {pending
              ? t('fill.evidenceUploading')
              : kind === 'photo'
                ? t('fill.evidenceAddPhoto')
                : t('fill.evidenceAddFile')}
          </span>
          <input
            type="file"
            accept={kind === 'photo' ? 'image/*' : 'image/*,application/pdf'}
            capture={kind === 'photo' ? 'environment' : undefined}
            disabled={pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              // Cleared so choosing the same file twice still fires a change.
              e.target.value = '';
            }}
            className="sr-only"
          />
        </label>
      )}
    </div>
  );
}

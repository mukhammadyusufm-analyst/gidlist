'use client';

import { useActionState, useMemo, useOptimistic, useState, useTransition } from 'react';
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
import { useOffline } from '@/components/offline/offline-provider';
import { useT } from '@/components/i18n/provider';
import { cn } from '@/lib/utils';

const initialState: ActionState = {};

type GroupWithAnswers = ChecklistGroup & { items: AnsweredItem[] };

/**
 * Ticks in flight, which the server has not confirmed yet. Answer id to value.
 *
 * This used to carry the value each tick started *from*, so the running total
 * could be measured against it. That is no longer needed and was subtly wrong
 * once ticks could be queued offline: the value at tap time is whatever was on
 * screen, which for a queued item is the queued guess rather than the server's
 * answer, so a queued-then-retapped item counted against the wrong baseline.
 * The server's own values are right here in `groups`; measuring against those
 * is both simpler and correct in every order of events.
 */
type PendingTicks = Map<string, boolean>;

/**
 * Whether a box should look ticked, in order of who knows best.
 *
 *   1. a tick in flight right now      — React drops this when it settles
 *   2. a tick waiting for a connection — survives reloads until it is sent
 *   3. the server's answer
 *
 * Two layers rather than one because they have opposite lifetimes. The
 * optimistic map exists to cover a round trip and is *meant* to vanish when the
 * server replies. A queued tick must do the reverse: outlive the failure, the
 * reload, and the walk back out of the basement. Collapsing them into one would
 * either revert queued work or leave in-flight guesses on screen after they
 * were refused.
 */
function isTicked(item: AnsweredItem, pending: PendingTicks, queued: QueuedTicks): boolean {
  const id = item.answer?.id;
  if (!id) return item.answer?.checked ?? false;

  const optimistic = pending.get(id);
  if (optimistic !== undefined) return optimistic;

  const waiting = queued.get(id);
  if (waiting !== undefined) return waiting;

  return item.answer?.checked ?? false;
}

/** Answer id to the value waiting to be sent. */
type QueuedTicks = Map<string, boolean>;

/** Counts every level, not just the top — a section is only done when its sub-tasks are. */
function countProgress(
  items: AnsweredItem[],
  pending: PendingTicks,
  queued: QueuedTicks,
): { done: number; total: number } {
  return items.reduce(
    (acc, item) => {
      const child = countProgress(item.children, pending, queued);
      return {
        done: acc.done + (isTicked(item, pending, queued) ? 1 : 0) + child.done,
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

  /*
   * TICKING HAS TO BE INSTANT, AND UNTIL NOW IT WAS NOT.
   *
   * `checked` came straight from the server, so a tap did nothing visible until
   * the action returned and the page re-rendered — up to two seconds on a cold
   * function (item 2f). On a phone in a warehouse that is indistinguishable
   * from the app having ignored you, and the second tap it invites *un*-ticks
   * the item the first one ticked.
   *
   * One optimistic map for the whole sheet rather than a flag inside each row,
   * because the box is not the only thing that has to move: the ring at the
   * top and the count on each section are all derived from the same answers.
   * Making only the checkbox instant would have swapped one visible lag for a
   * subtler one — a ticked box beside a counter still reading the old number.
   *
   * React discards this the moment the transition settles, at which point the
   * server props are the truth. So a failed write needs no rollback code: the
   * box returns to where it was, and `onError` says why.
   */
  const [pendingTicks, addPendingTick] = useOptimistic<PendingTicks, { id: string; to: boolean }>(
    new Map(),
    (current, change) => new Map(current).set(change.id, change.to),
  );

  /*
   * Writes still waiting for a connection.
   *
   * Null when this sheet is rendered outside the dashboard — the checklist
   * details page previews it read-only, where there is nothing to queue.
   */
  const offline = useOffline();
  const queuedTicks: QueuedTicks = useMemo(() => {
    const map: QueuedTicks = new Map();
    for (const record of offline?.pending ?? []) {
      if (record.op.kind === 'tick') map.set(record.op.answerId, record.op.checked);
    }
    return map;
  }, [offline?.pending]);

  /** What the server actually holds, which is the baseline every count needs. */
  const serverChecked = useMemo(() => {
    const map = new Map<string, boolean>();
    const walk = (items: AnsweredItem[]) => {
      for (const item of items) {
        if (item.answer?.id) map.set(item.answer.id, item.answer.checked ?? false);
        walk(item.children);
      }
    };
    for (const group of groups) walk(group.items);
    return map;
  }, [groups]);

  /*
   * One pass over every id that differs from the server, whichever layer it
   * differs in. Counting the two layers separately would double-count an item
   * that is queued and then tapped again.
   */
  const delta = useMemo(() => {
    let sum = 0;
    for (const id of new Set([...pendingTicks.keys(), ...queuedTicks.keys()])) {
      const shown = pendingTicks.get(id) ?? queuedTicks.get(id) ?? false;
      const server = serverChecked.get(id) ?? false;
      sum += (shown ? 1 : 0) - (server ? 1 : 0);
    }
    return sum;
  }, [pendingTicks, queuedTicks, serverChecked]);

  const shownChecked = Math.min(Math.max(checkedItems + delta, 0), totalItems);
  const remaining = totalItems - shownChecked;

  return (
    <div className="space-y-4">
      {/* Progress sits directly above the list and stays put while scrolling.
          On a long checklist the single most useful thing to know is how much
          is left, and burying that at the bottom means scrolling to find it. */}
      <div className="sticky top-14 z-20 -mx-4 border-y border-[var(--color-border)] bg-[var(--color-background)]/90 px-4 py-2.5 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex items-center gap-3">
          <ProgressRing value={shownChecked} total={totalItems} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {t('fill.ticked', { done: shownChecked, total: totalItems })}
            </p>
            <ProgressBar
              className="mt-1.5"
              value={shownChecked}
              total={totalItems}
              tone={remaining === 0 ? 'success' : 'primary'}
              label={t('fill.ticked', { done: shownChecked, total: totalItems })}
            />
          </div>
        </div>
      </div>

      {error ? <FormNotice kind="error">{error}</FormNotice> : null}
      {submitState.formError ? <FormNotice kind="error">{submitState.formError}</FormNotice> : null}

      {groups.map((group) => {
        const progress = countProgress(group.items, pendingTicks, queuedTicks);
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
              <ItemList
                items={group.items}
                readOnly={readOnly}
                onError={setError}
                depth={0}
                pending={pendingTicks}
                queued={queuedTicks}
                onTick={addPendingTick}
              />
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

/** What every row needs to show and record an unconfirmed tick. */
type TickState = {
  pending: PendingTicks;
  queued: QueuedTicks;
  onTick: (change: { id: string; to: boolean }) => void;
};

function ItemList({
  items,
  readOnly,
  onError,
  depth,
  pending,
  queued,
  onTick,
}: {
  items: AnsweredItem[];
  readOnly: boolean;
  onError: (message: string | null) => void;
  depth: number;
} & TickState) {
  return (
    <>
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          readOnly={readOnly}
          onError={onError}
          depth={depth}
          pending={pending}
          queued={queued}
          onTick={onTick}
        />
      ))}
    </>
  );
}

function ItemRow({
  item,
  readOnly,
  onError,
  depth,
  pending: pendingTicks,
  queued,
  onTick,
}: {
  item: AnsweredItem;
  readOnly: boolean;
  onError: (message: string | null) => void;
  depth: number;
} & TickState) {
  const [pending, startTransition] = useTransition();
  const [showComment, setShowComment] = useState(Boolean(item.answer?.comment));
  const offline = useOffline();
  const { t } = useT();

  const hasChildren = item.children.length > 0;
  // The optimistic view, so a tap moves the box now rather than after the
  // round trip. Falls back to the server's answer once the write settles.
  const checked = isTicked(item, pendingTicks, queued);
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
       * Move the box now — but NOT when a location is enforced.
       *
       * For an ordinary item the tick is all but certain to succeed, so showing
       * it immediately is honest. An item that refuses outside its radius is
       * different: the reading below genuinely decides the outcome, and a tick
       * that appears and then vanishes is a worse answer than one that waits
       * the second or two the GPS takes. So the enforced case gets its
       * optimistic update after the position is in hand, not before.
       */
      if (!locationRequired) onTick({ id: answerId, to: !checked });

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

      // The enforced case, now that the reading has cleared. See above.
      if (locationRequired) onTick({ id: answerId, to: !checked });

      try {
        const result = await setItemChecked(answerId, !checked, position);
        if (result.error) onError(result.error);
      } catch {
        /*
         * COULD NOT REACH THE SERVER, WHICH IS NOT THE SAME AS BEING REFUSED.
         *
         * A thrown request means the network failed — a freezer, a basement, a
         * lift. The tick is real work somebody did, so it goes in the queue and
         * stays on screen until it can be sent. A refusal, by contrast, comes
         * back as `result.error` above and is shown immediately, because the
         * server has considered it and said no.
         *
         * Telling the two apart is the whole point. Queueing a refusal would
         * retry it forever; showing an error for lost signal would throw away
         * work and blame the person for their building.
         */
        if (offline) {
          await offline.enqueue({ kind: 'tick', answerId, checked: !checked });
        } else {
          onError(t('fill.offlineUnavailable'));
        }
      }
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
            pending={pendingTicks}
            queued={queued}
            onTick={onTick}
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

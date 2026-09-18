'use client';

import {
  createContext,
  useActionState,
  useContext,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react';
import { parseInstructions } from '@app/core';
import { Check, Lock, MessageSquarePlus, Paperclip, Send } from 'lucide-react';

import {
  saveComment,
  setItemChecked,
  submitSubmission,
  type ActionState,
  type TickPosition,
} from '@/lib/submissions/actions';
import { removeEvidence, uploadEvidence } from '@/lib/submissions/evidence';
// The flight recorder. Every branch below that decides between sending and
// queueing writes one line, because which branch was taken is the thing three
// rounds of debugging could not establish from a description of the screen.
import { record as trace } from '@/lib/offline/log';
import { evidenceKey, tickKey } from '@/lib/offline/queue';
import type { AnsweredItem } from '@/lib/submissions/queries';
import type { ChecklistGroup } from '@/lib/supabase/database.types';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { ProgressBar, ProgressRing } from '@/components/ui/progress';
import { useOffline } from '@/components/offline/offline-provider';
import { useT } from '@/components/i18n/provider';
import { InstructionsView } from '@/components/checklists/instructions-view';
import { cn } from '@/lib/utils';

const initialState: ActionState = {};

/** Signed instruction links, out of band rather than through every item row. */
const InstructionUrlsContext = createContext<Record<string, string>>({});

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

/**
 * Is the server actually reachable — asked, not assumed.
 *
 * `navigator.onLine` only reports whether the device has a network interface
 * up. It goes true the moment a phone leaves aeroplane mode, well before any
 * request can complete, which is exactly when somebody presses submit. Trusting
 * it produced the failure this exists to prevent.
 *
 * `manifest.webmanifest` is the probe because it is tiny, static, and excluded
 * from the proxy matcher — so it costs no session lookup and no function
 * invocation. Any response at all means the network is carrying traffic; only a
 * throw means it is not. The status is deliberately ignored: a 404 would still
 * prove the round trip worked.
 */
async function reachable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

  try {
    await fetch('/manifest.webmanifest', { method: 'HEAD', cache: 'no-store' });
    return true;
  } catch {
    return false;
  }
}

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
  instructionUrls = {},
}: {
  submissionId: string;
  slug: string;
  groups: GroupWithAnswers[];
  readOnly: boolean;
  totalItems: number;
  checkedItems: number;
  /**
   * Signed links for instruction files, minted by the page. Absent offline and
   * in the builder preview, where text and video instructions still show but
   * files stay hidden.
   */
  instructionUrls?: Record<string, string>;
}) {
  const [submitState, submitAction] = useActionState(submitSubmission, initialState);
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();

  /**
   * Marks the second pass through the submit handler.
   *
   * A ref rather than state, because `requestSubmit()` fires the handler again
   * synchronously — a state update would not have landed by then, and the form
   * would stop itself in a loop.
   */
  const verifiedRef = useRef(false);

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

  /*
   * SUBMITTED OFFLINE, AND THEREFORE CLOSED.
   *
   * Once somebody has declared a checklist finished it must stop being
   * editable, whether or not the declaration has reached us yet. Otherwise the
   * thing eventually sent is not the thing they stood behind — they could tick
   * three more items after submitting and the server would receive a
   * submission it has no record of them making twice.
   *
   * `readOnly` from the server covers the online case. This covers the gap
   * between pressing submit in a basement and the queue draining.
   */
  const submittedOffline = Boolean(
    offline?.pending.some((r) => r.op.kind === 'submit' && r.op.submissionId === submissionId),
  );
  const locked = readOnly || submittedOffline;

  const queuedTicks: QueuedTicks = useMemo(() => {
    const map: QueuedTicks = new Map();
    for (const record of offline?.pending ?? []) {
      // Only what is still going to be sent. A refused tick is not a tick.
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
    <InstructionUrlsContext.Provider value={instructionUrls}>
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

      {/*
        Every piece of evidence in one place, for the person reviewing rather
        than the person filling in.

        Only when the record is closed. While a checklist is being filled the
        attachments are exactly where they belong — beside the item that asked
        for them — and a summary above would be clutter over work in progress.
        Afterwards the question changes completely: not "what does this item
        need" but "show me what was photographed", and answering that meant
        scrolling a checklist of forty items hoping to spot a thumbnail. That is
        the state a compliance report links into, so this is where it lands.
      */}
      {readOnly ? <EvidenceStrip groups={groups} /> : null}

      {/* Refusals from the queue, which nothing else on the page would
          mention. Shown until dismissed: the person ticked these believing
          they were done, and the server disagreed after they walked away. */}
      {offline && offline.rejected.length > 0 ? (
        <FormNotice kind="error">
          <span className="block">{t('offline.rejected', { count: offline.rejected.length })}</span>
          <span className="mt-1 block opacity-90">{offline.rejected[0].rejected}</span>
          <button
            type="button"
            onClick={() => void offline.dismissRejected()}
            className="mt-1 py-1 underline underline-offset-4"
          >
            {t('common.clear')}
          </button>
        </FormNotice>
      ) : null}

      {/* Said plainly, because the sheet has just gone read-only and nothing
          else on screen would explain why. Somebody who submits in a basement
          and then finds they cannot tick anything needs to know that is the
          feature working, not the app breaking. */}
      {submittedOffline ? (
        <FormNotice kind="info">{t('fill.submittedOffline')}</FormNotice>
      ) : null}

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
                readOnly={locked}
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

      {!locked ? (
        // Sticky at the bottom, clear of the home indicator. Someone finishing
        // the last item should not have to scroll back down to submit.
        <div className="pb-safe sticky bottom-0 -mx-4 border-t border-[var(--color-border)] bg-[var(--color-background)]/90 px-4 pt-3 backdrop-blur-md sm:mx-0">
          <form
            action={submitAction}
            /*
             * TWO THINGS ARE CHECKED BEFORE THIS IS ALLOWED TO SEND, and both
             * were found by filling a checklist in a basement.
             *
             * (1) Is the server actually reachable. `navigator.onLine` is not
             * an answer to that — it goes true the instant the radio comes back,
             * before anything can get through, so submitting the moment signal
             * returned produced "This page couldn't load". So the connection is
             * probed rather than assumed.
             *
             * (2) If it is not reachable, the submission is QUEUED, and the
             * sheet locks. This reverses an earlier decision, and the reason
             * that decision was wrong is worth keeping: it refused to queue a
             * submission because one arriving hours later would carry a time
             * nobody chose. True — of a design with only one timestamp. There
             * are now two. `completed_at` is when the person pressed submit, by
             * their own clock; `submitted_at` is when it reached us. A record
             * where they differ by four hours is not a problem to hide, it is
             * the true story of a night shift in a basement.
             *
             * Locking on submit matters as much as sending it. Once somebody
             * has declared a checklist finished it must stop being editable,
             * offline included — otherwise the thing eventually sent is not the
             * thing they stood behind.
             */
            onSubmit={(event) => {
              /*
               * ALWAYS PREVENTED FIRST, then re-submitted once the checks pass.
               *
               * `preventDefault` has to be called synchronously, and one of the
               * checks is a network probe. So the form is stopped every time
               * and `requestSubmit()` lets it through afterwards, with a ref
               * marking the second pass so it is not stopped again.
               */
              if (verifiedRef.current) {
                verifiedRef.current = false;
                return;
              }

              const form = event.currentTarget;
              event.preventDefault();
              setError(null);

              void (async () => {
                trace('submit.start', `onLine ${navigator.onLine}`);

                if (await reachable()) {
                  /*
                   * Online, but the queue may still be draining. Ticks must
                   * land before the submission, or the checklist is recorded
                   * complete while items proving it are still on the phone.
                   */
                  if (offline && offline.pending.length > 0) {
                    setError(t('fill.submitWaitForSync', { count: offline.pending.length }));
                    return;
                  }

                  verifiedRef.current = true;
                  form.requestSubmit();
                  return;
                }

                if (!offline) {
                  trace('submit.noProvider');
                  setError(t('fill.submitNeedsConnection'));
                  return;
                }

                trace('submit.queued');

                // Offline: record the moment they finished, by their clock, and
                // lock the sheet. Both times reach the server on sync.
                await offline.enqueue({
                  kind: 'submit',
                  submissionId,
                  slug,
                  completedAt: Date.now(),
                });
              })();
              return;
            }}
            className="space-y-2"
          >
            <input type="hidden" name="submissionId" value={submissionId} />
            <input type="hidden" name="slug" value={slug} />

            {remaining > 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
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
    </InstructionUrlsContext.Provider>
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
  const offline = useOffline();
  const { t } = useT();

  const instructionUrls = useContext(InstructionUrlsContext);
  const itemInstructions = parseInstructions(item.instructions);

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
   * Evidence this item demands that is not attached yet.
   *
   * THIS IS WHY A TICK CANNOT BE QUEUED OFFLINE FOR SUCH AN ITEM. The
   * requirement is enforced by a database trigger (item 30), so the server
   * refuses the tick — correctly. But offline the request never reaches it: the
   * fetch throws, the tick goes in the queue, the box shows done, and the
   * person walks away believing the item is complete. On the next sync the
   * server refuses it and the tick disappears.
   *
   * And the evidence cannot be supplied offline either, because attachments
   * upload straight from the browser to storage — so this is not a race that
   * resolves itself, it is a state that cannot be reached without a connection.
   *
   * Refusing at the moment of the tap, with a reason, is the only honest
   * answer. Location is different and deliberately excluded: GPS works with no
   * network, so a position captured offline is real evidence, and the server
   * judges it against the radius when the tick arrives.
   */
  const heldOnDevice = (attachment: 'photo' | 'file') =>
    Boolean(
      offline?.pending.some(
        (r) =>
          r.op.kind === 'evidence' &&
          r.op.answerId === answerId &&
          r.op.attachment === attachment,
      ),
    );

  const missingEvidence =
    (item.photo_required && !item.answer?.photo_path && !heldOnDevice('photo')) ||
    (item.file_required && !item.answer?.file_path && !heldOnDevice('file'));

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

    /*
     * Checked before anything moves, so the box does not flash on and off.
     *
     * Only when ticking and only when offline: with a connection the server
     * answers properly and its message is better than a guess made here.
     * `navigator.onLine` is famously optimistic, which is fine — it is used
     * only to decline early, and the catch below is the real backstop.
     */
    if (!checked && missingEvidence && typeof navigator !== 'undefined' && !navigator.onLine) {
      onError(t('fill.evidenceNeedsConnection'));
      return;
    }

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
      } catch (e) {
        trace('tick.threw', e);
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
        if (missingEvidence && !checked) {
          // The backstop for the early check above, for when `navigator.onLine`
          // lied. Queueing this would show it done and then lose it.
          onError(t('fill.evidenceNeedsConnection'));
        } else if (offline) {
          // `position` goes with it. It was read moments ago, from GPS, which
          // works with no network — and it is the only record of where this
          // was actually done. Dropping it here was the bug that made a
          // location-pinned item fail on sync with "must be ticked at its
          // location", about a tick made in exactly the right place.
          await offline.enqueue({ kind: 'tick', answerId, checked: !checked, position });
        } else {
          onError(t('fill.offlineUnavailable'));
        }
      }
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
              <span className="mt-0.5 block text-sm text-[var(--color-muted-foreground)]">
                {t(item.window_required ? 'fill.windowRequired' : 'fill.windowExpected', {
                  from: item.window_start.slice(0, 5),
                  to: item.window_end.slice(0, 5),
                })}
              </span>
            ) : null}
          </span>
        </label>

        {/* How to do it, closed by default: the instructions can be long, and
            the person who knows the job already should still see a checklist. */}
        {itemInstructions.length > 0 ? (
          <details className="ml-7">
            <summary className="cursor-pointer py-1.5 text-sm text-[var(--color-muted-foreground)]">
              {t('instructions.itemTitle')}
            </summary>
            <div className="mt-2">
              <InstructionsView blocks={itemInstructions} urls={instructionUrls} />
            </div>
          </details>
        ) : null}

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

        {answerId ? (
          <div className="px-3 pb-3">
            <CommentControl
              answerId={answerId}
              initial={item.answer?.comment ?? ''}
              readOnly={readOnly}
              onError={onError}
            />
          </div>
        ) : null}
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

/** One attachment, flattened out of the tree with the item that carries it. */
type Evidence = {
  itemTitle: string;
  kind: 'photo' | 'file';
  /** Signed, short-lived, and null when signing failed. */
  url: string | null;
};

/** Walk every level: evidence on a sub-task is evidence. */
function collectEvidence(items: AnsweredItem[], into: Evidence[] = []): Evidence[] {
  for (const item of items) {
    if (item.answer?.photo_path) {
      into.push({ itemTitle: item.title, kind: 'photo', url: item.photoUrl });
    }
    if (item.answer?.file_path) {
      into.push({ itemTitle: item.title, kind: 'file', url: item.fileUrl });
    }
    collectEvidence(item.children, into);
  }
  return into;
}

/**
 * The attachments on a finished checklist, as one strip.
 *
 * `id="evidence"` is the anchor the compliance table links to, so the count in
 * a report is a way in rather than only a number: from a month of records,
 * click the paperclip, land on the photographs.
 *
 * `scroll-mt-32` because the page has a sticky header and a sticky progress
 * bar. Without it the browser scrolls the anchor to the very top of the
 * viewport, which is underneath both of them, and the link appears to do
 * nothing.
 */
function EvidenceStrip({ groups }: { groups: GroupWithAnswers[] }) {
  const { t } = useT();
  const evidence = groups.flatMap((group) => collectEvidence(group.items));

  if (evidence.length === 0) return null;

  return (
    <section
      id="evidence"
      className="scroll-mt-32 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3"
    >
      <h2 className="text-sm font-medium">
        {t('compliance.attachmentsCount', { count: evidence.length })}
      </h2>

      {/* Scrolls inside itself. A row of twelve photographs must not make the
          page scroll sideways — the same rule as the compliance table. */}
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {evidence.map((entry, index) => (
          <li key={`${entry.itemTitle}-${entry.kind}-${index}`} className="w-20 shrink-0">
            <a
              href={entry.url ?? undefined}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'block rounded-md border border-[var(--color-border)]',
                entry.url ? 'hover:border-[var(--color-primary)]' : 'pointer-events-none opacity-60',
              )}
            >
              {entry.kind === 'photo' && entry.url ? (
                // A plain <img>: these are short-lived signed URLs on a private
                // bucket, which the image optimiser cannot fetch and must not
                // cache. Same reasoning as the control on each item.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.url}
                  alt={entry.itemTitle}
                  className="size-20 rounded-md object-cover"
                />
              ) : (
                <span className="flex size-20 items-center justify-center rounded-md">
                  <Paperclip className="size-5 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                </span>
              )}
            </a>
            {/* The item, not the filename. "Fridge temperature" is what somebody
                is looking for; a UUID with a .jpg on the end is not. */}
            <p className="mt-1 truncate text-xs text-[var(--color-muted-foreground)]" title={entry.itemTitle}>
              {entry.itemTitle}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The note on one answer.
 *
 * =============================================================================
 * SAVED ON A BUTTON, NOT ON BLUR, AND THE DIFFERENCE IS NOT COSMETIC
 *
 * It used to save when the field lost focus. That is a perfectly ordinary
 * pattern on a desktop form and a poor one here: on a phone, a note is finished
 * by pressing the keyboard's Done key or by tapping something else, and neither
 * feels like an act of saving. So there was no moment that said the words had
 * been kept, and no moment that said they had not. Somebody typing an
 * explanation of why a fridge was two degrees warm — which is precisely the
 * thing this field exists to capture — had to take it on trust.
 *
 * Worse, blur is not reliably reached. Submitting the checklist from a
 * half-typed note, or the tab going away, could take the words with it.
 *
 * A saved note is then shown as text rather than left in a box, so the screen
 * distinguishes between what has been recorded and what is still being written.
 * It stays editable and deletable until the checklist is submitted, and not
 * after — the record is fixed at the moment somebody stands behind it.
 */
function CommentControl({
  answerId,
  initial,
  readOnly,
  onError,
}: {
  answerId: string;
  /** What the server holds. The local view starts here and moves ahead of it. */
  initial: string;
  readOnly: boolean;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const offline = useOffline();
  const { t } = useT();

  /*
   * What this device believes is recorded, which is deliberately not the same
   * as what the server has confirmed.
   *
   * A note written with no signal is queued, and the server will not know about
   * it for hours. Showing the old value until then — or an empty box — would
   * tell somebody their words were lost. This holds what they wrote, from the
   * moment they press the button.
   */
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);

  function commit(text: string) {
    const value = text.trim();
    onError(null);
    setSaved(value);
    setEditing(false);

    if (value === saved.trim()) return;

    // Decided before the transition — the long note in `upload` explains why a
    // try/catch at the call site is not enough to keep a failed Server Action
    // away from the error boundary.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      trace('comment.offline', offline ? 'queueing' : 'NO PROVIDER');
      if (offline) void offline.enqueue({ kind: 'comment', answerId, comment: value });
      else onError(t('fill.offlineUnavailable'));
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveComment(answerId, value);
        if (result.error) onError(result.error);
      } catch (e) {
        trace('comment.threw', e);
        if (offline) await offline.enqueue({ kind: 'comment', answerId, comment: value });
        else onError(t('fill.offlineUnavailable'));
      }
    });
  }

  // Nothing written and nothing to write: the read-only case has no note to
  // show and no way to add one, so it renders nothing at all rather than an
  // empty heading.
  if (readOnly && !saved) return null;

  if (readOnly || !editing) {
    return saved ? (
      <div className="rounded-lg bg-[var(--color-surface)] px-3 py-2">
        {/* `whitespace-pre-wrap` because somebody who pressed return between two
            observations meant them to be two lines. */}
        <p className="text-sm whitespace-pre-wrap">{saved}</p>

        {!readOnly ? (
          <div className="mt-1.5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setDraft(saved);
                setEditing(true);
              }}
              className="py-1 text-sm text-[var(--color-muted-foreground)] underline underline-offset-4 transition-colors hover:text-[var(--color-foreground)]"
            >
              {t('common.edit')}
            </button>
            <button
              type="button"
              onClick={() => commit('')}
              className="py-1 text-sm text-[var(--color-muted-foreground)] underline underline-offset-4 transition-colors hover:text-[var(--color-destructive)]"
            >
              {t('common.delete')}
            </button>
          </div>
        ) : null}
      </div>
    ) : (
      <button
        type="button"
        onClick={() => {
          setDraft('');
          setEditing(true);
        }}
        className="inline-flex items-center gap-1.5 py-1.5 text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
      >
        <MessageSquarePlus className="size-4" aria-hidden="true" />
        {t('fill.addNote')}
      </button>
    );
  }

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        autoFocus
        placeholder={t('fill.addNote')}
        className="w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] px-3 py-2 text-base sm:text-sm"
      />

      <div className="mt-1.5 flex gap-2">
        <Button type="button" size="sm" onClick={() => commit(draft)} disabled={pending}>
          {t('common.save')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(saved);
            setEditing(false);
          }}
        >
          {t('common.cancel')}
        </Button>
      </div>
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
  const offline = useOffline();
  const { t, locale } = useT();

  /*
   * From the provider rather than `navigator.onLine` read at render: this has to
   * change the button back the moment signal returns, and only the provider's
   * subscription re-renders on that event. Assumed present when there is no
   * provider at all — the read-only preview has no delete button to disable.
   */
  const noSignal = offline ? !offline.online : false;

  /** Held on the device, not yet uploaded. Satisfies the requirement locally. */
  const queued = offline?.pending.some(
    (r) => r.op.kind === 'evidence' && r.op.answerId === answerId && r.op.attachment === kind,
  );

  function upload(file: File) {
    onError(null);
    const data = new FormData();
    data.set('answerId', answerId);
    data.set('kind', kind);
    data.set('file', file);

    /*
     * KEEP THE FILE, NOT AN APOLOGY.
     *
     * The photograph is the evidence. It exists, on this device, taken where
     * and when the work was done — a connection is the only thing missing.
     * Discarding it because the upload failed would mean asking somebody to
     * walk back into the freezer and take it again, which is the exact thing
     * this feature exists to prevent.
     */
    const keep = async () => {
      trace('evidence.keep', offline ? `${kind}, ${Math.round(file.size / 1024)} kB` : 'NO PROVIDER');
      if (offline) {
        // IndexedDB stores Blobs by structured clone, so the queue holds the
        // actual bytes rather than a reference to a file picker that will not
        // exist in five minutes.
        await offline.enqueue({ kind: 'evidence', answerId, attachment: kind, file });
      } else {
        onError(t('fill.offlineUnavailable'));
      }
    };

    /*
     * DECIDED BEFORE ENTERING THE TRANSITION, not inside it.
     *
     * Wrapping the call in try/catch was not enough and this is the correction.
     * A Server Action that fails on the network does not reliably surface as a
     * rejection at the call site — React's transition machinery reports it too,
     * and that report reaches the error boundary whatever the caller does with
     * the promise. So catching it cannot be the defence.
     *
     * The only reliable defence is not to make the call. `navigator.onLine` is
     * checked synchronously, here, outside React entirely: when it says there
     * is no network there is certainly none, and the file goes straight to the
     * queue without an action ever being dispatched.
     *
     * The probe inside still earns its place for the case `onLine` gets wrong
     * — connected to a wifi access point with no route out, which is ordinary
     * in a warehouse.
     */
    trace('evidence.start', `${kind}, onLine ${navigator.onLine}`);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      void keep();
      return;
    }

    startTransition(async () => {
      if (!(await reachable())) {
        trace('evidence.unreachable');
        await keep();
        return;
      }

      try {
        const result = await uploadEvidence(data);
        if (result.error) onError(result.error);
      } catch (e) {
        trace('evidence.threw', e);
        // The connection died between the probe and the upload. Rare, and the
        // file still matters.
        await keep();
      }
    });
  }

  function remove() {
    onError(null);
    const data = new FormData();
    data.set('answerId', answerId);
    data.set('kind', kind);

    // Refused up front rather than attempted — see the note in `upload`.
    // Deleting is never queued, so there is nothing to fall back to.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      onError(t('fill.offlineUnavailable'));
      return;
    }

    startTransition(async () => {
      try {
        const result = await removeEvidence(data);
        if (result.error) onError(result.error);
      } catch {
        /*
         * NOT QUEUED, and this one is a real decision rather than an omission.
         *
         * Deleting evidence is destructive and irreversible. Queueing it would
         * mean a file disappearing hours later, from a checklist that may by
         * then have been submitted with that file counted as present. Removing
         * a photograph is the kind of thing somebody should do deliberately,
         * with a connection, and be told about immediately if they cannot.
         */
        onError(t('fill.offlineUnavailable'));
      }
    });
  }

  /*
   * Held on the device takes precedence over "nothing attached", because for
   * the person standing there it IS attached — the only thing outstanding is
   * the upload. Saying "no photo" about a photo they just took would be both
   * wrong and alarming.
   */
  if (queued && !hasFile) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--color-border)] p-2.5 text-sm">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t('fill.evidenceHeldOnDevice')}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {t('fill.evidenceWillUpload')}
          </p>
        </div>

        {/*
          Removable with no signal, unlike one already uploaded, and the
          difference is not a technicality. This file has never left the phone,
          so taking it back changes nothing anybody else can see and undoes
          nothing on the server. Refusing here would mean somebody who
          photographed the wrong shelf in a freezer carries that mistake around
          until they find signal — with the queue still holding a file they have
          already decided is wrong.
        */}
        {!readOnly && offline ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              void (async () => {
                await offline.discard(evidenceKey(kind, answerId));

                /*
                 * And the tick that this file was the reason for.
                 *
                 * The database enforces the same thing from the other side: a
                 * trigger unticks an item whose required evidence is removed.
                 * Neither is redundant. That one is the guarantee, and it acts
                 * on records; this one is the truth on the screen, and it acts
                 * before anything has been sent. Without it the box stays
                 * ticked all the way to the next connection and is then refused
                 * — correctly, and far too late to be useful to somebody
                 * standing in front of the item.
                 */
                if (required) await offline.discard(tickKey(answerId));
              })()
            }
          >
            {t('common.delete')}
          </Button>
        ) : null}
      </div>
    );
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
                className="underline underline-offset-4"
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

          {/*
            REFUSED WITH NO SIGNAL, AND SAID SO WHERE THE TAP HAPPENS.

            Deleting an uploaded file is not queued — the reason is in `remove`
            below, and it stands. What was wrong was the way it refused: an
            error banner at the top of a long checklist, invisible to somebody
            scrolled down to the attachment they just tapped. It read as the
            button doing nothing at all, which is how it was reported.

            So the control is disabled and carries its own reason. A dead button
            that explains itself is worth more than a live one that fails
            silently somewhere off screen.
          */}
          {!readOnly ? (
            <div className="flex shrink-0 flex-col items-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={remove}
                disabled={pending || noSignal}
              >
                {t('common.delete')}
              </Button>
              {noSignal ? (
                <p className="max-w-32 text-right text-xs text-[var(--color-muted-foreground)]">
                  {t('fill.evidenceDeleteNeedsConnection')}
                </p>
              ) : null}
            </div>
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

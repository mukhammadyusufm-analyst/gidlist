'use client';

import { useActionState, useRef, useState } from 'react';
import { describeSchedule } from '@app/core';

import {
  addAssignee,
  inviteAndAssign,
  deleteSchedule,
  removeAssignee,
  toggleSchedule,
  type ActionState,
} from '@/lib/schedules/actions';
import type { ScheduleWithAssignees } from '@/lib/schedules/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

// Dates are formatted inside the component now, from the reader's own locale
// rather than a fixed en-GB — a Russian speaker should see "12 авг. 2026".

export type AssignCandidate = { email: string; name: string; pending: boolean };

export function ScheduleCard({
  schedule,
  canManage,
  boardId,
  candidates,
  activeEmails,
}: {
  schedule: ScheduleWithAssignees;
  canManage: boolean;
  boardId: string;
  candidates: AssignCandidate[];
  /** Members who have accepted. Anyone else is assigned but not yet working. */
  activeEmails: string[];
}) {
  const active = new Set(activeEmails.map((e) => e.toLowerCase()));
  const [assignState, assignAction] = useActionState(addAssignee, initialState);
  const [manageState, manageAction] = useActionState(toggleSchedule, initialState);
  const [deleteState, deleteAction] = useActionState(deleteSchedule, initialState);
  const [inviteState, inviteAction] = useActionState(inviteAndAssign, initialState);
  const [showInvite, setShowInvite] = useState(false);
  const assignFormRef = useRef<HTMLFormElement>(null);
  const inviteFormRef = useRef<HTMLFormElement>(null);
  const { t, locale } = useT();

  // Anyone in the space who is not already on this schedule.
  const assigned = new Set(schedule.assignees.map((a) => a.email.toLowerCase()));
  const unassigned = candidates.filter((c) => !assigned.has(c.email.toLowerCase()));

  const error =
    assignState.formError ??
    inviteState.formError ??
    manageState.formError ??
    deleteState.formError;
  const notice = inviteState.notice ?? assignState.notice;

  const formatDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <li className="rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {describeSchedule(
              schedule.kind,
              (schedule.config ?? {}) as Record<string, unknown>,
              t,
              locale,
            )}
            {!schedule.active ? (
              <span className="ml-2 rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-xs font-normal text-[var(--color-muted-foreground)]">
                {t('schedule.paused')}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            {schedule.end_date
              ? t('schedule.rangeUntil', {
                  from: formatDate(schedule.start_date),
                  to: formatDate(schedule.end_date),
                })
              : t('schedule.rangeFrom', { from: formatDate(schedule.start_date) })}{' '}
            · {schedule.timezone}
          </p>
        </div>

        {canManage ? (
          <div className="flex shrink-0 gap-1">
            <form action={manageAction}>
              <input type="hidden" name="scheduleId" value={schedule.id} />
              <input type="hidden" name="active" value={String(schedule.active)} />
              <Button type="submit" variant="ghost" size="sm">
                {t(schedule.active ? 'schedule.pause' : 'schedule.resume')}
              </Button>
            </form>
            <form action={deleteAction}>
              <input type="hidden" name="scheduleId" value={schedule.id} />
              <Button type="submit" variant="ghost" size="sm">
                {t('common.delete')}
              </Button>
            </form>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3">
          <FormNotice kind="error">{error}</FormNotice>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-3">
          <FormNotice kind="info">{notice}</FormNotice>
        </div>
      ) : null}

      {schedule.upcoming.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
            {t('schedule.nextDates')}
          </p>
          <p className="mt-1 text-sm">
            {schedule.upcoming.map((d) => formatDate(d)).join(' · ')}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          {t('schedule.noDates')}
        </p>
      )}

      <div className="mt-4 border-t border-[var(--color-border)] pt-3">
        <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
          {t('schedule.assignedTo')}{' '}
          {schedule.assignees.length === 0 ? t('schedule.anyoneInSpace') : null}
        </p>

        {schedule.assignees.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {schedule.assignees.map((assignee) => (
              <li key={assignee.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm">
                  {assignee.email}
                  {!active.has(assignee.email.toLowerCase()) ? (
                    // Not "unregistered" — they may well have an account. What
                    // matters is that they have not accepted, so no work is
                    // being created for them yet.
                    <span className="ml-2 rounded bg-[var(--color-warning)]/15 px-1.5 py-0.5 text-xs text-[var(--color-warning)]">
                      {t('schedule.awaitingAcceptance')}
                    </span>
                  ) : null}
                </span>
                {canManage ? (
                  <form action={async (fd: FormData) => void (await removeAssignee({}, fd))}>
                    <input type="hidden" name="assigneeId" value={assignee.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {t('common.remove')}
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {canManage ? (
          <div className="mt-3 space-y-2">
            {/* Only people already in the space. Assigning anyone else is
                refused by the database — they would be handed obligations they
                could never see, and would silently accumulate "Missed". */}
            {unassigned.length > 0 ? (
              <form
                ref={assignFormRef}
                action={async (fd: FormData) => {
                  await assignAction(fd);
                  assignFormRef.current?.reset();
                }}
                className="flex gap-2"
              >
                <input type="hidden" name="scheduleId" value={schedule.id} />
                <select
                  name="email"
                  required
                  defaultValue=""
                  className="min-h-11 flex-1 rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2 text-base sm:text-sm"
                  aria-label={t('schedule.assign')}
                >
                  <option value="" disabled>
                    {t('schedule.choosePerson')}
                  </option>
                  {unassigned.map((person) => (
                    <option key={person.email} value={person.email}>
                      {person.name}
                      {person.pending ? ` (${t('schedule.notRegistered')})` : ''}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm">
                  {t('schedule.assign')}
                </Button>
              </form>
            ) : (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {t('schedule.everyoneAssigned')}
              </p>
            )}

            {showInvite ? (
              <form
                ref={inviteFormRef}
                action={async (fd: FormData) => {
                  await inviteAction(fd);
                  inviteFormRef.current?.reset();
                }}
                className="flex gap-2"
              >
                <input type="hidden" name="scheduleId" value={schedule.id} />
                <input type="hidden" name="boardId" value={boardId} />
                <Input
                  name="email"
                  type="email"
                  required
                  placeholder={t('members.emailPlaceholder')}
                  className="flex-1"
                />
                <Button type="submit" size="sm">
                  {t('schedule.inviteAndAssign')}
                </Button>
              </form>
            ) : null}

            <button
              type="button"
              onClick={() => setShowInvite((v) => !v)}
              className="text-xs text-[var(--color-muted-foreground)] underline underline-offset-2"
            >
              {showInvite ? t('common.cancel') : t('schedule.inviteSomeoneNew')}
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

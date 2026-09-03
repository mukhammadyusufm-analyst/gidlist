'use client';

import { useActionState, useState } from 'react';
// Subpaths, not the `@app/core` barrel: the barrel loads Zod for its side
// effect, which this form has no use for in the browser. See core/index.ts.
import {
  ASSIGNMENT_MODES,
  COMMON_TIMEZONES,
  MONTHS,
  WEEKDAYS,
  type AssignmentMode,
} from '@app/core/schedule-display';
import { SCHEDULE_KINDS, type ScheduleKind } from '@app/core/constants';
import { toIsoDate } from '@app/core/dates';

import { createSchedule, type ActionState } from '@/lib/schedules/actions';
import type { AssignCandidate } from '@/components/schedules/schedule-card';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Label } from '@/components/ui/label';
import { FieldError, FormNotice } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

/** Each recurrence kind maps to its own catalogue key. */
const KIND_KEYS: Record<ScheduleKind, string> = {
  daily: 'schedule.daily',
  weekly: 'schedule.weekly',
  monthly: 'schedule.monthly',
  yearly: 'schedule.yearly',
  specific_dates: 'schedule.specificDates',
};

const selectClass =
  'min-h-11 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2 text-base sm:text-sm';

/** Weekday names in the app language. 2024-01-01 was a Monday, anchoring this. */
function weekdayName(locale: string, isoWeekday: number): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, isoWeekday)),
  );
}

/** Month names in the app language. 2024 is arbitrary; only the month matters. */
function monthName(locale: string, month: number): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, month - 1, 1)),
  );
}

function today(): string {
  // Local calendar parts, never toISOString — that converts to UTC and hands
  // back yesterday's date anywhere east of Greenwich.
  return toIsoDate(new Date());
}

/** Kept beside the modes so a new one cannot be added without its wording. */
const MODE_LABELS: Record<AssignmentMode, string> = {
  creator: 'schedule.assignCreator',
  everyone: 'schedule.assignEveryone',
  specific: 'schedule.assignSpecific',
};

const MODE_NOTES: Record<AssignmentMode, string> = {
  creator: 'schedule.assignCreatorNote',
  everyone: 'schedule.assignEveryoneNote',
  specific: 'schedule.assignSpecificNote',
};

export function ScheduleForm({
  checklistId,
  candidates,
}: {
  checklistId: string;
  /** Everyone in the space, for the "specific people" case. */
  candidates: AssignCandidate[];
}) {
  const [state, formAction] = useActionState(createSchedule, initialState);
  const [kind, setKind] = useState<ScheduleKind>('daily');
  const [specificDates, setSpecificDates] = useState<string[]>(['']);
  // Null until somebody picks, so nothing is chosen on their behalf — the whole
  // point of asking.
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode | null>(null);
  const { t, locale } = useT();

  /*
   * The span the chosen dates cover. Sorted rather than assuming the person
   * entered them in order — nothing makes them, and the rows can be edited after
   * the fact.
   */
  const chosenRange = (() => {
    const valid = specificDates.filter((d) => d).sort();
    return { start: valid[0] ?? '', end: valid[valid.length - 1] ?? '' };
  })();

  /** ISO to something readable, in the reader's own language. */
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="checklistId" value={checklistId} />

      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}
      {state.notice ? <FormNotice kind="info">{state.notice}</FormNotice> : null}

      <div>
        <Label htmlFor="kind">{t('schedule.howOften')}</Label>
        <select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as ScheduleKind)}
          className={selectClass}
        >
          {SCHEDULE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(KIND_KEYS[k])}
            </option>
          ))}
        </select>
      </div>

      {kind === 'weekly' ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t('schedule.whichDays')}</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day.value}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border)] px-3"
              >
                <input type="checkbox" name="weekdays" value={day.value} className="size-4" />
                <span className="text-sm">{weekdayName(locale, day.value)}</span>
              </label>
            ))}
          </div>
          <FieldError messages={state.fieldErrors?.config} />
        </fieldset>
      ) : null}

      {kind === 'monthly' ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">
            {t('schedule.whichDaysOfMonth')}
          </legend>
          <div className="grid grid-cols-7 gap-1 sm:grid-cols-10">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <label
                key={day}
                className="flex min-h-10 cursor-pointer items-center justify-center rounded-md border border-[var(--color-border)] text-sm has-checked:border-[var(--color-primary)] has-checked:bg-[var(--color-primary)] has-checked:text-[var(--color-primary-foreground)]"
              >
                <input type="checkbox" name="days" value={day} className="sr-only" />
                {day}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
            {t('schedule.monthEndNote')}
          </p>
          <FieldError messages={state.fieldErrors?.config} />
        </fieldset>
      ) : null}

      {kind === 'yearly' ? (
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="yearlyMonth">{t('schedule.month')}</Label>
            {/* Month names from `Intl`, not from the English MONTHS constant
                this used to render — that constant is a stable key list, not
                display text, and showing it left the one dropdown in the form
                permanently in English whatever language the app was in. */}
            <select id="yearlyMonth" name="yearlyMonth" className={selectClass} defaultValue="1">
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {monthName(locale, index + 1)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <Label htmlFor="yearlyDay">{t('schedule.day')}</Label>
            <Input id="yearlyDay" name="yearlyDay" type="number" min={1} max={31} defaultValue={1} />
          </div>
        </div>
      ) : null}

      {kind === 'specific_dates' ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t('schedule.dates')}</legend>
          <div className="space-y-2">
            {specificDates.map((value, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <DateField
                    name="specificDates"
                    value={value}
                    onChange={(iso) => {
                      const next = [...specificDates];
                      next[index] = iso;
                      setSpecificDates(next);
                    }}
                  />
                </div>
                {specificDates.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSpecificDates(specificDates.filter((_, i) => i !== index))}
                  >
                    {t('common.remove')}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setSpecificDates([...specificDates, ''])}
          >
            {t('schedule.addDate')}
          </Button>
          <FieldError messages={state.fieldErrors?.config} />
        </fieldset>
      ) : null}

      {/*
        On specific dates the range is not a separate decision.

        The chosen dates already say when this starts and stops, so asking again
        invites a contradiction — a start after the first date silently drops it,
        and nothing on screen explains why one of the dates the person picked
        never produced a checklist. The range is derived and shown as a sentence
        instead, and travels in hidden fields the server already knows how to
        read.
      */}
      {kind === 'specific_dates' ? (
        <div>
          <input type="hidden" name="startDate" value={chosenRange.start} />
          <input type="hidden" name="endDate" value={chosenRange.end} />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {chosenRange.start
              ? t('schedule.derivedRange', {
                  from: formatDate(chosenRange.start),
                  to: formatDate(chosenRange.end),
                })
              : t('schedule.derivedRangeEmpty')}
          </p>
          <FieldError messages={state.fieldErrors?.startDate} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Label htmlFor="startDate">{t('schedule.starts')}</Label>
            <DateField id="startDate" name="startDate" required defaultValue={today()} />
            <FieldError messages={state.fieldErrors?.startDate} />
          </div>
          <div className="flex-1">
            <Label htmlFor="endDate">{t('schedule.ends')}</Label>
            <DateField id="endDate" name="endDate" />
            <FieldError messages={state.fieldErrors?.endDate} />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="timezone">{t('schedule.timezone')}</Label>
        <select id="timezone" name="timezone" className={selectClass} defaultValue="Asia/Tashkent">
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace('_', ' ')}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
          {t('schedule.timezoneNote')}
        </p>
      </div>

      {/*
        Required, with no pre-selected option — the point of asking is that
        somebody decides. A schedule used to mean "anyone" when nobody chose,
        which is how a completed checklist came to be reported as filled by
        nobody in particular.

        Specific people are not offered here. A schedule is created before its
        assignees exist, so choosing them now would mean claiming named people
        while naming none; you add them to the schedule once it exists, and that
        is what switches it.
      */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('schedule.assignTo')}</legend>

        <div className="space-y-2">
          {ASSIGNMENT_MODES.map((mode) => (
            <label
              key={mode}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--color-input)] p-3 transition-colors hover:bg-[var(--color-accent)]"
            >
              <input
                type="radio"
                name="assignmentMode"
                value={mode}
                checked={assignmentMode === mode}
                onChange={() => setAssignmentMode(mode)}
                className="mt-0.5 size-4"
                required
              />
              <span className="text-sm">
                {t(MODE_LABELS[mode])}
                <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                  {t(MODE_NOTES[mode])}
                </span>
              </span>
            </label>
          ))}
        </div>

        {/* The names, in the same step rather than afterwards. Choosing
            "specific people" and then being sent elsewhere to say who would
            leave a schedule that claims named people and has none — which the
            database refuses outright. */}
        {assignmentMode === 'specific' ? (
          <div className="mt-3 rounded-lg border border-[var(--color-input)] p-3">
            {candidates.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {t('schedule.noCandidates')}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {candidates.map((candidate) => (
                  <li key={candidate.email}>
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        name="assignees"
                        value={candidate.email}
                        className="size-4"
                      />
                      <span className="min-w-0 truncate">
                        {candidate.name}
                        <span className="ml-1.5 text-xs text-[var(--color-muted-foreground)]">
                          {candidate.email}
                          {candidate.pending ? ` · ${t('schedule.pendingInvite')}` : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <FieldError messages={state.fieldErrors?.assignees} />
          </div>
        ) : null}

        <FieldError messages={state.fieldErrors?.assignmentMode} />
      </fieldset>

      <SubmitButton pendingLabel={t('common.creating')}>{t('schedule.create')}</SubmitButton>
    </form>
  );
}

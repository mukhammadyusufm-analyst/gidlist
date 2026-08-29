import { z } from 'zod';

import { SCHEDULE_KINDS } from './constants';

/**
 * Schedule validation, shared by web and mobile.
 *
 * The config shape is validated per kind here and again by a CHECK constraint
 * in the database. The duplication is deliberate: a weekly schedule saved with
 * no weekdays would generate no dates at all, and nobody would notice until an
 * audit found an empty month.
 */

export const WEEKDAYS = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 7, short: 'Sun', label: 'Sunday' },
] as const;

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const scheduleKindSchema = z.enum(SCHEDULE_KINDS);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Use the date picker.' });

export const scheduleConfigSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily'), config: z.object({}) }),

  z.object({
    kind: z.literal('weekly'),
    config: z.object({
      weekdays: z
        .array(z.int().min(1).max(7))
        .min(1, { error: 'Choose at least one day of the week.' }),
    }),
  }),

  z.object({
    kind: z.literal('monthly'),
    config: z.object({
      days: z
        .array(z.int().min(1).max(31))
        .min(1, { error: 'Choose at least one day of the month.' }),
    }),
  }),

  z.object({
    kind: z.literal('yearly'),
    config: z.object({
      dates: z
        .array(z.object({ month: z.int().min(1).max(12), day: z.int().min(1).max(31) }))
        .min(1, { error: 'Add at least one date.' }),
    }),
  }),

  z.object({
    kind: z.literal('specific_dates'),
    config: z.object({
      dates: z.array(isoDate).min(1, { error: 'Add at least one date.' }),
    }),
  }),
]);

/**
 * Who owns the work a schedule generates.
 *
 * There is no "unassigned" option, deliberately. Every mode resolves to named
 * people — `everyone` expands to one obligation per active member, not a single
 * record anybody may claim — which is what stopped a completed checklist being
 * reported as filled by "Anyone".
 */
export const ASSIGNMENT_MODES = ['creator', 'everyone', 'specific'] as const;
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number];

export const createScheduleSchema = z
  .object({
    checklistId: z.uuid(),
    startDate: isoDate,
    endDate: isoDate.optional().nullable(),
    timezone: z.string().min(1).max(60),
    /*
     * Required, with no default. A default would recreate the thing this exists
     * to remove: an ownership decision nobody made.
     */
    assignmentMode: z.enum(ASSIGNMENT_MODES, {
      error: 'Choose who this checklist is for.',
    }),

    /**
     * Only meaningful for `specific`, and required there — checked by the
     * refinement below rather than by the field, so the message lands on the
     * list instead of on a mode the person chose correctly.
     */
    assignees: z.array(z.email({ error: 'Enter a valid email address.' })).default([]),
  })
  .and(scheduleConfigSchema)
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    error: 'The end date cannot be before the start date.',
    path: ['endDate'],
  })
  .refine((v) => v.assignmentMode !== 'specific' || v.assignees.length > 0, {
    error: 'Choose at least one person, or assign this to everyone.',
    path: ['assignees'],
  });

export const addAssigneeSchema = z.object({
  scheduleId: z.uuid(),
  email: z.email({ error: 'Enter a valid email address.' }),
});

/**
 * Timezones offered in the picker.
 *
 * A short curated list rather than all ~600 IANA zones: the product is aimed at
 * Uzbek and nearby operations, and a searchable list of every zone on earth is
 * worse for the one person who has to pick correctly. The column accepts any
 * valid IANA name, so this list can grow without a migration.
 */
export const COMMON_TIMEZONES = [
  'Asia/Tashkent',
  'Asia/Samarkand',
  'Asia/Almaty',
  'Asia/Bishkek',
  'Asia/Dushanbe',
  'Asia/Ashgabat',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Shanghai',
  'Asia/Seoul',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
] as const;

type Translator = (key: string, values?: Record<string, string | number>) => string;

/**
 * Weekday and month names come from `Intl`, not from the message catalogue.
 *
 * Every locale already knows them, in the right form and the right case, so
 * adding nineteen keys per language would be work that also has to be redone
 * every time an administrator adds a language in the app. 2024-01-01 is a
 * Monday, which anchors the weekday lookup.
 */
function weekdayName(locale: string, isoWeekday: number): string {
  const date = new Date(Date.UTC(2024, 0, isoWeekday));
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date);
}

function monthName(locale: string, month: number): string {
  const date = new Date(Date.UTC(2024, month - 1, 1));
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(date);
}

/**
 * Human-readable summary of a schedule rule, for lists and cards.
 *
 * Takes the translator rather than returning English, because this string is
 * the only description of a rule most people will ever read — leaving it in
 * English would undo the point of translating the page around it.
 */
export function describeSchedule(
  kind: string,
  config: Record<string, unknown>,
  t: Translator,
  locale: string,
): string {
  switch (kind) {
    case 'daily':
      return t('schedule.daily');

    case 'weekly': {
      const days = ((config.weekdays as number[] | undefined) ?? []).slice().sort((a, b) => a - b);
      if (days.length === 7) return t('schedule.daily');
      return t('schedule.weeklyOn', {
        days: days.map((d) => weekdayName(locale, d)).join(', '),
      });
    }

    case 'monthly': {
      const days = ((config.days as number[] | undefined) ?? []).slice().sort((a, b) => a - b);
      // Plain numerals rather than English ordinals ("31st"), which have no
      // equivalent in Uzbek or Russian and would read as untranslated.
      return t('schedule.monthlyOn', { days: days.join(', ') });
    }

    case 'yearly': {
      const dates = (config.dates as { month: number; day: number }[] | undefined) ?? [];
      return t('schedule.yearlyOn', {
        dates: dates.map((d) => `${d.day} ${monthName(locale, d.month)}`).join(', '),
      });
    }

    case 'specific_dates': {
      const dates = (config.dates as string[] | undefined) ?? [];
      return t('schedule.specificCount', { count: dates.length });
    }

    default:
      return kind;
  }
}

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

import { z } from 'zod';

import { SCHEDULE_KINDS } from './constants';
import { ASSIGNMENT_MODES } from './schedule-display';

/**
 * Schedule validation, shared by web and mobile.
 *
 * The config shape is validated per kind here and again by a CHECK constraint
 * in the database. The duplication is deliberate: a weekly schedule saved with
 * no weekdays would generate no dates at all, and nobody would notice until an
 * audit found an empty month.
 *
 * The constants and the `describeSchedule` formatter live in
 * `./schedule-display` so that browser code can reach them without loading Zod.
 * They are re-exported here, so the barrel and every server import are
 * unaffected by the split.
 *
 * Messages are translation keys, translated by the action that runs the schema
 * — see the note in `./auth.ts`.
 */

export * from './schedule-display';

export const scheduleKindSchema = z.enum(SCHEDULE_KINDS);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'errors.useDatePicker' });

export const scheduleConfigSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily'), config: z.object({}) }),

  z.object({
    kind: z.literal('weekly'),
    config: z.object({
      weekdays: z
        .array(z.int().min(1).max(7))
        .min(1, { error: 'errors.chooseWeekday' }),
    }),
  }),

  z.object({
    kind: z.literal('monthly'),
    config: z.object({
      days: z
        .array(z.int().min(1).max(31))
        .min(1, { error: 'errors.chooseMonthDay' }),
    }),
  }),

  z.object({
    kind: z.literal('yearly'),
    config: z.object({
      dates: z
        .array(z.object({ month: z.int().min(1).max(12), day: z.int().min(1).max(31) }))
        .min(1, { error: 'errors.addDate' }),
    }),
  }),

  z.object({
    kind: z.literal('specific_dates'),
    config: z.object({
      dates: z.array(isoDate).min(1, { error: 'errors.addDate' }),
    }),
  }),
]);

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
      error: 'errors.chooseAssignment',
    }),

    /**
     * Only meaningful for `specific`, and required there — checked by the
     * refinement below rather than by the field, so the message lands on the
     * list instead of on a mode the person chose correctly.
     */
    assignees: z.array(z.email({ error: 'errors.emailInvalid' })).default([]),
  })
  .and(scheduleConfigSchema)
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    error: 'errors.endBeforeStart',
    path: ['endDate'],
  })
  .refine((v) => v.assignmentMode !== 'specific' || v.assignees.length > 0, {
    error: 'errors.choosePerson',
    path: ['assignees'],
  });

export const addAssigneeSchema = z.object({
  scheduleId: z.uuid(),
  email: z.email({ error: 'errors.emailInvalid' }),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

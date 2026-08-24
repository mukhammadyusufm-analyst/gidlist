import 'server-only';

import { addDays } from '@app/core';

import { createClient } from '@/lib/supabase/server';
import { getToday } from '@/lib/timezone/server';
import type { Schedule, ScheduleAssignee } from '@/lib/supabase/database.types';

export type ScheduleWithAssignees = Schedule & {
  assignees: ScheduleAssignee[];
  /** The next few dates this schedule produces, for the summary line. */
  upcoming: string[];
};

export async function listSchedules(checklistId: string): Promise<ScheduleWithAssignees[]> {
  const supabase = await createClient();

  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('checklist_id', checklistId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load schedules: ${error.message}`);
  if (!schedules?.length) return [];

  const { data: assignees } = await supabase
    .from('schedule_assignees')
    .select('*')
    .in(
      'schedule_id',
      schedules.map((s) => s.id),
    )
    .order('email');

  const bySchedule = new Map<string, ScheduleAssignee[]>();
  for (const assignee of assignees ?? []) {
    const list = bySchedule.get(assignee.schedule_id) ?? [];
    list.push(assignee);
    bySchedule.set(assignee.schedule_id, list);
  }

  // Asking the database for the dates rather than reimplementing the rules in
  // TypeScript. Two implementations of "which dates does 'monthly on the 31st'
  // mean" would eventually disagree, and the version people are actually held
  // to is the one in the database.
  // Computed in the viewer's timezone rather than the server's UTC, so the
  // "next dates" list does not start a day early for users east of Greenwich.
  const today = await getToday();
  const horizon = addDays(today, 60);

  const withDates = await Promise.all(
    schedules.map(async (schedule) => {
      const { data } = await supabase.rpc('generate_occurrences', {
        p_kind: schedule.kind,
        p_config: schedule.config,
        p_start_date: schedule.start_date,
        p_end_date: schedule.end_date,
        p_from: today,
        p_to: horizon,
      });

      return {
        ...schedule,
        assignees: bySchedule.get(schedule.id) ?? [],
        upcoming: (data ?? []).slice(0, 5),
      };
    }),
  );

  return withDates;
}

/**
 * Preview the dates a rule would produce, before it is saved.
 *
 * "Monthly on the 31st" is genuinely ambiguous to most people — showing the
 * actual dates removes the guesswork rather than explaining the rule in prose.
 */
export async function previewOccurrences(input: {
  kind: string;
  config: unknown;
  startDate: string;
  endDate: string | null;
}): Promise<string[]> {
  const supabase = await createClient();

  const from = input.startDate;
  const to = new Date(new Date(from).getTime() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase.rpc('generate_occurrences', {
    p_kind: input.kind,
    p_config: input.config as never,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_from: from,
    p_to: to,
  });

  if (error) return [];
  return data ?? [];
}

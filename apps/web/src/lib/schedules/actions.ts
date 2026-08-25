'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addAssigneeSchema, createScheduleSchema } from '@app/core';

import { createClient, getUser } from '@/lib/supabase/server';
import { isEmailConfigured } from '@/lib/email/send';
import { sendInvitationEmail } from '@/lib/email/invitation';
import { getTranslations } from '@/lib/i18n/server';

export type ActionState = {
  formError?: string;
  fieldErrors?: Record<string, string[]>;
  notice?: string;
};

const SCHEDULES_PATH = '/dashboard/boards/[slug]/checklists/[id]/schedules';

/**
 * Rebuild the config object from flat form fields.
 *
 * A <form> can only send strings, so the structured config each recurrence kind
 * needs is assembled here and then validated. Anything malformed is rejected by
 * the schema, and again by a CHECK constraint in the database.
 */
function configFromForm(kind: string, formData: FormData): unknown {
  switch (kind) {
    case 'daily':
      return {};

    case 'weekly':
      return { weekdays: formData.getAll('weekdays').map((v) => Number(v)) };

    case 'monthly':
      return { days: formData.getAll('days').map((v) => Number(v)) };

    case 'yearly':
      return {
        dates: [
          {
            month: Number(formData.get('yearlyMonth')),
            day: Number(formData.get('yearlyDay')),
          },
        ],
      };

    case 'specific_dates':
      return {
        dates: formData
          .getAll('specificDates')
          .map((v) => String(v).trim())
          .filter(Boolean),
      };

    default:
      return {};
  }
}

export async function createSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = String(formData.get('kind') ?? '');
  const endDateRaw = String(formData.get('endDate') ?? '').trim();

  const parsed = createScheduleSchema.safeParse({
    checklistId: formData.get('checklistId'),
    kind,
    config: configFromForm(kind, formData),
    startDate: formData.get('startDate'),
    endDate: endDateRaw || null,
    timezone: formData.get('timezone'),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      formError: flat.formErrors[0],
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('schedules')
    .insert({
      checklist_id: parsed.data.checklistId,
      kind: parsed.data.kind,
      config: parsed.data.config as never,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate ?? null,
      timezone: parsed.data.timezone,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { formError: `Could not create the schedule: ${error?.message ?? 'unknown error'}` };
  }

  // Generate this schedule's obligations straight away. Waiting for the nightly
  // job would leave a schedule that looks broken for up to 24 hours.
  const { error: matError } = await supabase.rpc('materialise_schedule', {
    p_schedule_id: data.id,
    p_horizon_days: 45,
  });

  revalidatePath(SCHEDULES_PATH, 'page');

  if (matError) {
    return {
      notice: 'Schedule saved, but its dates are not ready yet. They will appear overnight.',
    };
  }

  return { notice: 'Schedule created.' };
}

export async function deleteSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const scheduleId = String(formData.get('scheduleId') ?? '');
  const supabase = await createClient();

  // Submissions cascade with it. That is intended: they are obligations this
  // schedule created, and leaving orphans would show phantom "Missed" rows for
  // a rule nobody is bound by any more.
  const { error } = await supabase.from('schedules').delete().eq('id', scheduleId);
  if (error) return { formError: `Could not delete: ${error.message}` };

  revalidatePath(SCHEDULES_PATH, 'page');
  return { notice: 'Schedule deleted.' };
}

export async function toggleSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const scheduleId = String(formData.get('scheduleId') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  const supabase = await createClient();

  // Pausing leaves existing submissions alone and simply stops new ones being
  // generated — history stays intact, which deleting would destroy.
  const { error } = await supabase
    .from('schedules')
    .update({ active: !active })
    .eq('id', scheduleId);

  if (error) return { formError: `Could not update: ${error.message}` };

  revalidatePath(SCHEDULES_PATH, 'page');
  return {};
}

/**
 * Invite someone to the space and assign them in one step.
 *
 * Assignment now requires membership, so without this the only way to give a
 * new colleague a schedule would be to leave this page, invite them on the
 * Members tab, and come back. The order matters: the invitation has to land
 * before the assignment, or the database refuses it.
 */
export async function inviteAndAssign(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addAssigneeSchema.safeParse({
    scheduleId: formData.get('scheduleId'),
    email: formData.get('email'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const boardId = String(formData.get('boardId') ?? '');
  const email = parsed.data.email.toLowerCase().trim();

  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect('/login');

  const { error: inviteError } = await supabase.from('board_members').insert({
    board_id: boardId,
    invited_email: email,
    role: 'member',
    status: 'invited',
    invited_by: user.id,
  });

  // 23505 means they are already in the space, which is fine here — the point
  // was to make sure they are a member, and they are.
  if (inviteError && inviteError.code !== '23505') {
    return { formError: `Could not invite: ${inviteError.message}` };
  }

  const { error } = await supabase
    .from('schedule_assignees')
    .insert({ schedule_id: parsed.data.scheduleId, email });

  if (error) {
    if (error.code === '23505') {
      return { formError: 'That person is already assigned to this schedule.' };
    }
    return { formError: friendlyAssigneeError(error.message) };
  }

  await supabase.rpc('materialise_schedule', {
    p_schedule_id: parsed.data.scheduleId,
    p_horizon_days: 45,
  });

  const delivered = await notifyNewMember(boardId, email);

  revalidatePath(SCHEDULES_PATH, 'page');
  return {
    notice: delivered
      ? `${email} was invited, emailed, and assigned.`
      : `${email} was invited and assigned. No email was sent — tell them to sign in and accept.`,
  };
}

/** Best-effort notification; an outage must not undo the invitation. */
async function notifyNewMember(boardId: string, email: string): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const supabase = await createClient();
    const user = await getUser();

    const [{ data: board }, { data: profile }, { locale }, { data: membership }] =
      await Promise.all([
        supabase.from('boards').select('name').eq('id', boardId).maybeSingle(),
        user
          ? supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        getTranslations(),
        supabase
          .from('board_members')
          .select('user_id')
          .eq('board_id', boardId)
          .eq('invited_email', email)
          .maybeSingle(),
      ]);

    const result = await sendInvitationEmail({
      to: email,
      spaceName: board?.name ?? 'a space',
      inviterName: profile?.full_name?.trim() || user?.email || 'A colleague',
      roleKey: 'members.roleMember',
      locale,
      needsAccount: !membership?.user_id,
    });

    return result.sent;
  } catch (error) {
    console.error('Invitation email failed:', error);
    return false;
  }
}

/** Turn the database's membership rule into something worth reading. */
function friendlyAssigneeError(message: string): string {
  if (message.includes('before assigning them a schedule')) {
    return 'That person is not in this space yet. Use "Invite someone new" instead.';
  }
  return message;
}

export async function addAssignee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = addAssigneeSchema.safeParse({
    scheduleId: formData.get('scheduleId'),
    email: formData.get('email'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();

  // Only the email is sent. Linking it to an account is done by a database
  // trigger, because auth.users is not readable through the API — any attempt
  // to resolve the address here would quietly resolve to nothing.
  const { error } = await supabase.from('schedule_assignees').insert({
    schedule_id: parsed.data.scheduleId,
    email: parsed.data.email.toLowerCase().trim(),
  });

  if (error) {
    if (error.code === '23505') {
      return { formError: 'That person is already assigned to this schedule.' };
    }
    return { formError: friendlyAssigneeError(error.message) };
  }

  await supabase.rpc('materialise_schedule', {
    p_schedule_id: parsed.data.scheduleId,
    p_horizon_days: 45,
  });

  revalidatePath(SCHEDULES_PATH, 'page');
  return { notice: `${parsed.data.email} assigned.` };
}

export async function removeAssignee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const assigneeId = String(formData.get('assigneeId') ?? '');
  const supabase = await createClient();

  const { error } = await supabase.from('schedule_assignees').delete().eq('id', assigneeId);
  if (error) return { formError: `Could not remove: ${error.message}` };

  revalidatePath(SCHEDULES_PATH, 'page');
  return {};
}

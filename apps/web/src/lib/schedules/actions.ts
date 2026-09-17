'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addAssigneeSchema, createScheduleSchema } from '@app/core';

import { createClient, getUser } from '@/lib/supabase/server';
import { explainFailure, translateFieldErrors } from '@/lib/errors';
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
  const { t } = await getTranslations();

  const kind = String(formData.get('kind') ?? '');
  const endDateRaw = String(formData.get('endDate') ?? '').trim();

  const parsed = createScheduleSchema.safeParse({
    checklistId: formData.get('checklistId'),
    kind,
    config: configFromForm(kind, formData),
    startDate: formData.get('startDate'),
    endDate: endDateRaw || null,
    timezone: formData.get('timezone'),
    assignmentMode: formData.get('assignmentMode'),
    // Only present when "specific people" is chosen; the schema requires at
    // least one in that case and ignores them otherwise.
    assignees: formData.getAll('assignees').map(String).filter(Boolean),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      formError: flat.formErrors[0] ? t(flat.formErrors[0]) : undefined,
      fieldErrors: translateFieldErrors(flat.fieldErrors as Record<string, string[] | undefined>, t),
    };
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect('/login');

  /*
   * One call, one transaction.
   *
   * Inserting the schedule and then its assignees over two requests is two
   * transactions, and the deferred constraint fires at the end of the first —
   * when the schedule names nobody. That is what previously made "specific
   * people" impossible to offer at creation. The function writes both together,
   * so the trigger sees a complete schedule, which is what deferring it was for.
   */
  const { data, error } = await supabase.rpc('create_schedule_with_assignees', {
    p_checklist_id: parsed.data.checklistId,
    p_kind: parsed.data.kind,
    p_config: parsed.data.config as never,
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate ?? null,
    p_timezone: parsed.data.timezone,
    p_assignment_mode: parsed.data.assignmentMode,
    p_assignees: parsed.data.assignees,
  });

  if (error || !data) {
    /*
     * This used to return `friendlyDatabaseError(...)` alone, which is undefined
     * for anything that helper did not recognise — so an unrecognised failure
     * produced a form that refused to save and said nothing at all. It now always
     * says something.
     */
    return { formError: explainFailure(error?.message, 'errors.couldNotSave', t) };
  }

  // Generate this schedule's obligations straight away. Waiting for the nightly
  // job would leave a schedule that looks broken for up to 24 hours.
  const { error: matError } = await supabase.rpc('materialise_schedule', {
    // The function returns the new id directly, not a row.
    p_schedule_id: data,
    p_horizon_days: 45,
  });

  revalidatePath(SCHEDULES_PATH, 'page');

  if (matError) {
    return { notice: t('notices.scheduleSavedDatesLater') };
  }

  return { notice: t('notices.scheduleCreated') };
}

export async function deleteSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const scheduleId = String(formData.get('scheduleId') ?? '');
  const supabase = await createClient();

  // Only its unopened days go with it — a database trigger deletes those. Every
  // opened, submitted and missed record stays, with no schedule (README item
  // 64). It used to cascade and take the whole history with it.
  const { error } = await supabase.from('schedules').delete().eq('id', scheduleId);

  const { t } = await getTranslations();
  if (error) return { formError: explainFailure(error.message, 'errors.couldNotDelete', t) };

  revalidatePath(SCHEDULES_PATH, 'page');
  return { notice: t('notices.scheduleDeleted') };
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

  if (error) {
    const { t } = await getTranslations();
    return { formError: explainFailure(error.message, 'errors.couldNotUpdate', t) };
  }

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
  const { t } = await getTranslations();

  const parsed = addAssigneeSchema.safeParse({
    scheduleId: formData.get('scheduleId'),
    email: formData.get('email'),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

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
    return { formError: explainFailure(inviteError.message, 'errors.couldNotInvite', t) };
  }

  const { error } = await supabase
    .from('schedule_assignees')
    .insert({ schedule_id: parsed.data.scheduleId, email });

  if (error) {
    if (error.code === '23505') {
      return { formError: t('errors.alreadyAssigned') };
    }
    return { formError: explainFailure(error.message, 'errors.couldNotSave', t) };
  }

  await supabase.rpc('materialise_schedule', {
    p_schedule_id: parsed.data.scheduleId,
    p_horizon_days: 45,
  });

  const delivered = await notifyNewMember(boardId, email);

  revalidatePath(SCHEDULES_PATH, 'page');
  return {
    notice: delivered
      ? t('notices.invitedEmailedAssigned', { email })
      : t('notices.invitedAssignedNoEmail', { email }),
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

/*
 * `friendlyAssigneeError` used to live here, turning "Add x to the space before
 * assigning them a schedule" into English. That refusal is recognised in
 * `lib/errors.ts` now, with every other one, and leaves in the reader's language.
 */

export async function addAssignee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getTranslations();

  const parsed = addAssigneeSchema.safeParse({
    scheduleId: formData.get('scheduleId'),
    email: formData.get('email'),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

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
      return { formError: t('errors.alreadyAssigned') };
    }
    return { formError: explainFailure(error.message, 'errors.couldNotSave', t) };
  }

  /*
   * Naming somebody IS the choice of "specific people".
   *
   * Without this, adding a name to a schedule set to everyone would leave the
   * mode untouched and the name would do nothing — the materialiser branches on
   * the mode, not on whether names exist. Making the act of assigning switch the
   * mode is what stops the interface offering two controls that quietly
   * contradict each other.
   *
   * Safe against the deferred constraint: the row was inserted a moment ago, so
   * by the time this commits the schedule does name someone.
   */
  await supabase
    .from('schedules')
    .update({ assignment_mode: 'specific' })
    .eq('id', parsed.data.scheduleId);

  await supabase.rpc('materialise_schedule', {
    p_schedule_id: parsed.data.scheduleId,
    p_horizon_days: 45,
  });

  revalidatePath(SCHEDULES_PATH, 'page');
  return { notice: t('notices.assigned', { email: parsed.data.email }) };
}

/**
 * Switch a schedule between creator and everyone.
 *
 * `specific` is deliberately not reachable here: it is chosen by naming
 * somebody, and the database refuses a schedule that claims specific people
 * while naming none. Moving *away* from specific is what this is for, and it is
 * the way out of the block a person hits when removing their last assignee.
 */
export async function setAssignmentMode(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { t } = await getTranslations();

  const scheduleId = String(formData.get('scheduleId') ?? '');
  const mode = String(formData.get('mode') ?? '');

  if (mode !== 'creator' && mode !== 'everyone') {
    return { formError: t('errors.assignByName') };
  }

  const supabase = await createClient();

  /*
   * THE MODE FIRST, THEN THE NAMES. The order is the whole thing.
   *
   * Clearing the names first commits a schedule that still says 'specific' and
   * names nobody — which is precisely what the deferred trigger refuses. That
   * made these buttons impossible to use, and they are the only way out of
   * 'specific', so the error told people to do the thing they were doing.
   *
   * Reversed, each transaction is valid on its own: the update leaves a
   * schedule whose mode does not require names, and the delete then has nothing
   * to violate.
   *
   * Between the two the schedule is 'everyone' with names still attached. That
   * is harmless — the materialiser branches on the mode and never reads the
   * list for anything but 'specific'.
   */
  const { error } = await supabase
    .from('schedules')
    .update({ assignment_mode: mode })
    .eq('id', scheduleId);

  if (error) return { formError: explainFailure(error.message, 'errors.couldNotUpdate', t) };

  // Names left behind on a schedule that no longer uses them would reappear the
  // moment somebody switched back, having quietly survived a decision that
  // looked like it removed them.
  const { error: clearError } = await supabase
    .from('schedule_assignees')
    .delete()
    .eq('schedule_id', scheduleId);

  if (clearError) {
    return { formError: explainFailure(clearError.message, 'errors.couldNotUpdate', t) };
  }

  await supabase.rpc('materialise_schedule', {
    p_schedule_id: scheduleId,
    p_horizon_days: 45,
  });

  revalidatePath(SCHEDULES_PATH, 'page');
  return {
    notice: mode === 'creator' ? t('notices.assignedToYou') : t('notices.assignedToEveryone'),
  };
}

export async function removeAssignee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const assigneeId = String(formData.get('assigneeId') ?? '');
  const supabase = await createClient();

  const { error } = await supabase.from('schedule_assignees').delete().eq('id', assigneeId);
  if (error) {
    const { t } = await getTranslations();
    return { formError: explainFailure(error.message, 'errors.couldNotRemove', t) };
  }

  revalidatePath(SCHEDULES_PATH, 'page');
  return {};
}

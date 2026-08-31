'use client';

import { useActionState } from 'react';

import { removeMember, setMemberManager, updateMemberRole, type ActionState } from '@/lib/boards/actions';
import type { MemberWithProfile } from '@/lib/boards/queries';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

export function MemberRow({
  member,
  boardId,
  canManage,
  viewerIsOwner,
  colleagues,
}: {
  member: MemberWithProfile;
  boardId: string;
  canManage: boolean;
  viewerIsOwner: boolean;
  /** Everyone else in the space, as candidate managers. */
  colleagues: { id: string; name: string }[];
}) {
  const [roleState, roleAction] = useActionState(updateMemberRole, initialState);
  const [removeState, removeAction] = useActionState(removeMember, initialState);
  const [managerState, managerAction] = useActionState(setMemberManager, initialState);
  const { t } = useT();

  const isOwner = member.role === 'owner';
  const pending = member.status === 'invited';
  const displayName = member.full_name?.trim() || member.invited_email || t('members.unknown');

  // The owner's role and membership are fixed. The database enforces both
  // independently; disabling the controls just avoids offering an action that
  // is certain to fail.
  const editable = canManage && !isOwner && (viewerIsOwner || member.role !== 'admin');

  const error = roleState.formError ?? removeState.formError ?? managerState.formError;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate font-medium">{displayName}</p>
        <p className="truncate text-xs text-[var(--color-muted-foreground)]">
          {member.full_name && member.invited_email ? member.invited_email : null}
          {pending ? (
            <span className="ml-0 rounded bg-[var(--color-muted)] px-1.5 py-0.5">
              Invited — not registered yet
            </span>
          ) : null}
        </p>
        {error ? <p className="mt-1 text-xs text-[var(--color-destructive)]">{error}</p> : null}
      </div>

      <div className="flex items-center gap-2">
        {/* Who they report to. Recorded now, and not yet used to decide what
            anybody can see — that is a separate change to every submission and
            compliance policy. See README item 11. */}
        {canManage ? (
          <form action={managerAction}>
            <input type="hidden" name="memberId" value={member.id} />
            <label className="sr-only" htmlFor={`manager-${member.id}`}>
              {t('members.reportsTo')}
            </label>
            <select
              id={`manager-${member.id}`}
              name="managerId"
              /*
               * Keyed by the saved value, not just given it as a default.
               *
               * `defaultValue` is read once when the element mounts. After the
               * action ran and the server sent fresh data, this select stayed
               * mounted and kept displaying whatever it started with — so a
               * reporting line that had saved correctly still read "reports to
               * nobody", and one that failed looked identical. Keying on the
               * saved value remounts it whenever the database disagrees with
               * what is on screen, which makes the control tell the truth in
               * both directions.
               */
              key={member.manager_id ?? 'none'}
              defaultValue={member.manager_id ?? ''}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="min-h-11 rounded-md border border-[var(--color-input)] bg-transparent px-2 text-sm"
            >
              <option value="">{t('members.reportsToNobody')}</option>
              {colleagues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </form>
        ) : null}

        {editable ? (
          <form action={roleAction}>
            <input type="hidden" name="memberId" value={member.id} />
            <input type="hidden" name="boardId" value={boardId} />
            <select
              name="role"
              defaultValue={member.role}
              // Submitting on change keeps this to one interaction. The row is
              // re-rendered from the server afterwards, so a rejected change
              // visibly snaps back rather than lying about having saved.
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="min-h-11 rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-sm"
              aria-label={`Role for ${displayName}`}
            >
              <option value="member">{t('members.roleMember')}</option>
              <option value="editor">{t('members.roleEditor')}</option>
              <option value="admin">{t('members.roleAdmin')}</option>
            </select>
          </form>
        ) : (
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {t(`members.role${member.role.charAt(0).toUpperCase()}${member.role.slice(1)}`)}
          </span>
        )}

        {editable ? (
          <form action={removeAction}>
            <input type="hidden" name="memberId" value={member.id} />
            <input type="hidden" name="boardId" value={boardId} />
            <Button type="submit" variant="ghost" size="sm">
              Remove
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

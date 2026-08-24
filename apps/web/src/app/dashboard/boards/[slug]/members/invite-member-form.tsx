'use client';

import { useActionState } from 'react';
import { UserPlus } from 'lucide-react';

import { inviteMember, type ActionState } from '@/lib/boards/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError, FormNotice } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

const selectClass =
  'min-h-11 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2 text-base sm:text-sm';

export function InviteMemberForm({ boardId }: { boardId: string }) {
  const [state, formAction] = useActionState(inviteMember, initialState);
  const { t } = useT();

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="boardId" value={boardId} />

      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}
      {state.notice ? <FormNotice kind="info">{state.notice}</FormNotice> : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Label htmlFor="email">{t('common.email')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder={t('members.emailPlaceholder')}
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
          <FieldError messages={state.fieldErrors?.email} />
        </div>

        <div className="sm:w-40">
          <Label htmlFor="role">{t('members.role')}</Label>
          <select id="role" name="role" defaultValue="member" className={selectClass}>
            <option value="member">{t('members.roleMember')}</option>
            <option value="editor">{t('members.roleEditor')}</option>
            <option value="admin">{t('members.roleAdmin')}</option>
          </select>
          <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
            {t('members.roleHint')}
          </p>
        </div>
      </div>

      <SubmitButton pendingLabel={t('members.sendingInvite')}>
        <UserPlus aria-hidden="true" />
        {t('members.sendInvitation')}
      </SubmitButton>
    </form>
  );
}

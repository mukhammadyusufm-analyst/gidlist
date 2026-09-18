'use client';

import { useActionState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

import { deleteMyAccount, type AccountState } from '@/lib/account/actions';
import { clearAll } from '@/lib/offline/queue';
import { clearSnapshots, forgetUser } from '@/lib/offline/snapshot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';

const initialState: AccountState & { deleted?: boolean } = {};

/**
 * Deleting one's own account, confirmed by typing the email address.
 *
 * Once the server says it is done, the phone's offline copies go too — the
 * same wipe as signing out — and then the sign-in page, which says so.
 */
export function DeleteAccount({ email }: { email: string }) {
  const [state, action, pending] = useActionState(deleteMyAccount, initialState);
  const { t } = useT();

  useEffect(() => {
    if (!state.deleted) return;
    void (async () => {
      await clearAll();
      await clearSnapshots();
      forgetUser();
      window.location.replace('/login?deleted=1');
    })();
  }, [state.deleted]);

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="text-sm">{t('account.deleteConfirmLabel', { email })}</span>
        <Input name="confirm" type="email" autoComplete="off" className="mt-1.5" />
      </label>
      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}
      <Button type="submit" variant="destructive" size="sm" disabled={pending || state.deleted}>
        <Trash2 aria-hidden="true" />
        {t('account.deleteAction')}
      </Button>
    </form>
  );
}

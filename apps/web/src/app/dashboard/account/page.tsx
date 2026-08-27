import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Check, ChevronRight, CreditCard, KeyRound, Mail } from 'lucide-react';

import { createClient, getUser } from '@/lib/supabase/server';
import { getTranslations } from '@/lib/i18n/server';
import { AvatarUpload } from '@/components/account/avatar-upload';
import { EmailForm, NameForm, PasswordForm } from '@/components/account/account-forms';

// Translated, so the browser tab matches the language the app is being read in.
// Static `metadata` cannot do this: it is evaluated without a request, so it
// has no way to know which locale the cookie asked for.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('account.title') };
}

export default async function AccountPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect('/login?next=/dashboard/account');

  const [{ data: profile }, { t }] = await Promise.all([
    supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
    getTranslations(),
  ]);

  /**
   * Which sign-in methods this account actually has.
   *
   * Supabase records one identity per provider. Someone who signed up with
   * Google has only the `google` identity and no password at all — which is
   * worth showing plainly, because it means one lost Google account is one lost
   * way into this product.
   */
  const identities = user.identities ?? [];
  const hasGoogle = identities.some((i) => i.provider === 'google');
  const hasPassword = identities.some((i) => i.provider === 'email');

  const methods = [
    { key: 'account.methodPassword', icon: KeyRound, active: hasPassword },
    { key: 'account.methodGoogle', icon: Mail, active: hasGoogle },
  ];

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('account.title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('account.intro')}</p>
      </div>

      {/* First, and a link rather than a section. Billing covers every space
          this person owns, so it does not belong under any one of them — and
          it is the thing an owner comes here looking for. */}
      <section>
        <Link
          href="/dashboard/account/billing"
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:bg-[var(--color-accent)]"
        >
          <span className="flex items-center gap-3">
            <CreditCard className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
            <span className="text-sm font-medium">{t('billing.title')}</span>
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-[var(--color-muted-foreground)]"
            aria-hidden="true"
          />
        </Link>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t('account.photo')}</h2>
        <div className="mt-4">
          <AvatarUpload
            userId={user.id}
            name={profile?.full_name?.trim() || user.email || '?'}
            currentUrl={profile?.avatar_url ?? null}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t('account.profile')}</h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
          {t('account.nameIntro')}
        </p>
        <NameForm currentName={profile?.full_name ?? ''} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t('account.signInMethods')}</h2>
        <ul className="mt-4 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <li key={method.key} className="flex items-center justify-between gap-3 p-4">
                <span className="flex items-center gap-2.5">
                  <Icon className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                  <span className="text-sm font-medium">{t(method.key)}</span>
                </span>

                {method.active ? (
                  <span className="flex items-center gap-1 text-xs text-[var(--color-success)]">
                    <Check className="size-3.5" aria-hidden="true" />
                    {t('account.methodActive')}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {t('account.methodNotSet')}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t('account.emailSection')}</h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
          {t('account.emailIntro')}
        </p>
        <EmailForm currentEmail={user.email ?? ''} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t('account.passwordSection')}</h2>
        <div className="mt-4">
          <PasswordForm hasPassword={hasPassword} />
        </div>
      </section>
    </div>
  );
}

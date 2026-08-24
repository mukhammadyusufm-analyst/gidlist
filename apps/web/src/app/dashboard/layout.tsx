import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CircleCheckBig, LogOut, Languages } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/auth/actions';
import { getAvailableLocales, getTranslations, isPlatformAdmin } from '@/lib/i18n/server';
import { getTheme } from '@/lib/theme/server';
import { getTimezone } from '@/lib/timezone/server';
import { TimezoneProbe } from '@/components/timezone-probe';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [{ t }, locales, platformAdmin, theme, timezone] = await Promise.all([
    getTranslations(),
    getAvailableLocales(),
    isPlatformAdmin(),
    getTheme(),
    getTimezone(),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects signed-out visitors away from /dashboard. This
  // repeats the check on purpose: the proxy protects by URL pattern, and a
  // future matcher edit could quietly stop covering this route. Authorisation
  // belongs next to the data it guards, not only at the edge.
  if (!user) {
    redirect('/login?next=/dashboard');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  const displayName = profile?.full_name?.trim() || user.email;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Sticky, translucent and blurred: on a phone the header stays reachable
          while scrolling a long checklist, and the blur keeps it legible over
          whatever passes beneath. */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
              <CircleCheckBig className="size-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">Checklists</span>
          </Link>

          <div className="flex items-center gap-1.5">
            {platformAdmin ? (
              <Link
                href="/dashboard/admin/translations"
                title={t('admin.translations')}
                className="flex size-9 items-center justify-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
              >
                <Languages className="size-4" aria-hidden="true" />
                <span className="sr-only">{t('admin.translations')}</span>
              </Link>
            ) : null}

            <ThemeToggle current={theme} />
            <LanguageSwitcher locales={locales} />

            {/* The name doubles as the way into account settings — that is
                where people look for it, and it saves a separate icon in an
                already busy header. */}
            <Link
              href="/dashboard/account"
              title={t('account.link')}
              className="ml-1 flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-[var(--color-accent)]"
            >
              <Avatar
                name={displayName ?? '?'}
                imageUrl={profile?.avatar_url ?? null}
                seed={user.id}
                className="size-7 rounded-full"
              />
              <span className="hidden max-w-40 truncate text-sm text-[var(--color-muted-foreground)] lg:inline">
                {displayName}
              </span>
              <span className="sr-only">{t('account.link')}</span>
            </Link>

            <form action={signOut}>
              <Button type="submit" variant="ghost" size="icon" title={t('auth.signOut')}>
                <LogOut className="size-4" aria-hidden="true" />
                <span className="sr-only">{t('auth.signOut')}</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>

      {/* Renders nothing; reports the browser's timezone once so the server can
          work out what "today" means where the user actually is. */}
      <TimezoneProbe current={timezone} />
    </div>
  );
}

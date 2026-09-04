import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CircleCheckBig, LogOut, ShieldCheck } from 'lucide-react';

import { getUser } from '@/lib/supabase/server';
import { getMyProfile } from '@/lib/account/profile';
import { OfflineProvider } from '@/components/offline/offline-provider';
import { OfflineIndicator } from '@/components/offline/offline-indicator';
import { signOut } from '@/lib/auth/actions';
import { getAvailableLocales, getTranslations } from '@/lib/i18n/server';
import { hasAnyCapability } from '@/lib/platform/access';
import { getTheme } from '@/lib/theme/server';
import { getTimezone } from '@/lib/timezone/server';
import { TimezoneProbe } from '@/components/timezone-probe';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // One link to the admin area rather than one per tool. What is inside it
  // depends on which capabilities the person holds, and that decision belongs
  // on the admin page, not duplicated in the header.
  const [{ t }, locales, isAdmin, theme, timezone] = await Promise.all([
    getTranslations(),
    getAvailableLocales(),
    hasAnyCapability(),
    getTheme(),
    getTimezone(),
  ]);

  const user = await getUser();

  // proxy.ts already redirects signed-out visitors away from /dashboard. This
  // repeats the check on purpose: the proxy protects by URL pattern, and a
  // future matcher edit could quietly stop covering this route. Authorisation
  // belongs next to the data it guards, not only at the edge.
  if (!user) {
    redirect('/login?next=/dashboard');
  }

  // Shared with getLocale() and the account page — see lib/account/profile.ts.
  const profile = await getMyProfile();
  const displayName = profile?.full_name?.trim() || user.email;

  return (
    // Wrapped here rather than around the fill sheet alone, so a tick made in a
    // basement is still flushed when the person comes back and lands on any
    // page — the queue would otherwise only drain if they happened to reopen
    // the same checklist.
    <OfflineProvider userId={user.id}>
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
            <span className="hidden sm:inline">Gidlist</span>
          </Link>

          <div className="flex items-center gap-1.5">
            {isAdmin ? (
              <Link
                href="/dashboard/admin"
                title={t('admin.title')}
                className="flex size-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                <span className="sr-only">{t('admin.title')}</span>
              </Link>
            ) : null}

            {/* Before the theme and language controls, because it is the only
                thing here that is ever urgent. */}
            <OfflineIndicator />

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
              {/* Outlined with a card background rather than ghost, so it reads
                  as the same kind of control as the theme toggle and language
                  picker next to it. A bare ghost button looked like a different
                  class of thing sitting in the same row. */}
              <Button
                type="submit"
                variant="outline"
                size="icon"
                title={t('auth.signOut')}
                className="bg-[var(--color-card)]"
              >
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
    </OfflineProvider>
  );
}

import Link from 'next/link';
import Script from 'next/script';
import { headers } from 'next/headers';
import { CalendarClock, CircleCheckBig, Smartphone } from 'lucide-react';

import { getAvailableLocales, getTranslations } from '@/lib/i18n/server';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';

/**
 * The page a prospect sees before anything else.
 *
 * Two audiences arrive here and they want opposite things. Someone evaluating
 * the product needs to know what it is; someone who works here needs to sign in
 * and get on with their shift. So the form comes first in the reading order and
 * on small screens, and the explanation sits beside it on a wide one — where an
 * evaluator almost certainly is, and where a worker is not.
 *
 * The explanation is not hidden from phones, only moved below the form. Hiding
 * it would mean a prospect who opened the link on a phone learns nothing, and
 * that is most of them.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [locales, { t }] = await Promise.all([getAvailableLocales(), getTranslations()]);

  /*
   * The nonce `proxy.ts` minted for this request, read exactly as the Next
   * CSP guide prescribes. It has to be on this tag: `script-src` uses
   * `strict-dynamic`, which makes the browser ignore host allowlists entirely,
   * so naming challenges.cloudflare.com in the policy would achieve nothing.
   * A nonced script is trusted, and anything it goes on to load inherits that
   * trust — which is how Turnstile's own bundle gets in.
   *
   * Loaded once for the whole auth group rather than per form, because all
   * three forms need it and the script is happy to be present with no widget.
   */
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const points = [
    { icon: CalendarClock, text: t('auth.pitchPointSchedule') },
    { icon: CircleCheckBig, text: t('auth.pitchPointRecord') },
    { icon: Smartphone, text: t('auth.pitchPointPhone') },
  ];

  return (
    // `items-center` with `min-h-dvh` is what centres the whole block
    // vertically. Without it the content hangs from the top, which is barely
    // noticeable on a laptop and looks abandoned on a large monitor or when
    // somebody zooms out.
    <div className="auth-backdrop auth-shell flex min-h-dvh items-center justify-center">
      {turnstileEnabled ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          nonce={nonce}
        />
      ) : null}

      <div className="w-full max-w-4xl">
        {/* Above the grid rather than inside the left column. In the left
            column it would follow the form on a phone, so the first thing on
            the page would be a password field belonging to nothing named. Up
            here it is first on every screen, and on a wide one it still lines
            up with the column beneath it. */}
        <Link
          href="/"
          className="mx-auto flex w-fit items-center gap-2.5 lg:mx-0"
          aria-label="Gidlist"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
            <CircleCheckBig className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold tracking-tight">Gidlist</span>
        </Link>

        <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-16">
          <section className="order-2 lg:order-1">
            {/* Centred on a phone, left-aligned once there is a column to align
                to. Left-aligned text under a centred logo on a narrow screen
                looks like a mistake rather than a choice. */}
            <h2 className="text-center text-2xl font-semibold tracking-tight text-balance sm:text-3xl lg:text-left">
              {t('auth.pitchTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-[var(--color-muted-foreground)] lg:mx-0 lg:text-left">
              {t('auth.pitchBody')}
            </p>

            {/* The list stays left-aligned at every width — centred bullets
                with icons in front of them read as decoration, not points —
                but the block itself is centred on a phone so it sits under the
                heading rather than off to one side. */}
            <ul className="mx-auto mt-6 max-w-md space-y-3 lg:mx-0">
              {points.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.text} className="flex items-start gap-2.5 text-sm">
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-[var(--color-muted-foreground)]"
                      aria-hidden="true"
                    />
                    <span>{point.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="order-1 lg:order-2">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
              {children}
            </div>

            {/* Here rather than only behind the login. Someone signing in for
                the first time on a factory floor has no profile yet, so this is
                their only chance to get out of English before they have to read
                anything. */}
            <div className="mt-4 flex justify-center">
              <LanguageSwitcher locales={locales} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

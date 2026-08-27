import Link from 'next/link';
import { CalendarClock, CircleCheckBig, Smartphone } from 'lucide-react';

import { getAvailableLocales, getTranslations } from '@/lib/i18n/server';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';

/**
 * The page a prospect sees before anything else.
 *
 * Two audiences arrive here and they want opposite things. Someone evaluating
 * the product needs to know what it is; someone who works here needs to sign in
 * and get on with their shift. So the layout puts the form first in the reading
 * order and on small screens, and shows the explanation beside it on a wide one
 * — where an evaluator almost certainly is, and where a worker is not.
 *
 * The explanation is not hidden from phones, only moved below the form. Hiding
 * it would mean a prospect who opened the link on a phone learns nothing.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [locales, { t }] = await Promise.all([getAvailableLocales(), getTranslations()]);

  const points = [
    { icon: CalendarClock, text: t('auth.pitchPointSchedule') },
    { icon: CircleCheckBig, text: t('auth.pitchPointRecord') },
    { icon: Smartphone, text: t('auth.pitchPointPhone') },
  ];

  return (
    <div className="min-h-dvh px-4 py-10 sm:py-16">
      <div className="mx-auto grid w-full max-w-4xl gap-10 lg:grid-cols-[1fr_22rem] lg:items-center lg:gap-16">
        {/* Second on a phone, first on a wide screen — `order` rather than two
            copies of the markup, so the words exist once. */}
        <section className="order-2 lg:order-1">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
              <CircleCheckBig className="size-5" aria-hidden="true" />
            </span>
            <span className="text-xl font-semibold tracking-tight">Gidlist</span>
          </Link>

          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {t('auth.pitchTitle')}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            {t('auth.pitchBody')}
          </p>

          <ul className="mt-6 space-y-3">
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

          {/* Here rather than only behind the login. Someone signing in for the
              first time on a factory floor has no profile yet, so this is their
              only chance to get out of English before they have to read
              anything. */}
          <div className="mt-4 flex justify-center">
            <LanguageSwitcher locales={locales} />
          </div>
        </div>
      </div>
    </div>
  );
}

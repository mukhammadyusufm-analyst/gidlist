import Link from 'next/link';

import { getAvailableLocales } from '@/lib/i18n/server';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locales = await getAvailableLocales();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-lg font-semibold tracking-tight">
          Checklists
        </Link>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
          {children}
        </div>

        {/* The switcher belongs here, not only behind the login. Someone signing
            in for the first time on a factory floor has no profile yet, so this
            is their only chance to get out of English before they have to read
            anything. */}
        <div className="mt-6 flex justify-center">
          <LanguageSwitcher locales={locales} />
        </div>
      </div>
    </div>
  );
}

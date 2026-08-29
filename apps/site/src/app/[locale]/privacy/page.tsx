import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isBuiltinLocale } from '@/lib/i18n/locale';
import { getSiteMessages } from '@/lib/content';
import { LEGAL } from '@/lib/legal';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { LegalPage } from '@/components/legal-page';

/**
 * Fully static, and no `revalidate`.
 *
 * The home page revalidates because its copy is editable from the product's
 * admin screen. This text is not: it comes from `lib/legal.ts`, so it can only
 * change with a deploy, and a revalidation window would poll for a change that
 * cannot happen. Google also requires this URL to be reachable before it will
 * publish the OAuth consent screen, so it must not depend on a database being
 * up at request time.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isBuiltinLocale(locale)) return {};

  return { title: LEGAL[locale].privacy.title };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isBuiltinLocale(locale)) notFound();

  // Header and footer still need the editable copy — their navigation labels are
  // the same strings as everywhere else on the site.
  const m = await getSiteMessages(locale);

  return (
    <>
      <SiteHeader locale={locale} m={m} />
      <main>
        <LegalPage doc={LEGAL[locale].privacy} />
      </main>
      <SiteFooter locale={locale} m={m} />
    </>
  );
}

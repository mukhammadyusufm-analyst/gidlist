import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isBuiltinLocale } from '@/lib/i18n/locale';
import { getSiteMessages } from '@/lib/content';
import { LEGAL } from '@/lib/legal';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { LegalPage } from '@/components/legal-page';

/**
 * Static for the same reasons as the privacy page — see the note there. Added
 * for Lemon Squeezy's store review: a merchant of record wants the refund rule
 * published where a buyer can find it before paying.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isBuiltinLocale(locale)) return {};

  return { title: LEGAL[locale].refunds.title };
}

export default async function RefundsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isBuiltinLocale(locale)) notFound();

  const m = await getSiteMessages(locale);

  return (
    <>
      <SiteHeader locale={locale} m={m} />
      <main>
        <LegalPage doc={LEGAL[locale].refunds} />
      </main>
      <SiteFooter locale={locale} m={m} />
    </>
  );
}
